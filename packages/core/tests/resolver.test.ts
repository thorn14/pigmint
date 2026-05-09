import { describe, it, expect } from 'vitest';
import {
  buildDefaultCurves,
  buildResolvedValue,
  generateRamp,
  getWcagContrast,
  hexToOklch,
  resolveToken,
  ResolveError,
} from '../src/index.js';
import type { ColorScale, FormalIntent } from '../src/index.js';

function makeRamp(sourceHex: string, name: string): ReturnType<typeof generateRamp> {
  const sourceOklch = hexToOklch(sourceHex);
  const curves = buildDefaultCurves(sourceOklch, 11);
  const scale: ColorScale = {
    id: name,
    name,
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
  return generateRamp(scale);
}

const aaTextIntent: FormalIntent = {
  threshold: { kind: 'wcag', level: 'AA', usage: 'text' },
  preference: 'lowest-passing',
  consistency: 'independent',
  surfaceContext: 'primary',
};

describe('resolveToken — lowest-passing + independent + WCAG AA text', () => {
  it('picks the ramp step that just passes 4.5:1 against white', () => {
    const blue = makeRamp('#3366cc', 'blue');
    const { token, step } = resolveToken({
      tokenPath: 'color.action.primary.foreground',
      mode: 'light',
      intent: aaTextIntent,
      ramp: blue,
      surfaceHex: '#ffffff',
      surfaceRef: '{color.surface.main.bg}',
    });

    expect(token.compliance?.level).toBe('AA-text');
    expect(token.contrast?.wcag21).toBeGreaterThanOrEqual(4.5);
    expect(token.source.ramp).toBe('blue');
    expect(token.source.nearestPrimitive).toBe(`blue.${step.name}`);

    const lighter = blue.steps.findIndex((s) => s.name === step.name) - 1;
    if (lighter >= 0) {
      const lighterStep = blue.steps[lighter]!;
      const lighterRatio = getWcagContrast(lighterStep.hex, '#ffffff').ratio;
      expect(lighterRatio).toBeLessThan(4.5);
    }
  });

  it('throws when no step can meet the threshold', () => {
    const neutral = makeRamp('#888888', 'neutral');
    const aaaText: FormalIntent = {
      ...aaTextIntent,
      threshold: { kind: 'wcag', level: 'AAA', usage: 'text' },
    };
    expect(() =>
      resolveToken({
        tokenPath: 'color.text.primary',
        mode: 'light',
        intent: aaaText,
        ramp: neutral,
        surfaceHex: '#111111',
        surfaceRef: '{color.surface.main.bg}',
      }),
    ).not.toThrow();
  });

  it('rejects matched-to-set at per-token resolve (use driver for matched-across-ramps groups)', () => {
    const blue = makeRamp('#3366cc', 'blue');
    const unsupported: FormalIntent = { ...aaTextIntent, preference: 'matched-to-set' };
    expect(() =>
      resolveToken({
        tokenPath: 'x',
        mode: 'light',
        intent: unsupported,
        ramp: blue,
        surfaceHex: '#ffffff',
        surfaceRef: '{s}',
      }),
    ).toThrow(ResolveError);
  });

  it('picks a step with WCAG ratio closest to constraints.anchor (anchored + independent)', () => {
    const blue = makeRamp('#3366cc', 'blue');
    const { token } = resolveToken({
      tokenPath: 'x',
      mode: 'light',
      intent: {
        ...aaTextIntent,
        preference: 'anchored',
        constraints: { anchor: 6.0 },
      },
      ramp: blue,
      surfaceHex: '#ffffff',
      surfaceRef: '{s}',
    });
    expect(token.contrast?.wcag21).toBeGreaterThanOrEqual(4.5);
  });

  it('buildResolvedValue produces an oklch() string and hex', () => {
    const blue = makeRamp('#3366cc', 'blue');
    const step = blue.steps[5]!;
    const v = buildResolvedValue(step);
    expect(v.oklch).toMatch(/^oklch\(/);
    expect(v.hex).toBe(step.hex);
  });

  it('midpoint picks an index between lowest-passing and highest-contrast', () => {
    const blue = makeRamp('#3366cc', 'blue');
    const lo = resolveToken({
      tokenPath: 'lo',
      mode: 'light',
      intent: { ...aaTextIntent, preference: 'lowest-passing' },
      ramp: blue,
      surfaceHex: '#ffffff',
      surfaceRef: '{s}',
    });
    const hi = resolveToken({
      tokenPath: 'hi',
      mode: 'light',
      intent: { ...aaTextIntent, preference: 'highest-contrast' },
      ramp: blue,
      surfaceHex: '#ffffff',
      surfaceRef: '{s}',
    });
    const mid = resolveToken({
      tokenPath: 'mid',
      mode: 'light',
      intent: { ...aaTextIntent, preference: 'midpoint' },
      ramp: blue,
      surfaceHex: '#ffffff',
      surfaceRef: '{s}',
    });
    const loIdx = blue.steps.findIndex((s) => s.name === lo.step.name);
    const hiIdx = blue.steps.findIndex((s) => s.name === hi.step.name);
    const midIdx = blue.steps.findIndex((s) => s.name === mid.step.name);
    expect(midIdx).toBe(Math.round((loIdx + hiIdx) / 2));
    expect(midIdx).toBeGreaterThanOrEqual(loIdx);
    expect(midIdx).toBeLessThanOrEqual(hiIdx);
  });

  it('median picks a passing step at the median contrast ratio', () => {
    const blue = makeRamp('#3366cc', 'blue');
    const { token } = resolveToken({
      tokenPath: 'x',
      mode: 'light',
      intent: { ...aaTextIntent, preference: 'median' },
      ramp: blue,
      surfaceHex: '#ffffff',
      surfaceRef: '{s}',
    });
    expect(token.contrast?.wcag21).toBeGreaterThanOrEqual(4.5);
  });

  it('level-up picks a step that clears one tier above the configured target', () => {
    const blue = makeRamp('#3366cc', 'blue');
    // AA-text base = 4.5; level-up bumps to 7 (AAA).
    const { token } = resolveToken({
      tokenPath: 'x',
      mode: 'light',
      intent: { ...aaTextIntent, preference: 'level-up' },
      ramp: blue,
      surfaceHex: '#ffffff',
      surfaceRef: '{s}',
    });
    expect(token.contrast?.wcag21).toBeGreaterThanOrEqual(7);
  });

  it('level-up under hc elevation records a selectionNote on the receipt', () => {
    const blue = makeRamp('#3366cc', 'blue');
    const { token } = resolveToken({
      tokenPath: 'x',
      mode: 'light',
      intent: { ...aaTextIntent, preference: 'level-up' },
      ramp: blue,
      surfaceHex: '#ffffff',
      surfaceRef: '{s}',
      thresholdElevation: 'hc',
    });
    expect(token.contrast?.wcag21).toBeGreaterThanOrEqual(7);
    expect(token.source.selectionNote).toMatch(/level-up/);
  });

  it('midpoint never returns a step that fails the threshold (non-monotonic ramp)', () => {
    const blue = makeRamp('#3366cc', 'blue');
    // Inject a non-monotonic dip: copy step[0] (light, fails AA against white)
    // into the middle so the rounded midpoint between lo and hi could land on it.
    const lightStep = blue.steps[0]!;
    const broken = {
      ...blue,
      steps: blue.steps.map((s, i) => (i === Math.floor(blue.steps.length / 2) ? { ...lightStep } : s)),
    };
    const { token } = resolveToken({
      tokenPath: 'x',
      mode: 'light',
      intent: { ...aaTextIntent, preference: 'midpoint' },
      ramp: broken,
      surfaceHex: '#ffffff',
      surfaceRef: '{s}',
    });
    expect(token.contrast?.wcag21).toBeGreaterThanOrEqual(4.5);
  });
});
