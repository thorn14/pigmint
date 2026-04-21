import { describe, it, expect } from 'vitest';
import {
  hexToOklch,
  oklchToHex,
  getWcagContrast,
  getApcaContrast,
  checkGamut,
  generateRamp,
  buildDefaultCurves,
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
