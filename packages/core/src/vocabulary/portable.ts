import type {
  ComplianceTarget,
  EngineConfig,
  FormalIntent,
  PortableDecorativeToken,
  PortableSemanticToken,
  PortableSurfaceToken,
  PortableVocabulary,
  VocabularyEntry,
} from '../types/spec.js';
import type { SurfaceStepDecl } from '../resolver/driver.js';

export class PortableVocabularyError extends Error {
  constructor(
    message: string,
    readonly path: string,
  ) {
    super(message);
    this.name = 'PortableVocabularyError';
  }
}

const VALID_PREFERENCES = new Set(['lowest-passing', 'highest-contrast', 'matched-to-set']);
const VALID_CONSISTENCIES = new Set(['independent', 'matched-across-ramps', 'anchored-to-reference']);
const VALID_LEVELS = new Set(['AA', 'AAA']);

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function assertString(v: unknown, label: string, filePath: string): string {
  if (typeof v !== 'string' || v.trim() === '') {
    throw new PortableVocabularyError(`${label} must be a non-empty string`, filePath);
  }
  return v;
}

function assertNumber(v: unknown, label: string, filePath: string): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new PortableVocabularyError(`${label} must be a number`, filePath);
  }
  return v;
}

function validateSurfaceToken(
  name: string,
  raw: unknown,
  filePath: string,
): PortableSurfaceToken {
  if (!isObj(raw)) {
    throw new PortableVocabularyError(`surfaces.${name} must be a mapping`, filePath);
  }
  assertString(raw.ramp, `surfaces.${name}.ramp`, filePath);

  const hasStep = 'step' in raw && raw.step !== undefined;
  const hasLightStep = 'lightStep' in raw && raw.lightStep !== undefined;
  const hasDarkStep = 'darkStep' in raw && raw.darkStep !== undefined;

  if (!hasStep && !hasLightStep && !hasDarkStep) {
    throw new PortableVocabularyError(
      `surfaces.${name} must declare either "step" or "lightStep"/"darkStep"`,
      filePath,
    );
  }
  if (hasStep && (hasLightStep || hasDarkStep)) {
    throw new PortableVocabularyError(
      `surfaces.${name}: "step" is mutually exclusive with "lightStep"/"darkStep"`,
      filePath,
    );
  }
  if (hasLightStep) assertNumber(raw.lightStep, `surfaces.${name}.lightStep`, filePath);
  if (hasDarkStep) assertNumber(raw.darkStep, `surfaces.${name}.darkStep`, filePath);
  if (hasStep) assertNumber(raw.step, `surfaces.${name}.step`, filePath);

  return raw as unknown as PortableSurfaceToken;
}

function validateSemanticToken(
  section: string,
  name: string,
  raw: unknown,
  surfaceNames: Set<string>,
  filePath: string,
): PortableSemanticToken {
  if (!isObj(raw)) {
    throw new PortableVocabularyError(`${section}.${name} must be a mapping`, filePath);
  }
  assertString(raw.ramp, `${section}.${name}.ramp`, filePath);

  if (!Array.isArray(raw.surfaces) || raw.surfaces.length === 0) {
    throw new PortableVocabularyError(
      `${section}.${name}.surfaces must be a non-empty array`,
      filePath,
    );
  }
  for (const s of raw.surfaces) {
    if (typeof s !== 'string' || !surfaceNames.has(s)) {
      throw new PortableVocabularyError(
        `${section}.${name}.surfaces references unknown surface "${s}"`,
        filePath,
      );
    }
  }

  const pref = raw.preference;
  if (typeof pref !== 'string' || !VALID_PREFERENCES.has(pref)) {
    throw new PortableVocabularyError(
      `${section}.${name}.preference must be one of: ${[...VALID_PREFERENCES].join(', ')}`,
      filePath,
    );
  }

  if ('consistency' in raw && raw.consistency !== undefined) {
    if (typeof raw.consistency !== 'string' || !VALID_CONSISTENCIES.has(raw.consistency)) {
      throw new PortableVocabularyError(
        `${section}.${name}.consistency must be one of: ${[...VALID_CONSISTENCIES].join(', ')}`,
        filePath,
      );
    }
  }

  if ('level' in raw && raw.level !== undefined) {
    if (typeof raw.level !== 'string' || !VALID_LEVELS.has(raw.level)) {
      throw new PortableVocabularyError(
        `${section}.${name}.level must be "AA" or "AAA"`,
        filePath,
      );
    }
  }

  if ('interactions' in raw && raw.interactions !== undefined) {
    if (!isObj(raw.interactions)) {
      throw new PortableVocabularyError(
        `${section}.${name}.interactions must be a mapping`,
        filePath,
      );
    }
    for (const [state, decl] of Object.entries(raw.interactions)) {
      if (!isObj(decl) || typeof decl.offset !== 'number') {
        throw new PortableVocabularyError(
          `${section}.${name}.interactions.${state} must be { offset: number }`,
          filePath,
        );
      }
    }
  }

  return raw as unknown as PortableSemanticToken;
}

