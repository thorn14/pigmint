import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { current } from 'immer';
import type { ColorScale, PaletteState, PortableVocabulary, SavedPalette, StepNamingConfig, StepNamingPreset } from '../types/palette';
import { remapPortableVocabularyRamps } from '@pigmint/core';
import { hexToOklch, buildDefaultCurves, buildChromaCurve, oklchToHex, computeHueShift } from '../lib/colorMath';
import { buildLightnessValues, resolveStepNames, type LightnessPreset } from '../constants/stepPresets';
import type { ImportedScale } from '../lib/importTokens';
import { canonicalScaleName, disambiguateKey } from '../lib/scaleNaming';
import { useVocabStore } from './vocabStore';
import { useIntentStore } from './intentStore';
import initialConfig from '../color-tokens.json';

// nanoid is a small dep, but we can also just use crypto.randomUUID
function uid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

// Returns a scale name that doesn't collide with any other scale in `existing`.
// If `desired` is already taken, appends " 2", " 3", etc. until free.
// Pass `ignoreId` when renaming a scale so it doesn't count as its own conflict.
function uniqueScaleName(
  desired: string,
  existing: readonly ColorScale[],
  ignoreId?: string,
): string {
  const base = canonicalScaleName(desired);
  const taken = new Set<string>();
  for (const s of existing) {
    if (s.id !== ignoreId) taken.add(canonicalScaleName(s.name));
  }
  return disambiguateKey(base, taken);
}

interface HistorySnapshot {
  scales: ColorScale[];
  activeScaleId: string | null;
  selectedScaleIds: string[];
}

interface PaletteActions {
  addScale: (sourceHex: string, name?: string) => void;
  removeScale: (id: string) => void;
  reorderScales: (fromIndex: number, toIndex: number) => void;
  setActiveScale: (id: string | null) => void;
  flushCurrentPalette: () => void;
  switchPalette: (id: string) => void;
  createPalette: (name: string) => void;
  deletePalette: (id: string) => void;
  renamePalette: (id: string, name: string) => void;
  updateActiveVocab: (vocab: PortableVocabulary | null) => void;
  updateSourceHex: (id: string, hex: string) => void;
  updateScaleName: (id: string, name: string) => void;
  updateStepNaming: (id: string, naming: StepNamingConfig) => void;
  updateStepNamingAll: (naming: StepNamingConfig) => void;
  updateStepName: (id: string, index: number, name: string) => void;
  insertStepAt: (id: string, index: number, name?: string) => void;
  removeStepAt: (id: string, index: number) => void;
  setStepsAll: (names: string[]) => void;
  updateCurveValue: (id: string, channel: 'lightness' | 'chroma' | 'hue', stepIndex: number, value: number) => void;
  updateCurveValues: (id: string, channel: 'lightness' | 'chroma' | 'hue', values: number[]) => void;
  updateCurveNodeType: (id: string, channel: 'lightness' | 'chroma' | 'hue', stepIndex: number, type: 'smooth' | 'corner') => void;
  updateCurveSmoothing: (id: string, channel: 'lightness' | 'chroma' | 'hue', amount: number) => void;
  updateLightnessAt: (id: string, index: number, value: number) => void;
  setLightnessList: (id: string, values: number[]) => void;
  setStepList: (id: string, names: string[]) => void;
  setStepsAndLightness: (id: string, names: string[] | null, lightness: number[] | null) => void;
  setLightnessAll: (values: number[]) => void;
  updateHueShift: (id: string, end: 'lightEndAdjust' | 'darkEndAdjust', value: number) => void;
  applyLightnessPreset: (id: string, preset: LightnessPreset) => void;
  updateChromaPeak: (id: string, peak: number) => void;
  updateChromaLow: (id: string, low: number) => void;
  updateChromaHigh: (id: string, high: number) => void;
  updateSourceAlpha: (id: string, alpha: number) => void;
  setChromaShapeAll: (low: number, peak: number, high: number) => void;
  setChromaCurveValues: (id: string, values: number[]) => void;
  setFocusedStep: (ref: { scaleId: string; stepName: string } | null) => void;
  bulkCreateScales: (scales: Array<{ sourceHex: string; name: string }>, namingPreset: StepNamingPreset, lightnessPreset: LightnessPreset) => void;
  importScales: (imported: ImportedScale[], replace: boolean) => void;
  toggleSrgbPreview: () => void;
  toggleScaleLock: (id: string) => void;
  undo: () => void;
  redo: () => void;
  beginCurveEdit: (id: string) => void;
  commitCurveEdit: () => void;
  duplicateScale: (id: string) => void;
  toggleSelectScale: (id: string) => void;
  selectAllScales: () => void;
  clearSelection: () => void;
  removeSelectedScales: () => void;
}

