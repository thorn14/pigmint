import type { GeneratedRamp, GeneratedStep } from '../types/palette.js';
import type { FormalIntent, ResolvedToken, VocabularyEntry } from '../types/spec.js';
import { DriverError } from './errors.js';
import {
  makeResolveResultFromPicked,
  passThreshold,
  pickStepAnchored,
  pickStepAtNormalizedT,
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
    return [
      resolveToken({
        tokenPath: m0.entry.path,
        mode: binding.mode,
        intent: { ...intent, consistency: 'independent' },
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
    } else if (pref === 'lowest-passing' || pref === 'matched-to-set') {
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