function validateDecorativeToken(
  name: string,
  raw: unknown,
  filePath: string,
): PortableDecorativeToken {
  if (!isObj(raw)) {
    throw new PortableVocabularyError(`decorative.${name} must be a mapping`, filePath);
  }
  assertString(raw.ramp, `decorative.${name}.ramp`, filePath);
  assertNumber(raw.step, `decorative.${name}.step`, filePath);
  return raw as unknown as PortableDecorativeToken;
}

export function validatePortableVocabulary(raw: unknown, filePath: string): PortableVocabulary {
  if (!isObj(raw)) {
    throw new PortableVocabularyError('vocabulary must be a mapping', filePath);
  }

  if (!isObj(raw.surfaces) || Object.keys(raw.surfaces).length === 0) {
    throw new PortableVocabularyError(
      'vocabulary must have a non-empty "surfaces" section',
      filePath,
    );
  }

  const surfaceNames = new Set(Object.keys(raw.surfaces));
  const surfaces: Record<string, PortableSurfaceToken> = {};
  for (const [name, entry] of Object.entries(raw.surfaces)) {
    surfaces[name] = validateSurfaceToken(name, entry, filePath);
  }

  const hasForeground = isObj(raw.foreground) && Object.keys(raw.foreground).length > 0;
  const hasNonText = isObj(raw.nonText) && Object.keys(raw.nonText).length > 0;
  const hasDecorative = isObj(raw.decorative) && Object.keys(raw.decorative).length > 0;

  if (!hasForeground && !hasNonText && !hasDecorative) {
    throw new PortableVocabularyError(
      'vocabulary must have at least one non-empty section: foreground, nonText, or decorative',
      filePath,
    );
  }

  const foreground: Record<string, PortableSemanticToken> = {};
  if (isObj(raw.foreground)) {
    for (const [name, entry] of Object.entries(raw.foreground)) {
      foreground[name] = validateSemanticToken('foreground', name, entry, surfaceNames, filePath);
    }
  }

  const nonText: Record<string, PortableSemanticToken> = {};
  if (isObj(raw.nonText)) {
    for (const [name, entry] of Object.entries(raw.nonText)) {
      nonText[name] = validateSemanticToken('nonText', name, entry, surfaceNames, filePath);
    }
  }

  const decorative: Record<string, PortableDecorativeToken> = {};
  if (isObj(raw.decorative)) {
    for (const [name, entry] of Object.entries(raw.decorative)) {
      decorative[name] = validateDecorativeToken(name, entry, filePath);
    }
  }

  return { surfaces, foreground, nonText, ...(hasDecorative ? { decorative } : {}) };
}

function deriveIntent(
  token: PortableSemanticToken,
  usage: 'text' | 'nonText',
  engineConfig: EngineConfig,
): FormalIntent {
  const kind = engineConfig.compliance === 'apca' ? 'apca' : 'wcag';
  const level = (token.level ?? engineConfig.target) as ComplianceTarget;
  const consistency =
    (token.consistency as FormalIntent['consistency']) ?? 'independent';
  return {
    threshold: { kind, level, usage },
    preference: token.preference as FormalIntent['preference'],
    consistency,
    surfaceContext: 'primary',
  };
}

export function portableToVocabularyEntries(
  vocab: PortableVocabulary,
  engineConfig: EngineConfig,
): VocabularyEntry[] {
  const entries: VocabularyEntry[] = [];

  const surfacePlaceholderIntent: FormalIntent = {
    threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
    preference: 'highest-contrast',
    consistency: 'independent',
    surfaceContext: 'primary',
  };

  for (const name of Object.keys(vocab.surfaces)) {
    entries.push({
      path: name,
      usage: 'nonText',
      primarySurface: name,
      defaultIntent: surfacePlaceholderIntent,
      states: ['base'],
    });
  }

  for (const [name, token] of Object.entries(vocab.foreground)) {
    entries.push({
      path: name,
      usage: 'text',
      primarySurface: token.surfaces[0],
      additionalSurfaces: token.surfaces.slice(1),
      defaultIntent: deriveIntent(token, 'text', engineConfig),
      states: ['base'],
    });
  }

  for (const [name, token] of Object.entries(vocab.nonText)) {
    entries.push({
      path: name,
      usage: 'nonText',
      primarySurface: token.surfaces[0],
      additionalSurfaces: token.surfaces.slice(1),
      defaultIntent: deriveIntent(token, 'nonText', engineConfig),
      states: ['base'],
    });
  }

  for (const name of Object.keys(vocab.decorative ?? {})) {
    entries.push({
      path: name,
      usage: 'decorative',
      states: ['base'],
    });
  }

  return entries;
}

