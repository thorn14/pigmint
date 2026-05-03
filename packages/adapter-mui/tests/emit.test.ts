import { describe, it, expect } from 'vitest';
import {
  buildDefaultCurves,
  buildDefaultTokenRamp,
  emitDtcg,
  generateRamp,
  hexToOklch,
  resolveAll,
  VOCABULARY_V1_SLICE,
  type ColorScale,
  type ProjectConfig,
} from '@pigmint/core';
import { muiEmit, buildMuiOutput } from '../src/emit';

function makeRamp(sourceHex: string, name: string) {
  const sourceOklch = hexToOklch(sourceHex);
  const curves = buildDefaultCurves(sourceOklch, 11);
  const scale: ColorScale = {
    id: name,
    name,
    sourceHex,
    sourceOklch,
    sourceAlpha: 1,
    stepCount: 11,
    naming: { preset: 'tailwind' },
    curves,
    hueShift: { lightEndAdjust: 0, darkEndAdjust: 0 },
    lightnessPreset: 'tailwind',
    chromaPeak: sourceOklch.c,
  };
  return generateRamp(scale);
}

const config: ProjectConfig = {
  engine: { compliance: 'wcag21', target: 'AA', modes: ['light', 'dark'] },
  ramps: [
    { name: 'neutral', source: '#888888' },
    { name: 'blue', source: '#3366cc' },
    { name: 'slate', source: '#64748b' },
    { name: 'success', source: '#16a34a' },
    { name: 'danger', source: '#dc2626' },
    { name: 'warning', source: '#d97706' },
    { name: 'info', source: '#0284c7' },
  ],
  output: { dtcg: './tokens.json' },
};

const RAMP_SOURCE: [string, string][] = [
  ['#888888', 'neutral'],
  ['#3366cc', 'blue'],
  ['#64748b', 'slate'],
  ['#16a34a', 'success'],
  ['#dc2626', 'danger'],
  ['#d97706', 'warning'],
  ['#0284c7', 'info'],
];
function buildContainer() {
  const ramps = RAMP_SOURCE.map(([hex, name]) => makeRamp(hex, name));
  const tokenRamp = buildDefaultTokenRamp(
    VOCABULARY_V1_SLICE,
    RAMP_SOURCE.map(([, n]) => n),
  );
  const { tokens, ramps: dtcgRamps } = resolveAll({
    config,
    vocabulary: VOCABULARY_V1_SLICE,
    ramps,
    modes: [
      { mode: 'light', scheme: 'light', baselineHex: '#ffffff' },
      { mode: 'dark', scheme: 'dark', baselineHex: '#0a0a0a' },
    ],
    tokenRamp,
  });
  return emitDtcg({
    engineVersion: '0.0.0',
    defaultMode: 'light',
    ramps: dtcgRamps,
    resolvedTokens: tokens,
    vocabulary: VOCABULARY_V1_SLICE,
  });
}

describe('muiEmit', () => {
  it('emits theme.ts with light+dark colorSchemes and receipts.json', () => {
    const container = buildContainer();
    const result = muiEmit({
      container,
      adapterConfig: { name: 'mui', output: './dist-mui/', formats: ['hex'] },
      projectConfig: config,
    });

    expect(result.files.map((f) => f.path).sort()).toEqual([
      './dist-mui/receipts.json',
      './dist-mui/theme.ts',
    ]);

    const theme = result.files.find((f) => f.path.endsWith('theme.ts'))!;
    expect(theme.content).toMatch(/colorSchemes/);
    expect(theme.content).toMatch(/"light"/);
    expect(theme.content).toMatch(/"dark"/);
    expect(theme.content).toMatch(/extendTheme/);
    expect(theme.content).toMatch(/"primary":/);
    expect(theme.content).toMatch(/"background":/);

    const receipts = result.files.find((f) => f.path.endsWith('receipts.json'))!;
    const parsed = JSON.parse(receipts.content) as {
      artifactVersion: string;
      tokens: Array<{ tokenPath: string; modes: Record<string, string> }>;
    };
    expect(parsed.artifactVersion).toBe('mui-receipts@0.1');
    const paths = parsed.tokens.map((t) => t.tokenPath).sort();
    expect(paths).toContain('surface.main');
    expect(paths).toContain('foreground.main');
    expect(paths).toContain('action.primary.background');
    for (const t of parsed.tokens) {
      expect(t.modes.light).toMatch(/^#[0-9a-f]{6}$/i);
      expect(t.modes.dark).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('does not warn about missing palette bindings when the default vocabulary covers the MUI map', () => {
    const container = buildContainer();
    const { missingBindings } = buildMuiOutput(
      {
        container,
        adapterConfig: { name: 'mui', output: './css', formats: ['hex'] },
        projectConfig: config,
      },
      'hex',
    );
    expect(missingBindings).toEqual([]);
  });

  it('buildMuiOutput maps surface.main to background.default', () => {
    const container = buildContainer();
    const { themeObject, receipts } = buildMuiOutput(
      {
        container,
        adapterConfig: { name: 'mui', output: './x', formats: ['hex'] },
        projectConfig: config,
      },
      'hex',
    );
    const light = themeObject.colorSchemes.light!.palette as Record<
      string,
      Record<string, string>
    >;
    expect(light.background!.default).toBeTruthy();
    const surface = receipts.tokens.find((t) => t.tokenPath === 'surface.main')!;
    expect(surface.palettePaths).toEqual(['background.default']);
    expect(surface.modes.light).toBe(light.background!.default);
  });
});
