import { describe, it, expect } from 'vitest';
import {
  buildDefaultCurves,
  emitDtcg,
  generateRamp,
  hexToOklch,
  resolveAll,
  VOCABULARY_V1_SLICE,
  type ColorScale,
  type ProjectConfig,
} from '@pigmint/core';
import { muiEmit, buildMuiOutput } from '../src/emit.js';

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
  ],
  output: { dtcg: './tokens.json' },
};

function buildContainer() {
  const ramps = [makeRamp('#888888', 'neutral'), makeRamp('#3366cc', 'blue')];
  const tokenRamp: Record<string, string> = {
    'color.surface.main': 'neutral',
    'color.surface.inverse': 'neutral',
    'color.foreground.main': 'neutral',
    'color.action.primary.background': 'blue',
  };
  const { tokens } = resolveAll({
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
    ramps,
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
    expect(paths).toContain('color.surface.main');
    expect(paths).toContain('color.foreground.main');
    expect(paths).toContain('color.action.primary.background');
    for (const t of parsed.tokens) {
      expect(t.modes.light).toMatch(/^#[0-9a-f]{6}$/i);
      expect(t.modes.dark).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('warns when some palette bindings are not covered by vocab', () => {
    const container = buildContainer();
    const result = muiEmit({
      container,
      adapterConfig: { name: 'mui', output: './css', formats: ['hex'] },
      projectConfig: config,
    });
    expect(result.warnings!.some((w) => w.includes('palette binding'))).toBe(true);
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
    const surface = receipts.tokens.find((t) => t.tokenPath === 'color.surface.main')!;
    expect(surface.palettePaths).toEqual(['background.default']);
    expect(surface.modes.light).toBe(light.background!.default);
  });
});