export function buildSurfaceStepMap(vocab: PortableVocabulary): Map<string, SurfaceStepDecl> {
  const map = new Map<string, SurfaceStepDecl>();
  for (const [name, entry] of Object.entries(vocab.surfaces)) {
    map.set(name, {
      light: entry.lightStep,
      dark: entry.darkStep,
      default: entry.step,
    });
  }
  return map;
}

export function buildSurfacePaths(vocab: PortableVocabulary): Set<string> {
  return new Set(Object.keys(vocab.surfaces));
}

function rampMatchKey(name: string): string {
  return name.trim().toLowerCase() || 'color';
}

/**
 * When palette ramps are removed, portable tokens may still reference the old
 * `ramp` name. Rewrites every token whose `ramp` is in `deletedRampNames` to
 * `fallbackRampName` (typically the first remaining scale).
 * Matching is case-insensitive so vocab `gray` still matches a removed scale `Gray`.
 */
export function remapPortableVocabularyRamps(
  vocab: PortableVocabulary,
  deletedRampNames: readonly string[],
  fallbackRampName: string,
): PortableVocabulary {
  if (deletedRampNames.length === 0) return vocab;
  const deletedKeys = new Set(deletedRampNames.map((n) => rampMatchKey(n)));
  const fix = <T extends { ramp: string }>(t: T): T =>
    deletedKeys.has(rampMatchKey(t.ramp)) ? { ...t, ramp: fallbackRampName } : t;

  const surfaces = Object.fromEntries(
    Object.entries(vocab.surfaces).map(([k, t]) => [k, fix(t)]),
  );
  const foreground = Object.fromEntries(
    Object.entries(vocab.foreground).map(([k, t]) => [k, fix(t)]),
  );
  const nonText = Object.fromEntries(
    Object.entries(vocab.nonText).map(([k, t]) => [k, fix(t)]),
  );
  const out: PortableVocabulary = { ...vocab, surfaces, foreground, nonText };
  if (vocab.decorative !== undefined) {
    out.decorative = Object.fromEntries(
      Object.entries(vocab.decorative).map(([k, t]) => [k, fix(t)]),
    );
  }
  return out;
}

/**
 * Point every tokenRamp entry at a real `scales[].name` (case-insensitive match).
 * Unknown names (e.g. stale ramp after palette edit) map to `scaleNames[0]`.
 */
export function coerceTokenRampToPaletteScales(
  tokenRamp: Record<string, string>,
  scaleNames: readonly string[],
): Record<string, string> {
  if (scaleNames.length === 0) return { ...tokenRamp };
  const keyToCanonical = new Map<string, string>();
  for (const n of scaleNames) {
    keyToCanonical.set(rampMatchKey(n), n);
  }
  const fallback = scaleNames[0]!;
  const out: Record<string, string> = { ...tokenRamp };
  for (const path of Object.keys(out)) {
    const r = out[path] ?? '';
    const k = rampMatchKey(r);
    const hit = keyToCanonical.get(k);
    out[path] = hit ?? fallback;
  }
  return out;
}

export function buildTokenRampFromPortable(vocab: PortableVocabulary): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [name, entry] of Object.entries(vocab.surfaces)) {
    map[name] = entry.ramp;
  }
  for (const [name, entry] of Object.entries(vocab.foreground)) {
    map[name] = entry.ramp;
  }
  for (const [name, entry] of Object.entries(vocab.nonText)) {
    map[name] = entry.ramp;
  }
  for (const [name, entry] of Object.entries(vocab.decorative ?? {})) {
    map[name] = entry.ramp;
  }
  return map;
}

export interface PortableVocabularyArtifacts {
  vocabulary: VocabularyEntry[];
  tokenRamp: Record<string, string>;
  surfacePaths: Set<string>;
  surfaceSteps: Map<string, SurfaceStepDecl>;
}

export function buildPortableArtifacts(
  vocab: PortableVocabulary,
  engineConfig: EngineConfig,
): PortableVocabularyArtifacts {
  return {
    vocabulary: portableToVocabularyEntries(vocab, engineConfig),
    tokenRamp: buildTokenRampFromPortable(vocab),
    surfacePaths: buildSurfacePaths(vocab),
    surfaceSteps: buildSurfaceStepMap(vocab),
  };
}
