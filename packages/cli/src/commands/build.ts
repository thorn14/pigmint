import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  emitDtcg,
  emitPrimitives,
  resolveAll,
  type ModeBinding,
  type VocabularyEntry,
  buildPortableArtifacts,
  validatePortableVocabulary,
  PortableVocabularyError,
  type PortableVocabularyArtifacts,
} from '@pigmint/core';
import type { AuditReport, Suggestion } from '@pigmint/audit';
import { loadProjectConfig } from '../config.js';
import { generateAllRamps, generateAllScales } from '../ramps.js';
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
  primitivesPath?: string;
  outputPath?: string;
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
    ...(mode.endsWith('-high-contrast') ? { thresholdElevation: 'hc' as const } : {}),
  }));
}

export async function build(options: BuildOptions): Promise<BuildResult> {
  const cwd = options.cwd ?? process.cwd();
  const configPath = resolve(cwd, options.configPath);
  const config = await loadProjectConfig(configPath);

  const ramps = await generateAllRamps(config);
  const scales = await generateAllScales(config);
  const defaultMode = config.engine.modes[0] ?? 'light';
  const modes = buildModeBindings(config.engine.modes);
  const rampNames = ramps.map((r) => r.scaleName);
  if (rampNames.length === 0) {
    throw new Error('project config must declare at least one ramp');
  }

  const hasDtcg = Boolean(config.output.dtcg);
  const hasPrimitives = Boolean(config.output.primitives);

  let vocabulary: VocabularyEntry[] | null = null;
  let portableArtifacts: PortableVocabularyArtifacts | undefined;

  if (config.defaults?.vocabulary) {
    const vocabPath = resolve(dirname(configPath), config.defaults.vocabulary);
    let text: string;
    try {
      text = await readFile(vocabPath, 'utf8');
    } catch (err) {
      throw new Error(`could not read vocabulary file "${vocabPath}": ${(err as Error).message}`);
    }
    let parsed: unknown;
    try {
      parsed = parseYaml(text);
    } catch (err) {
      throw new PortableVocabularyError(
        `YAML parse failed: ${(err as Error).message}`,
        vocabPath,
      );
    }
    const vocab = validatePortableVocabulary(parsed, vocabPath);
    portableArtifacts = buildPortableArtifacts(vocab, config.engine);
    vocabulary = portableArtifacts.vocabulary;
  } else if (hasDtcg) {
    throw new Error(
      'defaults.vocabulary is required when output.dtcg is set.\n' +
      'Add the following to your pigmint.yaml:\n\n' +
      '  defaults:\n    vocabulary: ./tokens.yaml\n\n' +
      'Or remove output.dtcg to emit primitives only.',
    );
  }

  // Emit primitives file if configured
  let primitivesPath: string | undefined;
  if (hasPrimitives) {
    const primitivesContainer = emitPrimitives({
      defaultMode,
      ramps,
      ...(config.engine.cvd && config.engine.cvd.length > 0 ? { cvd: config.engine.cvd } : {}),
    });
    primitivesPath = resolve(dirname(configPath), config.output.primitives!);
    await mkdir(dirname(primitivesPath), { recursive: true });
    await writeFile(primitivesPath, JSON.stringify(primitivesContainer, null, 2) + '\n', 'utf8');
  }

  // Skip token resolution if no vocabulary
  if (!hasDtcg || !vocabulary) {
    return {
      ...(primitivesPath ? { primitivesPath } : {}),
      rampCount: ramps.length,
      modeCount: config.engine.modes.length,
      tokenCount: 0,
      adapters: [],
    };
  }

  const tokenRamp = portableArtifacts!.tokenRamp;
  const { tokens, ramps: dtcgRamps } = resolveAll({
    config,
    vocabulary,
    ramps,
    modes,
    tokenRamp,
    scales,
    ...(portableArtifacts
      ? { surfacePaths: portableArtifacts.surfacePaths, surfaceSteps: portableArtifacts.surfaceSteps }
      : {}),
  });

  const container = emitDtcg({
    engineVersion: '0.0.0',
    defaultMode,
    ramps: dtcgRamps,
    resolvedTokens: tokens,
    vocabulary,
    includePrimitives: !hasPrimitives,
    ...(config.engine.cvd && config.engine.cvd.length > 0 ? { cvd: config.engine.cvd } : {}),
  });

  const outputPath = resolve(dirname(configPath), config.output.dtcg!);
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
    ...(primitivesPath ? { primitivesPath } : {}),
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
