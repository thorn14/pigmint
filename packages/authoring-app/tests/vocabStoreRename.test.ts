import { beforeEach, describe, expect, it } from 'vitest';
import { useVocabStore } from '../src/store/vocabStore';
import { useIntentStore } from '../src/store/intentStore';
import type { EngineConfig, PortableVocabulary } from '@pigmint/core';

const ENGINE: EngineConfig = { compliance: 'wcag21', target: 'AA', modes: ['light'] };

const BASE: PortableVocabulary = {
  surfaces: {
    page: { ramp: 'gray', step: 0 },
    card: { ramp: 'gray', step: 1 },
  },
  foreground: {
    'color.foreground.text': { ramp: 'gray', surfaces: ['page'], preference: 'lowest-passing' },
  },
  nonText: {
    'color.border.subtle': { ramp: 'gray', surfaces: ['page', 'card'], preference: 'highest-contrast' },
  },
  alpha: {
    scrim: { base: 'gray.900', value: 0.4, referenceSurface: 'page' },
  },
};

beforeEach(() => {
  useVocabStore.getState().clear();
  useVocabStore.getState().loadFromVocab(structuredClone(BASE), ENGINE);
});

describe('vocabStore renames', () => {
  it('renameSurface updates the surfaces map and rewrites all references', () => {
    useVocabStore.getState().renameSurface('page', 'pageMain', ENGINE);
    const v = useVocabStore.getState().raw!;
    expect(v.surfaces.page).toBeUndefined();
    expect(v.surfaces.pageMain).toBeDefined();
    expect(v.foreground['color.foreground.text']?.surfaces).toEqual(['pageMain']);
    expect(v.nonText['color.border.subtle']?.surfaces).toEqual(['pageMain', 'card']);
    expect(v.alpha?.scrim?.referenceSurface).toBe('pageMain');
  });

  it('renameSurface preserves insertion order', () => {
    useVocabStore.getState().renameSurface('page', 'zMain', ENGINE);
    const v = useVocabStore.getState().raw!;
    expect(Object.keys(v.surfaces)).toEqual(['zMain', 'card']);
  });

  it('renameSurface and removeSurface keep the preview background pin in sync', () => {
    useIntentStore.getState().setPreviewBgSurface('page');
    useVocabStore.getState().renameSurface('page', 'pageMain', ENGINE);
    expect(useIntentStore.getState().previewBgSurface).toBe('pageMain');
    useVocabStore.getState().removeSurface('pageMain', ENGINE);
    expect(useIntentStore.getState().previewBgSurface).toBeNull();
  });

  it('renameSurface rejects collisions and sets an error', () => {
    useVocabStore.getState().renameSurface('page', 'card', ENGINE);
    expect(useVocabStore.getState().error).toMatch(/already taken|missing/);
    const v = useVocabStore.getState().raw!;
    expect(v.surfaces.page).toBeDefined();
    expect(v.surfaces.card).toBeDefined();
  });

  it('renameToken on foreground does not modify other sections', () => {
    useVocabStore.getState().renameToken('foreground', 'color.foreground.text', 'color.foreground.body', ENGINE);
    const v = useVocabStore.getState().raw!;
    expect(v.foreground['color.foreground.text']).toBeUndefined();
    expect(v.foreground['color.foreground.body']).toBeDefined();
    expect(v.nonText['color.border.subtle']).toBeDefined();
    expect(v.alpha?.scrim).toBeDefined();
  });

  it('renameAlpha updates the alpha map only', () => {
    useVocabStore.getState().renameAlpha('scrim', 'overlay', ENGINE);
    const v = useVocabStore.getState().raw!;
    expect(v.alpha?.scrim).toBeUndefined();
    expect(v.alpha?.overlay).toBeDefined();
    expect(v.alpha?.overlay?.value).toBe(0.4);
  });

  it('duplicateToken deep-copies a foreground token and places it right after the source', () => {
    useVocabStore.getState().duplicateToken('foreground', 'color.foreground.text', 'color.foreground.text-copy', ENGINE);
    const v = useVocabStore.getState().raw!;
    expect(v.foreground['color.foreground.text']).toBeDefined();
    expect(v.foreground['color.foreground.text-copy']).toEqual(v.foreground['color.foreground.text']);
    // Deep copy: mutating the source's surfaces must not affect the duplicate.
    expect(v.foreground['color.foreground.text-copy']?.surfaces).not.toBe(v.foreground['color.foreground.text']?.surfaces);
    expect(Object.keys(v.foreground)).toEqual(['color.foreground.text', 'color.foreground.text-copy']);
  });

  it('duplicateToken rejects collisions and sets an error', () => {
    useVocabStore.getState().duplicateToken('nonText', 'color.border.subtle', 'color.border.subtle', ENGINE);
    expect(useVocabStore.getState().error).toMatch(/already taken|missing/);
  });

  it('duplicateAlpha copies into the alpha map', () => {
    useVocabStore.getState().duplicateAlpha('scrim', 'scrim-copy', ENGINE);
    const v = useVocabStore.getState().raw!;
    expect(v.alpha?.scrim).toBeDefined();
    expect(v.alpha?.['scrim-copy']).toEqual(v.alpha?.scrim);
  });

  it('renameRamp rewrites every ramp reference and leaves others untouched', () => {
    const vocab: PortableVocabulary = {
      surfaces: { page: { ramp: 'gray', step: 0 }, brand: { ramp: 'blue', step: 0 } },
      foreground: { text: { ramp: 'gray', surfaces: ['page'], preference: 'lowest-passing' } },
      nonText: { border: { ramp: 'blue', surfaces: ['page'], preference: 'highest-contrast' } },
      decorative: { dot: { ramp: 'gray', step: 5 } },
      alpha: {
        scrim: { base: '{color.primitive.gray.900}', value: 0.4, referenceSurface: 'page' },
        wash: { baseRamp: 'gray', value: 0.2, surfaces: ['page'], preference: 'lowest-passing' },
      },
    };
    useVocabStore.getState().clear();
    useVocabStore.getState().loadFromVocab(vocab, ENGINE);
    useVocabStore.getState().renameRamp('gray', 'slate', ENGINE);
    const v = useVocabStore.getState().raw!;
    expect(v.surfaces.page?.ramp).toBe('slate');
    expect(v.surfaces.brand?.ramp).toBe('blue'); // untouched
    expect(v.foreground.text?.ramp).toBe('slate');
    expect(v.nonText.border?.ramp).toBe('blue'); // untouched
    expect(v.decorative?.dot?.ramp).toBe('slate');
    expect(v.alpha?.scrim?.base).toBe('{color.primitive.slate.900}');
    expect(v.alpha?.wash?.baseRamp).toBe('slate');
  });

  it('renameRamp ignores empty names so base refs are never corrupted', () => {
    const vocab: PortableVocabulary = {
      surfaces: { page: { ramp: 'gray', step: 0 } },
      foreground: { text: { ramp: 'gray', surfaces: ['page'], preference: 'lowest-passing' } },
      nonText: {},
      alpha: { scrim: { base: '{color.primitive.gray.900}', value: 0.4, referenceSurface: 'page' } },
    };
    useVocabStore.getState().clear();
    useVocabStore.getState().loadFromVocab(vocab, ENGINE);
    // Clearing the name field mid-edit must not rewrite refs to an empty ramp.
    useVocabStore.getState().renameRamp('gray', '', ENGINE);
    useVocabStore.getState().renameRamp('', 'slate', ENGINE);
    let v = useVocabStore.getState().raw!;
    expect(v.foreground.text?.ramp).toBe('gray');
    expect(v.alpha?.scrim?.base).toBe('{color.primitive.gray.900}');
    // A real (non-empty) rename afterwards still works end-to-end.
    useVocabStore.getState().renameRamp('gray', 'slate', ENGINE);
    v = useVocabStore.getState().raw!;
    expect(v.foreground.text?.ramp).toBe('slate');
    expect(v.alpha?.scrim?.base).toBe('{color.primitive.slate.900}');
  });

  it('renameRamp is a no-op when old === new', () => {
    useVocabStore.getState().renameRamp('gray', 'gray', ENGINE);
    const v = useVocabStore.getState().raw!;
    expect(v.surfaces.page?.ramp).toBe('gray');
  });

  it('renames are no-ops when old === new', () => {
    useVocabStore.getState().renameSurface('page', 'page', ENGINE);
    expect(useVocabStore.getState().error).toBeNull();
    expect(useVocabStore.getState().raw?.surfaces.page).toBeDefined();
  });

  it('moveToken converts foreground → nonText (and back), preserving the token shape', () => {
    useVocabStore.getState().moveToken('foreground', 'nonText', 'color.foreground.text', ENGINE);
    let v = useVocabStore.getState().raw!;
    expect(v.foreground['color.foreground.text']).toBeUndefined();
    expect(v.nonText['color.foreground.text']?.preference).toBe('lowest-passing');

    useVocabStore.getState().moveToken('nonText', 'foreground', 'color.foreground.text', ENGINE);
    v = useVocabStore.getState().raw!;
    expect(v.nonText['color.foreground.text']).toBeUndefined();
    expect(v.foreground['color.foreground.text']?.preference).toBe('lowest-passing');
  });

  it('moveToken refuses to overwrite a colliding name in the target section', () => {
    // Add a duplicate-named token to the nonText section first.
    useVocabStore.getState().addToken('nonText', 'color.foreground.text', { ramp: 'gray', surfaces: ['page'], preference: 'highest-contrast' }, ENGINE);
    useVocabStore.getState().moveToken('foreground', 'nonText', 'color.foreground.text', ENGINE);
    expect(useVocabStore.getState().error).toMatch(/already taken/);
    const v = useVocabStore.getState().raw!;
    expect(v.foreground['color.foreground.text']).toBeDefined();
    expect(v.nonText['color.foreground.text']?.preference).toBe('highest-contrast');
  });
});

describe('vocabStore round-trip preserves new fields', () => {
  it('YAML export then import keeps decorative + targetContrast', () => {
    const portable: PortableVocabulary = {
      surfaces: { page: { ramp: 'gray', step: 0 } },
      foreground: {
        'color.foreground.muted': {
          ramp: 'gray',
          surfaces: ['page'],
          preference: 'preferred-contrast',
          targetContrast: 5.5,
          decorative: true,
        },
      },
      nonText: {},
    };
    useVocabStore.getState().clear();
    useVocabStore.getState().loadFromVocab(portable, ENGINE);
    const yaml = useVocabStore.getState().exportYaml();
    useVocabStore.getState().clear();
    useVocabStore.getState().loadFromText(yaml, ENGINE);
    const v = useVocabStore.getState().raw!;
    expect(v.foreground['color.foreground.muted']?.preference).toBe('preferred-contrast');
    expect(v.foreground['color.foreground.muted']?.targetContrast).toBe(5.5);
    expect(v.foreground['color.foreground.muted']?.decorative).toBe(true);
  });
});
