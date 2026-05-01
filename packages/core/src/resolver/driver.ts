import { resolveToken, type ThresholdElevation } from './resolve.js';
import { assertValidFormalIntent } from './intent-validate.js';
import { materializeContinuousRamps } from './materialize-continuous.js';
import {
  resolveAnchoredToReference,
  resolveMatchedAcrossRamps,
  type NonSurfaceContext,
} from './group-resolve.js';
import { DriverError } from './errors.js';
import { resolveSurface, resolveSurfaceByIndex, type SurfaceRole } from './surfaces.js';
import { generateRamp } from '../math/ramp.js';
import type { ColorScale, GeneratedRamp } from '../types/palette.js';
import type {
  ContrastKind,
  FormalIntent,
  IntentOverride,
  ProjectConfig,
  ResolvedToken,
  VocabularyEntry,
} from '../types/spec.js';

// ADR-016 (post-v1): alpha sub-resolver.
// The default reference surfaces for alpha-composited tokens are `color.surface.main`
// for scheme=light and `color.surface.inverse` for scheme=dark (i.e. the canonical
// "light-on-dark" and "dark-on-light" baselines). When the sub-resolver lands it
// should consume `AdapterConfig.alpha.referenceSurface` as an override and fall
// back to these defaults. Until then, alpha is authored as pre-composited color
// and the driver resolves against the opaque reference directly — see
// `ModeBinding.baselineHex` below.

const DEFAULT_DENSE_STEPS = 256;

export interface ModeBinding {
  mode: string;
  scheme: 'light' | 'dark';
  baselineHex: string;
  thresholdElevation?: ThresholdElevation;
}

export type SurfaceStepDecl = { light?: number; dark?: number; default?: number };

export interface ResolveAllInput {
  config: ProjectConfig;
  vocabulary: VocabularyEntry[];
  ramps: GeneratedRamp[];
  modes: ModeBinding[];
  tokenRamp: Record<string, string>;
  scales?: ColorScale[];
  /** Portable vocabulary: set of token paths that are surfaces (overrides path-prefix detection). */
  surfacePaths?: Set<string>;
  /** Portable vocabulary: per-surface explicit step declarations by mode scheme. */
  surfaceSteps?: Map<string, SurfaceStepDecl>;
}

export interface ResolveAllOutput {
  tokens: ResolvedToken[];
  /** Stepped ramps plus any synthesized `c0000`–`c1000` primitives (continuous + F1). */
  ramps: GeneratedRamp[];
  surfaceByModeAndPath: Record<string, Record<string, string>>;
}

export { DriverError } from './errors.js';

const SURFACE_ROLES = new Set<SurfaceRole>(['main', 'elevated', 'subtle', 'inverse']);

function surfaceRoleFromPath(path: string): SurfaceRole | null {
  const parts = path.split('.');
  if (parts.length < 3) return null;
  if (parts[0] !== 'color' || parts[1] !== 'surface') return null;
  const role = parts[2] as SurfaceRole;
  return SURFACE_ROLES.has(role) ? role : null;
}

function requireRamp(ramps: GeneratedRamp[], name: string): GeneratedRamp {
  const r = ramps.find((ramp) => ramp.scaleName === name);
  if (!r) throw new DriverError(`ramp "${name}" declared in tokenRamp but not in ramps[]`);
  return r;
}

function requireTokenRamp(map: Record<string, string>, path: string): string {
  const name = map[path];
  if (!name) throw new DriverError(`tokenRamp is missing an entry for ${path}`);
  return name;
}

function mergeIntent(
  base: FormalIntent,
  override: IntentOverride | undefined,
): FormalIntent {
  if (!override) return base;
  return {
    threshold: override.threshold
      ? { ...base.threshold, ...override.threshold }
      : base.threshold,
    preference: override.preference ?? base.preference,
    consistency: override.consistency ?? base.consistency,
    surfaceContext: override.surfaceContext ?? base.surfaceContext,
    constraints:
      override.constraints !== undefined
        ? { ...base.constraints, ...override.constraints }
        : base.constraints,
  };
}

function applyIntentOverrides(
  vocabulary: VocabularyEntry[],
  overrides: Record<string, IntentOverride> | undefined,
): VocabularyEntry[] {
  if (!overrides || Object.keys(overrides).length === 0) return vocabulary;
  return vocabulary.map((entry) => {
    const override = overrides[entry.path];
    if (!override || !entry.defaultIntent) return entry;
    return { ...entry, defaultIntent: mergeIntent(entry.defaultIntent, override) };
  });
}

function intentGroupKey(intent: FormalIntent): string {
  return JSON.stringify({
    th: intent.threshold,
    pr: intent.preference,
    co: intent.consistency,
    sc: intent.surfaceContext,
    cs: intent.constraints ?? null,
  });
}

