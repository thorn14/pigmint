import type { ColorScale, GeneratedRamp } from '../types/palette';
import { generateRamp } from '../lib/colorMath';
import { useTargetGamut } from '../store/paletteStore';

export function useGeneratedRamp(scale: ColorScale): GeneratedRamp {
  const gamut = useTargetGamut();
  return generateRamp(scale, { gamut });
}
