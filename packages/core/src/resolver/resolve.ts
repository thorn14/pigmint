import { formatCss, parse, oklch as toOklch } from 'culori';
import { getWcagContrast, getApcaContrast } from '../math/contrast.js';
import type { GeneratedRamp, GeneratedStep } from '../types/palette.js';
import type {
  ComplianceLevel,
  ComplianceReceipt,
  ContrastKind,
  ContrastReceipt,
  FormalIntent,
  ReceiptSource,
  ResolvedToken,
  ResolvedValue,
  SurfaceContrast,
  Threshold,
} from '../types/spec.js';

export type ThresholdElevation = 'hc';

export interface ResolveInput {
  tokenPath: string;
  mode: string;
  intent: FormalIntent;
  ramp: GeneratedRamp;
  /** Surface the receipt records (`resolvedAgainst`) and the primary contrast is computed against. */
  surfaceHex: string;
  surfaceRef: string;
  /**
   * All surfaces this token is declared on (primary + additional), as hexes. The step is picked to
   * pass against the worst-case (lowest contrast) of these, so it satisfies every surface. Defaults
   * to `[surfaceHex]` when omitted.
   */
  contrastSurfaceHexes?: readonly string[];
  thresholdElevation?: ThresholdElevation;
  denseRamp?: GeneratedRamp;
  /** Decorative tokens skip the a11y floor, so preferred-contrast pins to the target. */
  exempt?: boolean;
}

export interface ResolveResult {
  token: ResolvedToken;
  step: GeneratedStep;
}

export class ResolveError extends Error {
  constructor(
    message: string,
    readonly tokenPath: string,
  ) {
    super(message);
    this.name = 'ResolveError';
  }
}

export function wcagThreshold(t: Threshold, elevate?: ThresholdElevation): number {
  if (t.kind !== 'wcag') {
    throw new Error(
      `internal: wcagThreshold with kind=${(t as Threshold).kind} (use passThreshold)`,
    );
  }
  // Spec/05 thresholds: AA-text 4.5, AAA-text 7, AA-nonText 3, AAA-nonText 4.5 (pigmint convention).
  const base = t.usage === 'text'
    ? (t.level === 'AAA' ? 7 : 4.5)
    : (t.level === 'AAA' ? 4.5 : 3);
  if (elevate === 'hc') {
    if (base === 3) return 4.5;
    if (base === 4.5) return 7;
  }
  return base;
}

/**
 * Minimum absolute Lc to clear the level for APCA. Convention (OQ-12, bridge from WCAG tiers):
 * - AA text: Lc 60, AAA text: 90, AA nonText: 45, AAA nonText: 60.
 * HC elevation moves each band one step up in the nontext ladder, and nudges text toward stricter.
 */
export function apcaThreshold(t: Threshold, elevate?: ThresholdElevation): number {
  if (t.kind !== 'apca') {
    throw new Error(`internal: apcaThreshold with kind=${(t as Threshold).kind}`);
  }
  const baseText = t.level === 'AAA' ? 90 : 60;
  const baseNon = t.level === 'AAA' ? 60 : 45;
  let base = t.usage === 'text' ? baseText : baseNon;
  if (elevate === 'hc') {
    if (t.usage === 'text') {
      if (base === 60) base = 75;
      else if (base === 90) base = 100;
    } else {
      if (base === 45) base = 60;
      else if (base === 60) base = 75;
    }
  }
  return base;
}

export function passThreshold(t: Threshold, elevate?: ThresholdElevation): number {
  if (t.kind === 'apca') {
    return apcaThreshold(t, elevate);
  }
  return wcagThreshold(t, elevate);
}

function absApcaLc(fg: string, bg: string): number {
  return Math.abs(getApcaContrast(fg, bg));
}