/** Engine compliance chooses WCAG vs APCA for the formal `threshold.kind` on every entry. */
function coerceVocabularyThresholdKinds(
  entries: VocabularyEntry[],
  compliance: ProjectConfig['engine']['compliance'],
): VocabularyEntry[] {
  const kind: ContrastKind = compliance === 'apca' ? 'apca' : 'wcag';
  return entries.map((e) => {
    if (!e.defaultIntent) return e;
    return {
      ...e,
      defaultIntent: {
        ...e.defaultIntent,
        threshold: { ...e.defaultIntent.threshold, kind },
      },
    };
  });
}

export function resolveAll(input: ResolveAllInput): ResolveAllOutput {
  const { config, ramps, modes, tokenRamp, scales } = input;
  const vocabulary = coerceVocabularyThresholdKinds(
    applyIntentOverrides(input.vocabulary, config.intents),
    config.engine.compliance,
  );
  const denseRamps = buildDenseRamps(config, ramps, scales);

  const tokens: ResolvedToken[] = [];
  const surfaceByModeAndPath: Record<string, Record<string, string>> = {};
  for (const m of modes) surfaceByModeAndPath[m.mode] = {};

  const isSurface = (path: string): boolean =>
    input.surfacePaths ? input.surfacePaths.has(path) : surfaceRoleFromPath(path) !== null;

  const surfaces = vocabulary.filter((v) => isSurface(v.path));
  const nonSurfaces = vocabulary.filter((v) => !isSurface(v.path));

  for (const binding of modes) {
    for (const entry of surfaces) {
      const rampName = requireTokenRamp(tokenRamp, entry.path);
      const ramp = requireRamp(ramps, rampName);

      const stepDecl = input.surfaceSteps?.get(entry.path);
      let token: ResolvedToken;

      if (stepDecl) {
        const stepIndex =
          binding.scheme === 'light'
            ? (stepDecl.light ?? stepDecl.default ?? 0)
            : (stepDecl.dark ?? stepDecl.default ?? ramp.steps.length - 1);
        ({ token } = resolveSurfaceByIndex({
          tokenPath: entry.path,
          mode: binding.mode,
          stepIndex,
          ramp,
          baselineHex: binding.baselineHex,
        }));
      } else {
        const role = surfaceRoleFromPath(entry.path);
        if (!role) continue;
        if (!entry.defaultIntent) {
          throw new DriverError(`surface ${entry.path} missing defaultIntent`);
        }
        ({ token } = resolveSurface({
          tokenPath: entry.path,
          mode: binding.mode,
          scheme: binding.scheme,
          role,
          ramp,
          baselineHex: binding.baselineHex,
          intent: entry.defaultIntent,
          thresholdElevation: binding.thresholdElevation,
        }));
      }

      tokens.push(token);
      const modeMap = surfaceByModeAndPath[binding.mode];
      if (modeMap) modeMap[entry.path] = token.hex;
    }

    const items: { path: string; context: NonSurfaceContext; intent: FormalIntent }[] = [];
    for (const entry of nonSurfaces) {
      if (entry.usage === 'decorative') continue;
      if (!entry.defaultIntent || !entry.primarySurface) {
        throw new DriverError(
          `non-decorative token ${entry.path} needs defaultIntent + primarySurface`,
        );
      }
      const intent = entry.defaultIntent;
      assertValidFormalIntent(entry.path, intent);
      const rampName = requireTokenRamp(tokenRamp, entry.path);
      const ramp = requireRamp(ramps, rampName);
      const pickRamp = denseRamps ? denseRamps.get(rampName) ?? ramp : ramp;
      const modeSurfaces = surfaceByModeAndPath[binding.mode];
      if (!modeSurfaces) {
        throw new DriverError(`mode ${binding.mode} has no surface map`);
      }
      const surfaceRef = resolveSurfaceReference(entry, modeSurfaces);
      const ctx: NonSurfaceContext = {
        entry,
        ramp,
        pickRamp,
        denseRamp: denseRamps ? denseRamps.get(rampName) : undefined,
        surfaceHex: surfaceRef.hex,
        surfaceRef: `{${surfaceRef.path}}`,
      };
      items.push({ path: entry.path, context: ctx, intent });
    }

    const gBinding = {
      mode: binding.mode,
      thresholdElevation: binding.thresholdElevation,
    };
    const resolvedByPath: Map<string, ResolvedToken> = new Map();

    const indep = items.filter((x) => x.intent.consistency === 'independent');
    for (const it of indep) {
      const { token } = resolveToken({
        tokenPath: it.path,
        mode: binding.mode,
        intent: it.intent,
        ramp: it.context.ramp,
        surfaceHex: it.context.surfaceHex,
        surfaceRef: it.context.surfaceRef,
        thresholdElevation: binding.thresholdElevation,
        ...(it.context.denseRamp ? { denseRamp: it.context.denseRamp } : {}),
      });
      resolvedByPath.set(it.path, token);
    }

    const groupMap = (pred: (i: (typeof items)[0]) => boolean) => {
      const m = new Map<string, (typeof items)[0][]>();
      for (const it of items) {
        if (!pred(it)) continue;
        const k = intentGroupKey(it.intent);
        m.set(k, [...(m.get(k) ?? []), it]);
      }
      return m;
    };
    for (const [, arr] of groupMap((i) => i.intent.consistency === 'matched-across-ramps')) {
      const toks = resolveMatchedAcrossRamps(
        arr[0]!.intent,
        arr.map((x) => x.context),
        gBinding,
      );
      for (const t of toks) {
        resolvedByPath.set(t.path, t);
      }
    }
    for (const [, arr] of groupMap((i) => i.intent.consistency === 'anchored-to-reference')) {
      const toks = resolveAnchoredToReference(
        arr[0]!.intent,
        arr.map((x) => x.context),
        gBinding,
        tokenRamp,
      );
      for (const t of toks) {
        resolvedByPath.set(t.path, t);
      }
    }

    for (const it of items) {
      if (!resolvedByPath.has(it.path)) {
        const i = it.intent;
        throw new DriverError(
          `unresolved non-surface token ${it.path} (consistency ${i.consistency}): internal`,
        );
      }
      tokens.push(resolvedByPath.get(it.path)!);
    }
  }

  const materialized = materializeContinuousRamps(config, ramps, tokens);
  return {
    tokens: materialized.tokens,
    ramps: materialized.ramps,
    surfaceByModeAndPath,
  };
}

