import { buildResolvedValue } from '../resolver/resolve.js';
import type { GeneratedRamp, GeneratedStep } from '../types/palette.js';
import type {
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
      engine: { version: string };
    };
  };
  color: {
    primitive: Record<string, PrimitiveRamp>;
  } & Record<string, unknown>;
}

export interface PrimitiveRamp {
  $type: 'color';
  [step: string]: PrimitiveToken | 'color';
}

export interface PrimitiveToken {
  $value: DtcgColorValue;
  $description?: string;
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

function buildPrimitives(ramps: GeneratedRamp[]): Record<string, PrimitiveRamp> {
  const out: Record<string, PrimitiveRamp> = {};
  for (const ramp of ramps) {
    const group: PrimitiveRamp = { $type: 'color' };
    for (const step of ramp.steps) {
      group[step.name] = { $value: primitiveValue(step) };
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
  const entry: ModeEntry = {
    value,
    source: token.source,
    resolvedAgainst: token.resolvedAgainst,
    contrast: token.contrast,
    compliance: token.compliance,
    gamut: {
      inSrgb: token.gamut === 'srgb',
      inP3: token.gamut === 'srgb' || token.gamut === 'p3',
      clipped: token.gamut !== 'srgb',
    },
  };
  return entry;
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
  } = input;

  const container: DtcgContainer = {
    $schema: 'https://design-tokens.github.io/community-group/format/',
    $description: 'Pigmint-generated tokens.',
    $extensions: {
      'com.pigmint': {
        specVersion,
        vocabularyVersion,
        ...(surfacePairsVersion ? { surfacePairsVersion } : {}),
        generatedAt,
        defaultMode,
        engine: { version: engineVersion },
      },
    },
    color: {
      primitive: buildPrimitives(ramps),
    },
  };

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
        defaultAlias = `{color.primitive.${r.source.ramp}.${stepName}}`;
      }
    }

    const firstResolution = resolutions[0];
    if (!firstResolution) continue;

    if (defaultAlias === null) {
      const stepName = firstResolution.source.nearestPrimitive?.split('.').pop() ?? '';
      defaultAlias = `{color.primitive.${firstResolution.source.ramp}.${stepName}}`;
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

    const segments = path.split('.');
    if (segments[0] === 'color') segments.shift();
    setAtPath(container.color as unknown as Record<string, unknown>, segments, token);
  }

  return container;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