/**
 * The scalar used to compare “passing” and drive preference for this threshold kind.
 *
 * When `surface` is a list, returns the **minimum** metric across all surfaces — i.e. the
 * worst-case contrast for that step. Picking against this guarantees a step that "passes" also
 * passes on every declared surface (spec: a token must satisfy contrast on every surface it is
 * added to). A single surface (string) behaves exactly as before.
 */
export function resolutionMetric(
  kind: ContrastKind,
  stepHex: string,
  surface: string | readonly string[],
): number {
  const surfaces = typeof surface === 'string' ? [surface] : surface;
  let min = Infinity;
  for (const s of surfaces) {
    const m = kind === 'wcag' ? getWcagContrast(stepHex, s).ratio : absApcaLc(stepHex, s);
    if (m < min) min = m;
  }
  return min;
}

function complianceLevelWcag(t: Threshold, ratio: number): ComplianceLevel {
  if (t.usage === 'text') {
    if (ratio >= 7) return 'AAA-text';
    if (ratio >= 4.5) return 'AA-text';
    return 'fail';
  }
  if (ratio >= 3) return 'AA-nonText';
  return 'fail';
}

export function complianceForThreshold(
  t: Threshold,
  usedMetric: number,
  thresholdElevation?: ThresholdElevation,
): ComplianceLevel {
  if (t.kind === 'apca') {
    const required = passThreshold(t, thresholdElevation);
    return usedMetric + 1e-9 < required ? 'fail' : 'apca-pass';
  }
  return complianceLevelWcag(t, usedMetric);
}

function toOklchCss(hex: string): string {
  const parsed = parse(hex);
  if (!parsed) return 'oklch(0 0 0)';
  const o = toOklch(parsed);
  if (!o) return 'oklch(0 0 0)';
  return formatCss({ mode: 'oklch', l: o.l ?? 0, c: o.c ?? 0, h: o.h ?? 0 }) ?? 'oklch(0 0 0)';
}

export function pickStepLowestPassing(
  ramp: GeneratedRamp,
  surfaceHex: string | readonly string[],
  threshold: Threshold,
  elevate?: ThresholdElevation,
): { index: number; ratio: number } | null {
  const kind = threshold.kind;
  const required = passThreshold(threshold, elevate);
  let best: { index: number; ratio: number } | null = null;
  for (let i = 0; i < ramp.steps.length; i++) {
    const step = ramp.steps[i];
    if (!step) continue;
    const m = resolutionMetric(kind, step.hex, surfaceHex);
    if (m < required) continue;
    if (best === null || m < best.ratio) {
      best = { index: i, ratio: m };
    }
  }
  return best;
}

function pickStepHighestContrast(
  ramp: GeneratedRamp,
  surfaceHex: string | readonly string[],
  threshold: Threshold,
  elevate?: ThresholdElevation,
): { index: number; ratio: number } | null {
  const kind = threshold.kind;
  const required = passThreshold(threshold, elevate);
  let best: { index: number; ratio: number } | null = null;
  for (let i = 0; i < ramp.steps.length; i++) {
    const step = ramp.steps[i];
    if (!step) continue;
    const m = resolutionMetric(kind, step.hex, surfaceHex);
    if (m < required) continue;
    if (best === null || m > best.ratio) {
      best = { index: i, ratio: m };
    }
  }
  return best;
}

/**
 * Among passing steps, pick the one whose **index** is the rounded midpoint
 * between the lowest-passing and highest-contrast picks. Yields a step with
 * moderate contrast — well-suited to the "main" slot of a Light/Main/Dark
 * triplet (lowest-passing → light, midpoint → main, highest-contrast → dark).
 *
 * Non-monotonic ramps (rare under default curves, possible with imported
 * primitives) can leave the rounded midpoint on a non-passing step. When that
 * happens, fall back to whichever neighbour passes and is closest to the
 * midpoint index, so the returned step always meets the threshold.
 */
