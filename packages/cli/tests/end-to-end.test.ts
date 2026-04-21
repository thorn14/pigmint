import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, it, expect, afterAll } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  emitDtcg,
  hexToOklch,
  resolveToken,
} from '@pigmint/core';
import type { FormalIntent } from '@pigmint/core';
import { audit } from '../src/commands/audit.js';
import { build } from '../src/commands/build.js';
import { generateAllRamps } from '../src/ramps.js';
import { loadProjectConfig } from '../src/config.js';

const repoRoot = resolve(__dirname, '..', '..', '..');
const fixtureDir = resolve(repoRoot, 'examples', 'basic');
const fixtureConfig = resolve(fixtureDir, 'pigmint.yaml');

const schemaDir = resolve(repoRoot, 'spec', 'schema');

async function loadSchema(name: string): Promise<Record<string, unknown>> {
  const raw = await readFile(resolve(schemaDir, name), 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

async function buildAjv(): Promise<Ajv2020> {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats.default(ajv);
  for (const name of [
    'dtcg-container.schema.json',
    'mode-entry.schema.json',
    'receipt.schema.json',
    'intent.schema.json',
    'vocabulary-token.schema.json',
    'project-config.schema.json',
    'audit-report.schema.json',
  ]) {
    ajv.addSchema(await loadSchema(name));
  }
  return ajv;
}

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

    const raw = await readFile(result.outputPath, 'utf8');
    const doc = JSON.parse(raw) as Record<string, unknown>;

    const ajv = await buildAjv();
    const validate = ajv.getSchema('https://pigmint.dev/schema/dtcg-container-0.1.json')!;
    const ok = validate(doc);
    if (!ok) {
      throw new Error(`schema errors: ${JSON.stringify(validate.errors, null, 2)}`);
    }
    expect(ok).toBe(true);

    const color = doc.color as Record<string, unknown>;
    const primitives = color.primitive as Record<string, Record<string, unknown>>;
    expect(Object.keys(primitives).sort()).toEqual(['blue', 'neutral']);
    const blue = primitives.blue as Record<string, unknown>;
    expect(blue.$type).toBe('color');
    expect((blue['500'] as { $value: unknown }).$value).toBeDefined();
  });
});

