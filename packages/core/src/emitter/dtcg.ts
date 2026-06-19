import { buildResolvedValue } from '../resolver/resolve.js';
import type { GeneratedRamp, GeneratedStep } from '../types/palette.js';
import type {
  CvdProfile,
  ModeEntry,
  ResolvedToken,
  ResolvedValue,
  VocabularyEntry,
} from '../types/spec.js';

export interface DtcgContainer {
  $schema: string;
  $description?: string;
  $extensions: {
    'com.pigmint': {
      specVersion: string;
      vocabularyVersion: string;
      surfacePairsVersion?: string;
      generatedAt: string;
      defaultMode: string;
      engine: { version: string; cvd?: CvdProfile[] };
    };
  };
  primitive: Record<string, PrimitiveRamp>;
  [key: string]: unknown;
}

export interface PrimitiveRamp {
  $type: 'color';
  [step: string]: PrimitiveToken | 'color';
}

export interface PrimitiveTokenExtensions {
  oklch?: { l: number; c: number; h: number; alpha?: number };
}

export interface PrimitiveToken {
  $value: DtcgColorValue;
  $description?: string;
  $extensions?: PrimitiveTokenExtensions;
}

export interface DtcgColorValue {
  colorSpace: 'srgb' | 'display-p3';
  components: [number, number, number];
  alpha?: number;
  hex?: string;
}

export interface SemanticToken {
  $type: 'color';
  $value: string;
  $description?: string;
  $extensions: {
    'com.pigmint': {
      usage: 'text' | 'nonText' | 'decorative';
      intent?: unknown;
      primarySurface?: string;
      modes: Record<string, ModeEntry>;
    };
  };
}

export interface EmitInput {
  specVersion?: string;
  engineVersion?: string;
  vocabularyVersion?: string;
  surfacePairsVersion?: string;
  defaultMode: string;
  generatedAt?: string;
  ramps: GeneratedRamp[];
  resolvedTokens: ResolvedToken[];
  vocabulary?: VocabularyEntry[];
  cvd?: CvdProfile[];
  /** When false, omit the primitive section (use when primitives are emitted separately). Default: true. */
  includePrimitives?: boolean;
}

export interface EmitPrimitivesInput {
  engineVersion?: string;
  defaultMode: string;
  generatedAt?: string;
  ramps: GeneratedRamp[];
  cvd?: CvdProfile[];
}

function primitiveValue(step: GeneratedStep): DtcgColorValue {
  if (step.gamut === 'p3' && step.p3) {
    return {
      colorSpace: 'display-p3',
      components: [round4(step.p3.r), round4(step.p3.g), round4(step.p3.b)],
      hex: step.hex,
    };
  }
  return {
    colorSpace: 'srgb',
    components: [round4(step.srgb.r), round4(step.srgb.g), round4(step.srgb.b)],
    hex: step.hex,
  };
}

function buildOklchExtension(step: GeneratedStep): { l: number; c: number; h: number; alpha?: number } {
  const { l, c, h, alpha } = step.oklch;
  const out: { l: number; c: number; h: number; alpha?: number } = {
    l: round6(l),
    c: round6(c),
    h: round6(h),
  };
  if (alpha !== undefined && alpha < 1) out.alpha = round4(alpha);
  return out;
}

function buildPrimitives(ramps: GeneratedRamp[]): Record<string, PrimitiveRamp> {
  const out: Record<string, PrimitiveRamp> = {};
  for (const ramp of ramps) {
    const group: PrimitiveRamp = { $type: 'color' };
    for (const step of ramp.steps) {
      group[step.name] = {
        $value: primitiveValue(step),
        $extensions: { oklch: buildOklchExtension(step) },
      };
    }
    out[ramp.scaleName] = group;
  }
  return out;
}

function setAtPath(
  root: Record<string, unknown>,
  segments: string[],
  token: SemanticToken,
): void {
  let cursor: Record<string, unknown> = root;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (!seg) continue;
    const next = cursor[seg];
    if (next && typeof next === 'object' && !Array.isArray(next)) {
      cursor = next as Record<string, unknown>;
    } else {
      const fresh: Record<string, unknown> = {};
      cursor[seg] = fresh;
      cursor = fresh;
    }
  }
  const last = segments[segments.length - 1];
  if (!last) throw new Error('empty token path');
  cursor[last] = token;
}

function modeEntryFromResolved(
  token: ResolvedToken,
  value: ResolvedValue,
): ModeEntry {
  const inSrgb = token.gamut === 'srgb';
  const strategy = token.intent.constraints?.gamutStrategy
    ?? (inSrgb ? 'chroma-preserve' : 'chroma-reduce');
  const entry: ModeEntry = {
    value,
    source: token.source,
    resolvedAgainst: token.resolvedAgainst,
    contrast: token.contrast,
    compliance: token.compliance,
    gamut: {
      inSrgb,
      inP3: token.gamut === 'srgb' || token.gamut === 'p3',
      clipped: !inSrgb,
      strategy,
    },
  };
  return entry;
}