export function pickStepMidpoint(
  ramp: GeneratedRamp,
  surfaceHex: string | readonly string[],
  threshold: Threshold,
  elevate?: ThresholdElevation,
): { index: number; ratio: number } | null {
  const lo = pickStepLowestPassing(ramp, surfaceHex, threshold, elevate);
  const hi = pickStepHighestContrast(ramp, surfaceHex, threshold, elevate);
  if (!lo || !hi) return null;
  const kind = threshold.kind;
  const required = passThreshold(threshold, elevate);
  const mid = Math.round((lo.index + hi.index) / 2);
  const midStep = ramp.steps[mid];
  if (midStep) {
    const m = resolutionMetric(kind, midStep.hex, surfaceHex);
    if (m >= required) return { index: mid, ratio: m };
  }
  const lowIdx = Math.min(lo.index, hi.index);
  const highIdx = Math.max(lo.index, hi.index);
  let best: { index: number; ratio: number; dist: number } | null = null;
  for (let i = lowIdx; i <= highIdx; i++) {
    const step = ramp.steps[i];
    if (!step) continue;
    const m = resolutionMetric(kind, step.hex, surfaceHex);
    if (m < required) continue;
    const dist = Math.abs(i - mid);
    if (best === null || dist < best.dist || (dist === best.dist && i < best.index)) {
      best = { index: i, ratio: m, dist };
    }
  }
  return best ? { index: best.index, ratio: best.ratio } : null;
}

/**
 * Pick the step whose resolution metric is closest to `target`. Prefers steps
 * that meet the threshold; only falls back to a non-passing step when no
 * passing step exists. Mirrors the "preferred lightness" pinning concept:
 * a single target value (not a range) that biases the picker.
 */
export function pickStepPreferredContrast(
  ramp: GeneratedRamp,
  surfaceHex: string | readonly string[],
  threshold: Threshold,
  target: number,
  elevate?: ThresholdElevation,
  exempt = false,
): { index: number; ratio: number } | null {
  const kind = threshold.kind;
  // Decorative tokens skip the a11y check, so every step counts as "passing" and
  // the pick is simply the step closest to the target (no compliance floor).
  const required = exempt ? -Infinity : passThreshold(threshold, elevate);
  let bestPassing: { index: number; ratio: number; dist: number } | null = null;
  let bestAny: { index: number; ratio: number; dist: number } | null = null;
  for (let i = 0; i < ramp.steps.length; i++) {
    const step = ramp.steps[i];
    if (!step) continue;
    const m = resolutionMetric(kind, step.hex, surfaceHex);
    const dist = Math.abs(m - target);
    if (bestAny === null || dist < bestAny.dist) {
      bestAny = { index: i, ratio: m, dist };
    }
    if (m >= required) {
      if (bestPassing === null || dist < bestPassing.dist) {
        bestPassing = { index: i, ratio: m, dist };
      }
    }
  }
  const pick = bestPassing ?? bestAny;
  return pick ? { index: pick.index, ratio: pick.ratio } : null;
}

/**
 * Among passing steps, pick the one whose **resolution metric** is closest
 * to the median of all passing-step metrics. Bias differs from `midpoint`:
 * favors whichever side of the ramp has more passing steps.
 */
export function pickStepMedianContrast(
  ramp: GeneratedRamp,
  surfaceHex: string | readonly string[],
  threshold: Threshold,
  elevate?: ThresholdElevation,
): { index: number; ratio: number } | null {
  const kind = threshold.kind;
  const required = passThreshold(threshold, elevate);
  const passing: { index: number; ratio: number }[] = [];
  for (let i = 0; i < ramp.steps.length; i++) {
    const step = ramp.steps[i];
    if (!step) continue;
    const m = resolutionMetric(kind, step.hex, surfaceHex);
    if (m < required) continue;
    passing.push({ index: i, ratio: m });
  }
  if (passing.length === 0) return null;
  const sorted = [...passing].sort((a, b) => a.ratio - b.ratio);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}

