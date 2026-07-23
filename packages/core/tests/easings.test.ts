import { describe, it, expect } from 'vitest';
import {
  blendEasing,
  buildLightnessFromEnds,
  easingFamilyHasVariants,
  sBendEasing,
  resolveEasingFunction,
} from '../src/index.js';

describe('sBendEasing', () => {
  it('is identity at bias 0', () => {
    const ease = sBendEasing(0);
    expect(ease(0)).toBe(0);
    expect(ease(0.25)).toBeCloseTo(0.25, 8);
    expect(ease(0.5)).toBeCloseTo(0.5, 8);
    expect(ease(0.75)).toBeCloseTo(0.75, 8);
    expect(ease(1)).toBe(1);
  });

  it('forms a symmetric S-bend when bias is positive', () => {
    const ease = sBendEasing(1);
    // Packs toward ends: below diagonal in the first half, above in the second.
    expect(ease(0.25)).toBeLessThan(0.25);
    expect(ease(0.5)).toBeCloseTo(0.5, 8);
    expect(ease(0.75)).toBeGreaterThan(0.75);
    // Symmetry around midpoint.
    expect(ease(0.25)).toBeCloseTo(1 - ease(0.75), 8);
  });

  it('forms an inverted S when bias is negative', () => {
    const ease = sBendEasing(-1);
    // Packs toward middle: above diagonal in the first half, below in the second.
    expect(ease(0.25)).toBeGreaterThan(0.25);
    expect(ease(0.5)).toBeCloseTo(0.5, 8);
    expect(ease(0.75)).toBeLessThan(0.75);
    expect(ease(0.25)).toBeCloseTo(1 - ease(0.75), 8);
  });

  it('grows stronger as |bias| increases', () => {
    const mild = sBendEasing(0.35);
    const strong = sBendEasing(1);
    expect(strong(0.25)).toBeLessThan(mild(0.25));
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
  it('resolves custom via S-bend curveBias', () => {
    const ease = resolveEasingFunction('custom', 'inOut', { curveBias: 1 });
    expect(ease(0.25)).toBeLessThan(0.25);
    expect(ease(0.5)).toBeCloseTo(0.5, 8);
    expect(ease(0.75)).toBeGreaterThan(0.75);
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
  it('preserves endpoints for custom S-bend easing', () => {
    const values = buildLightnessFromEnds(0.98, 0.13, 5, sBendEasing(0.75));
    expect(values).toHaveLength(5);
    expect(values[0]).toBeCloseTo(0.98, 8);
    expect(values[4]).toBeCloseTo(0.13, 8);
  });

  it('is linear by default', () => {
    const values = buildLightnessFromEnds(1, 0, 5);
    expect(values[2]).toBeCloseTo(0.5, 8);
  });
});
