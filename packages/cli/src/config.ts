import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { ProjectConfig } from '@pigmint/core';

const VALID_CVD_PROFILES = new Set([
  'deuteranopia',
  'protanopia',
  'tritanopia',
  'achromatopsia',
]);

export class ConfigError extends Error {
  constructor(
    message: string,
    readonly path: string,
  ) {
    super(message);
    this.name = 'ConfigError';
  }
}

export async function loadProjectConfig(configPath: string): Promise<ProjectConfig> {
  const abs = resolve(configPath);
  let text: string;
  try {
    text = await readFile(abs, 'utf8');
  } catch (err) {
    throw new ConfigError(
      `could not read config: ${(err as Error).message}`,
      abs,
    );
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(text);
  } catch (err) {
    throw new ConfigError(`YAML parse failed: ${(err as Error).message}`, abs);
  }

  return validateProjectConfig(parsed, abs);
}

export function validateProjectConfig(raw: unknown, path: string): ProjectConfig {
  if (!isPlainObject(raw)) {
    throw new ConfigError('config must be a mapping', path);
  }
  requireKey(raw, 'engine', path);
  requireKey(raw, 'ramps', path);
  requireKey(raw, 'output', path);

  const engine = raw.engine;
  if (!isPlainObject(engine)) throw new ConfigError('engine must be a mapping', path);
  requireKey(engine, 'compliance', path);
  requireKey(engine, 'target', path);
  requireKey(engine, 'modes', path);
  if (engine.compliance !== 'wcag21' && engine.compliance !== 'apca') {
    throw new ConfigError(
      `engine.compliance must be "wcag21" or "apca" (got ${JSON.stringify(engine.compliance)})`,
      path,
    );
  }
  if (!Array.isArray(engine.modes) || engine.modes.length === 0) {
    throw new ConfigError('engine.modes must be a non-empty array', path);
  }
  if ('cvd' in engine && engine.cvd !== undefined) {
    if (!Array.isArray(engine.cvd)) {
      throw new ConfigError('engine.cvd must be an array when provided', path);
    }
    for (const profile of engine.cvd) {
      if (typeof profile !== 'string' || !VALID_CVD_PROFILES.has(profile)) {
        throw new ConfigError(
          `engine.cvd contains unsupported profile ${JSON.stringify(profile)}`,
          path,
        );
      }
    }
  }
  if ('resolver' in engine && engine.resolver !== undefined) {
    if (!isPlainObject(engine.resolver)) {
      throw new ConfigError('engine.resolver must be a mapping', path);
    }
    const mode = engine.resolver.mode;
    if (mode !== 'stepped' && mode !== 'continuous') {
      throw new ConfigError(
        `engine.resolver.mode must be "stepped" or "continuous" (got ${JSON.stringify(mode)})`,
        path,
      );
    }
    if (
      'fallbackSteps' in engine.resolver &&
      engine.resolver.fallbackSteps !== undefined &&
      (typeof engine.resolver.fallbackSteps !== 'number' ||
        engine.resolver.fallbackSteps < 2)
    ) {
      throw new ConfigError(
        'engine.resolver.fallbackSteps must be a number >= 2',
        path,
      );
    }
    if (
      'materializeInterpolatedPrimitives' in engine.resolver &&
      engine.resolver.materializeInterpolatedPrimitives !== undefined &&
      typeof engine.resolver.materializeInterpolatedPrimitives !== 'boolean'
    ) {
      throw new ConfigError(
        'engine.resolver.materializeInterpolatedPrimitives must be a boolean when set',
        path,
      );
    }
  }

  const ramps = raw.ramps;
  if (!Array.isArray(ramps) || ramps.length === 0) {
    throw new ConfigError('ramps must be a non-empty array', path);
  }
  for (const r of ramps) {
    if (!isPlainObject(r)) throw new ConfigError('ramp entry must be a mapping', path);
    requireKey(r, 'name', path);
    requireKey(r, 'source', path);
  }

  const output = raw.output;
  if (!isPlainObject(output)) throw new ConfigError('output must be a mapping', path);
  requireKey(output, 'dtcg', path);

  if ('intents' in raw && raw.intents !== undefined) {
    if (!isPlainObject(raw.intents)) {
      throw new ConfigError('intents must be a mapping', path);
    }
    for (const [tokenPath, override] of Object.entries(raw.intents)) {
      if (!isPlainObject(override)) {
        throw new ConfigError(
          `intents["${tokenPath}"] must be a mapping of intent fields`,
          path,
        );
      }
    }
  }

  return raw as unknown as ProjectConfig;
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function requireKey(
  obj: Record<string, unknown>,
  key: string,
  path: string,
): void {
  if (!(key in obj)) {
    throw new ConfigError(`missing required key: ${key}`, path);
  }
}
