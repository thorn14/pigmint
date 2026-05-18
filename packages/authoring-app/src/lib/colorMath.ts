export {
  hexToOklch,
  tryParseHex,
  oklchToHex,
  sourceWithChromaToHex,
  getRelativeLuminance,
  getWcagContrast,
  getApcaContrast,
  checkGamut,
  maxSrgbChroma,
  maxP3Chroma,
  deltaEOklch,
  buildChromaCurve,
  buildDefaultCurves,
  smoothCurveValues,
  computeHueShift,
  autoHueShiftBase,
  nearestPrimary,
  generateRamp,
} from '@pigmint/core';

import { getWcagContrast } from '@pigmint/core';
import type { ContrastResult } from '@pigmint/core';

export function getContrast(hexA: string, hexB: string): ContrastResult {
  return getWcagContrast(hexA, hexB);
}
