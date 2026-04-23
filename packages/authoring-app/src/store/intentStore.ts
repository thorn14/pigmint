import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  FormalIntent,
  Preference,
  Consistency,
  ComplianceTarget,
  CvdProfile,
  ResolverConfig,
  ResolverMode,
  SurfaceContext,
} from '@pigmint/core';

const STORAGE_KEY = 'pigmint:intents:v1';

export type EngineCompliance = 'wcag21' | 'apca';

export type IntentOverride = Partial<
  Pick<FormalIntent, 'preference' | 'consistency' | 'surfaceContext'>
>;
export type IntentOverrides = Record<string, IntentOverride>;

export type EngineMode =
  | 'light'
  | 'dark'
  | 'light-high-contrast'
  | 'dark-high-contrast';

export const ENGINE_MODE_OPTIONS: readonly EngineMode[] = [
  'light',
  'dark',
  'light-high-contrast',
  'dark-high-contrast',
];

export const CVD_PROFILE_OPTIONS: readonly CvdProfile[] = [
  'deuteranopia',
  'protanopia',
  'tritanopia',
  'achromatopsia',
];

export const RESOLVER_MODE_OPTIONS: readonly ResolverMode[] = [
  'stepped',
  'continuous',
];

export const DEFAULT_RESOLVER_FALLBACK_STEPS = 256;

export interface PersistedIntentState {
  engineTarget: ComplianceTarget;
  engineCompliance: EngineCompliance;
  engineModes: EngineMode[];
  engineCvd: CvdProfile[];
  engineResolver: ResolverConfig;
  overrides: IntentOverrides;
}

interface IntentState extends PersistedIntentState {}

interface IntentActions {
  setEngineTarget: (target: ComplianceTarget) => void;
  toggleEngineMode: (mode: EngineMode) => void;
  toggleEngineCvd: (profile: CvdProfile) => void;
  setResolverMode: (mode: ResolverMode) => void;
  setResolverFallbackSteps: (steps: number | undefined) => void;
  setPreference: (path: string, preference: Preference) => void;
  setConsistency: (path: string, consistency: Consistency) => void;
  setSurfaceContext: (path: string, surfaceContext: SurfaceContext) => void;
  resetOverride: (path: string) => void;
  clearAll: () => void;
  loadOverrides: (overrides: IntentOverrides) => void;
  loadState: (state: Partial<PersistedIntentState>) => void;
}

const DEFAULT_STATE: PersistedIntentState = {
  engineTarget: 'AA',
  engineCompliance: 'wcag21',
  engineModes: ['light', 'dark'],
  engineCvd: [],
  engineResolver: { mode: 'stepped' },
  overrides: {},
};

function sanitizeModes(raw: unknown): EngineMode[] {
  if (!Array.isArray(raw)) return DEFAULT_STATE.engineModes;
  const known = new Set<EngineMode>(ENGINE_MODE_OPTIONS);
  const filtered = raw.filter((m): m is EngineMode =>
    typeof m === 'string' && known.has(m as EngineMode),
  );
  const deduped = Array.from(new Set(filtered));
  const ordered = ENGINE_MODE_OPTIONS.filter((m) => deduped.includes(m));
  return ordered.length > 0 ? ordered : DEFAULT_STATE.engineModes;
}

export function sanitizeCvd(raw: unknown): CvdProfile[] {
  if (!Array.isArray(raw)) return [];
  const known = new Set<CvdProfile>(CVD_PROFILE_OPTIONS);
  const filtered = raw.filter((p): p is CvdProfile =>
    typeof p === 'string' && known.has(p as CvdProfile),
  );
  const deduped = Array.from(new Set(filtered));
  return CVD_PROFILE_OPTIONS.filter((p) => deduped.includes(p));
}

export function sanitizeResolver(raw: unknown): ResolverConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_STATE.engineResolver };
  const obj = raw as Record<string, unknown>;
  const mode: ResolverMode = obj.mode === 'continuous' ? 'continuous' : 'stepped';
  const fallbackRaw = obj.fallbackSteps;
  const fallbackSteps =
    typeof fallbackRaw === 'number' && Number.isFinite(fallbackRaw) && fallbackRaw >= 2
      ? Math.floor(fallbackRaw)
      : undefined;
  return fallbackSteps !== undefined ? { mode, fallbackSteps } : { mode };
}

