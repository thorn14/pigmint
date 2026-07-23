import { describe, it, expect } from 'vitest';
import {
  blendEasing,
  buildLightnessFromEnds,
  easingFamilyHasVariants,
  powerEasing,
  resolveEasingFunction,
} from '../src/index.js';

describe('powerEasing', () => {
  it('is identity at bias 0', () => {
    const ease = powerEasing(0);
    expect(ease(0)).toBe(0);
    expect(ease(0.5)).toBeCloseTo(0.5, 8);
    expect(ease(1)).toBe(1);
  });

  it('packs toward start when bias is negative', () => {
    const ease = powerEasing(-1);
    // exp = 0.5 → sqrt, so mid t maps above the diagonal
    expect(ease(0.25)).toBeGreaterThan(0.25);
  });

  it('packs toward end when bias is positive', () => {
    const ease = powerEasing(1);
    // exp = 2 → t², so mid t maps below the diagonal
    expect(ease(0.5)).toBeCloseTo(0.25, 8);
    expect(ease(0.5)).toBeLessThan(0.5);
  });
});

describe('blendEasing', () => {
  it('returns linear at amount 0', () => {
    const ease = blendEasing((t) => t * t, 0);
    expect(ease(0.5)).toBeCloseTo(0.5, 8);
  });

  it('returns the base curve at amount 1', () => {
    const ease = blendEasing((t) => t * t, 1);
    expect(ease(0.5)).toBeCloseTo(0.25, 8);
  });

  it('sits between linear and full at amount 0.5', () => {
    const ease = blendEasing((t) => t * t, 0.5);
    expect(ease(0.5)).toBeCloseTo(0.375, 8);
  });
});

describe('resolveEasingFunction', () => {
  it('resolves custom via curveBias', () => {
    const ease = resolveEasingFunction('custom', 'inOut', { curveBias: 1 });
    expect(ease(0.5)).toBeCloseTo(0.25, 8);
  });

  it('blends named easings by amount', () => {
    const full = resolveEasingFunction('quadratic', 'in');
    const half = resolveEasingFunction('quadratic', 'in', { amount: 0.5 });
    expect(half(0.5)).toBeCloseTo((0.5 + full(0.5)) / 2, 8);
  });

  it('marks custom and linear as variant-less', () => {
    expect(easingFamilyHasVariants('custom')).toBe(false);
    expect(easingFamilyHasVariants('linear')).toBe(false);
    expect(easingFamilyHasVariants('cubic')).toBe(true);
  });
});

describe('buildLightnessFromEnds', () => {
  it('preserves endpoints for custom power easing', () => {
    const values = buildLightnessFromEnds(0.98, 0.13, 5, powerEasing(0.5));
    expect(values).toHaveLength(5);
    expect(values[0]).toBeCloseTo(0.98, 8);
    expect(values[4]).toBeCloseTo(0.13, 8);
  });

  it('is linear by default', () => {
    const values = buildLightnessFromEnds(1, 0, 5);
    expect(values[2]).toBeCloseTo(0.5, 8);
  });
});
