import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  emitDtcg,
  resolveAll,
  VOCABULARY_V1_SLICE,
  type ModeBinding,
  type VocabularyEntry,
} from '@pigmint/core';
import type { AuditReport, Suggestion } from '@pigmint/audit';
import { loadProjectConfig } from '../config.js';
import { generateAllRamps } from '../ramps.js';
import { resolveAdapter } from '../adapters.js';

export interface BuildOptions {
  configPath: string;
  cwd?: string;
}

export interface AdapterEmission {
  name: string;
  files: string[];
  warnings: string[];
}

export interface BuildResult {
  outputPath: string;
  rampCount: number;
  modeCount: number;
  tokenCount: number;
  adapters: AdapterEmission[];
  priorAudit?: PriorAuditFeedback;
}

export interface PriorAuditFeedback {
  reportPath: string;
  runId: string;
  suggestions: Suggestion[];
}

const MODE_SCHEMES: Record<string, 'light' | 'dark'> = {
  light: 'light',
  dark: 'dark',
  'light-high-contrast': 'light',
  'dark-high-contrast': 'dark',
};

const MODE_BASELINES: Record<string, string> = {
  light: '#ffffff',
  dark: '#0a0a0a',
  'light-high-contrast': '#ffffff',
  'dark-high-contrast': '#000000',
};

function buildModeBindings(modes: string[]): ModeBinding[] {
  return modes.map((mode) => ({
    mode,
    scheme: MODE_SCHEMES[mode] ?? 'light',
    baselineHex: MODE_BASELINES[mode] ?? '#ffffff',
  }));
}

function buildTokenRamp(
  vocabulary: VocabularyEntry[],
  rampNames: string[],
): Record<string, string> {
  const neutral = rampNames.find((n) => n === 'neutral') ?? rampNames[0];
  const accent = rampNames.find((n) => n !== 'neutral') ?? neutral;
  if (!neutral || !accent) {
    throw new Error('project config must declare at least one ramp');
  }

  const map: Record<string, string> = {};
  for (const entry of vocabulary) {
    if (entry.usage === 'decorative') continue;
    const isSurface = entry.path.startsWith('color.surface.');
    const isForeground = entry.path.startsWith('color.foreground.');
    map[entry.path] = isSurface || isForeground ? neutral : accent;
  }
  return map;
}

export async function build(options: BuildOptions): Promise<BuildResult> {
  const cwd = options.cwd ?? process.cwd();
  const configPath = resolve(cwd, options.configPath);
  const config = await loadProjectConfig(configPath);

  const ramps = generateAllRamps(config);
  const defaultMode = config.engine.modes[0] ?? 'light';
  const modes = buildModeBindings(config.engine.modes);
  const vocabulary = VOCABULARY_V1_SLICE;
  const tokenRamp = buildTokenRamp(vocabulary, ramps.map((r) => r.scaleName));

  const { tokens } = resolveAll({
    config,
    vocabulary,
    ramps,
    modes,
    tokenRamp,
  });

  const container = emitDtcg({
    engineVersion: '0.0.0',
    defaultMode,
    ramps,
    resolvedTokens: tokens,
    vocabulary,
  });

  const outputPath = resolve(dirname(configPath), config.output.dtcg);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(container, null, 2) + '\n', 'utf8');

  const adapterEmissions: AdapterEmission[] = [];
  for (const adapterConfig of config.adapters ?? []) {
    const adapter = resolveAdapter(adapterConfig.name);
    const result = await adapter.emit({
      container,
      adapterConfig,
      projectConfig: config,
    });
    const writtenPaths: string[] = [];
    for (const file of result.files) {
      const absPath = resolve(dirname(configPath), file.path);
      await mkdir(dirname(absPath), { recursive: true });
      await writeFile(absPath, file.content, 'utf8');
      writtenPaths.push(absPath);
    }
    adapterEmissions.push({
      name: adapterConfig.name,
      files: writtenPaths,
      warnings: result.warnings ?? [],
    });
  }

  const priorAudit = await loadPriorAudit(configPath, config.audit?.report);

  return {
    outputPath,
    rampCount: ramps.length,
    modeCount: config.engine.modes.length,
    tokenCount: tokens.length,
    adapters: adapterEmissions,
    ...(priorAudit ? { priorAudit } : {}),
  };
}

async function loadPriorAudit(
  configPath: string,
  reportPath: string | undefined,
): Promise<PriorAuditFeedback | null> {
  if (!reportPath) return null;
  const absPath = resolve(dirname(configPath), reportPath);
  let raw: string;
  try {
    raw = await readFile(absPath, 'utf8');
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as AuditReport;
    if (parsed.artifactVersion !== 'audit-report@0.1') return null;
    return {
      reportPath: absPath,
      runId: parsed.run.id,
      suggestions: parsed.suggestions ?? [],
    };
  } catch {
    return null;
  }
}
