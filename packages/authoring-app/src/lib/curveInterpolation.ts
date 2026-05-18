import type { ColorScale, GeneratedRamp } from '../types/palette';
import { formatCss } from 'culori';
import {
  computeHueShift,
  deltaEOklch,
  maxP3Chroma,
  maxSrgbChroma,
  smoothCurveValues,
} from './colorMath';

// Linear interpolation
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Clamp value between min and max
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Normalize a value from [inMin, inMax] to [outMin, outMax]
export function remap(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  const t = (value - inMin) / (inMax - inMin);
  return lerp(outMin, outMax, clamp(t, 0, 1));
}

// Generate evenly spaced values between start and end (inclusive), count points
export function linspace(start: number, end: number, count: number): number[] {
  if (count <= 1) return [start];
  return Array.from({ length: count }, (_, i) => lerp(start, end, i / (count - 1)));
}

/**
 * Builds an SVG path `d` attribute string for a curve through the given points.
 * Smooth nodes use cubic bezier tangents derived from the monotone spline;
 * corner nodes use independent incoming/outgoing tangents (segment chord slopes)
 * so the curve forms a genuine sharp angle at that point.
 *
 * @param points   Screen-space {x, y} positions for each control point
 * @param nodeTypes Per-point type: 'smooth' uses spline tangents, 'corner' creates sharp break
 * @returns SVG `d` string starting with M, using C (cubic bezier) commands
 */
export function buildCurvePath(
  points: { x: number; y: number }[],
  nodeTypes: ('smooth' | 'corner')[],
): string {
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) return `M ${points[0].x},${points[0].y}`;

  // Compute monotone cubic tangents in Y (X spacing is uniform)
  const ys = points.map((p) => p.y);
  const xs = points.map((p) => p.x);

  // Slopes between consecutive points
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = xs[i + 1] - xs[i];
    d.push(dx === 0 ? 0 : (ys[i + 1] - ys[i]) / dx);
  }

  // Initial tangents (average of neighboring slopes)
  const m: number[] = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = (d[i - 1] + d[i]) / 2;
  }

  // Fritsch–Carlson monotonicity constraints.
  // Treat corner nodes as hard boundaries: their effective tangents are
  // replaced later with segment chord slopes, so they must not participate
  // in scaling decisions for neighboring smooth tangents.
  for (let i = 0; i < n - 1; i++) {
    const leftType = nodeTypes[i] ?? 'smooth';
    const rightType = nodeTypes[i + 1] ?? 'smooth';
    if (leftType === 'corner' || rightType === 'corner') continue;

    if (Math.abs(d[i]) < 1e-10) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const alpha = m[i] / d[i];
      const beta = m[i + 1] / d[i];
      const r = alpha * alpha + beta * beta;
      if (r > 9) {
        const t = 3 / Math.sqrt(r);
        m[i] = t * alpha * d[i];
        m[i + 1] = t * beta * d[i];
      }
    }
  }

  // Split tangents: mIn (arrival) and mOut (departure) per node.
  // Smooth nodes share a single tangent (C1); corner nodes use the
  // chord slope of the adjacent segment for a genuine sharp break.
  const mIn: number[] = new Array(n);
  const mOut: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if ((nodeTypes[i] ?? 'smooth') === 'corner') {
      mIn[i] = i > 0 ? d[i - 1] : d[0];
      mOut[i] = i < n - 1 ? d[i] : d[n - 2];
    } else {
      mIn[i] = m[i];
      mOut[i] = m[i];
    }
  }

  // Build path using cubic bezier commands
  let path = `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = (xs[i + 1] - xs[i]) / 3;
    const cp1x = xs[i] + h;
    const cp1y = ys[i] + mOut[i] * h;
    const cp2x = xs[i + 1] - h;
    const cp2y = ys[i + 1] - mIn[i + 1] * h;
    path += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${points[i + 1].x.toFixed(2)},${points[i + 1].y.toFixed(2)}`;
  }
  return path;
}

