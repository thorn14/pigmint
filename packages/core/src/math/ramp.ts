import { type GamutTarget } from './gamut.js';
import { buildGeneratedStep } from './step.js';
import { clampAlpha } from './oklch.js';
import { TAILWIND_LIGHTNESS } from '../presets/lightness.js';
import { resolveStepNames } from '../presets/naming.js';
import type {
  ColorScale,
  GeneratedRamp,
  GeneratedStep,
  OklchColor,
} from '../types/palette.js';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function circularDist(a: number, b: number): number {
  const d = (((b - a) % 360) + 360) % 360;
  return d > 180 ? d - 360 : d;
}

export function buildChromaCurve(
  chromaPeak: number,
  stepCount: number,
  chromaLow = 0,
  chromaHigh = 0,
): number[] {
  return Array.from({ length: stepCount }, (_, i) => {
    const t = stepCount === 1 ? 0 : i / (stepCount - 1);
    const peak = 0.45;
    const width = 0.35;
    const bell = Math.exp(-(((t - peak) / width) ** 2));
    const floor = chromaLow + (chromaHigh - chromaLow) * t;
    return floor + (chromaPeak - floor) * bell;
  });
}

export function nearestPrimary(baseHue: number): number {
  const primaries = [0, 120, 240];
  return primaries.reduce((best, p) =>
    Math.abs(circularDist(baseHue, p)) < Math.abs(circularDist(baseHue, best)) ? p : best,
  );
}

export function autoHueShiftBase(baseHue: number): number {
  const primaries = [0, 120, 240];
  const distToNearest = Math.min(
    ...primaries.map((p) => Math.abs(circularDist(baseHue, p))),
  );
  const proximity = Math.min(distToNearest / 60, 1);
  return 5 + 20 * proximity;
}

export function computeHueShift(
  baseHue: number,
  t: number,
  lightEndAdjust: number,
  darkEndAdjust: number,
): number {
  const primary = nearestPrimary(baseHue);
  const dir = Math.sign(circularDist(baseHue, primary));
  const autoBase = autoHueShiftBase(baseHue);

  const lightShiftAmount = dir * (autoBase + lightEndAdjust);
  const darkShiftAmount = dir * (autoBase + darkEndAdjust);

  const lightWeight = Math.pow(Math.max(0, 1 - t * 2), 2);
  const darkWeight = Math.pow(Math.max(0, 1 - (1 - t) * 2), 2);

  return lightShiftAmount * lightWeight + darkShiftAmount * darkWeight;
}

export function buildDefaultCurves(
  sourceOklch: OklchColor,
  stepCount: number,
): ColorScale['curves'] {
  const lightnessValues: number[] = [];
  for (let i = 0; i < stepCount; i++) {
    const t = stepCount === 1 ? 0 : i / (stepCount - 1);
    const refIdx = t * (TAILWIND_LIGHTNESS.length - 1);
    const lo = Math.floor(refIdx);
    const hi = Math.min(lo + 1, TAILWIND_LIGHTNESS.length - 1);
    const frac = refIdx - lo;
    const a = TAILWIND_LIGHTNESS[lo] ?? 0.5;
    const b = TAILWIND_LIGHTNESS[hi] ?? a;
    lightnessValues.push(lerp(a, b, frac));
  }

  const chromaValues = buildChromaCurve(sourceOklch.c, stepCount);
  const hueValues = Array<number>(stepCount).fill(0);

  return {
    lightness: { values: lightnessValues },
    chroma: { values: chromaValues },
    hue: { values: hueValues },
  };
}

export function smoothCurveValues(values: number[], smoothing: number): number[] {
  if (smoothing <= 0 || values.length <= 2) return values;
  const result = values.slice();
  const t = Math.min(1, Math.max(0, smoothing));
  for (let i = 1; i < values.length - 1; i++) {
    const prev = values[i - 1] ?? 0;
    const curr = values[i] ?? 0;
    const next = values[i + 1] ?? 0;
    const avg = prev * 0.25 + curr * 0.5 + next * 0.25;
    result[i] = curr + (avg - curr) * t;
  }
  return result;
}

/** Authored OKLCH per step, after curve smoothing and hue shift, before any gamut clamp. */
export interface RampStepGeometry {
  name: string;
  l: number;
  c: number;
  h: number;
}

/**
 * The scale's requested L/C/H per step. Lightness and hue are independent of
 * chroma, so gamut pinning can read the final L/H from here without having to
 * generate (and then regenerate) a whole ramp.
 */
export function rampStepGeometry(scale: ColorScale): RampStepGeometry[] {
  const { sourceOklch, stepCount, naming, curves, hueShift } = scale;
  const stepNames = resolveStepNames(naming.preset, stepCount, naming.customNames);

  const lv = smoothCurveValues(curves.lightness.values, curves.lightness.smoothing ?? 0);
  const cv = smoothCurveValues(curves.chroma.values, curves.chroma.smoothing ?? 0);
  const hv = smoothCurveValues(curves.hue.values, curves.hue.smoothing ?? 0);

  return Array.from({ length: stepCount }, (_, i) => {
    const t = stepCount === 1 ? 0 : i / (stepCount - 1);
    const hueShiftDelta = computeHueShift(
      sourceOklch.h,
      t,
      hueShift.lightEndAdjust,
      hueShift.darkEndAdjust,
    );
    const baseDeltaH = hv[i] ?? 0;
    return {
      name: stepNames[i] ?? String(i),
      l: lv[i] ?? sourceOklch.l,
      c: cv[i] ?? sourceOklch.c,
      h: (((sourceOklch.h + baseDeltaH + hueShiftDelta) % 360) + 360) % 360,
    };
  });
}

export interface GenerateRampOptions {
  /**
   * Widest gamut the ramp may use. Defaults to `'p3'`. With `'srgb'` no step
   * carries a Display-P3 representation, so P3 cannot leak into previews or
   * emitted tokens.
   */
  gamut?: GamutTarget;
}

export function generateRamp(scale: ColorScale, opts: GenerateRampOptions = {}): GeneratedRamp {
  const { id, name, sourceOklch } = scale;
  const gamut = opts.gamut ?? 'p3';
  const alpha = clampAlpha(scale.sourceAlpha ?? sourceOklch.alpha);

  const steps: GeneratedStep[] = rampStepGeometry(scale).map((geometry) =>
    buildGeneratedStep({ ...geometry, alpha, gamut }),
  );

  return { scaleId: id, scaleName: name, steps };
}
