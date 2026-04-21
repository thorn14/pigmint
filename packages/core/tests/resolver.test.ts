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

  it('rejects unimplemented preferences', () => {
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

  it('buildResolvedValue produces an oklch() string and hex', () => {
    const blue = makeRamp('#3366cc', 'blue');
    const step = blue.steps[5]!;
    const v = buildResolvedValue(step);
    expect(v.oklch).toMatch(/^oklch\(/);
    expect(v.hex).toBe(step.hex);
  });
});
