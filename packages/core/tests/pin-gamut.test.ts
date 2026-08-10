import { describe, it, expect } from 'vitest';
import {
  buildDefaultCurves,
  generateRamp,
  hexToOklch,
  maxP3Chroma,
  maxSrgbChroma,
  pinChromaCurveToGamut,
  validateRampGamut,
} from '../src/index.js';
import type { ColorScale, GamutTarget } from '../src/index.js';

function makeScale(sourceHex: string, overrides: Partial<ColorScale> = {}): ColorScale {
  const sourceOklch = hexToOklch(sourceHex);
  const stepCount = overrides.stepCount ?? 11;
  return {
    id: 'scale',
    name: 'scale',
    sourceHex,
    sourceOklch,
    sourceAlpha: 1,
    stepCount,
    naming: { preset: 'tailwind' },
    curves: buildDefaultCurves(sourceOklch, stepCount),
    hueShift: { lightEndAdjust: 0, darkEndAdjust: 0 },
    lightnessPreset: 'tailwind',
    chromaPeak: sourceOklch.c,
    ...overrides,
  };
}

/** Saturate the chroma curve well past both gamut boundaries. */
function withMaxChroma(scale: ColorScale): ColorScale {
  return {
    ...scale,
    chromaPeak: 0.4,
    curves: {
      ...scale.curves,
      chroma: { values: Array<number>(scale.stepCount).fill(0.4) },
    },
  };
}

function applyPin(scale: ColorScale, gamut: GamutTarget): ColorScale {
  const { values, smoothing } = pinChromaCurveToGamut(scale, gamut);
  return { ...scale, curves: { ...scale.curves, chroma: { values, smoothing } } };
}

const SOURCES = ['#3366cc', '#ff0088', '#00a86b', '#f59e0b', '#7c3aed'];
const SMOOTHINGS = [0, 0.35, 1];

