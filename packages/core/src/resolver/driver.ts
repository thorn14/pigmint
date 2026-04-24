import { resolveToken, type ThresholdElevation } from './resolve.js';
import { materializeContinuousRamps } from './materialize-continuous.js';
import { resolveSurface, type SurfaceRole } from './surfaces.js';
import { generateRamp } from '../math/ramp.js';
import type { ColorScale, GeneratedRamp } from '../types/palette.js';
import type {
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

export interface ResolveAllInput {
  config: ProjectConfig;
  vocabulary: VocabularyEntry[];
  ramps: GeneratedRamp[];
  modes: ModeBinding[];
  tokenRamp: Record<string, string>;
  scales?: ColorScale[];
}

export interface ResolveAllOutput {
  tokens: ResolvedToken[];
  /** Stepped ramps plus any synthesized `c0000`–`c1000` primitives (continuous + F1). */
  ramps: GeneratedRamp[];
  surfaceByModeAndPath: Record<string, Record<string, string>>;
}

export class DriverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DriverError';
  }
}

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
    constraints: override.constraints ?? base.constraints,
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

export function resolveAll(input: ResolveAllInput): ResolveAllOutput {
  const { config, ramps, modes, tokenRamp, scales } = input;
  const vocabulary = applyIntentOverrides(input.vocabulary, config.intents);
  const denseRamps = buildDenseRamps(config, ramps, scales);

  const tokens: ResolvedToken[] = [];
  const surfaceByModeAndPath: Record<string, Record<string, string>> = {};
  for (const m of modes) surfaceByModeAndPath[m.mode] = {};

  const surfaces = vocabulary.filter((v) => surfaceRoleFromPath(v.path) !== null);
  const nonSurfaces = vocabulary.filter((v) => surfaceRoleFromPath(v.path) === null);

  for (const binding of modes) {
    for (const entry of surfaces) {
      const role = surfaceRoleFromPath(entry.path);
      if (!role) continue;
      const rampName = requireTokenRamp(tokenRamp, entry.path);
      const ramp = requireRamp(ramps, rampName);
      if (!entry.defaultIntent) {
        throw new DriverError(`surface ${entry.path} missing defaultIntent`);
      }
      const { token } = resolveSurface({
        tokenPath: entry.path,
        mode: binding.mode,
        scheme: binding.scheme,
        role,
        ramp,
        baselineHex: binding.baselineHex,
        intent: entry.defaultIntent,
      });
      tokens.push(token);
      const modeMap = surfaceByModeAndPath[binding.mode];
      if (modeMap) modeMap[entry.path] = token.hex;
    }

    for (const entry of nonSurfaces) {
      if (entry.usage === 'decorative') continue;
      if (!entry.defaultIntent || !entry.primarySurface) {
        throw new DriverError(
          `non-decorative token ${entry.path} needs defaultIntent + primarySurface`,
        );
      }
      const rampName = requireTokenRamp(tokenRamp, entry.path);
      const ramp = requireRamp(ramps, rampName);
      const modeSurfaces = surfaceByModeAndPath[binding.mode];
      if (!modeSurfaces) {
        throw new DriverError(`mode ${binding.mode} has no surface map`);
      }
      const surfaceRef = resolveSurfaceReference(entry, modeSurfaces);
      const { token } = resolveToken({
        tokenPath: entry.path,
        mode: binding.mode,
        intent: entry.defaultIntent,
        ramp,
        surfaceHex: surfaceRef.hex,
        surfaceRef: `{${surfaceRef.path}}`,
        thresholdElevation: binding.thresholdElevation,
        ...(denseRamps ? { denseRamp: denseRamps.get(rampName) } : {}),
      });
      tokens.push(token);
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
