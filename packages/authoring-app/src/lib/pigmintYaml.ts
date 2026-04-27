import { parse as yamlParse, stringify as yamlStringify } from 'yaml';
import { parse as cssParse, formatHex } from 'culori';
import {
  hexToOklch,
  oklchToHex,
  buildChromaCurve,
  computeHueShift,
  TAILWIND_LIGHTNESS,
  TAILWIND_STEPS,
  type ComplianceTarget,
  type CvdProfile,
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
}

export interface PigmintYamlDoc {
  engine: PigmintEngine;
  ramps: Array<{ name: string; source: string }>;
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
};

const DEFAULT_OUTPUT: PigmintYamlDoc['output'] = {
  dtcg: './tokens.json',
};

export interface SerializeInput {
  scales: ColorScale[];
  intents: IntentOverrides;
  engine?: Partial<PigmintEngine>;
}

export function serializePigmintYaml(input: SerializeInput): string {
  const engineInput = input.engine ?? {};
  const engine: PigmintEngine = {
    compliance: engineInput.compliance === 'apca' ? 'apca' : 'wcag21',
    target: engineInput.target === 'AAA' ? 'AAA' : 'AA',
    modes: sanitizeModes(engineInput.modes),
    cvd: sanitizeCvd(engineInput.cvd),
    resolver: sanitizeResolver(engineInput.resolver),
  };
  const doc: PigmintYamlDoc = {
    engine,
    ramps: input.scales.map((s) => ({ name: s.name, source: s.sourceHex })),
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
  return { compliance, target, modes, cvd, resolver };
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

export function parsePigmintYaml(text: string): ParsedPigmintYaml {
  const parsed = yamlParse(text);
  if (!isObj(parsed)) {
    throw new Error('pigmint.yaml must be a mapping at the top level');
  }

  const ramps = parsed.ramps;
  if (!Array.isArray(ramps)) {
    throw new Error('pigmint.yaml is missing a `ramps` list');
  }

  const scales: ImportedScale[] = [];
  for (const entry of ramps) {
    if (!isObj(entry)) continue;
    const name = typeof entry.name === 'string' ? entry.name : null;
    const source = typeof entry.source === 'string' ? entry.source : null;
    if (!name || !source) {
      throw new Error(`Ramp entry must have \`name\` and \`source\`: got ${JSON.stringify(entry)}`);
    }
    const parsedColor = cssParse(source);
    const hex = parsedColor ? formatHex(parsedColor) : null;
    if (!hex) {
      throw new Error(`Ramp \`${name}\` has invalid source color: ${source}`);
    }
    const oklch = hexToOklch(hex);
    const stepCount = TAILWIND_STEPS.length;
    const chromaValues = buildChromaCurve(oklch.c, stepCount);
    const steps = TAILWIND_STEPS.map((stepName, i) => {
      const l = TAILWIND_LIGHTNESS[i] ?? 0.5;
      const c = chromaValues[i] ?? oklch.c;
      const t = i / (stepCount - 1);
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

  const intents = isObj(parsed.intents) ? (parsed.intents as IntentOverrides) : {};
  const engine = parseEngine(parsed.engine);

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