interface InternalState {
  _past: HistorySnapshot[];
  _future: HistorySnapshot[];
  selectedScaleIds: string[];
  _isCurveEditing: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pushHistory(state: any) {
  if (state._isCurveEditing) return;
  const snapshot: HistorySnapshot = {
    scales: current(state.scales) as ColorScale[],
    activeScaleId: state.activeScaleId,
    selectedScaleIds: state.selectedScaleIds.slice(),
  };
  state._past.push(snapshot);
  if (state._past.length > 100) state._past.shift();
  state._future = [];
}

const DEFAULT_HEX = '#1894f8';

function makeDefaultScale(sourceHex: string, name?: string): ColorScale {
  const sourceOklch = hexToOklch(sourceHex);
  const stepCount = 11;
  const normalizedHex = oklchToHex(sourceOklch);
  return {
    id: uid(),
    name: name ?? 'Color',
    sourceHex: normalizedHex,
    sourceOklch,
    sourceAlpha: sourceOklch.alpha ?? 1,
    stepCount,
    naming: { preset: 'tailwind' },
    curves: buildDefaultCurves(sourceOklch, stepCount),
    hueShift: { lightEndAdjust: 0, darkEndAdjust: 0 },
    lightnessPreset: 'tailwind',
    chromaPeak: sourceOklch.c,
    chromaLow: 0,
    chromaHigh: 0,
  };
}

type PaletteConfig = {
  version?: number;
  // v1 fields
  activeScaleId?: string | null;
  scales?: Partial<ColorScale>[];
  // v2 fields
  activePaletteId?: string | null;
  palettes?: Array<{
    id?: string;
    name?: string;
    activeScaleId?: string | null;
    scales?: Partial<ColorScale>[];
    vocab?: PortableVocabulary | null;
  }>;
};

function normalizeNames(scale: ColorScale): string[] {
  return resolveStepNames(scale.naming.preset, scale.stepCount, scale.naming.customNames);
}

function insertCurveValue(values: number[], index: number, fallback: number): number[] {
  const prev = values[index - 1];
  const next = values[index];
  const value =
    typeof prev === 'number' && typeof next === 'number'
      ? (prev + next) / 2
      : typeof prev === 'number'
        ? prev
        : typeof next === 'number'
          ? next
          : fallback;
  const nextValues = values.slice();
  nextValues.splice(index, 0, value);
  return nextValues;
}

function removeCurveValue(values: number[], index: number): number[] {
  const nextValues = values.slice();
  nextValues.splice(index, 1);
  return nextValues;
}

function resampleCurve(values: number[], nextCount: number): number[] {
  if (nextCount <= 0) return [];
  if (values.length === 0) return Array(nextCount).fill(0);
  if (values.length === 1) return Array(nextCount).fill(values[0]);
  return Array.from({ length: nextCount }, (_, i) => {
    const t = nextCount === 1 ? 0 : i / (nextCount - 1);
    const idx = t * (values.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.min(lo + 1, values.length - 1);
    const frac = idx - lo;
    return values[lo] + (values[hi] - values[lo]) * frac;
  });
}

function insertNodeType(types: ('smooth' | 'corner')[] | undefined, index: number): ('smooth' | 'corner')[] | undefined {
  if (!types) return undefined;
  const next = types.slice();
  next.splice(index, 0, 'smooth');
  return next;
}

function removeNodeType(types: ('smooth' | 'corner')[] | undefined, index: number): ('smooth' | 'corner')[] | undefined {
  if (!types) return undefined;
  const next = types.slice();
  next.splice(index, 1);
  return next.length ? next : undefined;
}

function resampleNodeTypes(types: ('smooth' | 'corner')[] | undefined, nextCount: number): ('smooth' | 'corner')[] | undefined {
  if (!types || types.length === 0) return undefined;
  if (nextCount <= 0) return undefined;
  if (nextCount === 1) return [types[0] ?? 'smooth'];
  // Resample node types using nearest-neighbor mapping
  return Array.from({ length: nextCount }, (_, i) => {
    const srcIndex = Math.round(i / (nextCount - 1) * (types.length - 1));
    return types[Math.min(srcIndex, types.length - 1)];
  });
}

function resampleAllNodeTypes(scale: ColorScale, nextCount: number): void {
  for (const channel of ['lightness', 'chroma', 'hue'] as const) {
    scale.curves[channel].nodeTypes = resampleNodeTypes(scale.curves[channel].nodeTypes, nextCount);
  }
}

function ensureCurve(values: number[] | undefined, nextCount: number, fallback: number): number[] {
  if (!values || values.length === 0) {
    return Array.from({ length: nextCount }, () => fallback);
  }
  return resampleCurve(values, nextCount);
}

function inferStepCount(partial: Partial<ColorScale>): number {
  const countFromCurves =
    partial.curves?.lightness?.values?.length ??
    partial.curves?.chroma?.values?.length ??
    partial.curves?.hue?.values?.length ??
    0;
  const countFromNames = partial.naming?.customNames?.length ?? 0;
  const raw = partial.stepCount ?? countFromCurves ?? countFromNames ?? 11;
  return Math.max(1, Math.floor(raw));
}

function inflateScale(partial: Partial<ColorScale>, fallbackName: string): ColorScale {
  const sourceHexInput = typeof partial.sourceHex === 'string' ? partial.sourceHex : DEFAULT_HEX;
  const sourceOklch = hexToOklch(sourceHexInput);
  const stepCount = inferStepCount(partial);

  const baseCurves = buildDefaultCurves(sourceOklch, stepCount);

  const inflateCurve = (channel: 'lightness' | 'chroma' | 'hue', fallback: number) => {
    const saved = partial.curves?.[channel];
    return {
      values: ensureCurve(saved?.values, stepCount, fallback),
      ...(saved?.nodeTypes ? { nodeTypes: resampleNodeTypes(saved.nodeTypes, stepCount) } : {}),
      ...(typeof saved?.smoothing === 'number' ? { smoothing: Math.max(0, Math.min(1, saved.smoothing)) } : {}),
    };
  };

  const curves = {
    lightness: inflateCurve('lightness', baseCurves.lightness.values[0] ?? sourceOklch.l),
    chroma: inflateCurve('chroma', partial.chromaPeak ?? sourceOklch.c),
    hue: inflateCurve('hue', 0),
  };

  const fallbackPreset = stepCount === 11 ? 'tailwind' : 'numeric';
  const namingPreset = partial.naming?.preset ?? fallbackPreset;
  const customNames = partial.naming?.customNames;
  const naming: StepNamingConfig =
    namingPreset === 'custom' && customNames && customNames.length === stepCount
      ? { preset: 'custom', customNames }
      : { preset: namingPreset === 'custom' ? fallbackPreset : namingPreset };

  return {
    id: typeof partial.id === 'string' ? partial.id : uid(),
    name: typeof partial.name === 'string' ? partial.name : fallbackName,
    sourceHex: oklchToHex(sourceOklch),
    sourceOklch,
    sourceAlpha: typeof partial.sourceAlpha === 'number' ? partial.sourceAlpha : (sourceOklch.alpha ?? 1),
    stepCount,
    naming,
    curves,
    hueShift: {
      lightEndAdjust: partial.hueShift?.lightEndAdjust ?? 0,
      darkEndAdjust: partial.hueShift?.darkEndAdjust ?? 0,
    },
    lightnessPreset: (partial.lightnessPreset as LightnessPreset) ?? (partial.curves?.lightness ? 'custom' : 'tailwind'),
    chromaPeak: partial.chromaPeak ?? sourceOklch.c,
    chromaLow: partial.chromaLow ?? 0,
    chromaHigh: partial.chromaHigh ?? 0,
    lockedFromOverrides: !!partial.lockedFromOverrides,
  };
}

function inflatePalette(
  raw: { id?: string; name?: string; activeScaleId?: string | null; scales?: Partial<ColorScale>[]; vocab?: PortableVocabulary | null },
  fallbackName: string,
): SavedPalette {
  const scales = Array.isArray(raw.scales)
    ? raw.scales.map((s, i) => inflateScale(s, `Color ${i + 1}`))
    : [];
  const activeScaleId = raw.activeScaleId && scales.some((s) => s.id === raw.activeScaleId)
    ? raw.activeScaleId
    : null;
  return {
    id: typeof raw.id === 'string' ? raw.id : uid(),
    name: typeof raw.name === 'string' && raw.name.length > 0 ? raw.name : fallbackName,
    activeScaleId,
    scales,
    vocab: raw.vocab ?? null,
  };
}

const STORAGE_KEY = 'pigmint:color-tokens';
const LEGACY_STORAGE_KEY = 'palette-pal:color-tokens';

export function migrateLegacyStorage(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    if (localStorage.getItem(STORAGE_KEY)) return null;
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacy) return null;
    localStorage.setItem(STORAGE_KEY, legacy);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return legacy;
  } catch {
    return null;
  }
}

