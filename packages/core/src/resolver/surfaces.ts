import { formatCss, parse, oklch as toOklch } from 'culori';
import { getWcagContrast } from '../math/contrast.js';
import type { GeneratedRamp, GeneratedStep } from '../types/palette.js';
import type {
  ComplianceReceipt,
  ContrastReceipt,
  FormalIntent,
  ReceiptSource,
  ResolvedToken,
  ResolvedValue,
} from '../types/spec.js';

export type SurfaceRole = 'main' | 'elevated' | 'subtle' | 'inverse';

export interface ResolveSurfaceInput {
  tokenPath: string;
  mode: string;
  scheme: 'light' | 'dark';
  role: SurfaceRole;
  ramp: GeneratedRamp;
  baselineHex: string;
  intent: FormalIntent;
}

function pickSurfaceStep(ramp: GeneratedRamp, scheme: 'light' | 'dark', role: SurfaceRole): GeneratedStep {
  const steps = ramp.steps;
  if (steps.length === 0) throw new Error(`ramp ${ramp.scaleName} has no steps`);
  const last = steps.length - 1;

  const lightIndex = (r: SurfaceRole): number => {
    switch (r) {
      case 'main': return 0;
      case 'elevated': return 0;
      case 'subtle': return 1;
      case 'inverse': return last;
    }
  };

  const darkIndex = (r: SurfaceRole): number => {
    switch (r) {
      case 'main': return last;
      case 'elevated': return Math.max(0, last - 1);
      case 'subtle': return last;
      case 'inverse': return 0;
    }
  };

  const idx = scheme === 'light' ? lightIndex(role) : darkIndex(role);
  const step = steps[idx];
  if (!step) throw new Error(`surface index ${idx} out of range for ${ramp.scaleName}`);
  return step;
}

export function buildSurfaceResolvedValue(step: GeneratedStep): ResolvedValue {
  const parsed = parse(step.hex);
  const o = parsed ? toOklch(parsed) : null;
  const oklchCss = o
    ? (formatCss({ mode: 'oklch', l: o.l ?? 0, c: o.c ?? 0, h: o.h ?? 0 }) ?? 'oklch(0 0 0)')
    : 'oklch(0 0 0)';
  return {
    oklch: oklchCss,
    hex: step.hex,
    ...(step.displayP3 ? { p3: step.displayP3 } : {}),
  };
}

export interface ResolveSurfaceResult {
  token: ResolvedToken;
  step: GeneratedStep;
}

export function resolveSurface(input: ResolveSurfaceInput): ResolveSurfaceResult {
  const { tokenPath, mode, scheme, role, ramp, baselineHex, intent } = input;
  const step = pickSurfaceStep(ramp, scheme, role);

  const stepCount = ramp.steps.length;
  const index = ramp.steps.findIndex((s) => s === step);
  const position = stepCount <= 1 ? 0 : index / (stepCount - 1);
  const nearestPrimitive = `color.primitive.${ramp.scaleName}.${step.name}`;

  const baselineRatio = getWcagContrast(step.hex, baselineHex).ratio;

  const contrast: ContrastReceipt = {
    againstBaseline: round2(baselineRatio),
  };

  const compliance: ComplianceReceipt = {
    level: 'exempt',
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
    resolvedAgainst: null,
    contrast,
    compliance,
    intent,
  };

  return { token, step };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