/**
 * Lowest step that passes ONE compliance level higher than the configured
 * target (AA → AAA, AA-nonText → AAA-nonText, etc.). Stronger contrast
 * guarantee than `lowest-passing` without going all the way to
 * `highest-contrast`.
 *
 * The accepted `elevate` parameter is the caller's HC-mode elevation; the
 * picker uses whichever bar is stricter (level-up's `'hc'` vs the caller's
 * elevation). Today there's only one elevation tier so the two coincide when
 * the caller already passed `'hc'` — the resolver records a `selectionNote`
 * in that case so the receipt makes the no-op transparent.
 */
export function pickStepLevelUp(
  ramp: GeneratedRamp,
  surfaceHex: string | readonly string[],
  threshold: Threshold,
  elevate?: ThresholdElevation,
): { index: number; ratio: number } | null {
  const kind = threshold.kind;
  const required = Math.max(passThreshold(threshold, 'hc'), passThreshold(threshold, elevate));
  let best: { index: number; ratio: number } | null = null;
  for (let i = 0; i < ramp.steps.length; i++) {
    const step = ramp.steps[i];
    if (!step) continue;
    const m = resolutionMetric(kind, step.hex, surfaceHex);
    if (m < required) continue;
    if (best === null || m < best.ratio) {
      best = { index: i, ratio: m };
    }
  }
  return best;
}

/** Among passing steps, pick the one whose **resolution metric** is closest to `anchor` (same units: ratio or Lc). */
export function pickStepAnchored(
  pickRamp: GeneratedRamp,
  surfaceHex: string | readonly string[],
  threshold: Threshold,
  anchor: number,
  elevate?: ThresholdElevation,
): { index: number; ratio: number } | null {
  const kind = threshold.kind;
  const required = passThreshold(threshold, elevate);
  let best: { index: number; ratio: number; dist: number } | null = null;
  for (let i = 0; i < pickRamp.steps.length; i++) {
    const step = pickRamp.steps[i];
    if (!step) continue;
    const m = resolutionMetric(kind, step.hex, surfaceHex);
    if (m < required) continue;
    const dist = Math.abs(m - anchor);
    if (
      best === null ||
      dist < best.dist - 1e-9 ||
      (Math.abs(dist - best.dist) <= 1e-9 && i < best.index)
    ) {
      best = { index: i, ratio: m, dist };
    }
  }
  if (!best) return null;
  return { index: best.index, ratio: best.ratio };
}

/**
 * Fallback picker when no step passes the threshold. Walks from the end of the ramp that has the
 * highest contrast against `surfaceHex` (the "appropriate extreme" for this surface) inward toward
 * the midpoint, returning the step with the highest contrast found on that side.
 * Includes a `selectionNote` recording the direction walked, threshold required, and best achieved.
 */
export function pickStepTowardExtreme(
  pickRamp: GeneratedRamp,
  surfaceHex: string | readonly string[],
  kind: ContrastKind,
  requiredForNote: number,
): { index: number; ratio: number; selectionNote: string } | null {
  const steps = pickRamp.steps;
  if (steps.length === 0) return null;

  const firstStep = steps[0];
  const lastStep = steps[steps.length - 1];
  if (!firstStep || !lastStep) return null;

  const firstContrast = resolutionMetric(kind, firstStep.hex, surfaceHex);
  const lastContrast = resolutionMetric(kind, lastStep.hex, surfaceHex);
  const walkFromEnd = lastContrast >= firstContrast;

  let best: { index: number; ratio: number } | null = null;
  if (walkFromEnd) {
    for (let i = steps.length - 1; i >= 0; i--) {
      const step = steps[i];
      if (!step) continue;
      const m = resolutionMetric(kind, step.hex, surfaceHex);
      if (best === null || m > best.ratio) best = { index: i, ratio: m };
    }
  } else {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step) continue;
      const m = resolutionMetric(kind, step.hex, surfaceHex);
      if (best === null || m > best.ratio) best = { index: i, ratio: m };
    }
  }

  if (!best) return null;

  const direction = walkFromEnd ? 'darker extreme' : 'lighter extreme';
  const selectionNote =
    `fallback: walked toward ${direction}; required ${requiredForNote.toFixed(2)}, best achieved ${best.ratio.toFixed(2)}`;
  return { ...best, selectionNote };
}

