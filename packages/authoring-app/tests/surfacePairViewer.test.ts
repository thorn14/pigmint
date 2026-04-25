import { describe, expect, it } from 'vitest';
import {
  buildDefaultCurves,
  hexToOklch,
  buildDefaultTokenRamp,
  VOCABULARY_V1_SLICE,
} from '@pigmint/core';
import { runResolve, type ResolveVocabContext } from '../src/lib/resolveState';
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

function makeVocabCtx(rampNames: string[]): ResolveVocabContext {
  const tokenRamp = buildDefaultTokenRamp(VOCABULARY_V1_SLICE, rampNames);
  return { vocabulary: VOCABULARY_V1_SLICE, tokenRamp };
}

describe('runResolve', () => {
  it('returns a friendly failure when no vocabulary is loaded', () => {
    const state = runResolve([], ['light'], 'AA', 'wcag21', null);
    expect(state.ok).toBe(false);
    if (!state.ok) expect(state.error).toMatch(/tokens\.yaml/i);
  });

  it('returns a friendly failure when no scales are provided', () => {
    const vocabCtx = makeVocabCtx(['neutral', 'blue']);
    const state = runResolve([], ['light'], 'AA', 'wcag21', vocabCtx);
    expect(state.ok).toBe(false);
    if (!state.ok) expect(state.error).toMatch(/Primitives/i);
  });

  it('resolves every vocabulary token across every requested mode', () => {
    const scales = [makeScale('neutral', '#888888'), makeScale('blue', '#3366cc')];
    const vocabCtx = makeVocabCtx(['neutral', 'blue']);
    const state = runResolve(scales, ['light', 'dark'], 'AA', 'wcag21', vocabCtx);
    expect(state.ok).toBe(true);
    if (!state.ok) return;
    const modes = new Set(state.tokens.map((t) => t.mode));
    expect(modes).toEqual(new Set(['light', 'dark']));
    const lightPaths = state.tokens.filter((t) => t.mode === 'light').map((t) => t.path).sort();
    expect(lightPaths).toEqual(
      [...VOCABULARY_V1_SLICE.map((e) => e.path)].sort(),
    );
  });
});
