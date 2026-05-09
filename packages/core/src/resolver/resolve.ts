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
  Threshold,
} from '../types/spec.js';

export type ThresholdElevation = 'hc';

export interface ResolveInput {
  tokenPath: string;
  mode: string;
  intent: FormalIntent;
  ramp: GeneratedRamp;
  surfaceHex: string;
  surfaceRef: string;
  thresholdElevation?: ThresholdElevation;
  denseRamp?: GeneratedRamp;
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

/** The scalar used to compare “passing” and drive preference for this threshold kind. */
export function resolutionMetric(
  kind: ContrastKind,
  stepHex: string,
  surfaceHex: string,
): number {
  if (kind === 'wcag') {
    return getWcagContrast(stepHex, surfaceHex).ratio;
  }
  return absApcaLc(stepHex, surfaceHex);
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
  surfaceHex: string,
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
  surfaceHex: string,
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
 */
export function pickStepMidpoint(
  ramp: GeneratedRamp,
  surfaceHex: string,
  threshold: Threshold,
  elevate?: ThresholdElevation,
): { index: number; ratio: number } | null {
  const lo = pickStepLowestPassing(ramp, surfaceHex, threshold, elevate);
  const hi = pickStepHighestContrast(ramp, surfaceHex, threshold, elevate);
  if (!lo || !hi) return null;
  const mid = Math.round((lo.index + hi.index) / 2);
  const step = ramp.steps[mid];
  if (!step) return null;
  return { index: mid, ratio: resolutionMetric(threshold.kind, step.hex, surfaceHex) };
}

/**
 * Among passing steps, pick the one whose **resolution metric** is closest
 * to the median of all passing-step metrics. Bias differs from `midpoint`:
 * favors whichever side of the ramp has more passing steps.
 */
export function pickStepMedianContrast(
  ramp: GeneratedRamp,
  surfaceHex: string,
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
 * target (AA → AAA, AA-nonText → AAA-nonText, etc.). Equivalent to
 * `lowest-passing` evaluated against `passThreshold(threshold, 'hc')`.
 * Stronger contrast guarantee than `lowest-passing` without going all the
 * way to `highest-contrast`. Honors the elevated bar regardless of whether
 * the caller has already passed `elevate: 'hc'` (no double-elevation).
 */
export function pickStepLevelUp(
  ramp: GeneratedRamp,
  surfaceHex: string,
  threshold: Threshold,
): { index: number; ratio: number } | null {
  const kind = threshold.kind;
  const required = passThreshold(threshold, 'hc');
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
  surfaceHex: string,
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
  surfaceHex: string,
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
  surfaceHex: string,
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
  const kind = intent.threshold.kind;
  const pickStepCount = pickRamp.steps.length;
  const position = pickStepCount === 1 ? 0 : picked.index / (pickStepCount - 1);
  const nearestPrimitive = denseRamp
    ? `${ramp.scaleName}.${nearestPrimitiveName(ramp, position)}`
    : `${ramp.scaleName}.${step.name}`;

  const wcR = getWcagContrast(step.hex, surfaceHex).ratio;
  const apL = getApcaContrast(step.hex, surfaceHex);
  const resMetric = resolutionMetric(kind, step.hex, surfaceHex);
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

export function resolveToken(input: ResolveInput): ResolveResult {
  const { tokenPath, mode, intent, ramp, surfaceHex, surfaceRef, thresholdElevation, denseRamp } = input;

  if (intent.consistency !== 'independent') {
    throw new ResolveError(
      `consistency=${intent.consistency} is not independent; use driver group resolution (token ${tokenPath})`,
      tokenPath,
    );
  }

  const pickRamp = denseRamp ?? ramp;

  let picked: { index: number; ratio: number } | null;
  if (intent.preference === 'lowest-passing') {
    picked = pickStepLowestPassing(pickRamp, surfaceHex, intent.threshold, thresholdElevation);
  } else if (intent.preference === 'highest-contrast') {
    picked = pickStepHighestContrast(pickRamp, surfaceHex, intent.threshold, thresholdElevation);
  } else if (intent.preference === 'midpoint') {
    picked = pickStepMidpoint(pickRamp, surfaceHex, intent.threshold, thresholdElevation);
  } else if (intent.preference === 'median') {
    picked = pickStepMedianContrast(pickRamp, surfaceHex, intent.threshold, thresholdElevation);
  } else if (intent.preference === 'level-up') {
    picked = pickStepLevelUp(pickRamp, surfaceHex, intent.threshold);
  } else if (intent.preference === 'anchored') {
    const anchor = intent.constraints?.anchor;
    if (typeof anchor !== 'number' || !Number.isFinite(anchor)) {
      throw new ResolveError('anchored requires constraints.anchor (finite number)', tokenPath);
    }
    picked = pickStepAnchored(
      pickRamp,
      surfaceHex,
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
  let selectionNote: string | undefined;
  if (picked === null) {
    const required = passThreshold(intent.threshold, thresholdElevation);
    const fallback = pickStepTowardExtreme(pickRamp, surfaceHex, intent.threshold.kind, required);
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
