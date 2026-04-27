import { create } from 'zustand';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import {
  validatePortableVocabulary,
  portableToVocabularyEntries,
  buildSurfacePaths,
  buildSurfaceStepMap,
  type PortableVocabulary,
  type PortableSurfaceToken,
  type PortableSemanticToken,
  type PortableDecorativeToken,
} from '@pigmint/core';
import type { VocabularyEntry, EngineConfig, SurfaceStepDecl } from '@pigmint/core';
import { usePaletteStore } from './paletteStore';

const LEGACY_STORAGE_KEY = 'pigmint:vocab:v1';

export interface VocabState {
  raw: PortableVocabulary | null;
  entries: VocabularyEntry[] | null;
  surfacePaths: Set<string> | null;
  surfaceSteps: Map<string, SurfaceStepDecl> | null;
  error: string | null;
}

interface VocabActions {
  loadFromText(yamlText: string, engineConfig: EngineConfig): void;
  loadFromVocab(vocab: PortableVocabulary | null, engineConfig: EngineConfig): void;

  addSurface(name: string, token: PortableSurfaceToken, engineConfig: EngineConfig): void;
  updateSurface(name: string, updates: Partial<PortableSurfaceToken>, engineConfig: EngineConfig): void;
  removeSurface(name: string, engineConfig: EngineConfig): void;

  addToken(section: 'foreground' | 'nonText', name: string, token: PortableSemanticToken, engineConfig: EngineConfig): void;
  updateToken(section: 'foreground' | 'nonText', name: string, updates: Partial<PortableSemanticToken>, engineConfig: EngineConfig): void;
  addDecorative(name: string, token: PortableDecorativeToken, engineConfig: EngineConfig): void;
  removeToken(section: 'foreground' | 'nonText' | 'decorative', name: string, engineConfig: EngineConfig): void;

  exportYaml(): string;
  clear(): void;
}

function deriveArtifacts(vocab: PortableVocabulary, engineConfig: EngineConfig): Pick<VocabState, 'entries' | 'surfacePaths' | 'surfaceSteps'> {
  return {
    entries: portableToVocabularyEntries(vocab, engineConfig),
    surfacePaths: buildSurfacePaths(vocab),
    surfaceSteps: buildSurfaceStepMap(vocab),
  };
}

function syncToPalette(vocab: PortableVocabulary | null) {
  usePaletteStore.getState().updateActiveVocab(vocab);
}

const EMPTY_VOCAB: PortableVocabulary = { surfaces: {}, foreground: {}, nonText: {} };

function applyMutation(
  prev: PortableVocabulary | null,
  mutate: (v: PortableVocabulary) => PortableVocabulary,
  engineConfig: EngineConfig,
): Partial<VocabState> {
  const base = prev ?? EMPTY_VOCAB;
  try {
    const next = mutate(base);
    syncToPalette(next);
    return { raw: next, error: null, ...deriveArtifacts(next, engineConfig) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export const useVocabStore = create<VocabState & VocabActions>()((set, get) => {
  return {
    raw: null,
    entries: null,
    surfacePaths: null,
    surfaceSteps: null,
    error: null,

    loadFromText(yamlText, engineConfig) {
      try {
        const parsed = parseYaml(yamlText);
        const vocab = validatePortableVocabulary(parsed, '(pasted)');
        syncToPalette(vocab);
        set({ raw: vocab, error: null, ...deriveArtifacts(vocab, engineConfig) });
      } catch (e) {
        set({ error: (e as Error).message });
      }
    },

    // Called when loading FROM the palette store (palette switch, init). Does NOT sync back.
    loadFromVocab(vocab, engineConfig) {
      if (!vocab) {
        set({ raw: null, entries: null, surfacePaths: null, surfaceSteps: null, error: null });
        return;
      }
      set({ raw: vocab, error: null, ...deriveArtifacts(vocab, engineConfig) });
    },

    addSurface(name, token, engineConfig) {
      set(applyMutation(get().raw, (v) => ({
        ...v,
        surfaces: { ...v.surfaces, [name]: token },
      }), engineConfig));
    },

    updateSurface(name, updates, engineConfig) {
      set(applyMutation(get().raw, (v) => {
        const existing = v.surfaces[name];
        if (!existing) return v;
        return { ...v, surfaces: { ...v.surfaces, [name]: { ...existing, ...updates } } };
      }, engineConfig));
    },

    removeSurface(name, engineConfig) {
      set(applyMutation(get().raw, (v) => {
        const { [name]: _, ...rest } = v.surfaces;
        return { ...v, surfaces: rest };
      }, engineConfig));
    },

    addToken(section, name, token, engineConfig) {
      set(applyMutation(get().raw, (v) => ({
        ...v,
        [section]: { ...v[section], [name]: token },
      }), engineConfig));
    },

    updateToken(section, name, updates, engineConfig) {
      set(applyMutation(get().raw, (v) => {
        const existing = v[section][name];
        if (!existing) return v;
        return { ...v, [section]: { ...v[section], [name]: { ...existing, ...updates } } };
      }, engineConfig));
    },

    addDecorative(name, token, engineConfig) {
      set(applyMutation(get().raw, (v) => ({
        ...v,
        decorative: { ...(v.decorative ?? {}), [name]: token },
      }), engineConfig));
    },

    removeToken(section, name, engineConfig) {
      set(applyMutation(get().raw, (v) => {
        const sectionMap = v[section] as Record<string, unknown> ?? {};
        const { [name]: _, ...rest } = sectionMap;
        return { ...v, [section]: rest };
      }, engineConfig));
    },

    exportYaml() {
      const raw = get().raw;
      if (!raw) return '';
      return stringifyYaml(raw);
    },

    clear() {
      syncToPalette(null);
      set({ raw: null, entries: null, surfacePaths: null, surfaceSteps: null, error: null });
    },
  };
});

export function initVocabStore(engineConfig: EngineConfig) {
  // Migrate legacy global vocab key into active palette on first run
  const ps = usePaletteStore.getState();
  const activePalette = ps.savedPalettes.find((p) => p.id === ps.activePaletteId);

  let vocab: PortableVocabulary | null = activePalette?.vocab ?? null;

  if (!vocab && typeof localStorage !== 'undefined') {
    try {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        vocab = JSON.parse(legacy) as PortableVocabulary;
        // Migrate into active palette
        ps.updateActiveVocab(vocab);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    } catch { /* ignore */ }
  }

  if (vocab) {
    try {
      useVocabStore.getState().loadFromVocab(vocab, engineConfig);
    } catch { /* invalid vocab — leave empty */ }
  }
}