describe('end-to-end: full pipe with one resolved semantic token', () => {
  it('resolves color.action.primary.foreground on white and emits valid DTCG', async () => {
    const config = await loadProjectConfig(fixtureConfig);
    const ramps = generateAllRamps(config);
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

    const ajv = await buildAjv();
    const validate = ajv.getSchema('https://pigmint.dev/schema/dtcg-container-0.1.json')!;
    const ok = validate(container);
    if (!ok) {
      throw new Error(`schema errors: ${JSON.stringify(validate.errors, null, 2)}`);
    }
    expect(ok).toBe(true);

    const color = container.color as Record<string, unknown>;
    const action = color.action as Record<string, unknown>;
    const primary = action.primary as Record<string, unknown>;
    const fg = primary.foreground as Record<string, unknown>;
    expect(fg.$type).toBe('color');
    expect(typeof fg.$value).toBe('string');
    expect((fg.$value as string).startsWith('{color.primitive.blue.')).toBe(true);
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
  const { writeFile } = await import('node:fs/promises');
  const { stringify } = await import('yaml');
  await writeFile(path, stringify(config), 'utf8');
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

describe('end-to-end: audit against emitted DTCG', () => {
  const cleanups: string[] = [];
  afterAll(async () => {
    for (const p of cleanups) await rm(p, { recursive: true, force: true });
  });

  it('emits a schema-valid report for a clean light+dark build', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'pigmint-e2e-audit-'));
    cleanups.push(workDir);

    const baseConfig = await loadProjectConfig(fixtureConfig);
    const config = {
      ...baseConfig,
      engine: { ...baseConfig.engine, modes: ['light', 'dark'] },
      output: { dtcg: './tokens.json' },
      audit: { report: './audit.json', profile: 'wcag-srgb' as const },
    };
    const tmpConfig = join(workDir, 'pigmint.yaml');
    await writeFixtureConfig(tmpConfig, config);

    await build({ configPath: tmpConfig });
    const result = await audit({ configPath: tmpConfig });

    const ajv = await buildAjv();
    const validate = ajv.getSchema(
      'https://pigmint.dev/schema/audit-report-0.1.json',
    );
    expect(validate).toBeDefined();
    if (!validate) throw new Error('audit-report schema not registered');
    const ok = validate(result.report);
    if (!ok) {
      throw new Error(`schema errors: ${JSON.stringify(validate.errors, null, 2)}`);
    }
    expect(ok).toBe(true);

    expect(result.report.summary.violations.error).toBe(0);
    expect(result.report.run.profile).toBe('wcag-srgb');
    expect(result.report.summary.tokensAudited).toBeGreaterThan(0);
  });

  it('surfaces missing-mode violations when a token lacks a mode', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'pigmint-e2e-audit-miss-'));
    cleanups.push(workDir);

    const baseConfig = await loadProjectConfig(fixtureConfig);
    const lightOnly = {
      ...baseConfig,
      engine: { ...baseConfig.engine, modes: ['light'] },
      output: { dtcg: './tokens.json' },
    };
    const buildConfig = join(workDir, 'build.yaml');
    await writeFixtureConfig(buildConfig, lightOnly);
    await build({ configPath: buildConfig });

    const lightPlusDark = {
      ...lightOnly,
      engine: { ...lightOnly.engine, modes: ['light', 'dark'] },
    };
    const auditConfig = join(workDir, 'audit.yaml');
    await writeFixtureConfig(auditConfig, lightPlusDark);

    const result = await audit({ configPath: auditConfig });
    const missing = result.report.violations.filter((v) => v.type === 'missing-mode');
    expect(missing.length).toBeGreaterThan(0);
    expect(missing.every((v) => v.mode === 'dark')).toBe(true);
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
        'color.action.primary.background': { preference: 'highest-contrast' as const },
      },
    };

    const baseYaml = join(workDir, 'base.yaml');
    const overrideYaml = join(workDir, 'override.yaml');
    await writeFixtureConfig(baseYaml, baseConfig);
    await writeFixtureConfig(overrideYaml, overrideConfig);

    const baseResult = await build({ configPath: baseYaml });
    const overrideResult = await build({ configPath: overrideYaml });

    const baseDoc = JSON.parse(await readFile(baseResult.outputPath, 'utf8'));
    const overrideDoc = JSON.parse(await readFile(overrideResult.outputPath, 'utf8'));

    const basePrimary = baseDoc.color.action.primary.background;
    const overridePrimary = overrideDoc.color.action.primary.background;
    expect(basePrimary.$value).not.toBe(overridePrimary.$value);

    const basePig = basePrimary.$extensions['com.pigmint'];
    const overridePig = overridePrimary.$extensions['com.pigmint'];
    expect(basePig.intent.preference).toBe('lowest-passing');
    expect(overridePig.intent.preference).toBe('highest-contrast');

    const baseFg = baseDoc.color.foreground.main;
    const overrideFg = overrideDoc.color.foreground.main;
    expect(baseFg.$value).toBe(overrideFg.$value);
  });
});

describe('end-to-end: feedback loop — build surfaces prior audit suggestions', () => {
  const cleanups: string[] = [];
  afterAll(async () => {
    for (const p of cleanups) await rm(p, { recursive: true, force: true });
  });

  it('loads the prior audit report and exposes suggestions on rebuild', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'pigmint-e2e-fb-'));
    cleanups.push(workDir);

    const baseConfig = await loadProjectConfig(fixtureConfig);
    const strictConfig = {
      ...baseConfig,
      engine: { ...baseConfig.engine, target: 'AAA' as const, modes: ['light'] },
      output: { dtcg: './tokens.json' },
      audit: { report: './audit.json', profile: 'wcag-srgb' as const },
    };
    const tmpConfig = join(workDir, 'pigmint.yaml');
    await writeFixtureConfig(tmpConfig, strictConfig);

    const firstBuild = await build({ configPath: tmpConfig });
    expect(firstBuild.priorAudit).toBeUndefined();

    const auditResult = await audit({ configPath: tmpConfig });
    expect(auditResult.report.suggestions.length).toBeGreaterThan(0);
    expect(
      auditResult.report.suggestions.every(
        (s) => s.channel === 'intent-refinement',
      ),
    ).toBe(true);

    const secondBuild = await build({ configPath: tmpConfig });
    expect(secondBuild.priorAudit).toBeDefined();
    expect(secondBuild.priorAudit!.runId).toBe(auditResult.report.run.id);
    expect(secondBuild.priorAudit!.suggestions.length).toBe(
      auditResult.report.suggestions.length,
    );
  });
});
