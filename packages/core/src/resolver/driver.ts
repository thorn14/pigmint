import { resolveToken } from './resolve.js';
import { resolveSurface, type SurfaceRole } from './surfaces.js';
import type { GeneratedRamp } from '../types/palette.js';
import type {
  FormalIntent,
  IntentOverride,
  ProjectConfig,
  ResolvedToken,
  VocabularyEntry,
} from '../types/spec.js';

export interface ModeBinding {
  mode: string;
  scheme: 'light' | 'dark';
  baselineHex: string;
}

export interface ResolveAllInput {
  config: ProjectConfig;
  vocabulary: VocabularyEntry[];
  ramps: GeneratedRamp[];
  modes: ModeBinding[];
  tokenRamp: Record<string, string>;
}

export interface ResolveAllOutput {
  tokens: ResolvedToken[];
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
  const { config, ramps, modes, tokenRamp } = input;
  const vocabulary = applyIntentOverrides(input.vocabulary, config.intents);

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
      });
      tokens.push(token);
    }
  }

  return { tokens, surfaceByModeAndPath };
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