export function indexAtNormalizedT(len: number, t: number): number {
  if (len <= 0) return 0;
  if (len === 1) return 0;
  const tt = Math.min(1, Math.max(0, t));
  return Math.max(0, Math.min(len - 1, Math.round(tt * (len - 1))));
}

/** @param required — pass result from `passThreshold` for the same `threshold.kind` */
export function pickStepAtNormalizedT(
  pickRamp: GeneratedRamp,
  surfaceHex: string | readonly string[],
  t: number,
  required: number,
  kind: ContrastKind,
): { index: number; ratio: number; step: GeneratedStep } | null {
  const i = indexAtNormalizedT(pickRamp.steps.length, t);
  const step = pickRamp.steps[i];
  if (!step) return null;
  const m = resolutionMetric(kind, step.hex, surfaceHex);
  if (m < required) return null;
  return { index: i, ratio: m, step };
}

/**
 * Build the WCAG + APCA contrast receipt and the compliance receipt for a color
 * (`stepHex`) against a surface (`surfaceHex`), given the token's formal intent.
 * Shared by the primary-surface resolution path and the per-surface recompute.
 */
export function buildContrastCompliance(
  intent: FormalIntent,
  stepHex: string,
  surfaceHex: string,
  thresholdElevation?: ThresholdElevation,
): { contrast: ContrastReceipt; compliance: ComplianceReceipt } {
  const kind = intent.threshold.kind;
  const wcR = getWcagContrast(stepHex, surfaceHex).ratio;
  const apL = getApcaContrast(stepHex, surfaceHex);
  const resMetric = resolutionMetric(kind, stepHex, surfaceHex);
  const contrast: ContrastReceipt = {
    wcag21: round2(wcR),
    apca: round2(apL),
  };

  const t = intent.threshold;
  const apcaRequired = t.kind === 'apca' ? passThreshold(t, thresholdElevation) : undefined;
  const compliance: ComplianceReceipt = {
    target: t.level,
    level: complianceForThreshold(t, resMetric, thresholdElevation),
    apcaLc:
      t.kind === 'apca' && apcaRequired != null
        ? { achieved: resMetric, required: apcaRequired }
        : undefined,
    thresholds:
      t.kind === 'apca'
        ? t.usage === 'text'
          ? { text: apcaThreshold(t, thresholdElevation) }
          : { nonText: apcaThreshold(t, thresholdElevation) }
        : t.usage === 'text'
          ? { text: wcagThreshold(t, thresholdElevation) }
          : { nonText: wcagThreshold(t, thresholdElevation) },
  };

  return { contrast, compliance };
}

/**
 * Recompute contrast + compliance of an already-resolved color (`hex`) against every
 * surface the token is declared on. The step was picked against the primary surface, but
 * the same color can be displayed on additional surfaces — this records the actual
 * contrast/compliance per surface so the UI doesn't reuse the primary value everywhere.
 * Decorative tokens skip the a11y floor, so their per-surface level is forced to `'exempt'`.
 */
export function computeContrastBySurface(
  intent: FormalIntent,
  hex: string,
  surfaces: { ref: string; hex: string }[],
  thresholdElevation?: ThresholdElevation,
  exempt = false,
): SurfaceContrast[] {
  return surfaces.map(({ ref, hex: surfaceHex }) => {
    const { contrast, compliance } = buildContrastCompliance(
      intent,
      hex,
      surfaceHex,
      thresholdElevation,
    );
    return {
      surface: ref,
      contrast,
      compliance: exempt ? { ...compliance, level: 'exempt' } : compliance,
    };
  });
}