function loadInitialState(): PaletteState {
  let cfg: PaletteConfig = {};
  let hadStored = false;
  try {
    const stored = localStorage.getItem(STORAGE_KEY) ?? migrateLegacyStorage();
    if (stored) { cfg = JSON.parse(stored) as PaletteConfig; hadStored = true; }
  } catch { /* ignore */ }
  if (!cfg.version && !cfg.scales && !cfg.palettes) {
    cfg = (initialConfig ?? {}) as PaletteConfig;
    hadStored = false;
  }

  // Merge example palettes from initialConfig that aren't already in stored data
  if (hadStored) {
    const builtins = ((initialConfig as PaletteConfig).palettes ?? []).filter(
      (p) => p.id && Array.isArray(p.scales) && p.scales.length > 0,
    );
    const storedIds = new Set((cfg.palettes ?? []).map((p) => p.id));
    const toMerge = builtins.filter((p) => !storedIds.has(p.id));
    if (toMerge.length > 0) {
      cfg = { ...cfg, palettes: [...(cfg.palettes ?? []), ...toMerge] };
    }
  }

  // v2 format: has palettes array
  if (cfg.version === 2 && Array.isArray(cfg.palettes) && cfg.palettes.length > 0) {
    const savedPalettes = cfg.palettes.map((p, i) => inflatePalette(p, `Palette ${i + 1}`));
    const activePaletteId = cfg.activePaletteId && savedPalettes.some((p) => p.id === cfg.activePaletteId)
      ? cfg.activePaletteId
      : savedPalettes[0]!.id;
    const active = savedPalettes.find((p) => p.id === activePaletteId) ?? savedPalettes[0]!;
    return {
      savedPalettes,
      activePaletteId,
      currentPaletteName: active.name,
      scales: active.scales,
      activeScaleId: active.activeScaleId,
      focusedStepRef: null,
      srgbPreview: false,
    };
  }

  // v1 format: flat scales array — migrate to a single "Default" palette
  const defaultId = uid();
  if (Array.isArray(cfg.scales) && cfg.scales.length > 0) {
    const scales = cfg.scales.map((s, i) => inflateScale(s, `Color ${i + 1}`));
    const activeScaleId = cfg.activeScaleId && scales.some((s) => s.id === cfg.activeScaleId)
      ? cfg.activeScaleId
      : null;
    const palette: SavedPalette = { id: defaultId, name: 'Default', activeScaleId, scales };
    return {
      savedPalettes: [palette],
      activePaletteId: defaultId,
      currentPaletteName: 'Default',
      scales,
      activeScaleId,
      focusedStepRef: null,
      srgbPreview: false,
    };
  }

  // Empty state — no scales, show scale picker
  const palette: SavedPalette = { id: defaultId, name: 'Default', activeScaleId: null, scales: [] };
  return {
    savedPalettes: [palette],
    activePaletteId: defaultId,
    currentPaletteName: 'Default',
    scales: [],
    activeScaleId: null,
    focusedStepRef: null,
    srgbPreview: false,
  };
}