function buildDenseRamps(
  config: ProjectConfig,
  ramps: GeneratedRamp[],
  scales: ColorScale[] | undefined,
): Map<string, GeneratedRamp> | null {
  const resolver = config.engine.resolver;
  if (!resolver || resolver.mode !== 'continuous') return null;
  if (!scales || scales.length === 0) {
    throw new DriverError(
      'engine.resolver.mode="continuous" requires scales to be passed to resolveAll()',
    );
  }
  const steps = Math.max(
    ramps.reduce((max, r) => Math.max(max, r.steps.length), 0) + 1,
    resolver.fallbackSteps ?? DEFAULT_DENSE_STEPS,
  );
  const map = new Map<string, GeneratedRamp>();
  for (const scale of scales) {
    map.set(scale.name, generateRamp(densifyScale(scale, steps)));
  }
  return map;
}

function densifyScale(scale: ColorScale, targetSteps: number): ColorScale {
  return {
    ...scale,
    stepCount: targetSteps,
    curves: {
      lightness: {
        values: resampleCurve(scale.curves.lightness.values, targetSteps),
        ...(scale.curves.lightness.smoothing !== undefined
          ? { smoothing: scale.curves.lightness.smoothing }
          : {}),
      },
      chroma: {
        values: resampleCurve(scale.curves.chroma.values, targetSteps),
        ...(scale.curves.chroma.smoothing !== undefined
          ? { smoothing: scale.curves.chroma.smoothing }
          : {}),
      },
      hue: {
        values: resampleCurve(scale.curves.hue.values, targetSteps),
        ...(scale.curves.hue.smoothing !== undefined
          ? { smoothing: scale.curves.hue.smoothing }
          : {}),
      },
    },
  };
}

function resampleCurve(values: number[], targetLength: number): number[] {
  if (values.length === targetLength) return values.slice();
  if (values.length === 0) return new Array<number>(targetLength).fill(0);
  if (values.length === 1) return new Array<number>(targetLength).fill(values[0] ?? 0);
  if (targetLength <= 1) return [values[0] ?? 0];
  const result = new Array<number>(targetLength);
  for (let i = 0; i < targetLength; i++) {
    const t = i / (targetLength - 1);
    const src = t * (values.length - 1);
    const lo = Math.floor(src);
    const hi = Math.min(lo + 1, values.length - 1);
    const frac = src - lo;
    const a = values[lo] ?? 0;
    const b = values[hi] ?? a;
    result[i] = a + (b - a) * frac;
  }
  return result;
}

function resolveSurfaceReference(
  entry: VocabularyEntry,
  modeSurfaces: Record<string, string>,
): { path: string; hex: string } {
  const intent = entry.defaultIntent!;
  let target: string;
  switch (intent.surfaceContext) {
    case 'primary':
    case 'current':
      target = entry.primarySurface!;
      break;
    case 'inverse':
      target = 'color.surface.inverse';
      break;
    case 'elevated':
      target = 'color.surface.elevated';
      break;
  }
  const hex = modeSurfaces[target];
  if (!hex) {
    throw new DriverError(
      `token ${entry.path} needs surface "${target}" but it is not resolved for this mode`,
    );
  }
  return { path: target, hex };
}
