import { parse as yamlParse, stringify as yamlStringify } from 'yaml';
import { parse as cssParse, formatHex } from 'culori';
import { hexToOklch, type ComplianceTarget } from '@pigmint/core';
import type { ColorScale } from '../types/palette';
import type { ImportedScale, ImportedStep } from './importTokens';
import {
  ENGINE_MODE_OPTIONS,
  type EngineCompliance,
  type EngineMode,
  type IntentOverrides,
} from '../store/intentStore';

export interface PigmintEngine {
  compliance: EngineCompliance;
  target: ComplianceTarget;
  modes: EngineMode[];
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
  modes: ['light'],
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
  const engine: PigmintEngine = { ...DEFAULT_ENGINE, ...(input.engine ?? {}) };
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
  const known = new Set<EngineMode>(ENGINE_MODE_OPTIONS);
  const filtered = Array.isArray(raw.modes)
    ? raw.modes.filter((m): m is EngineMode =>
        typeof m === 'string' && known.has(m as EngineMode),
      )
    : [];
  const modes = filtered.length ? filtered : DEFAULT_ENGINE.modes;
  return { compliance, target, modes };
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
    const step: ImportedStep = { name: '500', hex, oklch };
    scales.push({
      name,
      sourceHex: hex,
      sourceOklch: oklch,
      steps: [step],
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
