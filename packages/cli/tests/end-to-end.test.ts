import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, it, expect, afterAll } from 'vitest';
import {
  emitDtcg,
  hexToOklch,
  resolveToken,
} from '@pigmint/core';
import type { FormalIntent } from '@pigmint/core';
import { build } from '../src/commands/build.js';
import { generateAllRamps } from '../src/ramps.js';
import { loadProjectConfig } from '../src/config.js';

const repoRoot = resolve(__dirname, '..', '..', '..');
const fixtureDir = resolve(repoRoot, 'examples', 'basic');
const fixtureConfig = resolve(fixtureDir, 'pigmint.yaml');

describe('end-to-end: primitives-only build via CLI', () => {
  const cleanups: string[] = [];
  afterAll(async () => {
    for (const p of cleanups) await rm(p, { recursive: true, force: true });
  });

  it('emits a DTCG file that validates against dtcg-container.schema.json', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'pigmint-e2e-'));
    cleanups.push(workDir);

    const config = await loadProjectConfig(fixtureConfig);
    const tmpConfig = join(workDir, 'pigmint.yaml');
    await writeFixtureConfig(tmpConfig, config);

    const result = await build({ configPath: tmpConfig });
    expect(result.rampCount).toBe(2);
    expect(result.modeCount).toBe(1);

    const raw = await readFile(result.primitivesPath!, 'utf8');
    const doc = JSON.parse(raw) as Record<string, unknown>;

    const primitives = doc.primitive as Record<string, Record<string, unknown>>;
    expect(Object.keys(primitives).sort()).toEqual(['blue', 'neutral']);
    const blue = primitives.blue as Record<string, unknown>;
    expect(blue.$type).toBe('color');
    expect((blue['500'] as { $value: unknown }).$value).toBeDefined();
  });
});

describe('end-to-end: full pipe with one resolved semantic token', () => {
  it('resolves color.action.primary.foreground on white and emits valid DTCG', async () => {
    const config = await loadProjectConfig(fixtureConfig);
    const ramps = await generateAllRamps(config);
    const blue = ramps.find((r) => r.scaleName === 'blue');
    expect(blue).toBeDefined();

    const intent: FormalIntent = {
      threshold: { kind: 'wcag', level: 'AA', usage: 'text' },
      preference: 'lowest-passing',
      consistency: 'independent',
      surfaceContext: 'primary',
    };
    const { token } = resolveToken({
      tokenPath: 'color.action.primary.foreground',
      mode: 'light',
      intent,
      ramp: blue!,
      surfaceHex: '#ffffff',
      surfaceRef: '{color.surface.main.bg}',
    });
    expect(token.compliance?.level).toBe('AA-text');

    const container = emitDtcg({
      defaultMode: 'light',
      ramps,
      resolvedTokens: [token],
    });

    // token path 'color.action.primary.foreground' → strips 'color.' → stored at action.primary.foreground
    const action = container.action as Record<string, unknown>;
    const primary = action.primary as Record<string, unknown>;
    const fg = primary.foreground as Record<string, unknown>;
    expect(fg.$type).toBe('color');
    expect(typeof fg.$value).toBe('string');
    expect((fg.$value as string).startsWith('{primitive.blue.')).toBe(true);
    const ext = fg.$extensions as Record<string, unknown>;
    const pig = ext['com.pigmint'] as Record<string, unknown>;
    expect(pig.usage).toBe('text');
    const modes = pig.modes as Record<string, unknown>;
    expect(modes.light).toBeDefined();
  });
});

async function writeFixtureConfig(
  path: string,
  config: Awaited<ReturnType<typeof loadProjectConfig>>,
): Promise<void> {
  const { writeFile, copyFile } = await import('node:fs/promises');
  const { dirname: dir, join: j } = await import('node:path');
  const { stringify } = await import('yaml');
  await writeFile(path, stringify(config), 'utf8');
  // Copy vocabulary file alongside config if present
  if (config.defaults?.vocabulary) {
    const srcVocab = j(fixtureDir, config.defaults.vocabulary);
    const dstVocab = j(dir(path), config.defaults.vocabulary);
    try { await copyFile(srcVocab, dstVocab); } catch { /* ignore if missing */ }
  }
}

