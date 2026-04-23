import { formatCss, parse, oklch as toOklch } from 'culori';
import { getWcagContrast, getApcaContrast } from '../math/contrast.js';
import type { GeneratedRamp, GeneratedStep } from '../types/palette.js';
import type {
  ComplianceLevel,
  ComplianceReceipt,
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

function wcagThreshold(t: Threshold, elevate?: ThresholdElevation): number {
  if (t.kind !== 'wcag') {
    throw new Error(`APCA threshold not yet supported (got kind=${t.kind})`);
  }
  const base = t.usage === 'text' ? (t.level === 'AAA' ? 7 : 4.5) : 3;
  if (elevate === 'hc') {
    if (base === 3) return 4.5;
    if (base === 4.5) return 7;
  }
  return base;
}

function complianceLevelFor(t: Threshold, ratio: number): ComplianceLevel {
  if (t.usage === 'text') {
    if (ratio >= 7) return 'AAA-text';
    if (ratio >= 4.5) return 'AA-text';
    return 'fail';
  }
  if (ratio >= 3) return 'AA-nonText';
  return 'fail';
}

function toOklchCss(hex: string): string {
  const parsed = parse(hex);
  if (!parsed) return 'oklch(0 0 0)';
  const o = toOklch(parsed);
  if (!o) return 'oklch(0 0 0)';
  return formatCss({ mode: 'oklch', l: o.l ?? 0, c: o.c ?? 0, h: o.h ?? 0 }) ?? 'oklch(0 0 0)';
}

function pickStepLowestPassing(
  ramp: GeneratedRamp,
  surfaceHex: string,
  threshold: Threshold,
  elevate?: ThresholdElevation,
): { index: number; ratio: number } | null {
  const required = wcagThreshold(threshold, elevate);
  let best: { index: number; ratio: number } | null = null;
  for (let i = 0; i < ramp.steps.length; i++) {
    const step = ramp.steps[i];
    if (!step) continue;
    const { ratio } = getWcagContrast(step.hex, surfaceHex);
    if (ratio < required) continue;
    if (best === null || ratio < best.ratio) {
      best = { index: i, ratio };
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
  const required = wcagThreshold(threshold, elevate);
  let best: { index: number; ratio: number } | null = null;
  for (let i = 0; i < ramp.steps.length; i++) {
    const step = ramp.steps[i];
    if (!step) continue;
    const { ratio } = getWcagContrast(step.hex, surfaceHex);
    if (ratio < required) continue;
    if (best === null || ratio > best.ratio) {
      best = { index: i, ratio };
    }
  }
  return best;
}

export function resolveToken(input: ResolveInput): ResolveResult {
  const { tokenPath, mode, intent, ramp, surfaceHex, surfaceRef, thresholdElevation, denseRamp } = input;

  if (intent.consistency !== 'independent') {
    throw new ResolveError(
      `consistency=${intent.consistency} not yet implemented (slice supports independent only)`,
      tokenPath,
    );
  }

  const pickRamp = denseRamp ?? ramp;

  let picked: { index: number; ratio: number } | null;
  if (intent.preference === 'lowest-passing') {
    picked = pickStepLowestPassing(pickRamp, surfaceHex, intent.threshold, thresholdElevation);
  } else if (intent.preference === 'highest-contrast') {
    picked = pickStepHighestContrast(pickRamp, surfaceHex, intent.threshold, thresholdElevation);
  } else {
    throw new ResolveError(
      `preference=${intent.preference} not yet implemented (slice supports lowest-passing and highest-contrast)`,
      tokenPath,
    );
  }
  if (picked === null) {
    throw new ResolveError(
      `no ramp step in "${ramp.scaleName}" meets threshold against surface ${surfaceHex}`,
      tokenPath,
    );
  }

  const step = pickRamp.steps[picked.index];
  if (!step) {
    throw new ResolveError(`ramp step index ${picked.index} missing`, tokenPath);
  }

  const pickStepCount = pickRamp.steps.length;
  const position = pickStepCount === 1 ? 0 : picked.index / (pickStepCount - 1);
  const nearestPrimitive = denseRamp
    ? `${ramp.scaleName}.${nearestPrimitiveName(ramp, position)}`
    : `${ramp.scaleName}.${step.name}`;

  const contrast: ContrastReceipt = {
    wcag21: round2(picked.ratio),
    apca: round2(getApcaContrast(step.hex, surfaceHex)),
  };

  const compliance: ComplianceReceipt = {
    target: intent.threshold.level,
    level: complianceLevelFor(intent.threshold, picked.ratio),
    thresholds:
      intent.threshold.usage === 'text'
        ? { text: wcagThreshold(intent.threshold, thresholdElevation) }
        : { nonText: wcagThreshold(intent.threshold, thresholdElevation) },
  };

  const source: ReceiptSource = {
    ramp: ramp.scaleName,
    position,
    nearestPrimitive,
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

export function buildResolvedValue(step: GeneratedStep): ResolvedValue {
  return {
    oklch: toOklchCss(step.hex),
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
