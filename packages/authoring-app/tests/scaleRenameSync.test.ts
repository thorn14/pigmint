import { describe, expect, it } from 'vitest';
import { usePaletteStore } from '../src/store/paletteStore';
import { useVocabStore } from '../src/store/vocabStore';
import type { EngineConfig, PortableVocabulary } from '@pigmint/core';

const ENGINE: EngineConfig = { compliance: 'wcag21', target: 'AA', modes: ['light'] };

describe('scale rename ↔ vocab ramp sync', () => {
  it('rename rewrites token ramp refs, and undo/redo keep refs in sync (P2)', () => {
    usePaletteStore.getState().addScale('#3366cc', 'Blue');
    const scale = usePaletteStore.getState().scales.find((s) => s.name === 'Blue');
    expect(scale).toBeDefined();
    const id = scale!.id;
    const origName = scale!.name;

    // Vocab references the scale by its current name.
    const vocab: PortableVocabulary = {
      surfaces: { page: { ramp: origName, step: 0 } },
      foreground: { text: { ramp: origName, surfaces: ['page'], preference: 'lowest-passing' } },
      nonText: {},
    };
    useVocabStore.getState().clear();
    useVocabStore.getState().loadFromVocab(vocab, ENGINE);

    // Rename → token ramp refs follow.
    usePaletteStore.getState().updateScaleName(id, 'RenamedRamp');
    expect(usePaletteStore.getState().scales.find((s) => s.id === id)?.name).toBe('RenamedRamp');
    expect(useVocabStore.getState().raw?.foreground.text?.ramp).toBe('RenamedRamp');
    expect(useVocabStore.getState().raw?.surfaces.page?.ramp).toBe('RenamedRamp');

    // Undo → both the scale name and the ramp refs revert together.
    usePaletteStore.getState().undo();
    expect(usePaletteStore.getState().scales.find((s) => s.id === id)?.name).toBe(origName);
    expect(useVocabStore.getState().raw?.foreground.text?.ramp).toBe(origName);
    expect(useVocabStore.getState().raw?.surfaces.page?.ramp).toBe(origName);

    // Redo → forward again, still in sync.
    usePaletteStore.getState().redo();
    expect(usePaletteStore.getState().scales.find((s) => s.id === id)?.name).toBe('RenamedRamp');
    expect(useVocabStore.getState().raw?.foreground.text?.ramp).toBe('RenamedRamp');
    expect(useVocabStore.getState().raw?.surfaces.page?.ramp).toBe('RenamedRamp');
  });
});
