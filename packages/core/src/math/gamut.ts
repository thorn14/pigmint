import { converter } from 'culori';
import type { GamutLevel } from '../types/palette.js';

/**
 * A gamut a ramp can be authored *into*, as opposed to `GamutLevel`, which
 * reports the narrowest gamut a color happens to land in. `'out'` is never a
 * target: every generated step is clamped into one of these two.
 */
export type GamutTarget = 'srgb' | 'p3';

/** Upper bound of the chroma searches, and the chroma ceiling used by the UI. */
export const MAX_CHROMA = 0.4;

const toRgb: ReturnType<typeof converter<'rgb'>> = converter('rgb');
const toP3: ReturnType<typeof converter<'p3'>> = converter('p3');

export function checkGamut(l: number, c: number, h: number): GamutLevel {
  const pre = { mode: 'oklch' as const, l, c, h };
  const rgb = toRgb(pre);
  const inSrgb =
    rgb &&
    rgb.r != null &&
    rgb.g != null &&
    rgb.b != null &&
    rgb.r >= -0.001 &&
    rgb.r <= 1.001 &&
    rgb.g >= -0.001 &&
    rgb.g <= 1.001 &&
    rgb.b >= -0.001 &&
    rgb.b <= 1.001;
  if (inSrgb) return 'srgb';

  const p3 = toP3(pre);
  const inP3 =
    p3 &&
    p3.r != null &&
    p3.g != null &&
    p3.b != null &&
    p3.r >= -0.001 &&
    p3.r <= 1.001 &&
    p3.g >= -0.001 &&
    p3.g <= 1.001 &&
    p3.b >= -0.001 &&
    p3.b <= 1.001;
  if (inP3) return 'p3';

  return 'out';
}

/**
 * Largest chroma at (l, h) that `accepts` still admits. Returns the last
 * known-good bound, so the result is always a hair *inside* the boundary rather
 * than on it — callers can clamp to it without re-checking.
 */
function searchMaxChroma(l: number, h: number, accepts: (level: GamutLevel) => boolean): number {
  let lo = 0;
  let hi = MAX_CHROMA;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (accepts(checkGamut(l, mid, h))) lo = mid;
    else hi = mid;
  }
  return lo;
}

export function maxSrgbChroma(l: number, h: number): number {
  return searchMaxChroma(l, h, (level) => level === 'srgb');
}

export function maxP3Chroma(l: number, h: number): number {
  return searchMaxChroma(l, h, (level) => level === 'srgb' || level === 'p3');
}

export function maxChromaForGamut(gamut: GamutTarget, l: number, h: number): number {
  return gamut === 'srgb' ? maxSrgbChroma(l, h) : maxP3Chroma(l, h);
}

/** Whether a color at `level` fits inside the requested target gamut. */
export function isWithinGamut(level: GamutLevel, gamut: GamutTarget): boolean {
  return gamut === 'srgb' ? level === 'srgb' : level === 'srgb' || level === 'p3';
}

export { toRgb, toP3 };
