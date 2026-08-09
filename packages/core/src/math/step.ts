import { formatHex, clampChroma } from 'culori';
import {
  checkGamut,
  maxChromaForGamut,
  maxP3Chroma,
  maxSrgbChroma,
  toP3,
  toRgb,
  type GamutTarget,
} from './gamut.js';
import { getRelativeLuminance } from './contrast.js';
import { clampAlpha } from './oklch.js';
import type { GeneratedStep, RgbChannels } from '../types/palette.js';

export interface BuildGeneratedStepInput {
  name: string;
  /** Authored OKLCH. Chroma is treated as a request and clamped to `gamut`. */
  l: number;
  c: number;
  h: number;
  alpha?: number;
  /**
   * Widest gamut this step may occupy. `'srgb'` keeps the step (and therefore
   * the whole ramp) free of any Display-P3 representation; `'p3'` allows it.
   */
  gamut?: GamutTarget;
  /** Hex to fall back to if culori cannot format the clamped color. */
  fallbackHex?: string;
}

/**
 * Single source of truth for turning an authored OKLCH triple into a
 * `GeneratedStep`. Both the ramp generator and the continuous resolver's
 * materialized primitives go through here so the gamut decision, the sRGB
 * fallback hex, and the recorded chroma ceilings can never disagree.
 *
 * The chroma request is clamped to the target gamut first, so `oklch.c` is the
 * chroma actually used; `hex` is that same color reduced into sRGB, making it a
 * safe fallback for every display regardless of which gamut the step landed in.
 */
export function buildGeneratedStep({
  name,
  l,
  c,
  h,
  alpha,
  gamut = 'p3',
  fallbackHex = '#000000',
}: BuildGeneratedStepInput): GeneratedStep {
  const maxSrgbC = maxSrgbChroma(l, h);
  const maxP3C = maxP3Chroma(l, h);
  const clampedC = Math.min(c, maxChromaForGamut(gamut, l, h));
  const level = checkGamut(l, clampedC, h);
  const stepAlpha = clampAlpha(alpha);

  let p3Channels: RgbChannels | undefined;
  let displayP3: string | undefined;
  if (level === 'p3') {
    const p3 = toP3({ mode: 'oklch' as const, l, c: clampedC, h });
    if (p3) {
      const pr = p3.r ?? 0;
      const pg = p3.g ?? 0;
      const pb = p3.b ?? 0;
      p3Channels = { r: pr, g: pg, b: pb };
      displayP3 = `color(display-p3 ${pr.toFixed(4)} ${pg.toFixed(4)} ${pb.toFixed(4)})`;
    }
  }

  const srgbClamped = clampChroma(
    { mode: 'oklch' as const, l, c: clampedC, h, alpha: stepAlpha },
    'oklch',
  );
  const hex = formatHex(srgbClamped) ?? fallbackHex;
  const srgbRgb = toRgb(srgbClamped);

  return {
    name,
    oklch: { l, c: clampedC, h, alpha: stepAlpha },
    hex,
    srgb: {
      r: srgbRgb?.r ?? 0,
      g: srgbRgb?.g ?? 0,
      b: srgbRgb?.b ?? 0,
    },
    p3: p3Channels,
    displayP3,
    relativeLuminance: getRelativeLuminance(hex),
    gamut: level,
    maxSrgbC,
    maxP3C,
  };
}
