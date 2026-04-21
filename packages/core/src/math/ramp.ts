import { formatHex, clampChroma } from 'culori';
import { checkGamut, maxP3Chroma, maxSrgbChroma, toP3, toRgb } from './gamut.js';
import { getRelativeLuminance } from './contrast.js';
import { clampAlpha } from './oklch.js';
import { TAILWIND_LIGHTNESS } from '../presets/lightness.js';
import { resolveStepNames } from '../presets/naming.js';
import type {
  ColorScale,
  GeneratedRamp,
  GeneratedStep,
  OklchColor,
  RgbChannels,
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

export function generateRamp(scale: ColorScale): GeneratedRamp {
  const { id, name, sourceOklch, stepCount, naming, curves, hueShift } = scale;
  const stepNames = resolveStepNames(naming.preset, stepCount, naming.customNames);

  const lv = smoothCurveValues(curves.lightness.values, curves.lightness.smoothing ?? 0);
  const cv = smoothCurveValues(curves.chroma.values, curves.chroma.smoothing ?? 0);
  const hv = smoothCurveValues(curves.hue.values, curves.hue.smoothing ?? 0);

  const steps: GeneratedStep[] = [];

  for (let i = 0; i < stepCount; i++) {
    const l = lv[i] ?? sourceOklch.l;
    const c = cv[i] ?? sourceOklch.c;
    const baseDeltaH = hv[i] ?? 0;

    const t = stepCount === 1 ? 0 : i / (stepCount - 1);
    const hueShiftDelta = computeHueShift(
      sourceOklch.h,
      t,
      hueShift.lightEndAdjust,
      hueShift.darkEndAdjust,
    );

    const h = (((sourceOklch.h + baseDeltaH + hueShiftDelta) % 360) + 360) % 360;

    const cP3 = Math.min(c, maxP3Chroma(l, h));
    const gamut = checkGamut(l, cP3, h);

    let p3Channels: RgbChannels | undefined;
    let displayP3: string | undefined;
    if (gamut === 'p3') {
      const p3 = toP3({ mode: 'oklch' as const, l, c: cP3, h });
      if (p3) {
        const pr = p3.r ?? 0;
        const pg = p3.g ?? 0;
        const pb = p3.b ?? 0;
        p3Channels = { r: pr, g: pg, b: pb };
        displayP3 = `color(display-p3 ${pr.toFixed(4)} ${pg.toFixed(4)} ${pb.toFixed(4)})`;
      }
    }

    const sourceAlpha = clampAlpha(scale.sourceAlpha ?? sourceOklch.alpha);
    const srgbClamped = clampChroma(
      { mode: 'oklch' as const, l, c: cP3, h, alpha: sourceAlpha },
      'oklch',
    );
    const hex = formatHex(srgbClamped) ?? '#000000';
    const srgbRgb = toRgb(srgbClamped);
    const srgbChannels: RgbChannels = {
      r: srgbRgb?.r ?? 0,
      g: srgbRgb?.g ?? 0,
      b: srgbRgb?.b ?? 0,
    };
    const oklchOut: OklchColor = { l, c: cP3, h, alpha: clampAlpha(sourceAlpha) };
    const relativeLuminance = getRelativeLuminance(hex);

    const stepName = stepNames[i] ?? String(i);
    steps.push({
      name: stepName,
      oklch: oklchOut,
      hex,
      srgb: srgbChannels,
      p3: p3Channels,
      displayP3,
      relativeLuminance,
      gamut,
      maxSrgbC: maxSrgbChroma(l, h),
    });
  }

  return { scaleId: id, scaleName: name, steps };
}
