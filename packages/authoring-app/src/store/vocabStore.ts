import { create } from 'zustand';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import {
  validatePortableVocabulary,
  portableToVocabularyEntries,
  buildSurfacePaths,
  buildSurfaceStepMap,
  buildSemanticStepMap,
  remapPortableVocabularyRamps,
  type PortableVocabulary,
  type PortableSurfaceToken,
  type PortableSemanticToken,
  type PortableDecorativeToken,
  type PortableAlphaToken,
} from '@pigmint/core';
import type { VocabularyEntry, EngineConfig, SurfaceStepDecl } from '@pigmint/core';
import { usePaletteStore } from './paletteStore';
import { useIntentStore } from './intentStore';

const LEGACY_STORAGE_KEY = 'pigmint:vocab:v1';

export interface VocabState {
  raw: PortableVocabulary | null;
  entries: VocabularyEntry[] | null;
  surfacePaths: Set<string> | null;
  surfaceSteps: Map<string, SurfaceStepDecl> | null;
  semanticSteps: Map<string, SurfaceStepDecl> | null;
  error: string | null;
}

interface VocabActions {
  loadFromText(yamlText: string, engineConfig: EngineConfig): void;
  loadFromVocab(vocab: PortableVocabulary | null, engineConfig: EngineConfig): void;

  addSurface(name: string, token: PortableSurfaceToken, engineConfig: EngineConfig): void;
  updateSurface(name: string, updates: Partial<PortableSurfaceToken>, engineConfig: EngineConfig): void;
  removeSurface(name: string, engineConfig: EngineConfig): void;
  renameSurface(oldName: string, newName: string, engineConfig: EngineConfig): void;

  renameRamp(oldName: string, newName: string, engineConfig: EngineConfig): void;

  addToken(section: 'foreground' | 'nonText', name: string, token: PortableSemanticToken, engineConfig: EngineConfig): void;
  updateToken(section: 'foreground' | 'nonText', name: string, updates: Partial<PortableSemanticToken>, engineConfig: EngineConfig): void;
  addDecorative(name: string, token: PortableDecorativeToken, engineConfig: EngineConfig): void;
  removeToken(section: 'foreground' | 'nonText' | 'decorative', name: string, engineConfig: EngineConfig): void;
  renameToken(section: 'foreground' | 'nonText' | 'decorative', oldName: string, newName: string, engineConfig: EngineConfig): void;
  moveToken(from: 'foreground' | 'nonText', to: 'foreground' | 'nonText', name: string, engineConfig: EngineConfig): void;

  addAlpha(name: string, token: PortableAlphaToken, engineConfig: EngineConfig): void;
  updateAlpha(name: string, updates: Partial<PortableAlphaToken>, engineConfig: EngineConfig): void;
  removeAlpha(name: string, engineConfig: EngineConfig): void;
  renameAlpha(oldName: string, newName: string, engineConfig: EngineConfig): void;

  exportYaml(): string;
  clear(): void;
}

function deriveArtifacts(vocab: PortableVocabulary, engineConfig: EngineConfig): Pick<VocabState, 'entries' | 'surfacePaths' | 'surfaceSteps' | 'semanticSteps'> {
  return {
    entries: portableToVocabularyEntries(vocab, engineConfig),
    surfacePaths: buildSurfacePaths(vocab),
    surfaceSteps: buildSurfaceStepMap(vocab),
    semanticSteps: buildSemanticStepMap(vocab),
  };
}

function syncToPalette(vocab: PortableVocabulary | null) {
  usePaletteStore.getState().updateActiveVocab(vocab);
}

const EMPTY_VOCAB: PortableVocabulary = { surfaces: {}, foreground: {}, nonText: {} };

/**
 * Rebuild a record with `oldKey` renamed to `newKey`, preserving insertion order.
 * Returns null if oldKey is missing or newKey already collides.
 */
function renameKey<T>(map: Record<string, T>, oldKey: string, newKey: string): Record<string, T> | null {
  if (!(oldKey in map)) return null;
  if (oldKey === newKey) return map;
  if (newKey in map) return null;
  const out: Record<string, T> = {};
  for (const k of Object.keys(map)) {
    out[k === oldKey ? newKey : k] = map[k]!;
  }
  return out;
}

/**
 * When a surface is renamed, downstream tokens that refer to it by name must
 * be updated. Surface refs live in: foreground/nonText `surfaces[]`, and
 * alpha `surfaces[]` + `referenceSurface`. Token names in foreground/nonText/
 * decorative/alpha are only referenced by their own section keys, so renaming
 * one of those does not require any downstream rewrites.
 */