function makeContainerBase(
  defaultMode: string,
  engineVersion: string,
  specVersion: string,
  vocabularyVersion: string,
  surfacePairsVersion: string | undefined,
  generatedAt: string,
  cvd: CvdProfile[] | undefined,
  primitives: Record<string, PrimitiveRamp>,
): DtcgContainer {
  return {
    $schema: 'https://design-tokens.github.io/community-group/format/',
    $description: 'Pigmint-generated tokens.',
    $extensions: {
      'com.pigmint': {
        specVersion,
        vocabularyVersion,
        ...(surfacePairsVersion ? { surfacePairsVersion } : {}),
        generatedAt,
        defaultMode,
        engine: {
          version: engineVersion,
          ...(cvd && cvd.length > 0 ? { cvd: [...cvd] } : {}),
        },
      },
    },
    primitive: primitives,
  };
}

export function emitPrimitives(input: EmitPrimitivesInput): DtcgContainer {
  const {
    engineVersion = '0.0.0',
    defaultMode,
    generatedAt = new Date().toISOString(),
    ramps,
    cvd,
  } = input;
  return makeContainerBase(
    defaultMode,
    engineVersion,
    '0.1.0',
    'vocabulary@0.1',
    undefined,
    generatedAt,
    cvd,
    buildPrimitives(ramps),
  );
}

export function emitDtcg(input: EmitInput): DtcgContainer {
  const {
    specVersion = '0.1.0',
    engineVersion = '0.0.0',
    vocabularyVersion = 'vocabulary@0.1',
    surfacePairsVersion,
    defaultMode,
    generatedAt = new Date().toISOString(),
    ramps,
    resolvedTokens,
    includePrimitives = true,
  } = input;

  const container = makeContainerBase(
    defaultMode,
    engineVersion,
    specVersion,
    vocabularyVersion,
    surfacePairsVersion,
    generatedAt,
    input.cvd,
    includePrimitives ? buildPrimitives(ramps) : {},
  );

  const rampByName = new Map(ramps.map((r) => [r.scaleName, r]));
  const vocabByPath = new Map<string, VocabularyEntry>();
  for (const e of input.vocabulary ?? []) vocabByPath.set(e.path, e);

  const byToken = new Map<string, ResolvedToken[]>();
  for (const t of resolvedTokens) {
    const list = byToken.get(t.path) ?? [];
    list.push(t);
    byToken.set(t.path, list);
  }

  for (const [path, resolutions] of byToken) {
    const modes: Record<string, ModeEntry> = {};
    let defaultAlias: string | null = null;

    for (const r of resolutions) {
      const ramp = rampByName.get(r.source.ramp);
      const stepName = r.source.nearestPrimitive?.split('.').pop() ?? '';
      const step = ramp?.steps.find((s) => s.name === stepName);
      if (!step) throw new Error(`step not found for ${r.path} mode=${r.mode}`);
      const value = buildResolvedValue(step);
      modes[r.mode] = modeEntryFromResolved(r, value);
      if (r.mode === defaultMode) {
        defaultAlias = `{primitive.${r.source.ramp}.${stepName}}`;
      }
    }

    const firstResolution = resolutions[0];
    if (!firstResolution) continue;

    if (defaultAlias === null) {
      const stepName = firstResolution.source.nearestPrimitive?.split('.').pop() ?? '';
      defaultAlias = `{primitive.${firstResolution.source.ramp}.${stepName}}`;
    }

    const entry = vocabByPath.get(path);
    const usage =
      entry?.usage ?? (firstResolution.intent.threshold.usage as SemanticToken['$extensions']['com.pigmint']['usage']);
    const primarySurface = entry?.primarySurface ?? firstResolution.resolvedAgainst ?? undefined;

    const token: SemanticToken = {
      $type: 'color',
      $value: defaultAlias,
      $extensions: {
        'com.pigmint': {
          usage,
          intent: firstResolution.intent,
          ...(primarySurface ? { primarySurface } : {}),
          modes,
        },
      },
    };

    // Strip leading 'color.' from V1 vocabulary paths; portable vocab paths have no prefix.
    const segments = path.split('.');
    if (segments[0] === 'color') segments.shift();
    setAtPath(container as unknown as Record<string, unknown>, segments, token);
  }

  return container;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function round6(n: number): number {
  return Math.round(n * 1000000) / 1000000;
}
