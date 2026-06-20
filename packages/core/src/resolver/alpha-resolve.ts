import { getWcagContrast, getApcaContrast } from '../math/contrast.js';
import { alphaCompositeHex } from '../math/composite.js';
import type { GeneratedRamp, GeneratedStep } from '../types/palette.js';
import type {
  AlphaModifier,
  AlphaReceipt,
  FormalIntent,
  ResolvedToken,
  Usage,
} from '../types/spec.js';
import {
  passThreshold,
  resolutionMetric,
  complianceForThreshold,
  wcagThreshold,
  apcaThreshold,
} from './resolve.js';

export interface AlphaResolveInput {
  tokenPath: string;
  mode: string;
  usage: Usage;
  modifier: AlphaModifier;
  /** Ramp to walk for path 1 (fixed alpha, resolve step). */
  ramp: GeneratedRamp;
  /** Hex of the reference surface to composite against. */
  referenceSurfaceHex: string;
  /** Canonical path of the reference surface (recorded in the receipt). */
  referenceSurfacePath: string;
  /** For non-decorative tokens: hex of the surface to contrast against. */
  surfaceHex?: string;
  /** For non-decorative tokens: canonical path of the contrast surface. */
  surfaceRef?: string;
  /** Decorative tokens skip the a11y floor, so step selection ignores `passThreshold`. */
  exempt?: boolean;
}

export interface AlphaResolveResult {
  token: ResolvedToken;
  step: GeneratedStep;
}