// Monotone cubic spline interpolation for smooth curve preview
// Returns a function that interpolates the given points
export function buildMonotoneCubicInterpolant(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length;
  if (n < 2) return () => ys[0] ?? 0;

  // Compute slopes
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  }

  // Tangents
  const m: number[] = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = (d[i - 1] + d[i]) / 2;
  }

  // Monotonicity constraints (Fritsch–Carlson)
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(d[i]) < 1e-10) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const alpha = m[i] / d[i];
      const beta = m[i + 1] / d[i];
      const r = alpha * alpha + beta * beta;
      if (r > 9) {
        const t = 3 / Math.sqrt(r);
        m[i] = t * alpha * d[i];
        m[i + 1] = t * beta * d[i];
      }
    }
  }

  return (x: number): number => {
    // Binary search for segment
    let lo = 0, hi = n - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] <= x) lo = mid; else hi = mid;
    }
    const h = xs[hi] - xs[lo];
    const t = h === 0 ? 0 : (x - xs[lo]) / h;
    const t2 = t * t, t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[lo] +
      (t3 - 2 * t2 + t) * h * m[lo] +
      (-2 * t3 + 3 * t2) * ys[hi] +
      (t3 - t2) * h * m[hi]
    );
  };
}

const SCALE_GRADIENT_SAMPLES = 16;

export type GamutTarget = 'srgb' | 'p3';

function maxChromaFor(l: number, h: number, gamut: GamutTarget): number {
  return gamut === 'srgb' ? maxSrgbChroma(l, h) : maxP3Chroma(l, h);
}

function oklchStop(l: number, c: number, h: number, alpha: number): string {
  return (
    formatCss({ mode: 'oklch', l, c, h, alpha }) ??
    `oklch(${l.toFixed(4)} ${c.toFixed(4)} ${h.toFixed(2)}${alpha < 1 ? ` / ${alpha}` : ''})`
  );
}

/**
 * CSS `background` value: `linear-gradient(in oklch shorter hue to right, …)`
 * through the scale's smooth L/C/H curves. Interpolation happens in OKLCH so
 * midpoints stay perceptually accurate; the chroma is clamped to the requested
 * gamut so out-of-gamut compression doesn't distort the ramp.
 */
export function buildScaleLinearGradientCss(
  scale: ColorScale,
  opts: { gamut?: GamutTarget; samples?: number } = {},
): string {
  const gamut: GamutTarget = opts.gamut ?? 'p3';
  const lRaw = smoothCurveValues(scale.curves.lightness.values, scale.curves.lightness.smoothing ?? 0);
  const cRaw = smoothCurveValues(scale.curves.chroma.values, scale.curves.chroma.smoothing ?? 0);
  const hRaw = smoothCurveValues(scale.curves.hue.values, scale.curves.hue.smoothing ?? 0);
  const xs = lRaw.map((_, i) => i);
  const lAt = buildMonotoneCubicInterpolant(xs, lRaw);
  const cAt = buildMonotoneCubicInterpolant(xs, cRaw);
  const hAt = buildMonotoneCubicInterpolant(xs, hRaw);
  const alpha = scale.sourceAlpha ?? 1;
  const n = lRaw.length;
  // Column-center alignment: the curve overlay places step `i` at (i + 0.5)/n
  // of the track width, so map the sampled curve range [0, n-1] into
  // [0.5/n, 1 - 0.5/n] and hold the edge color across the outer half-column.
  const halfCol = n > 0 ? 50 / n : 0;
  // Pick a sample count that *always hits every integer step position* so the
  // gradient color at each column center is the curve's exact value there
  // (no off-step linear interpolation muting peaks). subdivisions = samples per
  // segment between adjacent steps; total stops = subdivisions*(n-1) + 1.
  const segments = Math.max(1, n - 1);
  const target = opts.samples ?? SCALE_GRADIENT_SAMPLES;
  const subdivisions = Math.max(2, Math.ceil((target - 1) / segments));
  const samples = subdivisions * segments + 1;
  const stops: string[] = [];
  for (let s = 0; s < samples; s++) {
    const t = s / (samples - 1);
    const x = t * (n - 1);
    const l = lAt(x);
    const c = cAt(x);
    const baseDeltaH = hAt(x);
    const shift = computeHueShift(
      scale.sourceOklch.h,
      t,
      scale.hueShift.lightEndAdjust,
      scale.hueShift.darkEndAdjust,
    );
    const h = (((scale.sourceOklch.h + baseDeltaH + shift) % 360) + 360) % 360;
    const cClamped = Math.min(c, maxChromaFor(l, h, gamut));
    const color = oklchStop(l, cClamped, h, alpha);
    const pos = halfCol + t * (100 - 2 * halfCol);
    if (s === 0) stops.push(`${color} 0%`);
    stops.push(`${color} ${pos.toFixed(2)}%`);
    if (s === samples - 1) stops.push(`${color} 100%`);
  }
  return `linear-gradient(in oklch shorter hue to right, ${stops.join(', ')})`;
}