export const usePaletteStore = create<PaletteState & PaletteActions & InternalState>()(
  immer((set) => ({
    ...loadInitialState(),
    _past: [] as HistorySnapshot[],
    _future: [] as HistorySnapshot[],
    selectedScaleIds: [] as string[],
    _isCurveEditing: false,

    toggleSrgbPreview: () => set((state) => { state.srgbPreview = !state.srgbPreview; }),

    flushCurrentPalette: () => set((state) => {
      const palette = state.savedPalettes.find((p) => p.id === state.activePaletteId);
      if (!palette) return;
      palette.scales = state.scales;
      palette.activeScaleId = state.activeScaleId;
      palette.name = state.currentPaletteName;
    }),

    switchPalette: (id) => set((state) => {
      if (id === state.activePaletteId) return;
      // Flush working state into current palette slot
      const current = state.savedPalettes.find((p) => p.id === state.activePaletteId);
      if (current) {
        current.scales = state.scales;
        current.activeScaleId = state.activeScaleId;
        current.name = state.currentPaletteName;
      }
      // Load the target palette
      const target = state.savedPalettes.find((p) => p.id === id);
      if (!target) return;
      state.activePaletteId = id;
      state.currentPaletteName = target.name;
      state.scales = target.scales;
      state.activeScaleId = target.activeScaleId;
      state.focusedStepRef = null;
    }),

    createPalette: (name) => set((state) => {
      // Flush working state into current palette slot
      const current = state.savedPalettes.find((p) => p.id === state.activePaletteId);
      if (current) {
        current.scales = state.scales;
        current.activeScaleId = state.activeScaleId;
        current.name = state.currentPaletteName;
      }
      const newPalette: SavedPalette = {
        id: uid(),
        name,
        activeScaleId: null,
        scales: [],
      };
      state.savedPalettes.push(newPalette);
      state.activePaletteId = newPalette.id;
      state.currentPaletteName = name;
      state.scales = [];
      state.activeScaleId = null;
      state.focusedStepRef = null;
    }),

    deletePalette: (id) => set((state) => {
      if (state.savedPalettes.length <= 1) return;
      state.savedPalettes = state.savedPalettes.filter((p) => p.id !== id);
      if (state.activePaletteId === id) {
        const next = state.savedPalettes[0]!;
        state.activePaletteId = next.id;
        state.currentPaletteName = next.name;
        state.scales = next.scales;
        state.activeScaleId = next.activeScaleId;
        state.focusedStepRef = null;
      }
    }),

    renamePalette: (id, name) => set((state) => {
      const palette = state.savedPalettes.find((p) => p.id === id);
      if (palette) palette.name = name;
      if (state.activePaletteId === id) state.currentPaletteName = name;
    }),

    updateActiveVocab: (vocab) => set((state) => {
      const palette = state.savedPalettes.find((p) => p.id === state.activePaletteId);
      if (palette) palette.vocab = vocab;
    }),

    toggleScaleLock: (id) => set((state) => {
      const scale = state.scales.find((s) => s.id === id);
      if (scale) scale.lockedFromOverrides = !scale.lockedFromOverrides;
    }),

    addScale: (sourceHex, name) => set((state) => {
      pushHistory(state);
      const desired = name ?? `Color ${state.scales.length + 1}`;
      const scale = makeDefaultScale(sourceHex, uniqueScaleName(desired, state.scales));

      // Inherit naming + step count from existing scales so all ramps stay in sync
      const reference = state.scales[0];
      if (reference) {
        scale.naming = reference.naming.customNames
          ? { preset: reference.naming.preset, customNames: reference.naming.customNames.slice() }
          : { preset: reference.naming.preset };
        scale.stepCount = reference.stepCount;
        scale.curves = buildDefaultCurves(scale.sourceOklch, reference.stepCount);
      }

      state.scales.push(scale);
      state.activeScaleId = scale.id;
    }),

    removeScale: (id) => set((state) => {
      pushHistory(state);
      const removed = state.scales.find((s) => s.id === id);
      state.scales = state.scales.filter((s) => s.id !== id);
      state.selectedScaleIds = state.selectedScaleIds.filter((sid) => sid !== id);
      if (state.activeScaleId === id) {
        state.activeScaleId = state.scales[0]?.id ?? null;
      }
      const fallback = state.scales[0];
      const palette = state.savedPalettes.find((p) => p.id === state.activePaletteId);
      if (palette?.vocab && removed && fallback) {
        palette.vocab = remapPortableVocabularyRamps(palette.vocab, [removed.name], fallback.name);
      }
      queueMicrotask(() => {
        const ps = usePaletteStore.getState();
        const pal = ps.savedPalettes.find((p) => p.id === ps.activePaletteId);
        const is = useIntentStore.getState();
        const ec = { compliance: is.engineCompliance, target: is.engineTarget, modes: is.engineModes };
        useVocabStore.getState().loadFromVocab(pal?.vocab ?? null, ec);
      });
    }),

    reorderScales: (fromIndex, toIndex) => set((state) => {
      if (fromIndex === toIndex) return;
      pushHistory(state);
      const [item] = state.scales.splice(fromIndex, 1);
      state.scales.splice(toIndex, 0, item);
    }),

    setActiveScale: (id) => set((state) => {
      state.activeScaleId = id;
    }),

    updateSourceHex: (id, hex) => set((state) => {
      const scale = state.scales.find((s) => s.id === id);
      if (!scale) return;
      pushHistory(state);
      try {
        const sourceOklch = hexToOklch(hex);
        scale.sourceHex = oklchToHex(sourceOklch);
        scale.sourceOklch = sourceOklch;
        scale.sourceAlpha = sourceOklch.alpha ?? 1;
        const newCurves = buildDefaultCurves(sourceOklch, scale.stepCount);
        // Preserve user's chroma peak — don't let the new source color override it
        newCurves.chroma.values = buildChromaCurve(scale.chromaPeak, scale.stepCount, scale.chromaLow ?? 0, scale.chromaHigh ?? 0);
        // Preserve lightness — re-apply the active preset or keep custom values
        if (scale.lightnessPreset === 'custom') {
          newCurves.lightness.values = scale.curves.lightness.values.slice();
        } else if (scale.lightnessPreset !== 'tailwind') {
          newCurves.lightness.values = buildLightnessValues(scale.lightnessPreset as LightnessPreset, scale.stepCount);
        }
        scale.curves = newCurves;
      } catch {
        // Invalid hex — ignore
      }
    }),

    updateScaleName: (id, name) => set((state) => {
      const scale = state.scales.find((s) => s.id === id);
      if (!scale) return;
      pushHistory(state);
      scale.name = name;
    }),

    updateStepNaming: (id, naming) => set((state) => {
      pushHistory(state);
      const scale = state.scales.find((s) => s.id === id);
      if (scale) scale.naming = naming;
    }),

    updateStepNamingAll: (naming) => set((state) => {
      pushHistory(state);
      for (const scale of state.scales) {
        if (!scale.lockedFromOverrides) scale.naming = naming;
      }
    }),

    updateStepName: (id, index, name) => set((state) => {
      pushHistory(state);
      const scale = state.scales.find((s) => s.id === id);
      if (!scale) return;
      const names = normalizeNames(scale);
      if (index < 0 || index >= names.length) return;
      names[index] = name;
      scale.naming = { preset: 'custom', customNames: names };
    }),

    insertStepAt: (id, index, name) => set((state) => {
      pushHistory(state);
      const scale = state.scales.find((s) => s.id === id);
      if (!scale) return;
      const names = normalizeNames(scale);
      const clampedIndex = Math.max(0, Math.min(index, names.length));
      const nextNames = names.slice();
      const insertName = name ?? 'New';
      nextNames.splice(clampedIndex, 0, insertName);
      scale.naming = { preset: 'custom', customNames: nextNames };
      scale.stepCount = nextNames.length;

      scale.curves.lightness.values = insertCurveValue(scale.curves.lightness.values, clampedIndex, scale.sourceOklch.l);
      scale.curves.lightness.nodeTypes = insertNodeType(scale.curves.lightness.nodeTypes, clampedIndex);
      scale.curves.chroma.values = insertCurveValue(scale.curves.chroma.values, clampedIndex, scale.chromaPeak);
      scale.curves.chroma.nodeTypes = insertNodeType(scale.curves.chroma.nodeTypes, clampedIndex);
      scale.curves.hue.values = insertCurveValue(scale.curves.hue.values, clampedIndex, 0);
      scale.curves.hue.nodeTypes = insertNodeType(scale.curves.hue.nodeTypes, clampedIndex);
    }),

    removeStepAt: (id, index) => set((state) => {
      pushHistory(state);
      const scale = state.scales.find((s) => s.id === id);
      if (!scale) return;
      const names = normalizeNames(scale);
      if (names.length <= 1) return;
      if (index < 0 || index >= names.length) return;
      const nextNames = names.slice();
      nextNames.splice(index, 1);
      scale.naming = { preset: 'custom', customNames: nextNames };
      scale.stepCount = nextNames.length;
      scale.curves.lightness.values = removeCurveValue(scale.curves.lightness.values, index);
      scale.curves.lightness.nodeTypes = removeNodeType(scale.curves.lightness.nodeTypes, index);
      scale.curves.chroma.values = removeCurveValue(scale.curves.chroma.values, index);
      scale.curves.chroma.nodeTypes = removeNodeType(scale.curves.chroma.nodeTypes, index);
      scale.curves.hue.values = removeCurveValue(scale.curves.hue.values, index);
      scale.curves.hue.nodeTypes = removeNodeType(scale.curves.hue.nodeTypes, index);
    }),

    updateCurveValue: (id, channel, stepIndex, value) => set((state) => {
      const scale = state.scales.find((s) => s.id === id);
      if (!scale) return;
      pushHistory(state);
      scale.curves[channel].values[stepIndex] = value;
    }),

    updateCurveValues: (id, channel, values) => set((state) => {
      const scale = state.scales.find((s) => s.id === id);
      if (!scale) return;
      pushHistory(state);
      const curve = scale.curves[channel];
      const targetLength = scale.stepCount;
      const nextValues = values.slice(0, targetLength);
      const fallbackValue = nextValues[nextValues.length - 1] ?? curve.values[curve.values.length - 1] ?? 0;

      while (nextValues.length < targetLength) {
        nextValues.push(fallbackValue);
      }

      curve.values = nextValues;

      if (curve.nodeTypes) {
        const nextNodeTypes = curve.nodeTypes.slice(0, targetLength);
        while (nextNodeTypes.length < targetLength) {
          nextNodeTypes.push('smooth');
        }
        curve.nodeTypes = nextNodeTypes;
      }
    }),

    updateCurveNodeType: (id, channel, stepIndex, type) => set((state) => {
      const scale = state.scales.find((s) => s.id === id);
      if (!scale) return;
      pushHistory(state);
      const curve = scale.curves[channel];
      curve.nodeTypes = Array.from(
        { length: curve.values.length },
        (_, index) => curve.nodeTypes?.[index] ?? ('smooth' as const),
      );
      curve.nodeTypes[stepIndex] = type;
    }),

    updateCurveSmoothing: (id, channel, amount) => set((state) => {
      const scale = state.scales.find((s) => s.id === id);
      if (!scale) return;
      pushHistory(state);
      scale.curves[channel].smoothing = Math.max(0, Math.min(1, amount));
    }),

    updateLightnessAt: (id, index, value) => set((state) => {
      const scale = state.scales.find((s) => s.id === id);
      if (!scale) return;
      const clamped = Math.max(0, Math.min(1, value));
      scale.curves.lightness.values[index] = clamped;
      scale.lightnessPreset = 'custom';
    }),

    setLightnessList: (id, values) => set((state) => {
      pushHistory(state);
      const scale = state.scales.find((s) => s.id === id);
      if (!scale) return;
      const clampedValues = values.map((v) => Math.max(0, Math.min(1, v)));
      scale.curves.lightness.values = clampedValues.slice();
      scale.stepCount = clampedValues.length;
      const names = normalizeNames(scale);
      if (names.length !== clampedValues.length) {
        scale.naming = {
          preset: 'custom',
          customNames: resampleCurve(
            names.map((_, i) => i),
            clampedValues.length
          ).map((_, i) => String(i + 1)),
        };
      }
      scale.lightnessPreset = 'custom';
      scale.curves.chroma.values = resampleCurve(scale.curves.chroma.values, clampedValues.length);
      scale.curves.hue.values = resampleCurve(scale.curves.hue.values, clampedValues.length);
      resampleAllNodeTypes(scale, clampedValues.length);
    }),

    setStepList: (id, names) => set((state) => {
      pushHistory(state);
      const scale = state.scales.find((s) => s.id === id);
      if (!scale) return;
      const cleaned = names.map((n) => n.trim()).filter(Boolean);
      if (!cleaned.length) return;
      scale.naming = { preset: 'custom', customNames: cleaned };
      scale.stepCount = cleaned.length;
      scale.curves.lightness.values = resampleCurve(scale.curves.lightness.values, cleaned.length);
      scale.curves.chroma.values = resampleCurve(scale.curves.chroma.values, cleaned.length);
      scale.curves.hue.values = resampleCurve(scale.curves.hue.values, cleaned.length);
      resampleAllNodeTypes(scale, cleaned.length);
    }),

    setStepsAll: (names) => set((state) => {
      pushHistory(state);
      const cleaned = names.map((n) => n.trim()).filter(Boolean);
      if (!cleaned.length) return;
      for (const scale of state.scales) {
        if (scale.lockedFromOverrides) continue;
        scale.naming = { preset: 'custom', customNames: cleaned };
        scale.stepCount = cleaned.length;
        scale.curves.lightness.values = resampleCurve(scale.curves.lightness.values, cleaned.length);
        scale.curves.chroma.values = resampleCurve(scale.curves.chroma.values, cleaned.length);
        scale.curves.hue.values = resampleCurve(scale.curves.hue.values, cleaned.length);
        resampleAllNodeTypes(scale, cleaned.length);
      }
    }),

    setStepsAndLightness: (id, names, lightness) => set((state) => {
      pushHistory(state);
      const scale = state.scales.find((s) => s.id === id);
      if (!scale) return;
      const nextNames = names && names.length ? names.map((n) => n.trim()).filter(Boolean) : null;
      const nextLightness = lightness && lightness.length
        ? lightness.map((v) => Math.max(0, Math.min(1, v)))
        : null;

      if (!nextNames && !nextLightness) return;
      const nextCount =
        nextNames?.length ??
        nextLightness?.length ??
        scale.stepCount;

      if (nextNames) {
        scale.naming = { preset: 'custom', customNames: nextNames };
      } else {
        const namesResolved = normalizeNames(scale);
        if (namesResolved.length !== nextCount) {
          scale.naming = {
            preset: 'custom',
            customNames: Array.from({ length: nextCount }, (_, i) => String(i + 1)),
          };
        }
      }

      scale.stepCount = nextCount;

      if (nextLightness) {
        scale.curves.lightness.values = nextLightness.slice();
        scale.lightnessPreset = 'custom';
      } else {
        scale.curves.lightness.values = resampleCurve(scale.curves.lightness.values, nextCount);
      }

      scale.curves.chroma.values = resampleCurve(scale.curves.chroma.values, nextCount);
      scale.curves.hue.values = resampleCurve(scale.curves.hue.values, nextCount);
      resampleAllNodeTypes(scale, nextCount);
    }),

    setLightnessAll: (values) => set((state) => {
      pushHistory(state);
      const cleaned = values.length ? values.map((v) => Math.max(0, Math.min(1, v))) : [];
      if (!cleaned.length) return;
      for (const scale of state.scales) {
        if (scale.lockedFromOverrides) continue;
        scale.curves.lightness.values = resampleCurve(cleaned, scale.stepCount);
        scale.lightnessPreset = 'custom';
      }
    }),

    updateHueShift: (id, end, value) => set((state) => {
      const scale = state.scales.find((s) => s.id === id);
      if (!scale) return;
      pushHistory(state);
      scale.hueShift[end] = value;
    }),

    applyLightnessPreset: (id, preset) => set((state) => {
      pushHistory(state);
      const scale = state.scales.find((s) => s.id === id);
      if (!scale) return;
      if (preset === 'custom') {
        scale.lightnessPreset = 'custom';
        return;
      }
      scale.curves.lightness.values = buildLightnessValues(preset, scale.stepCount);
      scale.lightnessPreset = preset;
    }),

    updateChromaPeak: (id, peak) => set((state) => {
      const scale = state.scales.find((s) => s.id === id);
      if (!scale) return;
      pushHistory(state);
      const clamped = Math.max(0, Math.min(0.4, peak));
      scale.chromaPeak = clamped;
      scale.curves.chroma.values = buildChromaCurve(clamped, scale.stepCount, scale.chromaLow ?? 0, scale.chromaHigh ?? 0);
    }),

    updateChromaLow: (id, low) => set((state) => {
      const scale = state.scales.find((s) => s.id === id);
      if (!scale) return;
      pushHistory(state);
      const clamped = Math.max(0, Math.min(0.4, low));
      scale.chromaLow = clamped;
      scale.curves.chroma.values = buildChromaCurve(scale.chromaPeak, scale.stepCount, clamped, scale.chromaHigh ?? 0);
    }),

    updateChromaHigh: (id, high) => set((state) => {
      const scale = state.scales.find((s) => s.id === id);
      if (!scale) return;
      pushHistory(state);
      const clamped = Math.max(0, Math.min(0.4, high));
      scale.chromaHigh = clamped;
      scale.curves.chroma.values = buildChromaCurve(scale.chromaPeak, scale.stepCount, scale.chromaLow ?? 0, clamped);
    }),

    updateSourceAlpha: (id, alpha) => set((state) => {
      const scale = state.scales.find((s) => s.id === id);
      if (!scale) return;
      pushHistory(state);
      scale.sourceAlpha = Math.min(1, Math.max(0, alpha));
    }),

    setChromaShapeAll: (low, peak, high) => set((state) => {
      pushHistory(state);
      const clampedPeak = Math.max(0, Math.min(0.4, peak));
      const clampedLow = Math.max(0, Math.min(0.4, low));
      const clampedHigh = Math.max(0, Math.min(0.4, high));
      for (const scale of state.scales) {
        if (scale.lockedFromOverrides) continue;
        scale.chromaPeak = clampedPeak;
        scale.chromaLow = clampedLow;
        scale.chromaHigh = clampedHigh;
        scale.curves.chroma.values = buildChromaCurve(clampedPeak, scale.stepCount, clampedLow, clampedHigh);
      }
    }),

    setChromaCurveValues: (id, values) => set((state) => {
      pushHistory(state);
      const scale = state.scales.find((s) => s.id === id);
      if (!scale) return;
      const clamped = values.slice(0, scale.stepCount);
      scale.curves.chroma.values = clamped;
      // Sync scalar fields so updateSourceHex and Apply-to-all stay consistent
      if (clamped.length > 0) {
        scale.chromaLow = clamped[0];
        scale.chromaHigh = clamped[clamped.length - 1];
        scale.chromaPeak = Math.max(...clamped);
      }
    }),

    setFocusedStep: (ref) => set((state) => {
      state.focusedStepRef = ref;
    }),

    bulkCreateScales: (scaleInputs, namingPreset, lightnessPreset) => set((state) => {
      pushHistory(state);
      for (const { sourceHex, name } of scaleInputs) {
        // Dedupe against already-existing scales AND against prior scales
        // created in this same bulk call (state.scales grows as we push).
        const scale = makeDefaultScale(sourceHex, uniqueScaleName(name, state.scales));
        scale.naming = { preset: namingPreset };
        if (lightnessPreset !== 'tailwind' && lightnessPreset !== 'custom') {
          scale.curves.lightness.values = buildLightnessValues(lightnessPreset, scale.stepCount);
          scale.lightnessPreset = lightnessPreset;
        }
        state.scales.push(scale);
      }
      state.activeScaleId = state.scales[0]?.id ?? null;
    }),

    importScales: (imported, replace) => set((state) => {
      pushHistory(state);
      if (replace) state.scales = [];

      for (const imp of imported) {
        const sourceOklch = imp.sourceOklch;
        const normalizedHex = oklchToHex(sourceOklch);

        let scale: ColorScale;

        if (imp.curves) {
          // Curve data came from a pigmint.yaml export — restore the ColorScale faithfully.
          scale = {
            id: uid(),
            name: uniqueScaleName(imp.name, state.scales),
            sourceHex: normalizedHex,
            sourceOklch,
            sourceAlpha: sourceOklch.alpha ?? 1,
            stepCount: imp.stepCount ?? imp.steps.length,
            naming: imp.naming ?? { preset: 'tailwind' },
            curves: imp.curves,
            hueShift: imp.hueShift ?? { lightEndAdjust: 0, darkEndAdjust: 0 },
            lightnessPreset: 'tailwind',
            chromaPeak: imp.chromaPeak ?? sourceOklch.c,
            chromaLow: imp.chromaLow,
            chromaHigh: imp.chromaHigh,
          };
        } else {
          // Generic import (Figma, W3C tokens) — reverse-engineer curves from step colors.
          const stepCount = imp.steps.length;
          const lightnessValues = imp.steps.map((s) => s.oklch.l);
          const chromaValues = imp.steps.map((s) => s.oklch.c);
          const hueValues = imp.steps.map((s, idx) => {
            // Compute the auto hue shift that generateRamp will add at this step position,
            // then subtract it so the net result equals the token's actual hue.
            const t = stepCount === 1 ? 0 : idx / (stepCount - 1);
            const autoShift = computeHueShift(sourceOklch.h, t, 0, 0);
            const delta = s.oklch.h - sourceOklch.h;
            const wrapped = ((delta % 360) + 540) % 360 - 180;
            return wrapped - autoShift;
          });
          const maxC = Math.max(...chromaValues, 0.001);

          scale = {
            id: uid(),
            name: uniqueScaleName(imp.name, state.scales),
            sourceHex: normalizedHex,
            sourceOklch,
            sourceAlpha: sourceOklch.alpha ?? 1,
            stepCount,
            naming: { preset: 'custom', customNames: imp.steps.map((s) => s.name) },
            curves: {
              lightness: { values: lightnessValues },
              chroma: { values: chromaValues },
              hue: { values: hueValues },
            },
            hueShift: { lightEndAdjust: 0, darkEndAdjust: 0 },
            lightnessPreset: 'custom',
            chromaPeak: maxC,
          };
        }

        state.scales.push(scale);
      }

      if (!state.activeScaleId || replace) {
        state.activeScaleId = state.scales[0]?.id ?? null;
      }
    }),

    undo: () => set((state) => {
      const snapshot = state._past.pop();
      if (!snapshot) return;
      state._future.push({
        scales: current(state.scales) as ColorScale[],
        activeScaleId: state.activeScaleId,
        selectedScaleIds: state.selectedScaleIds.slice(),
      });
      if (state._future.length > 100) state._future.shift();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      state.scales = snapshot.scales as any;
      state.activeScaleId = snapshot.activeScaleId;
      state.selectedScaleIds = snapshot.selectedScaleIds.slice();
    }),

    redo: () => set((state) => {
      const snapshot = state._future.pop();
      if (!snapshot) return;
      state._past.push({
        scales: current(state.scales) as ColorScale[],
        activeScaleId: state.activeScaleId,
        selectedScaleIds: state.selectedScaleIds.slice(),
      });
      if (state._past.length > 100) state._past.shift();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      state.scales = snapshot.scales as any;
      state.activeScaleId = snapshot.activeScaleId;
      state.selectedScaleIds = snapshot.selectedScaleIds.slice();
    }),

    beginCurveEdit: (scaleId: string) => set((state) => {
      void scaleId;
      pushHistory(state);
      state._isCurveEditing = true;
    }),

    commitCurveEdit: () => set((state) => {
      state._isCurveEditing = false;
    }),

    duplicateScale: (id) => set((state) => {
      pushHistory(state);
      const original = state.scales.find((s) => s.id === id);
      if (!original) return;
      const plain = current(original) as ColorScale;
      const clone: ColorScale = {
        ...plain,
        id: uid(),
        name: uniqueScaleName(`${plain.name} (copy)`, state.scales),
        hueShift: { ...plain.hueShift },
        naming: plain.naming.customNames
          ? { preset: plain.naming.preset, customNames: plain.naming.customNames.slice() }
          : { preset: plain.naming.preset },
        curves: {
          lightness: {
            values: plain.curves.lightness.values.slice(),
            ...(plain.curves.lightness.nodeTypes && { nodeTypes: plain.curves.lightness.nodeTypes.slice() }),
            ...(typeof plain.curves.lightness.smoothing === 'number' && { smoothing: plain.curves.lightness.smoothing }),
          },
          chroma: {
            values: plain.curves.chroma.values.slice(),
            ...(plain.curves.chroma.nodeTypes && { nodeTypes: plain.curves.chroma.nodeTypes.slice() }),
            ...(typeof plain.curves.chroma.smoothing === 'number' && { smoothing: plain.curves.chroma.smoothing }),
          },
          hue: {
            values: plain.curves.hue.values.slice(),
            ...(plain.curves.hue.nodeTypes && { nodeTypes: plain.curves.hue.nodeTypes.slice() }),
            ...(typeof plain.curves.hue.smoothing === 'number' && { smoothing: plain.curves.hue.smoothing }),
          },
        },
      };
      const idx = state.scales.findIndex((s) => s.id === id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      state.scales.splice(idx + 1, 0, clone as any);
      state.activeScaleId = clone.id;
    }),

    toggleSelectScale: (id) => set((state) => {
      const idx = state.selectedScaleIds.indexOf(id);
      if (idx === -1) {
        state.selectedScaleIds.push(id);
      } else {
        state.selectedScaleIds.splice(idx, 1);
      }
    }),

    selectAllScales: () => set((state) => {
      state.selectedScaleIds = state.scales.map((s) => s.id);
    }),

    clearSelection: () => set((state) => {
      state.selectedScaleIds = [];
    }),

    removeSelectedScales: () => set((state) => {
      if (state.selectedScaleIds.length === 0) return;
      pushHistory(state);
      const ids = new Set(state.selectedScaleIds);
      const removed = state.scales.filter((s) => ids.has(s.id));
      state.scales = state.scales.filter((s) => !ids.has(s.id));
      state.selectedScaleIds = [];
      if (state.activeScaleId && ids.has(state.activeScaleId)) {
        state.activeScaleId = state.scales[0]?.id ?? null;
      }
      const fallback = state.scales[0];
      const palette = state.savedPalettes.find((p) => p.id === state.activePaletteId);
      if (palette?.vocab && removed.length > 0 && fallback) {
        palette.vocab = remapPortableVocabularyRamps(
          palette.vocab,
          removed.map((s) => s.name),
          fallback.name,
        );
      }
      queueMicrotask(() => {
        const ps = usePaletteStore.getState();
        const pal = ps.savedPalettes.find((p) => p.id === ps.activePaletteId);
        const is = useIntentStore.getState();
        const ec = { compliance: is.engineCompliance, target: is.engineTarget, modes: is.engineModes };
        useVocabStore.getState().loadFromVocab(pal?.vocab ?? null, ec);
      });
    }),
  }))
);

// Selector helpers
export const selectActiveScale = (state: PaletteState & PaletteActions & InternalState): ColorScale | undefined =>
  state.scales.find((s) => s.id === (state.activeScaleId ?? state.scales[0]?.id));

export const selectCanUndo = (state: PaletteState & PaletteActions & InternalState): boolean =>
  state._past.length > 0;

export const selectCanRedo = (state: PaletteState & PaletteActions & InternalState): boolean =>
  state._future.length > 0;
