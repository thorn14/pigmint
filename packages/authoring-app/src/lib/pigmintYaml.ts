import { parse as yamlParse, stringify as yamlStringify } from 'yaml';
import { parse as cssParse, formatHex } from 'culori';
import {
  hexToOklch,
  tryParseHex,
  oklchToHex,
  buildChromaCurve,
  buildDefaultCurves,
  computeHueShift,
  generateRamp,
  TAILWIND_LIGHTNESS,
  TAILWIND_STEPS,
  type ComplianceTarget,
  type CvdProfile,
  type GamutTarget,
  type ResolverConfig,
} from '@pigmint/core';
import type { ColorScale } from '../types/palette';
import type { ImportedScale } from './importTokens';
import {
  ENGINE_MODE_OPTIONS,
  sanitizeCvd,
  sanitizeResolver,
  type EngineCompliance,
  type EngineMode,
  type IntentOverrides,
} from '../store/intentStore';

export interface PigmintEngine {
  compliance: EngineCompliance;
  target: ComplianceTarget;
  modes: EngineMode[];
  cvd?: CvdProfile[];
  resolver?: ResolverConfig;
  gamut?: GamutTarget;
}

export interface PigmintYamlRamp {
  name: string;
  source: string;
  stepCount?: number;
  naming?: 'tailwind' | 'numeric';
  curves?: {
    lightness?: number[];
    chroma?: number[];
    hue?: number[];
    smoothing?: number;
  };
  hueShift?: { lightEnd?: number; darkEnd?: number };
  chromaPeak?: number;
  chromaLow?: number;
  chromaHigh?: number;
}

export interface PigmintYamlDoc {
  engine: PigmintEngine;
  ramps: PigmintYamlRamp[];
  output: {
    dtcg: string;
  };
  intents?: Record<string, unknown>;
}

export interface ParsedPigmintYaml {
  scales: ImportedScale[];
  intents: IntentOverrides;
  engine: PigmintEngine;
  doc: PigmintYamlDoc;
}

const DEFAULT_ENGINE: PigmintEngine = {
  compliance: 'wcag21',
  target: 'AA',
  modes: ['light', 'dark'],
  cvd: [],
  resolver: { mode: 'stepped' },
  gamut: 'p3',
};

const DEFAULT_OUTPUT: PigmintYamlDoc['output'] = {
  dtcg: './tokens.json',
};

export interface SerializeInput {
  scales: ColorScale[];
  intents: IntentOverrides;
  engine?: Partial<PigmintEngine>;
}

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => Math.abs(v - (b[i] ?? 0)) < 1e-10);
}

function serializeRamp(s: ColorScale): PigmintYamlRamp {
  const ramp: PigmintYamlRamp = { name: s.name, source: s.sourceHex };

  if (s.stepCount !== 11) ramp.stepCount = s.stepCount;
  if (s.naming.preset !== 'tailwind' && s.naming.preset !== 'custom') {
    ramp.naming = s.naming.preset as 'tailwind' | 'numeric';
  }

  const defaults = buildDefaultCurves(s.sourceOklch, s.stepCount);
  const lDefault = defaults.lightness.values;
  const cDefault = defaults.chroma.values;
  const hDefault = defaults.hue.values;

  const lValues = s.curves.lightness.values;
  const cValues = s.curves.chroma.values;
  const hValues = s.curves.hue.values;

  const lCustom = !arraysEqual(lValues, lDefault);
  const cCustom = !arraysEqual(cValues, cDefault);
  const hCustom = !arraysEqual(hValues, hDefault);
  const smoothing = s.curves.lightness.smoothing ?? 0;

  if (lCustom || cCustom || hCustom || smoothing !== 0) {
    ramp.curves = {};
    if (lCustom) ramp.curves.lightness = lValues.map((v) => Math.round(v * 1e6) / 1e6);
    if (cCustom) ramp.curves.chroma = cValues.map((v) => Math.round(v * 1e6) / 1e6);
    if (hCustom) ramp.curves.hue = hValues.map((v) => Math.round(v * 1e4) / 1e4);
    if (smoothing !== 0) ramp.curves.smoothing = smoothing;
  }

  if (s.hueShift.lightEndAdjust !== 0) {
    ramp.hueShift = { ...ramp.hueShift, lightEnd: s.hueShift.lightEndAdjust };
  }
  if (s.hueShift.darkEndAdjust !== 0) {
    ramp.hueShift = { ...ramp.hueShift, darkEnd: s.hueShift.darkEndAdjust };
  }

  const defaultChromaPeak = s.sourceOklch.c;
  if (Math.abs(s.chromaPeak - defaultChromaPeak) > 1e-10) {
    ramp.chromaPeak = Math.round(s.chromaPeak * 1e6) / 1e6;
  }
  if (s.chromaLow !== undefined) ramp.chromaLow = Math.round(s.chromaLow * 1e6) / 1e6;
  if (s.chromaHigh !== undefined) ramp.chromaHigh = Math.round(s.chromaHigh * 1e6) / 1e6;

  return ramp;
}

