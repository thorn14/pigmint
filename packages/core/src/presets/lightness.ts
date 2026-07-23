export type LightnessPreset = 'tailwind' | 'linear' | 'eased' | 'material' | 'custom';

const MATERIAL_LIGHTNESS: readonly number[] = [
  0.99, 0.95, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1,
];

export const TAILWIND_LIGHTNESS: readonly number[] = [
  0.9927, // 50
  0.9745, // 100
  0.9344, // 200
  0.8511, // 300
  0.7623, // 400
  0.6548, // 500
  0.5388, // 600
  0.4115, // 700
  0.2991, // 800
  0.2215, // 900
  0.196, // 950
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function interpolateRef(ref: readonly number[], t: number): number {
  const idx = t * (ref.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, ref.length - 1);
  const a = ref[lo] ?? 0;
  const b = ref[hi] ?? a;
  return lerp(a, b, idx - lo);
}

export function buildLightnessValues(preset: LightnessPreset, stepCount: number): number[] {
  return Array.from({ length: stepCount }, (_, i) => {
    const t = stepCount === 1 ? 0 : i / (stepCount - 1);
    switch (preset) {
      case 'tailwind':
        return interpolateRef(TAILWIND_LIGHTNESS, t);
      case 'linear':
        return lerp(0.98, 0.13, t);
      case 'eased': {
        const st = t * t * (3 - 2 * t);
        return lerp(0.98, 0.13, st);
      }
      case 'material':
        return interpolateRef(MATERIAL_LIGHTNESS, t);
      case 'custom':
        return 0.5;
    }
  });
}

/**
 * Redistribute lightness between fixed endpoints.
 * `curveBias` in [-1, 1]: 0 = even (linear); negative packs toward `start`; positive toward `end`.
 */
export function buildLightnessFromEnds(
  start: number,
  end: number,
  count: number,
  curveBias = 0,
): number[] {
  if (count <= 1) return [start];
  const exp = Math.pow(2, curveBias);
  return Array.from({ length: count }, (_, i) => {
    if (i === 0) return start;
    if (i === count - 1) return end;
    const t = i / (count - 1);
    const eased = exp === 1 ? t : Math.pow(t, exp);
    return lerp(start, end, eased);
  });
}
