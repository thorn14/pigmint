import { describe, expect, it } from 'vitest';
import { VOCABULARY_V1_SLICE, buildDefaultCurves, hexToOklch } from '@pigmint/core';
import { buildTokenRamp, runResolve } from '../src/lib/resolveState';
import type { ColorScale } from '../src/types/palette';

function makeScale(name: string, hex: string): ColorScale {
  const sourceOklch = hexToOklch(hex);
  return {
    id: name,
    name,
    sourceHex: hex,
    sourceOklch,
    sourceAlpha: 1,
    stepCount: 11,
    naming: { preset: 'tailwind' },
    curves: buildDefaultCurves(sourceOklch, 11),
    hueShift: { lightEndAdjust: 0, darkEndAdjust: 0 },
    lightnessPreset: 'tailwind',
    chromaPeak: sourceOklch.c,
  };
}

describe('buildTokenRamp', () => {
  it('routes surfaces + foregrounds to neutral, others to accent', () => {
    const map = buildTokenRamp(VOCABULARY_V1_SLICE, ['neutral', 'blue']);
    expect(map['color.surface.main']).toBe('neutral');
    expect(map['color.surface.inverse']).toBe('neutral');
    expect(map['color.foreground.main']).toBe('neutral');
    expect(map['color.action.primary.background']).toBe('blue');
  });

  it('falls back to the single available ramp when there is no accent', () => {
    const map = buildTokenRamp(VOCABULARY_V1_SLICE, ['neutral']);
    expect(map['color.action.primary.background']).toBe('neutral');
  });

  it('returns an empty map when no ramps are available', () => {
    expect(buildTokenRamp(VOCABULARY_V1_SLICE, [])).toEqual({});
  });
});

describe('runResolve', () => {
  it('returns a friendly failure when no scales are provided', () => {
    const state = runResolve([], ['light'], 'AA', {});
    expect(state.ok).toBe(false);
    if (!state.ok) expect(state.error).toMatch(/Add at least one ramp/);
  });

  it('resolves every vocabulary token across every requested mode', () => {
    const scales = [makeScale('neutral', '#888888'), makeScale('blue', '#3366cc')];
    const state = runResolve(scales, ['light', 'dark'], 'AA', {});
    expect(state.ok).toBe(true);
    if (!state.ok) return;
    const modes = new Set(state.tokens.map((t) => t.mode));
    expect(modes).toEqual(new Set(['light', 'dark']));
    const lightPaths = state.tokens.filter((t) => t.mode === 'light').map((t) => t.path).sort();
    expect(lightPaths).toEqual(
      [...VOCABULARY_V1_SLICE.map((e) => e.path)].sort(),
    );
  });

  it('applies intent overrides so the resolved receipt reflects them', () => {
    const scales = [makeScale('neutral', '#888888'), makeScale('blue', '#3366cc')];
    const base = runResolve(scales, ['light'], 'AA', {});
    const overridden = runResolve(scales, ['light'], 'AA', {
      'color.action.primary.background': { preference: 'highest-contrast' },
    });
    expect(base.ok && overridden.ok).toBe(true);
    if (!base.ok || !overridden.ok) return;
    const baseBtn = base.tokens.find((t) => t.path === 'color.action.primary.background');
    const overBtn = overridden.tokens.find((t) => t.path === 'color.action.primary.background');
    expect(baseBtn!.intent.preference).toBe('lowest-passing');
    expect(overBtn!.intent.preference).toBe('highest-contrast');
    expect(overBtn!.source.position).not.toBe(baseBtn!.source.position);
  });
});