describe('generateRamp gamut target', () => {
  it('keeps every step in sRGB and emits no P3 representation', () => {
    // Chroma is requested far past the sRGB boundary, so the clamp is doing the work.
    const scale = withMaxChroma(makeScale('#ff0088'));
    const ramp = generateRamp(scale, { gamut: 'srgb' });

    for (const step of ramp.steps) {
      expect(step.gamut).toBe('srgb');
      expect(step.p3).toBeUndefined();
      expect(step.displayP3).toBeUndefined();
      expect(step.oklch.c).toBeLessThanOrEqual(step.maxSrgbC + 1e-9);
    }
  });

  it('reaches into P3 for the same scale when the target is p3', () => {
    const scale = withMaxChroma(makeScale('#ff0088'));
    const ramp = generateRamp(scale, { gamut: 'p3' });

    expect(ramp.steps.some((step) => step.gamut === 'p3')).toBe(true);
    for (const step of ramp.steps) {
      expect(step.oklch.c).toBeLessThanOrEqual(step.maxP3C + 1e-9);
      if (step.gamut === 'p3') {
        expect(step.displayP3).toMatch(/^color\(display-p3 /);
        expect(step.p3).toBeDefined();
      }
    }
  });

  it('defaults to p3 so existing callers are unaffected', () => {
    const scale = withMaxChroma(makeScale('#ff0088'));
    expect(generateRamp(scale)).toEqual(generateRamp(scale, { gamut: 'p3' }));
  });

  it('always carries an sRGB hex fallback, even for P3 steps', () => {
    const ramp = generateRamp(withMaxChroma(makeScale('#00a86b')), { gamut: 'p3' });
    for (const step of ramp.steps) {
      expect(step.hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('pinChromaCurveToGamut', () => {
  for (const gamut of ['srgb', 'p3'] as const) {
    for (const smoothing of SMOOTHINGS) {
      it(`pins every step onto the ${gamut} boundary (smoothing ${smoothing})`, () => {
        for (const sourceHex of SOURCES) {
          const base = makeScale(sourceHex);
          const scale: ColorScale = {
            ...base,
            curves: { ...base.curves, chroma: { ...base.curves.chroma, smoothing } },
          };

          const pinned = applyPin(scale, gamut);
          const ramp = generateRamp(pinned, { gamut });

          for (const step of ramp.steps) {
            const ceiling = gamut === 'srgb' ? step.maxSrgbC : step.maxP3C;
            expect(step.oklch.c).toBeCloseTo(ceiling, 6);
          }

          const validation = validateRampGamut(ramp, gamut);
          expect(validation.ok).toBe(true);
          expect(validation.pinnedCount).toBe(ramp.steps.length);
          expect(validation.maxShortfall).toBeLessThan(1e-4);
        }
      });
    }
  }

  it('keeps an sRGB pin inside sRGB even when the ramp may reach into P3', () => {
    // The failure mode this guards: chroma smoothing mixes each interior step
    // with its neighbours, so pinned values drift above the sRGB ceiling and the
    // P3 target clamp happily admits them.
    const base = makeScale('#ff0088');
    const scale: ColorScale = {
      ...base,
      curves: { ...base.curves, chroma: { ...base.curves.chroma, smoothing: 1 } },
    };

    const ramp = generateRamp(applyPin(scale, 'srgb'), { gamut: 'p3' });

    expect(validateRampGamut(ramp, 'srgb').ok).toBe(true);
    for (const step of ramp.steps) {
      expect(step.gamut).toBe('srgb');
      expect(step.displayP3).toBeUndefined();
    }
  });

  it('zeroes chroma smoothing, which is what keeps the pin exact', () => {
    const scale = makeScale('#3366cc');
    const pin = pinChromaCurveToGamut(scale, 'p3');
    expect(pin.smoothing).toBe(0);
    expect(pin.values).toHaveLength(scale.stepCount);
  });

  it('matches the per-step boundary search for the scale geometry', () => {
    const scale = makeScale('#7c3aed');
    const ramp = generateRamp(scale, { gamut: 'p3' });
    const srgbPin = pinChromaCurveToGamut(scale, 'srgb');
    const p3Pin = pinChromaCurveToGamut(scale, 'p3');

    ramp.steps.forEach((step, i) => {
      expect(srgbPin.values[i]).toBeCloseTo(maxSrgbChroma(step.oklch.l, step.oklch.h), 9);
      expect(p3Pin.values[i]).toBeCloseTo(maxP3Chroma(step.oklch.l, step.oklch.h), 9);
      expect(srgbPin.values[i]).toBeLessThanOrEqual(p3Pin.values[i]!);
    });
  });
});

describe('validateRampGamut', () => {
  it('reports P3 steps as offenders when validated against sRGB', () => {
    const ramp = generateRamp(withMaxChroma(makeScale('#ff0088')), { gamut: 'p3' });
    const validation = validateRampGamut(ramp, 'srgb');

    expect(validation.ok).toBe(false);
    expect(validation.offenders.length).toBeGreaterThan(0);
    for (const offender of validation.offenders) {
      expect(offender.gamut).toBe('p3');
      expect(offender.overshoot).toBeGreaterThan(0);
    }
  });

  it('reports a low-chroma ramp as in-gamut but not pinned to the boundary', () => {
    const base = makeScale('#3366cc');
    const scale: ColorScale = {
      ...base,
      curves: { ...base.curves, chroma: { values: Array<number>(base.stepCount).fill(0.01) } },
    };
    const ramp = generateRamp(scale, { gamut: 'p3' });
    const validation = validateRampGamut(ramp, 'p3');

    expect(validation.ok).toBe(true);
    // Near-white steps have a chroma ceiling below 0.01 and so land on the
    // boundary anyway; every mid-ramp step is well inside it.
    expect(validation.pinnedCount).toBeLessThan(ramp.steps.length - 1);
    expect(validation.maxShortfall).toBeGreaterThan(0.05);
  });
});