function loadFromStorage(): PersistedIntentState {
  if (typeof localStorage === 'undefined') return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return {
        engineTarget: parsed.engineTarget === 'AAA' ? 'AAA' : 'AA',
        engineCompliance: 'wcag21',
        engineModes: sanitizeModes(parsed.engineModes),
        engineCvd: sanitizeCvd(parsed.engineCvd),
        engineResolver: sanitizeResolver(parsed.engineResolver),
        overrides:
          parsed.overrides && typeof parsed.overrides === 'object'
            ? (parsed.overrides as IntentOverrides)
            : {},
      };
    }
  } catch {
    /* corrupt storage — fall through to default */
  }
  return DEFAULT_STATE;
}

function persist(state: PersistedIntentState) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota/privacy mode — silently drop */
  }
}

function snapshot(state: PersistedIntentState): PersistedIntentState {
  return {
    engineTarget: state.engineTarget,
    engineCompliance: state.engineCompliance,
    engineModes: [...state.engineModes],
    engineCvd: [...state.engineCvd],
    engineResolver: { ...state.engineResolver },
    overrides: { ...state.overrides },
  };
}

export const useIntentStore = create<IntentState & IntentActions>()(
  immer((set) => ({
    ...loadFromStorage(),

    setEngineTarget: (target) =>
      set((state) => {
        state.engineTarget = target;
        persist(snapshot(state));
      }),

    toggleEngineMode: (mode) =>
      set((state) => {
        const has = state.engineModes.includes(mode);
        if (has && state.engineModes.length === 1) return;
        const next = has
          ? state.engineModes.filter((m) => m !== mode)
          : [...state.engineModes, mode];
        state.engineModes = sanitizeModes(next);
        persist(snapshot(state));
      }),

    toggleEngineCvd: (profile) =>
      set((state) => {
        const has = state.engineCvd.includes(profile);
        const next = has
          ? state.engineCvd.filter((p) => p !== profile)
          : [...state.engineCvd, profile];
        state.engineCvd = sanitizeCvd(next);
        persist(snapshot(state));
      }),

    setResolverMode: (mode) =>
      set((state) => {
        state.engineResolver = { ...state.engineResolver, mode };
        persist(snapshot(state));
      }),

    setResolverFallbackSteps: (steps) =>
      set((state) => {
        if (steps === undefined) {
          const { fallbackSteps: _drop, ...rest } = state.engineResolver;
          state.engineResolver = rest;
        } else {
          state.engineResolver = { ...state.engineResolver, fallbackSteps: steps };
        }
        persist(snapshot(state));
      }),

    setPreference: (path, preference) =>
      set((state) => {
        state.overrides[path] = { ...(state.overrides[path] ?? {}), preference };
        persist(snapshot(state));
      }),

    setConsistency: (path, consistency) =>
      set((state) => {
        state.overrides[path] = { ...(state.overrides[path] ?? {}), consistency };
        persist(snapshot(state));
      }),

    setSurfaceContext: (path, surfaceContext) =>
      set((state) => {
        state.overrides[path] = {
          ...(state.overrides[path] ?? {}),
          surfaceContext,
        };
        persist(snapshot(state));
      }),

    resetOverride: (path) =>
      set((state) => {
        delete state.overrides[path];
        persist(snapshot(state));
      }),

    clearAll: () =>
      set((state) => {
        state.overrides = {};
        persist(snapshot(state));
      }),

    loadOverrides: (overrides) =>
      set((state) => {
        state.overrides = { ...overrides };
        persist(snapshot(state));
      }),

    loadState: (next) =>
      set((state) => {
        if (next.engineTarget) state.engineTarget = next.engineTarget;
        if (next.engineCompliance) {
          state.engineCompliance = next.engineCompliance === 'apca' ? 'wcag21' : next.engineCompliance;
        }
        if (next.engineModes) state.engineModes = sanitizeModes(next.engineModes);
        if (next.engineCvd) state.engineCvd = sanitizeCvd(next.engineCvd);
        if (next.engineResolver) state.engineResolver = sanitizeResolver(next.engineResolver);
        if (next.overrides) state.overrides = { ...next.overrides };
        persist(snapshot(state));
      }),
  })),
);

export function mergeIntent(
  base: FormalIntent,
  override: IntentOverride | undefined,
  engineTarget: ComplianceTarget,
  engineCompliance: EngineCompliance,
): FormalIntent {
  const threshold = {
    ...base.threshold,
    kind: engineCompliance === 'apca' ? ('apca' as const) : ('wcag' as const),
    level: engineTarget,
  };
  if (!override) return { ...base, threshold };
  return {
    threshold,
    preference: override.preference ?? base.preference,
    consistency: override.consistency ?? base.consistency,
    surfaceContext: override.surfaceContext ?? base.surfaceContext,
    constraints: base.constraints,
  };
}