const FALLBACK_INTENT: FormalIntent = {
  threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
  preference: 'lowest-passing',
  consistency: 'independent',
  surfaceContext: 'primary',
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function makeAlphaReceipt(
  alphaValue: number,
  referenceSurfacePath: string,
  compositedHex: string,
): AlphaReceipt {
  return {
    alphaValue,
    referenceSurface: referenceSurfacePath,
    composited: { hex: compositedHex, against: referenceSurfacePath },
  };
}

/**
 * Path 1: fixed alpha, resolve step.
 * Walks the ramp, composites each step at `alpha` over `referenceSurfaceHex`, and picks
 * the step whose composited result best satisfies `intent` against `surfaceHex`.
 */
function resolveFixedAlpha(
  tokenPath: string,
  mode: string,
  intent: FormalIntent,
  ramp: GeneratedRamp,
  alpha: number,
  referenceSurfaceHex: string,
  referenceSurfacePath: string,
  surfaceHex: string,
  surfaceRef: string,
  exempt = false,
): AlphaResolveResult {
  const { threshold } = intent;
  // Decorative tokens skip the a11y check, so every step counts as "passing" and
  // preferred-contrast pins to the target rather than the lowest compliant step.
  const required = exempt ? -Infinity : passThreshold(threshold);

  let best: { index: number; metric: number } | null = null;

  if (intent.preference === 'lowest-passing') {
    for (let i = 0; i < ramp.steps.length; i++) {
      const step = ramp.steps[i];
      if (!step) continue;
      const composited = alphaCompositeHex(step.hex, alpha, referenceSurfaceHex);
      const m = resolutionMetric(threshold.kind, composited, surfaceHex);
      if (m < required) continue;
      if (best === null || m < best.metric) best = { index: i, metric: m };
    }
  } else if (intent.preference === 'highest-contrast') {
    for (let i = 0; i < ramp.steps.length; i++) {
      const step = ramp.steps[i];
      if (!step) continue;
      const composited = alphaCompositeHex(step.hex, alpha, referenceSurfaceHex);
      const m = resolutionMetric(threshold.kind, composited, surfaceHex);
      if (m < required) continue;
      if (best === null || m > best.metric) best = { index: i, metric: m };
    }
  } else if (intent.preference === 'preferred-contrast') {
    const target = intent.constraints?.targetContrast;
    if (typeof target !== 'number' || !Number.isFinite(target)) {
      throw new Error(
        `alpha token "${tokenPath}": preferred-contrast requires constraints.targetContrast`,
      );
    }
    let bestPassing: { index: number; metric: number; dist: number } | null = null;
    let bestAny: { index: number; metric: number; dist: number } | null = null;
    for (let i = 0; i < ramp.steps.length; i++) {
      const step = ramp.steps[i];
      if (!step) continue;
      const composited = alphaCompositeHex(step.hex, alpha, referenceSurfaceHex);
      const m = resolutionMetric(threshold.kind, composited, surfaceHex);
      const dist = Math.abs(m - target);
      if (bestAny === null || dist < bestAny.dist) bestAny = { index: i, metric: m, dist };
      if (m >= required && (bestPassing === null || dist < bestPassing.dist)) {
        bestPassing = { index: i, metric: m, dist };
      }
    }
    const pick = bestPassing ?? bestAny;
    if (pick) best = { index: pick.index, metric: pick.metric };
  } else {
    // anchored or matched-to-set: not yet supported for alpha tokens; fall back to lowest-passing
    for (let i = 0; i < ramp.steps.length; i++) {
      const step = ramp.steps[i];
      if (!step) continue;
      const composited = alphaCompositeHex(step.hex, alpha, referenceSurfaceHex);
      const m = resolutionMetric(threshold.kind, composited, surfaceHex);
      if (m < required) continue;
      if (best === null || m < best.metric) best = { index: i, metric: m };
    }
  }

  // Fallback: pick the step with the highest composited contrast (may still fail)
  if (best === null) {
    for (let i = 0; i < ramp.steps.length; i++) {
      const step = ramp.steps[i];
      if (!step) continue;
      const composited = alphaCompositeHex(step.hex, alpha, referenceSurfaceHex);
      const m = resolutionMetric(threshold.kind, composited, surfaceHex);
      if (best === null || m > best.metric) best = { index: i, metric: m };
    }
  }

  if (best === null || !ramp.steps[best.index]) {
    throw new Error(
      `alpha resolver: no steps in ramp "${ramp.scaleName}" for token "${tokenPath}"`,
    );
  }

  const picked = best;
  const step = ramp.steps[picked.index]!;
  const compositedHex = alphaCompositeHex(step.hex, alpha, referenceSurfaceHex);

  const n = ramp.steps.length;
  const position = n <= 1 ? 0 : picked.index / (n - 1);

  const wcR = getWcagContrast(compositedHex, surfaceHex).ratio;
  const apL = getApcaContrast(compositedHex, surfaceHex);
  const metric = resolutionMetric(threshold.kind, compositedHex, surfaceHex);

  const thresholds =
    threshold.kind === 'apca'
      ? threshold.usage === 'text'
        ? { text: apcaThreshold(threshold) }
        : { nonText: apcaThreshold(threshold) }
      : threshold.usage === 'text'
        ? { text: wcagThreshold(threshold) }
        : { nonText: wcagThreshold(threshold) };

  const token: ResolvedToken = {
    path: tokenPath,
    mode,
    oklch: step.oklch,
    hex: step.hex,
    gamut: step.gamut,
    source: {
      ramp: ramp.scaleName,
      position,
      nearestPrimitive: `${ramp.scaleName}.${step.name}`,
      selectionNote: 'alpha-path1: composited contrast',
    },
    resolvedAgainst: surfaceRef,
    contrast: { wcag21: round2(wcR), apca: round2(apL) },
    compliance: {
      target: threshold.level,
      level: complianceForThreshold(threshold, metric),
      thresholds,
    },
    intent,
    alpha: makeAlphaReceipt(alpha, referenceSurfacePath, compositedHex),
  };

  return { token, step };
}

/**
 * Degenerate case: both step and alpha are fixed (`baseRef` + fixed `value`).
 * Just composites the declared color at the declared alpha over the reference surface.
 * No step search needed. Used for decorative scrims and overlays.
 */
function resolveFixed(
  tokenPath: string,
  mode: string,
  step: GeneratedStep,
  rampName: string,
  stepIndex: number,
  stepCount: number,
  alpha: number,
  referenceSurfaceHex: string,
  referenceSurfacePath: string,
): AlphaResolveResult {
  const compositedHex = alphaCompositeHex(step.hex, alpha, referenceSurfaceHex);
  const position = stepCount <= 1 ? 0 : stepIndex / (stepCount - 1);

  const token: ResolvedToken = {
    path: tokenPath,
    mode,
    oklch: step.oklch,
    hex: step.hex,
    gamut: step.gamut,
    source: {
      ramp: rampName,
      position,
      nearestPrimitive: `${rampName}.${step.name}`,
    },
    resolvedAgainst: null,
    contrast: null,
    compliance: { level: 'exempt' },
    intent: FALLBACK_INTENT,
    alpha: makeAlphaReceipt(alpha, referenceSurfacePath, compositedHex),
  };

  return { token, step };
}

/**
 * Parse a step reference like `{color.primitive.slate.900}` → `{ ramp: 'slate', step: '900' }`.
 * Returns `null` when the reference doesn't match the expected pattern.
 */
export function parseStepRef(ref: string): { ramp: string; step: string } | null {
  const inner = ref.startsWith('{') && ref.endsWith('}') ? ref.slice(1, -1) : ref;
  const parts = inner.split('.');
  // Expect: color.primitive.<ramp>.<step>
  if (parts.length !== 4 || parts[0] !== 'color' || parts[1] !== 'primitive') return null;
  const ramp = parts[2];
  const step = parts[3];
  if (!ramp || !step) return null;
  return { ramp, step };
}

/**
 * Look up a step by name in a ramp. Returns `{ step, index }` or `null`.
 */
export function findStepByName(
  ramp: GeneratedRamp,
  stepName: string,
): { step: GeneratedStep; index: number } | null {
  for (let i = 0; i < ramp.steps.length; i++) {
    const s = ramp.steps[i];
    if (s && s.name === stepName) return { step: s, index: i };
  }
  return null;
}

/**
 * Resolve an alpha-carrying vocabulary token.
 *
 * Dispatches to the appropriate sub-path based on the `AlphaModifier` shape:
 * - Path 1 (`baseRamp` + fixed alpha + intent): walk ramp, pick step by composited contrast.
 * - Degenerate (`baseRef` + fixed alpha, usage decorative): just composite and emit.
 *
 * Path 2 (fixed step, resolve alpha) is deferred — not yet implemented.
 */
export function resolveAlphaToken(
  input: AlphaResolveInput,
  ramps: GeneratedRamp[],
): AlphaResolveResult {
  const { tokenPath, mode, usage, modifier, ramp, referenceSurfaceHex, referenceSurfacePath, surfaceHex, surfaceRef, exempt } = input;

  const isFixedAlpha = typeof modifier.value === 'number';
  const alpha = isFixedAlpha ? (modifier.value as number) : (modifier.value as [number, number])[0]!;

  // Path 1: baseRamp + fixed alpha + intent → resolve step
  if (modifier.baseRamp && isFixedAlpha && modifier.intent && surfaceHex && surfaceRef) {
    return resolveFixedAlpha(
      tokenPath,
      mode,
      modifier.intent,
      ramp,
      alpha,
      referenceSurfaceHex,
      referenceSurfacePath,
      surfaceHex,
      surfaceRef,
      exempt,
    );
  }

  // Degenerate: baseRef + fixed alpha → just composite
  if (modifier.baseRef && isFixedAlpha) {
    const parsed = parseStepRef(modifier.baseRef);
    if (!parsed) {
      throw new Error(
        `alpha token "${tokenPath}": cannot parse baseRef "${modifier.baseRef}" — expected "{color.primitive.<ramp>.<step>}"`,
      );
    }
    const targetRamp = ramps.find((r) => r.scaleName === parsed.ramp) ?? ramp;
    const found = findStepByName(targetRamp, parsed.step);
    if (!found) {
      throw new Error(
        `alpha token "${tokenPath}": step "${parsed.step}" not found in ramp "${parsed.ramp}"`,
      );
    }
    return resolveFixed(
      tokenPath,
      mode,
      found.step,
      parsed.ramp,
      found.index,
      targetRamp.steps.length,
      alpha,
      referenceSurfaceHex,
      referenceSurfacePath,
    );
  }

  // If neither path matches, emit a best-effort using middle step (with a warning note)
  if (usage === 'decorative') {
    const midIdx = Math.floor((ramp.steps.length - 1) / 2);
    const step = ramp.steps[midIdx];
    if (!step) {
      throw new Error(`alpha token "${tokenPath}": ramp "${ramp.scaleName}" has no steps`);
    }
    return resolveFixed(
      tokenPath,
      mode,
      step,
      ramp.scaleName,
      midIdx,
      ramp.steps.length,
      alpha,
      referenceSurfaceHex,
      referenceSurfacePath,
    );
  }

  throw new Error(
    `alpha token "${tokenPath}": cannot determine resolution path — ` +
    `set baseRamp+intent (path 1) or baseRef (degenerate); got baseRamp=${modifier.baseRamp}, baseRef=${modifier.baseRef}`,
  );
}

/** Default reference surface path per mode scheme (ADR-016). */
export function defaultAlphaReferenceSurface(scheme: 'light' | 'dark'): string {
  return scheme === 'light' ? 'color.surface.main' : 'color.surface.inverse';
}