/**
 * Mid-step OKLCH for the scale: holds two axes constant while one varies.
 * Sampled at t = 0.5 along the smoothed curves.
 */
function midStepOklch(scale: ColorScale): { l: number; c: number; h: number } {
  const lRaw = smoothCurveValues(scale.curves.lightness.values, scale.curves.lightness.smoothing ?? 0);
  const cRaw = smoothCurveValues(scale.curves.chroma.values, scale.curves.chroma.smoothing ?? 0);
  const hRaw = smoothCurveValues(scale.curves.hue.values, scale.curves.hue.smoothing ?? 0);
  const xs = lRaw.map((_, i) => i);
  const lAt = buildMonotoneCubicInterpolant(xs, lRaw);
  const cAt = buildMonotoneCubicInterpolant(xs, cRaw);
  const hAt = buildMonotoneCubicInterpolant(xs, hRaw);
  const mid = (lRaw.length - 1) / 2;
  const baseDeltaH = hAt(mid);
  const shift = computeHueShift(
    scale.sourceOklch.h,
    0.5,
    scale.hueShift.lightEndAdjust,
    scale.hueShift.darkEndAdjust,
  );
  const h = (((scale.sourceOklch.h + baseDeltaH + shift) % 360) + 360) % 360;
  return { l: lAt(mid), c: cAt(mid), h };
}

/**
 * Single-axis gradient: varies exactly one of {lightness, chroma}; holds the
 * other two at their mid-step values. Used in the diagnostics panel to show
 * what each axis contributes to the main gradient.
 */
export function buildScaleAxisGradientCss(
  scale: ColorScale,
  axis: 'lightness' | 'chroma',
  opts: { gamut?: GamutTarget; samples?: number } = {},
): string {
  const gamut: GamutTarget = opts.gamut ?? 'p3';
  const samples = opts.samples ?? SCALE_GRADIENT_SAMPLES;
  const alpha = scale.sourceAlpha ?? 1;
  const mid = midStepOklch(scale);
  const stops: string[] = [];

  if (axis === 'lightness') {
    const lRaw = smoothCurveValues(scale.curves.lightness.values, scale.curves.lightness.smoothing ?? 0);
    const xs = lRaw.map((_, i) => i);
    const lAt = buildMonotoneCubicInterpolant(xs, lRaw);
    for (let s = 0; s < samples; s++) {
      const t = s / (samples - 1);
      const l = lAt(t * (lRaw.length - 1));
      const cClamped = Math.min(mid.c, maxChromaFor(l, mid.h, gamut));
      stops.push(`${oklchStop(l, cClamped, mid.h, alpha)} ${(t * 100).toFixed(2)}%`);
    }
  } else {
    const maxC = maxChromaFor(mid.l, mid.h, gamut);
    for (let s = 0; s < samples; s++) {
      const t = s / (samples - 1);
      const c = t * maxC;
      stops.push(`${oklchStop(mid.l, c, mid.h, alpha)} ${(t * 100).toFixed(2)}%`);
    }
  }
  return `linear-gradient(in oklch shorter hue to right, ${stops.join(', ')})`;
}

/**
 * ΔE (OKLab Euclidean distance) between each adjacent pair of generated steps.
 * Returns ramp.steps.length - 1 values. Uniform values across the array mean
 * the ramp is perceptually even regardless of how the gradient looks visually.
 */
export function computeAdjacentDeltaE(ramp: GeneratedRamp): number[] {
  const out: number[] = [];
  for (let i = 0; i < ramp.steps.length - 1; i++) {
    out.push(deltaEOklch(ramp.steps[i].oklch, ramp.steps[i + 1].oklch));
  }
  return out;
}
