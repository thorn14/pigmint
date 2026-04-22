import { describe, it, expect } from 'vitest';
import {
  buildDefaultCurves,
  buildDefaultTokenRamp,
  generateRamp,
  hexToOklch,
  resolveAll,
  VOCABULARY_V1_SLICE,
} from '../src/index.js';
import type { ColorScale, ProjectConfig } from '../src/index.js';

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

const defaultRamps = () => [makeRamp('#888888', 'neutral'), makeRamp('#3366cc', 'blue')];

const defaultTokenRamp = buildDefaultTokenRamp(VOCABULARY_V1_SLICE, ['neutral', 'blue']);

const defaultModes = [
  { mode: 'light' as const, scheme: 'light' as const, baselineHex: '#ffffff' },
  { mode: 'dark' as const, scheme: 'dark' as const, baselineHex: '#0a0a0a' },
];

describe('resolveAll — light + dark, surfaces-then-tokens', () => {
  it('resolves every slice token in every mode against real surfaces', () => {
    const ramps = defaultRamps();
    const tokenRamp = defaultTokenRamp;
    const out = resolveAll({
      config,
      vocabulary: VOCABULARY_V1_SLICE,
      ramps,
      modes: defaultModes,
      tokenRamp,
    });

    const byKey = new Map(out.tokens.map((t) => [`${t.path}:${t.mode}`, t]));
    expect(byKey.size).toBe(VOCABULARY_V1_SLICE.length * 2);

    const lightMain = byKey.get('color.surface.main:light')!;
    const darkMain = byKey.get('color.surface.main:dark')!;
    expect(lightMain.resolvedAgainst).toBeNull();
    expect(lightMain.contrast?.againstBaseline).toBeGreaterThanOrEqual(1);
    expect(darkMain.hex).not.toBe(lightMain.hex);

    const fgLight = byKey.get('color.foreground.main:light')!;
    expect(fgLight.resolvedAgainst).toBe('{color.surface.main}');
    expect(fgLight.compliance?.level).toBe('AAA-text');

    const btnLight = byKey.get('color.action.primary.background:light')!;
    expect(btnLight.compliance?.level === 'AA-nonText' || btnLight.compliance?.level === 'AAA-nonText' || btnLight.compliance?.level === 'AA-text' || btnLight.compliance?.level === 'AAA-text').toBeTruthy();
    expect(btnLight.source.ramp).toBe('blue');
  });

  it('applies config.intents overrides to vocabulary defaults', () => {
    const ramps = defaultRamps();
    const base = resolveAll({
      config,
      vocabulary: VOCABULARY_V1_SLICE,
      ramps,
      modes: defaultModes,
      tokenRamp: defaultTokenRamp,
    });
    const overridden = resolveAll({
      config: {
        ...config,
        intents: {
          'color.action.primary.background': { preference: 'highest-contrast' },
        },
      },
      vocabulary: VOCABULARY_V1_SLICE,
      ramps,
      modes: defaultModes,
      tokenRamp: defaultTokenRamp,
    });

    const baseBtn = base.tokens.find(
      (t) => t.path === 'color.action.primary.background' && t.mode === 'light',
    )!;
    const overBtn = overridden.tokens.find(
      (t) => t.path === 'color.action.primary.background' && t.mode === 'light',
    )!;

    expect(baseBtn.intent.preference).toBe('lowest-passing');
    expect(overBtn.intent.preference).toBe('highest-contrast');
    expect(overBtn.source.position).not.toBe(baseBtn.source.position);
  });

  it('leaves unrelated tokens unchanged when only one override is set', () => {
    const ramps = defaultRamps();
    const base = resolveAll({
      config,
      vocabulary: VOCABULARY_V1_SLICE,
      ramps,
      modes: defaultModes,
      tokenRamp: defaultTokenRamp,
    });
    const overridden = resolveAll({
      config: {
        ...config,
        intents: {
          'color.action.primary.background': { preference: 'highest-contrast' },
        },
      },
      vocabulary: VOCABULARY_V1_SLICE,
      ramps,
      modes: defaultModes,
      tokenRamp: defaultTokenRamp,
    });

    const baseFg = base.tokens.find(
      (t) => t.path === 'color.foreground.main' && t.mode === 'light',
    )!;
    const overFg = overridden.tokens.find(
      (t) => t.path === 'color.foreground.main' && t.mode === 'light',
    )!;
    expect(overFg.hex).toBe(baseFg.hex);
    expect(overFg.intent.preference).toBe(baseFg.intent.preference);
  });
});