export function serializePigmintYaml(input: SerializeInput): string {
  const engineInput = input.engine ?? {};
  const engine: PigmintEngine = {
    compliance: engineInput.compliance === 'apca' ? 'apca' : 'wcag21',
    target: engineInput.target === 'AAA' ? 'AAA' : 'AA',
    modes: sanitizeModes(engineInput.modes),
    cvd: sanitizeCvd(engineInput.cvd),
    resolver: sanitizeResolver(engineInput.resolver),
    gamut: engineInput.gamut === 'srgb' ? 'srgb' : 'p3',
  };
  const doc: PigmintYamlDoc = {
    engine,
    ramps: input.scales.map(serializeRamp),
    output: DEFAULT_OUTPUT,
  };

  if (Object.keys(input.intents).length > 0) {
    doc.intents = input.intents as Record<string, unknown>;
  }

  return yamlStringify(doc);
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseEngine(raw: unknown): PigmintEngine {
  if (!isObj(raw)) return DEFAULT_ENGINE;
  const compliance = raw.compliance === 'apca' ? 'apca' : 'wcag21';
  const target = raw.target === 'AAA' ? 'AAA' : 'AA';
  const modes = sanitizeModes(raw.modes);
  const cvd = sanitizeCvd(raw.cvd);
  const resolver = sanitizeResolver(raw.resolver);
  const gamut: GamutTarget = raw.gamut === 'srgb' ? 'srgb' : 'p3';
  return { compliance, target, modes, cvd, resolver, gamut };
}

function sanitizeModes(raw: unknown): EngineMode[] {
  const known = new Set<EngineMode>(ENGINE_MODE_OPTIONS);
  const filtered = Array.isArray(raw)
    ? raw.filter((m): m is EngineMode =>
        typeof m === 'string' && known.has(m as EngineMode),
      )
    : [];
  const deduped = Array.from(new Set(filtered));
  const ordered = ENGINE_MODE_OPTIONS.filter((mode) => deduped.includes(mode));
  return ordered.length > 0 ? ordered : DEFAULT_ENGINE.modes;
}

export interface ParsePigmintYamlOptions {
  /**
   * Map of ramp name → pre-materialized ImportedScale, used to resolve
   * `ramps[].fromFile` entries without filesystem access. Build this with
   * {@link parsePigmintPrimitives} from the paired `primitives.json`.
   */
  primitives?: Record<string, ImportedScale>;
}

export function parsePigmintYaml(
  text: string,
  options: ParsePigmintYamlOptions = {},
): ParsedPigmintYaml {
  const parsed = yamlParse(text);
  if (!isObj(parsed)) {
    throw new Error('pigmint.yaml must be a mapping at the top level');
  }

  const ramps = parsed.ramps;
  if (!Array.isArray(ramps)) {
    throw new Error('pigmint.yaml is missing a `ramps` list');
  }

  const engine = parseEngine(parsed.engine);
  const scales: ImportedScale[] = [];
  for (const entry of ramps) {
    if (!isObj(entry)) continue;
    const name = typeof entry.name === 'string' ? entry.name : null;
    const source = typeof entry.source === 'string' ? entry.source : null;
    const fromFile = typeof entry.fromFile === 'string' ? entry.fromFile : null;

    if (name && fromFile && !source) {
      const preloaded = options.primitives?.[name];
      if (!preloaded) {
        throw new Error(
          `Ramp \`${name}\` uses \`fromFile: ${fromFile}\` — upload the referenced primitives.json alongside the pigmint.yaml.`,
        );
      }
      scales.push(preloaded);
      continue;
    }

    if (!name || !source) {
      throw new Error(`Ramp entry must have \`name\` and \`source\` (or \`fromFile\` with primitives uploaded): got ${JSON.stringify(entry)}`);
    }
    const parsedColor = cssParse(source);
    const hex = parsedColor ? formatHex(parsedColor) : null;
    if (!hex) {
      throw new Error(`Ramp \`${name}\` has invalid source color: ${source}`);
    }
    const oklch = hexToOklch(hex);

    // Read optional curve overrides from the YAML entry
    const stepCount = typeof entry.stepCount === 'number' ? entry.stepCount : TAILWIND_STEPS.length;
    const naming = entry.naming === 'numeric' ? 'numeric' : 'tailwind';
    const rawCurves = isObj(entry.curves) ? entry.curves : null;
    const rawHueShift = isObj(entry.hueShift) ? entry.hueShift : null;
    const chromaPeak = typeof entry.chromaPeak === 'number' ? entry.chromaPeak : undefined;
    const chromaLow = typeof entry.chromaLow === 'number' ? entry.chromaLow : undefined;
    const chromaHigh = typeof entry.chromaHigh === 'number' ? entry.chromaHigh : undefined;

    if (rawCurves) {
      // Reconstruct a full ColorScale so generateRamp produces accurate steps
      const defaults = buildDefaultCurves(oklch, stepCount);
      const smoothing = typeof rawCurves.smoothing === 'number' ? rawCurves.smoothing : 0;
      const curves = {
        lightness: {
          values: Array.isArray(rawCurves.lightness)
            ? rawCurves.lightness as number[]
            : defaults.lightness.values,
          smoothing,
        },
        chroma: {
          values: Array.isArray(rawCurves.chroma)
            ? rawCurves.chroma as number[]
            : defaults.chroma.values,
          smoothing,
        },
        hue: {
          values: Array.isArray(rawCurves.hue)
            ? rawCurves.hue as number[]
            : defaults.hue.values,
          smoothing,
        },
      };
      const hueShift = {
        lightEndAdjust: typeof rawHueShift?.lightEnd === 'number' ? rawHueShift.lightEnd : 0,
        darkEndAdjust: typeof rawHueShift?.darkEnd === 'number' ? rawHueShift.darkEnd : 0,
      };
      const colorScale = {
        id: name,
        name,
        sourceHex: hex,
        sourceOklch: oklch,
        sourceAlpha: 1,
        stepCount,
        naming: { preset: naming as 'tailwind' | 'numeric' },
        curves,
        hueShift,
        lightnessPreset: 'tailwind',
        chromaPeak: chromaPeak ?? oklch.c,
        chromaLow,
        chromaHigh,
      };
      const generated = generateRamp(colorScale, { gamut: engine.gamut });
      scales.push({
        name,
        sourceHex: hex,
        sourceOklch: oklch,
        steps: generated.steps.map((s) => ({ name: s.name, hex: s.hex, oklch: s.oklch })),
        curves,
        hueShift,
        chromaPeak: colorScale.chromaPeak,
        chromaLow,
        chromaHigh,
        stepCount,
        naming: { preset: naming as 'tailwind' | 'numeric' },
      });
    } else {
      // No curve data — use default derivation (backward compatible)
      const chromaValues = buildChromaCurve(oklch.c, stepCount);
      const stepNames = naming === 'numeric'
        ? Array.from({ length: stepCount }, (_, i) => String(i + 1))
        : TAILWIND_STEPS;
      const lightnessArr = TAILWIND_LIGHTNESS;
      const steps = stepNames.map((stepName, i) => {
        const l = lightnessArr[i] ?? 0.5;
        const c = chromaValues[i] ?? oklch.c;
        const t = stepCount <= 1 ? 0 : i / (stepCount - 1);
        const autoShift = computeHueShift(oklch.h, t, 0, 0);
        const h = (((oklch.h + autoShift) % 360) + 360) % 360;
        return { name: stepName, hex: oklchToHex({ l, c, h }), oklch: { l, c, h } };
      });
      scales.push({
        name,
        sourceHex: hex,
        sourceOklch: oklch,
        steps,
      });
    }
  }

  const intents = isObj(parsed.intents) ? (parsed.intents as IntentOverrides) : {};

  const doc: PigmintYamlDoc = {
    engine,
    ramps: scales.map((s) => ({ name: s.name, source: s.sourceHex })),
    output: isObj(parsed.output)
      ? { ...DEFAULT_OUTPUT, ...(parsed.output as Partial<PigmintYamlDoc['output']>) }
      : DEFAULT_OUTPUT,
  };
  if (Object.keys(intents).length > 0) doc.intents = intents;

  return { scales, intents, engine, doc };
}

/**
 * Parse a pigmint primitives.json (DTCG container with a `primitive` section)
 * into a map of `rampName → ImportedScale`. Used to satisfy `fromFile` entries
 * in `parsePigmintYaml`.
 *
 * Each ramp's `sourceHex` is taken from the middle step (or the first step if
 * the ramp is short). No curve data is reconstructed — `fromFile` ramps are
 * fixed step sets, not curve-derived ramps.
 */
export function parsePigmintPrimitives(text: string): Record<string, ImportedScale> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`primitives.json is not valid JSON: ${(err as Error).message}`);
  }
  if (!isObj(parsed)) {
    throw new Error('primitives.json must be a mapping at the top level');
  }
  const primitives = parsed.primitive;
  if (!isObj(primitives)) {
    throw new Error('primitives.json must have a `primitive` object at the top level');
  }

  const out: Record<string, ImportedScale> = {};
  const skipped: string[] = [];
  for (const [rampName, rampData] of Object.entries(primitives)) {
    if (!isObj(rampData)) continue;
    const steps: ImportedScale['steps'] = [];
    for (const [stepName, stepEntry] of Object.entries(rampData)) {
      if (stepName === '$type') continue;
      if (!isObj(stepEntry)) continue;
      const value = (stepEntry as { $value?: unknown }).$value;
      if (!isObj(value)) continue;
      const hex = typeof value.hex === 'string' ? value.hex : null;
      if (!hex) continue;
      // Use tryParseHex so a single malformed step skips itself instead of
      // throwing out of the whole upload (importTokens.ts uses the same
      // forgiving pattern via hexToOklchSafe).
      const oklch = tryParseHex(hex);
      if (!oklch) {
        skipped.push(`${rampName}.${stepName} ("${hex}")`);
        continue;
      }
      steps.push({ name: stepName, hex, oklch });
    }
    if (steps.length === 0) continue;
    const midStep = steps[Math.floor(steps.length / 2)] ?? steps[0]!;
    out[rampName] = {
      name: rampName,
      steps,
      sourceHex: midStep.hex,
      sourceOklch: midStep.oklch,
    };
  }
  if (Object.keys(out).length === 0 && skipped.length > 0) {
    throw new Error(
      `primitives.json: every step had an unparseable hex (e.g. ${skipped.slice(0, 3).join(', ')})`,
    );
  }
  return out;
}
