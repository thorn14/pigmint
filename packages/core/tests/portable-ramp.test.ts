import { describe, expect, it } from 'vitest';
import { coerceTokenRampToPaletteScales, remapPortableVocabularyRamps } from '../src/index.js';

describe('coerceTokenRampToPaletteScales', () => {
  it('maps unknown ramp to first scale', () => {
    const out = coerceTokenRampToPaletteScales({ a: 'gray', b: 'blue' }, ['blue', 'red']);
    expect(out).toEqual({ a: 'blue', b: 'blue' });
  });

  it('normalizes case to palette scale name', () => {
    const out = coerceTokenRampToPaletteScales({ x: 'BLUE' }, ['Blue']);
    expect(out).toEqual({ x: 'Blue' });
  });
});

describe('remapPortableVocabularyRamps', () => {
  it('remaps case-insensitively when a ramp is deleted', () => {
    const vocab = {
      surfaces: { main: { ramp: 'gray', step: 4 } },
      foreground: { fg: { ramp: 'Gray', surfaces: ['main'], preference: 'lowest-passing' as const } },
      nonText: {},
    };
    const out = remapPortableVocabularyRamps(vocab, ['gray'], 'blue');
    expect(out.surfaces.main.ramp).toBe('blue');
    expect(out.foreground.fg.ramp).toBe('blue');
  });
});