describe('end-to-end: light+dark DTCG → Tailwind CSS', () => {
  const cleanups: string[] = [];
  afterAll(async () => {
    for (const p of cleanups) await rm(p, { recursive: true, force: true });
  });

  it('emits a CSS file with :root and .dark selectors via the tailwind adapter', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'pigmint-e2e-tw-'));
    cleanups.push(workDir);

    const baseConfig = await loadProjectConfig(fixtureConfig);
    const multiModeConfig = {
      ...baseConfig,
      engine: { ...baseConfig.engine, modes: ['light', 'dark'] },
      adapters: [
        {
          name: 'tailwind',
          output: './css/tokens.css',
          preset: 'shadcn',
          formats: ['oklch'],
        },
      ],
      output: { dtcg: './tokens.json' },
    };
    const tmpConfig = join(workDir, 'pigmint.yaml');
    await writeFixtureConfig(tmpConfig, multiModeConfig);

    const result = await build({ configPath: tmpConfig });
    expect(result.modeCount).toBe(2);
    expect(result.tokenCount).toBeGreaterThan(0);
    expect(result.adapters).toHaveLength(1);
    const [tailwind] = result.adapters;
    expect(tailwind!.name).toBe('tailwind');
    expect(tailwind!.files).toHaveLength(1);

    const css = await readFile(tailwind!.files[0]!, 'utf8');
    expect(css).toMatch(/:root \{/);
    expect(css).toMatch(/\.dark \{/);
    expect(css).toMatch(/--background:/);
    expect(css).toMatch(/--foreground:/);
    expect(css).toMatch(/--primary:/);
    expect(css).toMatch(/oklch\(/);
  });
});

describe('end-to-end: light+dark DTCG → MUI theme + runtime validator', () => {
  const cleanups: string[] = [];
  afterAll(async () => {
    for (const p of cleanups) await rm(p, { recursive: true, force: true });
  });

  it('emits theme.ts + receipts.json and the validator catches overrides', async () => {
    const { validatePigmintTheme } = await import('@pigmint/adapter-mui/runtime');
    const workDir = await mkdtemp(join(tmpdir(), 'pigmint-e2e-mui-'));
    cleanups.push(workDir);

    const baseConfig = await loadProjectConfig(fixtureConfig);
    const muiConfig = {
      ...baseConfig,
      engine: { ...baseConfig.engine, modes: ['light', 'dark'] },
      adapters: [
        { name: 'mui', output: './mui', formats: ['hex'] },
      ],
      output: { dtcg: './tokens.json' },
    };
    const tmpConfig = join(workDir, 'pigmint.yaml');
    await writeFixtureConfig(tmpConfig, muiConfig);

    const result = await build({ configPath: tmpConfig });
    expect(result.adapters).toHaveLength(1);
    const mui = result.adapters[0]!;
    expect(mui.name).toBe('mui');
    expect(mui.files.map((f) => f.split('/').pop()).sort()).toEqual([
      'receipts.json',
      'theme.ts',
    ]);

    const themePath = mui.files.find((f) => f.endsWith('theme.ts'))!;
    const receiptsPath = mui.files.find((f) => f.endsWith('receipts.json'))!;
    const themeSource = await readFile(themePath, 'utf8');
    expect(themeSource).toMatch(/colorSchemes/);
    expect(themeSource).toMatch(/extendTheme/);

    const receipts = JSON.parse(await readFile(receiptsPath, 'utf8')) as {
      artifactVersion: 'mui-receipts@0.1';
      defaultMode: string;
      tokens: Array<{ tokenPath: string; palettePaths: string[]; modes: Record<string, string> }>;
    };
    expect(receipts.artifactVersion).toBe('mui-receipts@0.1');
    expect(receipts.tokens.length).toBeGreaterThan(0);

    const asTheme = {
      colorSchemes: Object.fromEntries(
        ['light', 'dark'].map((mode) => [
          mode,
          {
            palette: receipts.tokens.reduce(
              (acc, t) => {
                const val = t.modes[mode];
                if (!val) return acc;
                for (const path of t.palettePaths) {
                  const parts = path.split('.');
                  let cursor: Record<string, unknown> = acc;
                  for (let i = 0; i < parts.length - 1; i++) {
                    const key = parts[i]!;
                    if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
                    cursor = cursor[key] as Record<string, unknown>;
                  }
                  cursor[parts[parts.length - 1]!] = val;
                }
                return acc;
              },
              {} as Record<string, unknown>,
            ),
          },
        ]),
      ),
    };

    const clean = validatePigmintTheme(asTheme, receipts);
    expect(clean.ok).toBe(true);
    expect(clean.drifts).toHaveLength(0);

    const overriddenPalette = asTheme.colorSchemes.light!.palette as Record<
      string,
      Record<string, string>
    >;
    if (overriddenPalette.primary) overriddenPalette.primary.main = '#ff0000';
    const drifted = validatePigmintTheme(asTheme, receipts);
    expect(drifted.ok).toBe(false);
    expect(drifted.drifts.some((d) => d.kind === 'override' && d.palettePath === 'primary.main')).toBe(true);
  });
});