export function makeResolveResultFromPicked(
  tokenPath: string,
  mode: string,
  intent: FormalIntent,
  ramp: GeneratedRamp,
  denseRamp: GeneratedRamp | undefined,
  surfaceRef: string,
  surfaceHex: string,
  pickRamp: GeneratedRamp,
  picked: { index: number; ratio: number },
  step: GeneratedStep,
  thresholdElevation?: ThresholdElevation,
  selectionNote?: string,
): ResolveResult {
  const pickStepCount = pickRamp.steps.length;
  const position = pickStepCount === 1 ? 0 : picked.index / (pickStepCount - 1);
  const nearestPrimitive = denseRamp
    ? `${ramp.scaleName}.${nearestPrimitiveName(ramp, position)}`
    : `${ramp.scaleName}.${step.name}`;

  const { contrast, compliance } = buildContrastCompliance(
    intent,
    step.hex,
    surfaceHex,
    thresholdElevation,
  );

  const source: ReceiptSource = {
    ramp: ramp.scaleName,
    position,
    nearestPrimitive,
    ...(selectionNote ? { selectionNote } : {}),
  };

  const token: ResolvedToken = {
    path: tokenPath,
    mode,
    oklch: step.oklch,
    hex: step.hex,
    gamut: step.gamut,
    source,
    resolvedAgainst: surfaceRef,
    contrast,
    compliance,
    intent,
  };

  return { token, step };
}

export interface ResolvePinnedStepInput {
  tokenPath: string;
  mode: string;
  intent: FormalIntent;
  ramp: GeneratedRamp;
  stepIndex: number;
  surfaceHex: string;
  surfaceRef: string;
  thresholdElevation?: ThresholdElevation;
}

/**
 * `pin-to-step` resolution: the author has chosen an exact ramp step (per scheme),
 * so we skip contrast-driven step picking and emit that step directly. The full
 * contrast + compliance receipt is still computed against the surface (via
 * `makeResolveResultFromPicked`) so the UI can flag a failing pin; the driver applies
 * decorative exemption afterwards when the token opts out of the a11y floor.
 */
export function resolvePinnedStep(input: ResolvePinnedStepInput): ResolveResult {
  const { tokenPath, mode, intent, ramp, stepIndex, surfaceHex, surfaceRef, thresholdElevation } = input;
  const steps = ramp.steps;
  if (steps.length === 0) {
    throw new ResolveError(`ramp "${ramp.scaleName}" has no steps`, tokenPath);
  }
  const clamped = Math.max(0, Math.min(stepIndex, steps.length - 1));
  const step = steps[clamped];
  if (!step) {
    throw new ResolveError(`ramp step index ${clamped} missing`, tokenPath);
  }
  const ratio = resolutionMetric(intent.threshold.kind, step.hex, surfaceHex);
  return makeResolveResultFromPicked(
    tokenPath,
    mode,
    intent,
    ramp,
    undefined,
    surfaceRef,
    surfaceHex,
    ramp,
    { index: clamped, ratio },
    step,
    thresholdElevation,
    'pinned to step',
  );
}

