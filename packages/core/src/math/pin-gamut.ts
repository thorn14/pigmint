import { isWithinGamut, maxChromaForGamut, type GamutTarget } from './gamut.js';
import { rampStepGeometry } from './ramp.js';
import type { ColorScale, GeneratedRamp, GamutLevel } from '../types/palette.js';

/** Chroma tolerance when comparing a step against its gamut ceiling. */
const CHROMA_EPSILON = 1e-4;

export interface PinnedChromaCurve {
  /** Chroma curve values to store on the scale, one per step. */
  values: number[];
  /**
   * Curve smoothing the scale must use for `values` to survive intact. Always
   * 0: smoothing mixes each interior step with its neighbours, and the gamut
   * boundary is not smooth, so any smoothing pulls pinned steps off it.
   */
  smoothing: 0;
}

/**
 * Chroma curve that places every step exactly on `gamut`'s boundary.
 *
 * Lightness and hue don't depend on chroma, so each step's ceiling can be read
 * straight from the scale's geometry — no iteration needed. The returned
 * smoothing must be applied together with the values: `generateRamp` smooths
 * the chroma curve before clamping, so a non-zero smoothing would leave
 * interior steps short of the boundary (and, when pinning to sRGB inside a P3
 * ramp, would let them drift past it into P3).
 */
export function pinChromaCurveToGamut(scale: ColorScale, gamut: GamutTarget): PinnedChromaCurve {
  const values = rampStepGeometry(scale).map((step) =>
    maxChromaForGamut(gamut, step.l, step.h),
  );
  return { values, smoothing: 0 };
}

export interface GamutOffender {
  name: string;
  gamut: GamutLevel;
  /** How far this step's chroma exceeds the target gamut's ceiling. */
  overshoot: number;
}

export interface GamutValidation {
  gamut: GamutTarget;
  /** Every step fits inside `gamut`. */
  ok: boolean;
  stepCount: number;
  /** Steps whose chroma sits on the gamut boundary (i.e. successfully pinned). */
  pinnedCount: number;
  /** Steps that fall outside `gamut` — always empty for a ramp generated with it. */
  offenders: GamutOffender[];
  /** Largest gap between a step's chroma and its ceiling. 0 means fully pinned. */
  maxShortfall: number;
}

/**
 * Checks a generated ramp against a target gamut: whether every step fits
 * inside it, and how close each step sits to the boundary. Used to confirm a
 * pin actually took, rather than trusting that it did.
 */
export function validateRampGamut(ramp: GeneratedRamp, gamut: GamutTarget): GamutValidation {
  const offenders: GamutOffender[] = [];
  let pinnedCount = 0;
  let maxShortfall = 0;

  for (const step of ramp.steps) {
    const ceiling = gamut === 'srgb' ? step.maxSrgbC : step.maxP3C;
    const shortfall = ceiling - step.oklch.c;
    if (!isWithinGamut(step.gamut, gamut)) {
      offenders.push({ name: step.name, gamut: step.gamut, overshoot: -shortfall });
      continue;
    }
    if (Math.abs(shortfall) <= CHROMA_EPSILON) pinnedCount++;
    if (shortfall > maxShortfall) maxShortfall = shortfall;
  }

  return {
    gamut,
    ok: offenders.length === 0,
    stepCount: ramp.steps.length,
    pinnedCount,
    offenders,
    maxShortfall,
  };
}
