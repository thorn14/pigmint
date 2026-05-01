import type { GeneratedRamp, GeneratedStep } from '../types/palette.js';
import type { FormalIntent, ResolvedToken, VocabularyEntry } from '../types/spec.js';
import { DriverError } from './errors.js';
import {
  makeResolveResultFromPicked,
  passThreshold,
  pickStepAnchored,
  pickStepAtNormalizedT,
  pickStepLowestPassing,
  pickStepTowardExtreme,
  resolveToken,
  type ThresholdElevation,
} from './resolve.js';

export interface GroupBinding {
  mode: string;
  thresholdElevation?: ThresholdElevation;
}

export interface NonSurfaceContext {
  entry: VocabularyEntry;
  ramp: GeneratedRamp;
  pickRamp: GeneratedRamp;
  denseRamp: GeneratedRamp | undefined;
  surfaceHex: string;
  surfaceRef: string;
}

function mean(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

function variance(numbers: number[]): number {
  if (numbers.length < 2) return 0;
  const m = mean(numbers);
  return numbers.reduce((a, b) => a + (b - m) ** 2, 0) / numbers.length;
}

const SCAN_SAMPLES = 201;
const EPS = 1e-8;
const MATCHED_TO_SET_MAX_ITER = 8;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = values.slice().sort((a, b) => a - b);
  const mid = s.length >>> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * Synchronized t ∈ [0,1] on each pick ramp, minimize contrast variance, tie-break by preference.
 */
export function resolveMatchedAcrossRamps(
  intent: FormalIntent,
  members: NonSurfaceContext[],
  binding: GroupBinding,
): ResolvedToken[] {
  if (members.length === 0) return [];
  if (members.length === 1) {
    const m0 = members[0]!;
    // matched-to-set with a single member uses resolveMatchedToSet so the
    // directional-extreme fallback applies in HC mode, same as multi-member groups.
    if (intent.preference === 'matched-to-set') {
      return resolveMatchedToSet(intent, members, binding);
    }
    return [
      resolveToken({
        tokenPath: m0.entry.path,
        mode: binding.mode,
        intent: { ...intent, consistency: 'independent' as const },
        ramp: m0.ramp,
        surfaceHex: m0.surfaceHex,
        surfaceRef: m0.surfaceRef,
        thresholdElevation: binding.thresholdElevation,
        ...(m0.denseRamp ? { denseRamp: m0.denseRamp } : {}),
      }).token,
    ];
  }

  const pref = intent.preference;
  if (pref === 'anchored' || intent.consistency !== 'matched-across-ramps') {
    throw new DriverError('resolveMatchedAcrossRamps: invalid intent (internal)');
  }

  if (pref === 'matched-to-set') {
    return resolveMatchedToSet(intent, members, binding);
  }

  const th = intent.threshold;
  const req = passThreshold(th, binding.thresholdElevation);
  const kind = th.kind;

  let bestT: number | null = null;
  let bestVar = Infinity;
  let bestSecondary = Infinity;

  for (let s = 0; s < SCAN_SAMPLES; s++) {
    const t = s / (SCAN_SAMPLES - 1);
    const ratios: number[] = [];
    let ok = true;
    for (const m of members) {
      const got = pickStepAtNormalizedT(m.pickRamp, m.surfaceHex, t, req, kind);
      if (!got) {
        ok = false;
        break;
      }
      ratios.push(got.ratio);
    }
    if (!ok) continue;

    const v = variance(ratios);
    let secondary: number;
    if (pref === 'highest-contrast') {
      secondary = -Math.min(...ratios);
    } else if (pref === 'lowest-passing') {
      secondary = Math.max(...ratios);
    } else {
      throw new DriverError('resolveMatchedAcrossRamps: unexpected preference');
    }

    if (
      v < bestVar - EPS ||
      (Math.abs(v - bestVar) <= EPS && secondary < bestSecondary - EPS) ||
      (Math.abs(v - bestVar) <= EPS &&
        Math.abs(secondary - bestSecondary) <= EPS &&
        (bestT === null || t < bestT - EPS))
    ) {
      bestT = t;
      bestVar = v;
      bestSecondary = secondary;
    }
  }

  if (bestT === null) {
    const paths = members.map((m) => m.entry.path).join(', ');
    throw new DriverError(
      `matched-across-ramps: no synchronized position passes threshold for [${paths}] in mode ${binding.mode}`,
    );
  }

  const out: ResolvedToken[] = [];
  for (const m of members) {
    const g = pickStepAtNormalizedT(m.pickRamp, m.surfaceHex, bestT, req, kind);
    if (!g) {
      throw new DriverError('matched-across-ramps: internal pick at bestT failed');
    }
    out.push(
      makeResolveResultFromPicked(
        m.entry.path,
        binding.mode,
        intent,
        m.ramp,
        m.denseRamp,
        m.surfaceRef,
        m.surfaceHex,
        m.pickRamp,
        { index: g.index, ratio: g.ratio },
        g.step,
        binding.thresholdElevation,
      ).token,
    );
  }
  return out;
}

/**
 * Spec/05 matched-to-set: each member picks the step whose contrast is closest
 * to the median of the set's contrasts. Solved as a fixed-point iteration —
 * seed each member with `lowest-passing`, take the median, re-pick everyone
 * closest to that median, repeat until indices stabilize. Each member stays
 * on its own ramp at its own position, so disparate-luminosity ramps no
 * longer collapse to extremes the way a sync'd-t variance scan would.
 */
export function resolveMatchedToSet(
  intent: FormalIntent,
  members: NonSurfaceContext[],
  binding: GroupBinding,
): ResolvedToken[] {
  if (members.length === 0) return [];
  if (intent.preference !== 'matched-to-set' || intent.consistency !== 'matched-across-ramps') {
    throw new DriverError('resolveMatchedToSet: invalid intent (internal)');
  }

  const th = intent.threshold;
  const elevate = binding.thresholdElevation;
  const required = passThreshold(th, elevate);

  type Pick = { index: number; ratio: number; selectionNote?: string };

  const seeds: (Pick | null)[] = members.map((m) => {
    const passing = pickStepLowestPassing(m.pickRamp, m.surfaceHex, th, elevate);
    if (passing !== null) return passing;
    // No step meets the (potentially HC-elevated) threshold — walk toward the appropriate extreme.
    return pickStepTowardExtreme(m.pickRamp, m.surfaceHex, th.kind, required);
  });

  const emptyRamps = members
    .map((m, i) => (seeds[i] === null ? m.entry.path : null))
    .filter((p): p is string => p !== null);
  if (emptyRamps.length > 0) {
    throw new DriverError(
      `matched-to-set: members [${emptyRamps.join(', ')}] have no steps at all in mode ${binding.mode}`,
    );
  }

  let picks = seeds as Pick[];
  let lastTarget = Number.NaN;
  for (let iter = 0; iter < MATCHED_TO_SET_MAX_ITER; iter++) {
    const target = median(picks.map((p) => p.ratio));
    const next: Pick[] = [];
    for (const m of members) {
      const got: Pick | null =
        pickStepAnchored(m.pickRamp, m.surfaceHex, th, target, elevate) ??
        pickStepTowardExtreme(m.pickRamp, m.surfaceHex, th.kind, required);
      if (!got) {
        throw new DriverError('matched-to-set: anchored pick unexpectedly failed');
      }
      next.push(got);
    }
    const stable = next.every((p, i) => p.index === picks[i]!.index);
    picks = next;
    if (stable) break;
    if (Math.abs(target - lastTarget) <= EPS) break;
    lastTarget = target;
  }

  const out: ResolvedToken[] = [];
  for (let i = 0; i < members.length; i++) {
    const m = members[i]!;
    const p = picks[i]!;
    const step = m.pickRamp.steps[p.index]!;
    out.push(
      makeResolveResultFromPicked(
        m.entry.path,
        binding.mode,
        intent,
        m.ramp,
        m.denseRamp,
        m.surfaceRef,
        m.surfaceHex,
        m.pickRamp,
        p,
        step,
        elevate,
        p.selectionNote,
      ).token,
    );
  }
  return out;
}

function referenceResolutionIntent(base: FormalIntent): FormalIntent {
  if (base.preference === 'highest-contrast') {
    return { ...base, consistency: 'independent' };
  }
  if (base.preference === 'lowest-passing') {
    return { ...base, consistency: 'independent' };
  }
  if (base.preference === 'matched-to-set') {
    return { ...base, preference: 'lowest-passing', consistency: 'independent' };
  }
  if (base.preference === 'anchored') {
    return { ...base, preference: 'lowest-passing', consistency: 'independent' };
  }
  throw new DriverError('anchored-to-reference: unsupported reference preference');
}

/**
 * First token on `constraints.referenceRamp` defines the target resolution metric; others match it.
 */
export function resolveAnchoredToReference(
  intent: FormalIntent,
  members: NonSurfaceContext[],
  binding: GroupBinding,
  tokenRamp: Record<string, string>,
): ResolvedToken[] {
  const refName = intent.constraints?.referenceRamp;
  if (!refName) {
    throw new DriverError('resolveAnchoredToReference: missing referenceRamp');
  }

  const ordered = members.slice().sort((a, b) => a.entry.path.localeCompare(b.entry.path));
  const refMem = ordered.find((m) => tokenRamp[m.entry.path] === refName);
  if (!refMem) {
    throw new DriverError(
      `anchored-to-reference: no token maps to reference ramp "${refName}" in this group`,
    );
  }

  const synth = referenceResolutionIntent({ ...intent, constraints: { ...intent.constraints } });
  const { token: refTok } = resolveToken({
    tokenPath: refMem.entry.path,
    mode: binding.mode,
    intent: synth,
    ramp: refMem.ramp,
    surfaceHex: refMem.surfaceHex,
    surfaceRef: refMem.surfaceRef,
    thresholdElevation: binding.thresholdElevation,
    ...(refMem.denseRamp ? { denseRamp: refMem.denseRamp } : {}),
  });
  const k = refTok.intent.threshold.kind;
  const target =
    k === 'apca'
      ? Math.abs(refTok.contrast?.apca ?? 0)
      : refTok.contrast?.wcag21;
  if (target == null || !Number.isFinite(target)) {
    throw new DriverError('anchored-to-reference: reference token has no contrast metric');
  }

  const byPath: Map<string, ResolvedToken> = new Map();
  for (const m of ordered) {
    if (m.entry.path === refMem.entry.path) {
      byPath.set(m.entry.path, { ...refTok, path: m.entry.path, intent });
      continue;
    }
    const picked = pickStepAnchored(
      m.pickRamp,
      m.surfaceHex,
      intent.threshold,
      target,
      binding.thresholdElevation,
    );
    if (picked === null) {
      throw new DriverError(
        `anchored-to-reference: cannot match target ${target} for ${m.entry.path} on ${m.ramp.scaleName} in ${binding.mode}`,
      );
    }
    const step: GeneratedStep = m.pickRamp.steps[picked.index]!;
    byPath.set(
      m.entry.path,
      makeResolveResultFromPicked(
        m.entry.path,
        binding.mode,
        intent,
        m.ramp,
        m.denseRamp,
        m.surfaceRef,
        m.surfaceHex,
        m.pickRamp,
        picked,
        step,
        binding.thresholdElevation,
      ).token,
    );
  }
  return members.map((m) => {
    const t = byPath.get(m.entry.path);
    if (!t) throw new DriverError('anchored-to-reference: internal path mismatch');
    return t;
  });
}
