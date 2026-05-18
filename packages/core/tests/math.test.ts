import { describe, it, expect } from 'vitest';
import {
  hexToOklch,
  oklchToHex,
  getWcagContrast,
  getApcaContrast,
  checkGamut,
  generateRamp,
  buildDefaultCurves,
  deltaEOklch,
} from '../src/index.js';
import type { ColorScale } from '../src/index.js';

describe('oklch conversion', () => {
  it('round-trips hex → oklch → hex within 1 bit', () => {
    const inputs = ['#3366cc', '#ffffff', '#000000', '#ff0088'];
    for (const hex of inputs) {
      const o = hexToOklch(hex);
      const out = oklchToHex(o);
      expect(out.toLowerCase()).toBe(hex.toLowerCase());
    }
  });

  it('throws on invalid hex', () => {
    expect(() => hexToOklch('nope')).toThrow();
  });
});

describe('contrast', () => {
  it('WCAG black-on-white = 21', () => {
    const { ratio, level } = getWcagContrast('#000000', '#ffffff');
    expect(ratio).toBeCloseTo(21, 1);
    expect(level).toBe('AAA');
  });

  it('APCA black-on-white ≈ 106', () => {
    const lc = getApcaContrast('#000000', '#ffffff');
    expect(Math.abs(lc)).toBeGreaterThan(100);
  });
});

describe('deltaEOklch', () => {
  it('returns 0 for identical colors', () => {
    const a = { l: 0.6, c: 0.1, h: 30 };
    expect(deltaEOklch(a, a)).toBe(0);
  });

  it('matches hand-computed OKLab distance for a 30° hue shift', () => {
    const a = { l: 0.6, c: 0.1, h: 30 };
    const b = { l: 0.6, c: 0.1, h: 60 };
    // |a₀ - a₁| = |0.1·(cos30° - cos60°)| ≈ 0.0366
    // |b₀ - b₁| = |0.1·(sin30° - sin60°)| ≈ 0.0366
    // sqrt ≈ 0.0518
    expect(deltaEOklch(a, b)).toBeCloseTo(0.0518, 3);
  });

  it('is symmetric', () => {
    const a = { l: 0.5, c: 0.08, h: 200 };
    const b = { l: 0.7, c: 0.12, h: 350 };
    expect(deltaEOklch(a, b)).toBeCloseTo(deltaEOklch(b, a), 10);
  });
});

describe('gamut', () => {
  it('pure red in sRGB is srgb', () => {
    const o = hexToOklch('#ff0000');
    expect(checkGamut(o.l, o.c, o.h)).toBe('srgb');
  });

  it('extreme chroma is out-of-gamut', () => {
    expect(checkGamut(0.7, 0.35, 30)).toBe('out');
  });
});

describe('generateRamp', () => {
  it('produces stepCount steps, all with sRGB hex', () => {
    const sourceHex = '#3366cc';
    const sourceOklch = hexToOklch(sourceHex);
    const curves = buildDefaultCurves(sourceOklch, 11);
    const scale: ColorScale = {
      id: 'blue',
      name: 'blue',
      sourceHex,
      sourceOklch,
      sourceAlpha: 1,
      stepCount: 11,
      naming: { preset: 'tailwind' },
      curves,
      hueShift: { lightEndAdjust: 0, darkEndAdjust: 0 },
      lightnessPreset: 'tailwind',
      chromaPeak: sourceOklch.c,
    };
    const ramp = generateRamp(scale);
    expect(ramp.steps).toHaveLength(11);
    expect(ramp.steps[0]?.name).toBe('50');
    expect(ramp.steps[10]?.name).toBe('950');
    for (const step of ramp.steps) {
      expect(step.hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
