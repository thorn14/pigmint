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
import { tailwindEmit } from '../src/emit.js';

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
  engine: {
    compliance: 'wcag21',
    target: 'AA',
    modes: ['light', 'dark', 'light-high-contrast', 'dark-high-contrast'],
  },
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

const DEFAULT_RAMP_NAMES = [
  'neutral',
  'blue',
  'slate',
  'success',
  'danger',
  'warning',
  'info',
];
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
  const tokenRamp = buildDefaultTokenRamp(VOCABULARY_V1_SLICE, DEFAULT_RAMP_NAMES);
  const { tokens } = resolveAll({
    config,
    vocabulary: VOCABULARY_V1_SLICE,
    ramps,
    modes: [
      { mode: 'light', scheme: 'light', baselineHex: '#ffffff' },
      { mode: 'dark', scheme: 'dark', baselineHex: '#0a0a0a' },
      { mode: 'light-high-contrast', scheme: 'light', baselineHex: '#ffffff' },
      { mode: 'dark-high-contrast', scheme: 'dark', baselineHex: '#000000' },
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

describe('tailwindEmit', () => {
  it('emits a CSS file with class-scoped selector blocks for every mode', () => {
    const container = buildContainer();
    const result = tailwindEmit({
      container,
      adapterConfig: { name: 'tailwind', output: './dist-css/', formats: ['oklch'] },
      projectConfig: config,
    });

    expect(result.files).toHaveLength(1);
    const file = result.files[0]!;
    expect(file.path).toBe('./dist-css/tokens.css');
    expect(file.content).toMatch(/:root \{/);
    expect(file.content).toMatch(/\.dark \{/);
    expect(file.content).toMatch(/\.light-high-contrast \{/);
    expect(file.content).toMatch(/\.dark-high-contrast \{/);
    expect(file.content).not.toMatch(/data-contrast/);
    expect(file.content).toMatch(/--color-surface-main:/);
    expect(file.content).toMatch(/--color-action-primary-background:/);
    expect(file.content).toMatch(/oklch\(/);
  });

  it('maps semantic paths to shadcn variable names when preset=shadcn', () => {
    const container = buildContainer();
    const result = tailwindEmit({
      container,
      adapterConfig: { name: 'tailwind', output: './css', preset: 'shadcn', formats: ['oklch'] },
      projectConfig: config,
    });
    const css = result.files[0]!.content;
    expect(css).toMatch(/--background:/);
    expect(css).toMatch(/--foreground:/);
    expect(css).toMatch(/--primary:/);
    expect(css).not.toMatch(/--color-surface-main:/);
  });

  it('emits hex values when format=hex', () => {
    const container = buildContainer();
    const result = tailwindEmit({
      container,
      adapterConfig: { name: 'tailwind', output: './css', formats: ['hex'] },
      projectConfig: config,
    });
    const css = result.files[0]!.content;
    expect(css).toMatch(/#[0-9a-f]{6}/i);
    expect(css).not.toMatch(/oklch\(/);
  });
});
