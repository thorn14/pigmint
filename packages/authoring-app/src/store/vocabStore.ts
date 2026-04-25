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

const STORAGE_KEY = 'pigmint:vocab:v1';

export interface VocabState {
  raw: PortableVocabulary | null;
  entries: VocabularyEntry[] | null;
  surfacePaths: Set<string> | null;
  surfaceSteps: Map<string, SurfaceStepDecl> | null;
  error: string | null;
}

interface VocabActions {
  loadFromText(yamlText: string, engineConfig: EngineConfig): void;
  loadFromVocab(vocab: PortableVocabulary, engineConfig: EngineConfig): void;

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

function saveRaw(raw: PortableVocabulary | null) {
  if (typeof localStorage === 'undefined') return;
  try {
    if (raw) localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}

function loadRaw(): PortableVocabulary | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as PortableVocabulary;
  } catch { return null; }
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
    saveRaw(next);
    return { raw: next, error: null, ...deriveArtifacts(next, engineConfig) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export const useVocabStore = create<VocabState & VocabActions>()((set, get) => {
  // Restore from localStorage at init (engine config not available yet — defer)
  const restoredRaw = loadRaw();

  return {
    raw: restoredRaw,
    entries: null,
    surfacePaths: null,
    surfaceSteps: null,
    error: null,

    loadFromText(yamlText, engineConfig) {
      try {
        const parsed = parseYaml(yamlText);
        const vocab = validatePortableVocabulary(parsed, '(pasted)');
        saveRaw(vocab);
        set({ raw: vocab, error: null, ...deriveArtifacts(vocab, engineConfig) });
      } catch (e) {
        set({ error: (e as Error).message });
      }
    },

    loadFromVocab(vocab, engineConfig) {
      saveRaw(vocab);
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
      saveRaw(null);
      set({ raw: null, entries: null, surfacePaths: null, surfaceSteps: null, error: null });
    },
  };
});

export function initVocabStore(engineConfig: EngineConfig) {
  const store = useVocabStore.getState();
  if (store.raw && !store.entries) {
    try {
      store.loadFromVocab(store.raw, engineConfig);
    } catch { /* invalid stored vocab — clear */ }
  }
}