describe('end-to-end: intent overrides in pigmint.yaml change resolution', () => {
  const cleanups: string[] = [];
  afterAll(async () => {
    for (const p of cleanups) await rm(p, { recursive: true, force: true });
  });

  it('switching color.action.primary.background preference picks a different step', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'pigmint-e2e-intents-'));
    cleanups.push(workDir);

    const base = await loadProjectConfig(fixtureConfig);
    const baseConfig = { ...base, output: { dtcg: './base.json' } };
    const overrideConfig = {
      ...base,
      output: { dtcg: './override.json' },
      intents: {
        // Override flips both fields so the token leaves its matched-across-ramps cohort.
        // Path matches the portable vocabulary token name (no color. prefix).
        'action.primary.background': {
          preference: 'highest-contrast' as const,
          consistency: 'independent' as const,
        },
      },
    };

    const baseYaml = join(workDir, 'base.yaml');
    const overrideYaml = join(workDir, 'override.yaml');
    await writeFixtureConfig(baseYaml, baseConfig);
    await writeFixtureConfig(overrideYaml, overrideConfig);

    const baseResult = await build({ configPath: baseYaml });
    const overrideResult = await build({ configPath: overrideYaml });

    const baseDoc = JSON.parse(await readFile(baseResult.outputPath!, 'utf8'));
    const overrideDoc = JSON.parse(await readFile(overrideResult.outputPath!, 'utf8'));

    // Tokens are at root (no color. wrapper); V1-style paths strip 'color.' prefix
    const baseAction = baseDoc.action as Record<string, Record<string, Record<string, unknown>>>;
    const overrideAction = overrideDoc.action as Record<string, Record<string, Record<string, unknown>>>;
    const basePrimary = baseAction.primary!.background!;
    const overridePrimary = overrideAction.primary!.background!;
    expect(basePrimary.$value).not.toBe(overridePrimary.$value);

    const basePig = (basePrimary.$extensions as Record<string, unknown>)['com.pigmint'] as Record<string, unknown>;
    const overridePig = (overridePrimary.$extensions as Record<string, unknown>)['com.pigmint'] as Record<string, unknown>;
    expect((basePig.intent as Record<string, string>).preference).toBe('lowest-passing');
    expect((overridePig.intent as Record<string, string>).preference).toBe('highest-contrast');
    expect((overridePig.intent as Record<string, string>).consistency).toBe('independent');

    const baseFg = (baseDoc.foreground as Record<string, unknown>).main;
    const overrideFg = (overrideDoc.foreground as Record<string, unknown>).main;
    expect((baseFg as Record<string, unknown>).$value).toBe((overrideFg as Record<string, unknown>).$value);
  });
});

