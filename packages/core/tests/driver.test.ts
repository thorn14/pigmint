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

function makeScale(sourceHex: string, name: string): ColorScale {
  const sourceOklch = hexToOklch(sourceHex);
  const curves = buildDefaultCurves(sourceOklch, 11);
  return {
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
}

function makeRamp(sourceHex: string, name: string) {
  return generateRamp(makeScale(sourceHex, name));
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

const RAMP_SPECS: [string, string][] = [
  ['#888888', 'neutral'],
  ['#3366cc', 'blue'],
  ['#64748b', 'slate'],
  ['#16a34a', 'success'],
  ['#dc2626', 'danger'],
  ['#d97706', 'warning'],
  ['#0284c7', 'info'],
];
const defaultRamps = () => RAMP_SPECS.map(([hex, name]) => makeRamp(hex, name));
const RAMP_NAMES = RAMP_SPECS.map(([, n]) => n);
const defaultTokenRamp = buildDefaultTokenRamp(VOCABULARY_V1_SLICE, RAMP_NAMES);

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

  it('engine.compliance apca drives formal threshold kind and Lc in receipts', () => {
    const apcaConfig: ProjectConfig = { ...config, engine: { ...config.engine, compliance: 'apca' } };
    const ramps = defaultRamps();
    const out = resolveAll({
      config: apcaConfig,
      vocabulary: VOCABULARY_V1_SLICE,
      ramps,
      modes: defaultModes,
      tokenRamp: defaultTokenRamp,
    });
    const fg = out.tokens.find((t) => t.path === 'color.foreground.main' && t.mode === 'light');
    expect(fg?.intent.threshold.kind).toBe('apca');
    expect(typeof fg?.contrast?.apca).toBe('number');
    expect(Number.isFinite(fg?.contrast?.apca ?? NaN)).toBe(true);
    expect(fg?.compliance?.level).toBe('apca-pass');
    expect(fg?.compliance?.apcaLc).toBeDefined();
    const { achieved, required } = fg!.compliance!.apcaLc!;
    expect(achieved).toBeGreaterThanOrEqual(required);
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

  it('resolver.mode="continuous" picks off-step positions and labels nearest primitive', () => {
    const scales = RAMP_SPECS.map(([hex, name]) => makeScale(hex, name));
    const ramps = scales.map((s) => generateRamp(s));
    const baseline = resolveAll({
      config,
      vocabulary: VOCABULARY_V1_SLICE,
      ramps,
      modes: defaultModes,
      tokenRamp: defaultTokenRamp,
    });
    const continuous = resolveAll({
      config: {
        ...config,
        engine: {
          ...config.engine,
          resolver: { mode: 'continuous', fallbackSteps: 256 },
        },
      },
      vocabulary: VOCABULARY_V1_SLICE,
      ramps,
      modes: defaultModes,
      tokenRamp: defaultTokenRamp,
      scales,
    });

    const baseBtn = baseline.tokens.find(
      (t) => t.path === 'color.action.primary.background' && t.mode === 'light',
    )!;
    const contBtn = continuous.tokens.find(
      (t) => t.path === 'color.action.primary.background' && t.mode === 'light',
    )!;

    // Baseline snaps to an 11-step grid: position is an integer multiple of 0.1.
    const baseSnap = Math.abs(baseBtn.source.position * 10 - Math.round(baseBtn.source.position * 10));
    expect(baseSnap).toBeLessThan(1e-9);

    // Continuous picks a finer position and meets the threshold more tightly.
    const contSnap = Math.abs(contBtn.source.position * 10 - Math.round(contBtn.source.position * 10));
    expect(contSnap).toBeGreaterThan(1e-6);
    expect(contBtn.contrast?.wcag21 ?? 0).toBeGreaterThanOrEqual(3);
    expect(contBtn.contrast?.wcag21 ?? 99).toBeLessThanOrEqual(baseBtn.contrast?.wcag21 ?? 99);

    // F1: off-grid continuous picks get `c0000`–`c1000` primitives, not the nearest 11-step name.
    expect(contBtn.source.nearestPrimitive).toMatch(/^blue\.c\d{4}$/);
    const blueRamp = continuous.ramps.find((r) => r.scaleName === 'blue')!;
    const stepName = contBtn.source.nearestPrimitive?.split('.').pop();
    const step = blueRamp.steps.find((s) => s.name === stepName);
    expect(step?.hex).toBe(contBtn.hex);
  });

  it('materializeInterpolatedPrimitives: false keeps named nearest for continuous off-grid (legacy alias path)', () => {
    const scales = RAMP_SPECS.map(([hex, name]) => makeScale(hex, name));
    const ramps = scales.map((s) => generateRamp(s));
    const out = resolveAll({
      config: {
        ...config,
        engine: {
          ...config.engine,
          resolver: {
            mode: 'continuous',
            fallbackSteps: 256,
            materializeInterpolatedPrimitives: false,
          },
        },
      },
      vocabulary: VOCABULARY_V1_SLICE,
      ramps,
      modes: defaultModes,
      tokenRamp: defaultTokenRamp,
      scales,
    });
    const btn = out.tokens.find(
      (t) => t.path === 'color.action.primary.background' && t.mode === 'light',
    )!;
    expect(btn.source.nearestPrimitive).toMatch(/^blue\.(50|100|200|300|400|500|600|700|800|900|950)$/);
  });

  it('resolver.mode="continuous" throws without scales', () => {
    const ramps = defaultRamps();
    expect(() =>
      resolveAll({
        config: {
          ...config,
          engine: {
            ...config.engine,
            resolver: { mode: 'continuous' },
          },
        },
        vocabulary: VOCABULARY_V1_SLICE,
        ramps,
        modes: defaultModes,
        tokenRamp: defaultTokenRamp,
      }),
    ).toThrow(/continuous/);
  });

  it('thresholdElevation: "hc" raises the effective min so HC modes diverge from base', () => {
    const ramps = defaultRamps();
    const out = resolveAll({
      config: {
        ...config,
        engine: {
          ...config.engine,
          modes: ['light', 'light-high-contrast'],
        },
      },
      vocabulary: VOCABULARY_V1_SLICE,
      ramps,
      modes: [
        { mode: 'light', scheme: 'light', baselineHex: '#ffffff' },
        {
          mode: 'light-high-contrast',
          scheme: 'light',
          baselineHex: '#ffffff',
          thresholdElevation: 'hc',
        },
      ],
      tokenRamp: defaultTokenRamp,
    });

    const base = out.tokens.find(
      (t) => t.path === 'color.action.primary.background' && t.mode === 'light',
    )!;
    const hc = out.tokens.find(
      (t) =>
        t.path === 'color.action.primary.background' && t.mode === 'light-high-contrast',
    )!;

    // Non-text AA (3:1) elevates to text AA (4.5:1); picker lands on a higher-contrast step.
    expect(base.contrast?.wcag21 ?? 0).toBeLessThan(hc.contrast?.wcag21 ?? 0);
    expect(hc.contrast?.wcag21 ?? 0).toBeGreaterThanOrEqual(4.5);
    expect(hc.compliance?.thresholds?.nonText).toBe(4.5);
    expect(base.compliance?.thresholds?.nonText).toBe(3);

    const baseMuted = out.tokens.find(
      (t) => t.path === 'color.foreground.muted' && t.mode === 'light',
    )!;
    const hcMuted = out.tokens.find(
      (t) => t.path === 'color.foreground.muted' && t.mode === 'light-high-contrast',
    )!;
    // Text AA (4.5) elevates to text AAA (7); muted-foreground is AA-text in the default slice.
    expect(baseMuted.compliance?.thresholds?.text).toBe(4.5);
    expect(hcMuted.compliance?.thresholds?.text).toBe(7);
    expect((hcMuted.contrast?.wcag21 ?? 0) > (baseMuted.contrast?.wcag21 ?? 0)).toBe(true);
  });

  it('matched-across-ramps + matched-to-set: synchronizes t and groups tokens on different ramps', () => {
    const scales = RAMP_SPECS.map(([hex, name]) => makeScale(hex, name));
    const ramps = scales.map((s) => generateRamp(s));
    const out = resolveAll({
      config: {
        ...config,
        intents: {
          'color.border.subtle': {
            preference: 'matched-to-set',
            consistency: 'matched-across-ramps',
          },
          'color.action.primary.background': {
            preference: 'matched-to-set',
            consistency: 'matched-across-ramps',
          },
        },
      },
      vocabulary: VOCABULARY_V1_SLICE,
      ramps,
      modes: defaultModes,
      tokenRamp: defaultTokenRamp,
      scales,
    });

    const t1 = out.tokens.find(
      (t) => t.path === 'color.border.subtle' && t.mode === 'light',
    )!;
    const t2 = out.tokens.find(
      (t) => t.path === 'color.action.primary.background' && t.mode === 'light',
    )!;

    expect(t1.intent.consistency).toBe('matched-across-ramps');
    expect(t1.source.position).toBeCloseTo(t2.source.position, 5);
  });

  it('anchored-to-reference: non-reference ramps match reference ramp WCAG (blue → neutral)', () => {
    const scales = RAMP_SPECS.map(([hex, name]) => makeScale(hex, name));
    const ramps = scales.map((s) => generateRamp(s));
    const out = resolveAll({
      config: {
        ...config,
        intents: {
          'color.action.primary.background': {
            consistency: 'anchored-to-reference',
            preference: 'highest-contrast',
            constraints: { referenceRamp: 'blue' },
          },
          'color.border.subtle': {
            consistency: 'anchored-to-reference',
            preference: 'highest-contrast',
            constraints: { referenceRamp: 'blue' },
          },
        },
      },
      vocabulary: VOCABULARY_V1_SLICE,
      ramps,
      modes: defaultModes,
      tokenRamp: defaultTokenRamp,
      scales,
    });

    const ref = out.tokens.find(
      (t) => t.path === 'color.action.primary.background' && t.mode === 'light',
    )!;
    const follows = out.tokens.find(
      (t) => t.path === 'color.border.subtle' && t.mode === 'light',
    )!;

    const refR = ref.contrast?.wcag21 ?? 0;
    const followR = follows.contrast?.wcag21 ?? 0;
    expect(followR).toBeCloseTo(refR, 0);
  });
});
