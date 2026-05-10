import { describe, it, expect } from 'vitest';
import {
  buildDefaultCurves,
  generateRamp,
  getWcagContrast,
  hexToOklch,
  resolveAll,
  resolveToken,
  ResolveError,
  validatePortableVocabulary,
  portableToVocabularyEntries,
  PortableVocabularyError,
} from '../src/index.js';
import type {
  ColorScale,
  EngineConfig,
  FormalIntent,
  PortableVocabulary,
  ProjectConfig,
} from '../src/index.js';
import { pickStepPreferredContrast } from '../src/resolver/resolve.js';

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

const aaTextWcag: FormalIntent['threshold'] = { kind: 'wcag', level: 'AA', usage: 'text' };

describe('pickStepPreferredContrast', () => {
  it('picks the step whose ratio against the surface is closest to the target', () => {
    const blue = makeRamp('#3366cc', 'blue');
    const surface = '#ffffff';
    const got = pickStepPreferredContrast(blue, surface, aaTextWcag, 5);
    expect(got).not.toBeNull();
    // The picked ratio must be at least as close to 5 as every other passing step.
    for (const step of blue.steps) {
      const r = getWcagContrast(step.hex, surface).ratio;
      if (r < 4.5) continue;
      expect(Math.abs(got!.ratio - 5)).toBeLessThanOrEqual(Math.abs(r - 5) + 1e-9);
    }
  });

  it('clamps to the highest-contrast step when target exceeds the ramp', () => {
    const blue = makeRamp('#3366cc', 'blue');
    const surface = '#ffffff';
    const target = 100;
    const got = pickStepPreferredContrast(blue, surface, aaTextWcag, target);
    const max = Math.max(
      ...blue.steps.map((s) => {
        const c = getWcagContrast(s.hex, surface).ratio;
        return c >= 4.5 ? c : -Infinity;
      }),
    );
    expect(got!.ratio).toBeCloseTo(max, 5);
  });

  it('falls back to the closest non-passing step when nothing meets the threshold', () => {
    // White-on-white: no step can pass AA text contrast against white
    const grayish = makeRamp('#f5f5f5', 'gray');
    const got = pickStepPreferredContrast(grayish, '#ffffff', aaTextWcag, 3);
    expect(got).not.toBeNull();
    // Even though the step fails AA, the picker still returns one (best-effort).
    expect(typeof got!.ratio).toBe('number');
  });
});

describe('resolveToken with preferred-contrast preference', () => {
  it('drives the picker via constraints.targetContrast', () => {
    const blue = makeRamp('#3366cc', 'blue');
    const intent: FormalIntent = {
      threshold: aaTextWcag,
      preference: 'preferred-contrast',
      consistency: 'independent',
      surfaceContext: 'primary',
      constraints: { targetContrast: 6 },
    };
    const { token } = resolveToken({
      tokenPath: 'color.foo.bar',
      mode: 'light',
      intent,
      ramp: blue,
      surfaceHex: '#ffffff',
      surfaceRef: '{color.surface.main.bg}',
    });
    expect(token.contrast?.wcag21).toBeDefined();
    // Ratio should be close to 6 (within roughly the ramp's step granularity).
    expect(Math.abs((token.contrast!.wcag21 ?? 0) - 6)).toBeLessThan(3);
  });

  it('throws when targetContrast is missing', () => {
    const blue = makeRamp('#3366cc', 'blue');
    const intent: FormalIntent = {
      threshold: aaTextWcag,
      preference: 'preferred-contrast',
      consistency: 'independent',
      surfaceContext: 'primary',
    };
    expect(() => resolveToken({
      tokenPath: 'color.foo.bar',
      mode: 'light',
      intent,
      ramp: blue,
      surfaceHex: '#ffffff',
      surfaceRef: '{color.surface.main.bg}',
    })).toThrow(ResolveError);
  });
});

describe('decorative flag exempts from compliance checks', () => {
  const config: ProjectConfig = {
    engine: { compliance: 'wcag21', target: 'AA', modes: ['light'] },
    ramps: [{ name: 'gray', source: '#888888' }],
    output: { dtcg: './tokens.json' },
  };
  const engineConfig: EngineConfig = config.engine;

  it('forces compliance.level to "exempt" when entry.decorative is true', () => {
    const portable: PortableVocabulary = {
      surfaces: { card: { ramp: 'gray', step: 1 } },
      foreground: {
        'color.foreground.label': {
          ramp: 'gray',
          surfaces: ['card'],
          preference: 'lowest-passing',
          decorative: true,
        },
      },
      nonText: {},
    };
    const vocab = portableToVocabularyEntries(portable, engineConfig);
    const out = resolveAll({
      config,
      vocabulary: vocab,
      ramps: [makeRamp('#888888', 'gray')],
      modes: [{ mode: 'light', scheme: 'light', baselineHex: '#ffffff' }],
      tokenRamp: { card: 'gray', 'color.foreground.label': 'gray' },
      surfacePaths: new Set(['card']),
      surfaceSteps: new Map([['card', { default: 1 }]]),
    });
    const fg = out.tokens.find((t) => t.path === 'color.foreground.label');
    expect(fg).toBeDefined();
    expect(fg!.compliance?.level).toBe('exempt');
  });
});

describe('validator accepts new fields', () => {
  it('accepts preferred-contrast + targetContrast on a foreground token', () => {
    const v = validatePortableVocabulary({
      surfaces: { card: { ramp: 'gray', step: 0 } },
      foreground: {
        'color.fg.x': {
          ramp: 'gray',
          surfaces: ['card'],
          preference: 'preferred-contrast',
          targetContrast: 5.5,
          decorative: true,
        },
      },
      nonText: {},
    }, '(test)');
    expect(v.foreground['color.fg.x']?.preference).toBe('preferred-contrast');
    expect(v.foreground['color.fg.x']?.targetContrast).toBe(5.5);
    expect(v.foreground['color.fg.x']?.decorative).toBe(true);
  });

  it('rejects preferred-contrast without targetContrast', () => {
    expect(() => validatePortableVocabulary({
      surfaces: { card: { ramp: 'gray', step: 0 } },
      foreground: {
        'color.fg.x': {
          ramp: 'gray',
          surfaces: ['card'],
          preference: 'preferred-contrast',
        },
      },
      nonText: {},
    }, '(test)')).toThrow(PortableVocabularyError);
  });

  it('rejects non-boolean decorative', () => {
    expect(() => validatePortableVocabulary({
      surfaces: { card: { ramp: 'gray', step: 0 } },
      foreground: {
        'color.fg.x': {
          ramp: 'gray',
          surfaces: ['card'],
          preference: 'lowest-passing',
          decorative: 'yes' as unknown as boolean,
        },
      },
      nonText: {},
    }, '(test)')).toThrow(PortableVocabularyError);
  });
});
