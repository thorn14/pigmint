import { converter } from 'culori';
import type { GamutLevel } from '../types/palette.js';

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

export function maxSrgbChroma(l: number, h: number): number {
  let lo = 0;
  let hi = 0.4;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (checkGamut(l, mid, h) === 'srgb') lo = mid;
    else hi = mid;
  }
  return lo;
}

export function maxP3Chroma(l: number, h: number): number {
  let lo = 0;
  let hi = 0.4;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const g = checkGamut(l, mid, h);
    if (g === 'srgb' || g === 'p3') lo = mid;
    else hi = mid;
  }
  return lo;
}

export { toRgb, toP3 };