function rewriteSurfaceRefs(vocab: PortableVocabulary, oldName: string, newName: string): PortableVocabulary {
  const swap = (s: string) => (s === oldName ? newName : s);
  const swapArr = (arr: string[]) => arr.map(swap);

  const foreground = Object.fromEntries(
    Object.entries(vocab.foreground).map(([k, t]) => [k, { ...t, surfaces: swapArr(t.surfaces) }]),
  );
  const nonText = Object.fromEntries(
    Object.entries(vocab.nonText).map(([k, t]) => [k, { ...t, surfaces: swapArr(t.surfaces) }]),
  );
  const out: PortableVocabulary = { ...vocab, foreground, nonText };
  if (vocab.alpha !== undefined) {
    out.alpha = Object.fromEntries(
      Object.entries(vocab.alpha).map(([k, t]) => {
        const next: PortableAlphaToken = { ...t };
        if (t.surfaces) next.surfaces = swapArr(t.surfaces);
        if (t.referenceSurface === oldName) next.referenceSurface = newName;
        return [k, next];
      }),
    );
  }
  return out;
}

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
    semanticSteps: null,
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
        set({ raw: null, entries: null, surfacePaths: null, surfaceSteps: null, semanticSteps: null, error: null });
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
      // Drop a preview-chrome pin that pointed at the deleted surface.
      useIntentStore.getState().renamePreviewBgSurface(name, '');
    },

    renameSurface(oldName, newName, engineConfig) {
      const trimmed = newName.trim();
      if (!trimmed) {
        set({ error: 'Surface name cannot be empty' });
        return;
      }
      set(applyMutation(get().raw, (v) => {
        const renamed = renameKey(v.surfaces, oldName, trimmed);
        if (renamed === null) {
          throw new Error(`Cannot rename surface "${oldName}" to "${trimmed}" — name already taken or missing`);
        }
        if (renamed === v.surfaces) return v;
        return rewriteSurfaceRefs({ ...v, surfaces: renamed }, oldName, trimmed);
      }, engineConfig));
      // Keep View → Background pin in sync with the surface rename.
      if (get().error == null) {
        useIntentStore.getState().renamePreviewBgSurface(oldName, trimmed);
      }
    },

    renameRamp(oldName, newName, engineConfig) {
      if (oldName === newName) return;
      // Never remap to/from an empty name: an empty `newName` would rewrite alpha
      // base refs to `{color.primitive..900}`, which can no longer be matched and
      // so is unrepairable by later keystrokes. The Scale-name field withholds
      // empty values, but guard here too as the single safe entry point.
      if (oldName.trim() === '' || newName.trim() === '') return;
      // Reuse the same ramp-rewriting the ramp-deletion path uses; a rename is a
      // single old→new remap. Case-insensitive, covers ramp/baseRamp/base refs.
      set(applyMutation(get().raw, (v) => remapPortableVocabularyRamps(v, [oldName], newName), engineConfig));
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

    moveToken(from, to, name, engineConfig) {
      if (from === to) return;
      set(applyMutation(get().raw, (v) => {
        const fromMap = v[from] ?? {};
        const token = fromMap[name];
        if (!token) {
          throw new Error(`Cannot move ${from} token "${name}" — not found`);
        }
        const toMap = v[to] ?? {};
        if (name in toMap) {
          throw new Error(`Cannot move "${name}" to ${to} — name already taken`);
        }
        const { [name]: _removed, ...restFrom } = fromMap;
        return {
          ...v,
          [from]: restFrom,
          [to]: { ...toMap, [name]: token },
        };
      }, engineConfig));
    },

    renameToken(section, oldName, newName, engineConfig) {
      const trimmed = newName.trim();
      if (!trimmed) {
        set({ error: 'Token name cannot be empty' });
        return;
      }
      set(applyMutation(get().raw, (v) => {
        const sectionMap = (v[section] ?? {}) as Record<string, unknown>;
        const renamed = renameKey(sectionMap, oldName, trimmed);
        if (renamed === null) {
          throw new Error(`Cannot rename ${section} token "${oldName}" to "${trimmed}" — name already taken or missing`);
        }
        if (renamed === sectionMap) return v;
        return { ...v, [section]: renamed };
      }, engineConfig));
    },

    addAlpha(name, token, engineConfig) {
      set(applyMutation(get().raw, (v) => ({
        ...v,
        alpha: { ...(v.alpha ?? {}), [name]: token },
      }), engineConfig));
    },

    updateAlpha(name, updates, engineConfig) {
      set(applyMutation(get().raw, (v) => {
        const existing = v.alpha?.[name];
        if (!existing) return v;
        return { ...v, alpha: { ...(v.alpha ?? {}), [name]: { ...existing, ...updates } } };
      }, engineConfig));
    },

    removeAlpha(name, engineConfig) {
      set(applyMutation(get().raw, (v) => {
        const { [name]: _, ...rest } = v.alpha ?? {};
        return { ...v, alpha: Object.keys(rest).length > 0 ? rest : undefined };
      }, engineConfig));
    },

    renameAlpha(oldName, newName, engineConfig) {
      const trimmed = newName.trim();
      if (!trimmed) {
        set({ error: 'Alpha token name cannot be empty' });
        return;
      }
      set(applyMutation(get().raw, (v) => {
        const alphaMap = v.alpha ?? {};
        const renamed = renameKey(alphaMap, oldName, trimmed);
        if (renamed === null) {
          throw new Error(`Cannot rename alpha token "${oldName}" to "${trimmed}" — name already taken or missing`);
        }
        if (renamed === alphaMap) return v;
        return { ...v, alpha: renamed };
      }, engineConfig));
    },

    exportYaml() {
      const raw = get().raw;
      if (!raw) return '';
      return stringifyYaml(raw);
    },

    clear() {
      syncToPalette(null);
      set({ raw: null, entries: null, surfacePaths: null, surfaceSteps: null, semanticSteps: null, error: null });
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