export function resolveToken(input: ResolveInput): ResolveResult {
  const { tokenPath, mode, intent, ramp, surfaceHex, surfaceRef, contrastSurfaceHexes, thresholdElevation, denseRamp, exempt } = input;

  if (intent.consistency !== 'independent') {
    throw new ResolveError(
      `consistency=${intent.consistency} is not independent; use driver group resolution (token ${tokenPath})`,
      tokenPath,
    );
  }

  const pickRamp = denseRamp ?? ramp;
  // Pick the step against every declared surface (worst-case), so it passes on all of them.
  // The receipt still records `surfaceHex` (the primary surface) via makeResolveResultFromPicked.
  const pickSurfaces: string | readonly string[] =
    contrastSurfaceHexes && contrastSurfaceHexes.length > 0 ? contrastSurfaceHexes : surfaceHex;

  let picked: { index: number; ratio: number } | null;
  let selectionNote: string | undefined;
  if (intent.preference === 'lowest-passing') {
    picked = pickStepLowestPassing(pickRamp, pickSurfaces, intent.threshold, thresholdElevation);
  } else if (intent.preference === 'highest-contrast') {
    picked = pickStepHighestContrast(pickRamp, pickSurfaces, intent.threshold, thresholdElevation);
  } else if (intent.preference === 'midpoint') {
    picked = pickStepMidpoint(pickRamp, pickSurfaces, intent.threshold, thresholdElevation);
  } else if (intent.preference === 'median') {
    picked = pickStepMedianContrast(pickRamp, pickSurfaces, intent.threshold, thresholdElevation);
  } else if (intent.preference === 'level-up') {
    picked = pickStepLevelUp(pickRamp, pickSurfaces, intent.threshold, thresholdElevation);
    if (picked && thresholdElevation === 'hc') {
      // HC mode already raised the bar to level-up's target — record so the
      // receipt makes the no-op transparent (otherwise the pick is identical
      // to lowest-passing under the same elevation).
      selectionNote = 'level-up: HC mode already at elevated bar; pick coincides with lowest-passing';
    }
  } else if (intent.preference === 'preferred-contrast') {
    const target = intent.constraints?.targetContrast;
    if (typeof target !== 'number' || !Number.isFinite(target)) {
      throw new ResolveError(
        'preferred-contrast requires constraints.targetContrast (finite number)',
        tokenPath,
      );
    }
    picked = pickStepPreferredContrast(pickRamp, pickSurfaces, intent.threshold, target, thresholdElevation, exempt);
  } else if (intent.preference === 'anchored') {
    const anchor = intent.constraints?.anchor;
    if (typeof anchor !== 'number' || !Number.isFinite(anchor)) {
      throw new ResolveError('anchored requires constraints.anchor (finite number)', tokenPath);
    }
    picked = pickStepAnchored(
      pickRamp,
      pickSurfaces,
      intent.threshold,
      anchor,
      thresholdElevation,
    );
  } else {
    throw new ResolveError(
      `preference=${intent.preference} must be resolved via group driver (matched-to-set) or is unsupported here`,
      tokenPath,
    );
  }
  if (picked === null) {
    const required = passThreshold(intent.threshold, thresholdElevation);
    const fallback = pickStepTowardExtreme(pickRamp, pickSurfaces, intent.threshold.kind, required);
    if (!fallback) {
      throw new ResolveError(
        `no ramp step in "${ramp.scaleName}" meets threshold against surface ${surfaceHex}`,
        tokenPath,
      );
    }
    picked = fallback;
    selectionNote = fallback.selectionNote;
  }

  const step = pickRamp.steps[picked.index];
  if (!step) {
    throw new ResolveError(`ramp step index ${picked.index} missing`, tokenPath);
  }

  return makeResolveResultFromPicked(
    tokenPath,
    mode,
    intent,
    ramp,
    denseRamp,
    surfaceRef,
    surfaceHex,
    pickRamp,
    picked,
    step,
    thresholdElevation,
    selectionNote,
  );
}

export function buildResolvedValue(step: GeneratedStep): ResolvedValue {
  const { l, c, h, alpha } = step.oklch;
  const oklch =
    formatCss({ mode: 'oklch', l, c, h, ...(alpha != null ? { alpha } : {}) }) ??
    toOklchCss(step.hex);
  return {
    oklch,
    hex: step.hex,
    ...(step.displayP3 ? { p3: step.displayP3 } : {}),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function nearestPrimitiveName(ramp: GeneratedRamp, position: number): string {
  const n = ramp.steps.length;
  if (n === 0) return String(position);
  if (n === 1) return ramp.steps[0]?.name ?? '0';
  const idx = Math.round(position * (n - 1));
  const clamped = Math.max(0, Math.min(n - 1, idx));
  return ramp.steps[clamped]?.name ?? String(clamped);
}
