import type { ColorScale, GeneratedRamp } from '../types/palette';
import { generateRamp } from '../lib/colorMath';

export function useGeneratedRamp(scale: ColorScale): GeneratedRamp {
  return generateRamp(scale);
}
