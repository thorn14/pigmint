import { describe, it, expect } from 'vitest';
import {
  buildDefaultCurves,
  buildPortableArtifacts,
  generateRamp,
  hexToOklch,
  resolveAll,
} from '../src/index.js';
import type { ColorScale, EngineConfig, ProjectConfig, PortableVocabulary } from '../src/index.js';

function makeScale(sourceHex: string, name: string): ColorScale {
  const sourceOklch = hexToOklch(sourceHex);
  return {
    id: name,
    name,
    sourceHex,
    sourceOklch,
    sourceAlpha: 1,
    stepCount: 11,
    naming: { preset: 'tailwind' },
    curves: buildDefaultCurves(sourceOklch, 11),
    hueShift: { lightEndAdjust: 0, darkEndAdjust: 0 },
    lightnessPreset: 'tailwind',
    chromaPeak: sourceOklch.c,
  };
}

const engine: EngineConfig = { compliance: 'wcag21', target: 'AA', modes: ['light', 'dark'] };
const config: ProjectConfig = {
  engine,
  ramps: [{ name: 'neutral', source: '#888888' }],
  output: { dtcg: './tokens.json' },
};
const modes = [
  { mode: 'light' as const, scheme: 'light' as const, baselineHex: '#ffffff' },
  { mode: 'dark' as const, scheme: 'dark' as const, baselineHex: '#0a0a0a' },
];

function resolvePinned(vocab: PortableVocabulary) {
  const scales = [makeScale('#888888', 'neutral')];
  const ramps = scales.map((s) => generateRamp(s));
  const art = buildPortableArtifacts(vocab, engine);
  const out = resolveAll({
    config,
    vocabulary: art.vocabulary,
    ramps,
    modes,
    tokenRamp: art.tokenRamp,
    surfacePaths: art.surfacePaths,
    surfaceSteps: art.surfaceSteps,
    semanticSteps: art.semanticSteps,
    scales,
  });
  const ramp = ramps[0]!;
  const byKey = new Map(out.tokens.map((t) => [`${t.path}:${t.mode}`, t]));
  return { ramp, byKey };
}

describe('pin-to-step resolution', () => {
  it('emits exactly the pinned step per scheme with a contrast receipt against the surface', () => {
    const vocab: PortableVocabulary = {
      surfaces: { bg: { ramp: 'neutral', lightStep: 0, darkStep: 10 } },
      foreground: {
        fg: { ramp: 'neutral', surfaces: ['bg'], preference: 'pin-to-step', lightStep: 10, darkStep: 0 },
      },
      nonText: {},
    };
    const { ramp, byKey } = resolvePinned(vocab);

    const light = byKey.get('fg:light')!;
    const dark = byKey.get('fg:dark')!;

    // Exact pinned step hex per scheme (index 10 = darkest, index 0 = lightest).
    expect(light.hex).toBe(ramp.steps[10]!.hex);
    expect(dark.hex).toBe(ramp.steps[0]!.hex);

    // Real receipt against the surface (not exempt, not baseline-only).
    expect(light.resolvedAgainst).toBe('{bg}');
    expect(light.contrast?.wcag21).toBeGreaterThan(1);
    expect(light.compliance?.level).not.toBe('exempt');
    // Darkest-on-lightest is a strong contrast → passes text AA at least.
    expect(['AA-text', 'AAA-text']).toContain(light.compliance?.level);
    expect(light.source.nearestPrimitive).toBe('neutral.950');
  });

  it('flags a failing pin via compliance.level = "fail" when the step has too little contrast', () => {
    const vocab: PortableVocabulary = {
      surfaces: { bg: { ramp: 'neutral', lightStep: 0, darkStep: 10 } },
      foreground: {
        // light step 0 on a light surface (also step 0) → ~1:1, fails.
        fg: { ramp: 'neutral', surfaces: ['bg'], preference: 'pin-to-step', lightStep: 0, darkStep: 10 },
      },
      nonText: {},
    };
    const { byKey } = resolvePinned(vocab);
    expect(byKey.get('fg:light')!.compliance?.level).toBe('fail');
  });

  it('decorative pinned token is exempt regardless of contrast', () => {
    const vocab: PortableVocabulary = {
      surfaces: { bg: { ramp: 'neutral', lightStep: 0, darkStep: 10 } },
      foreground: {
        fg: {
          ramp: 'neutral', surfaces: ['bg'], preference: 'pin-to-step',
          lightStep: 0, darkStep: 10, decorative: true,
        },
      },
      nonText: {},
    };
    const { ramp, byKey } = resolvePinned(vocab);
    const light = byKey.get('fg:light')!;
    expect(light.hex).toBe(ramp.steps[0]!.hex);
    expect(light.compliance?.level).toBe('exempt');
  });

  it('accepts step names (not just indices) — stable against ramp re-ordering', () => {
    const vocab: PortableVocabulary = {
      surfaces: { bg: { ramp: 'neutral', lightStep: '50', darkStep: '950' } },
      foreground: {
        fg: { ramp: 'neutral', surfaces: ['bg'], preference: 'pin-to-step', lightStep: '950', darkStep: '50' },
      },
      nonText: {},
    };
    const { ramp, byKey } = resolvePinned(vocab);
    // Identical to the index-based pin: "950" === index 10, "50" === index 0.
    expect(byKey.get('fg:light')!.hex).toBe(ramp.steps[10]!.hex);
    expect(byKey.get('fg:dark')!.hex).toBe(ramp.steps[0]!.hex);
    expect(byKey.get('fg:light')!.source.nearestPrimitive).toBe('neutral.950');
  });

  it('throws a clear error for an unknown step name', () => {
    const vocab: PortableVocabulary = {
      surfaces: { bg: { ramp: 'neutral', lightStep: '50', darkStep: '950' } },
      foreground: {
        fg: { ramp: 'neutral', surfaces: ['bg'], preference: 'pin-to-step', lightStep: '850', darkStep: '50' },
      },
      nonText: {},
    };
    expect(() => resolvePinned(vocab)).toThrow(/"850" not found in ramp "neutral"/);
  });
});
