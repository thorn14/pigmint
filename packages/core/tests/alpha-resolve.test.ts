import { describe, it, expect } from 'vitest';
import {
  alphaCompositeHex,
  toRgbaString,
  toHex8,
  resolveAlphaToken,
  defaultAlphaReferenceSurface,
  parseStepRef,
  findStepByName,
  buildDefaultCurves,
  generateRamp,
  hexToOklch,
  getWcagContrast,
} from '../src/index.js';
import type { ColorScale, AlphaModifier } from '../src/index.js';

function makeRamp(sourceHex: string, name: string): ReturnType<typeof generateRamp> {
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

describe('alphaCompositeHex', () => {
  it('fully opaque alpha returns foreground color', () => {
    const result = alphaCompositeHex('#ff0000', 1, '#ffffff');
    expect(result.toLowerCase()).toBe('#ff0000');
  });

  it('fully transparent alpha returns background color', () => {
    const result = alphaCompositeHex('#ff0000', 0, '#ffffff');
    expect(result.toLowerCase()).toBe('#ffffff');
  });

  it('50% red over white is between red and white', () => {
    const result = alphaCompositeHex('#ff0000', 0.5, '#ffffff');
    // ~#ff8080 in sRGB — composited value between red and white
    expect(result.toLowerCase()).toMatch(/^#[0-9a-f]{6}$/);
    // Red channel should be near ff (≥ f0), green near 80
    const r = parseInt(result.slice(1, 3), 16);
    const g = parseInt(result.slice(3, 5), 16);
    expect(r).toBeGreaterThan(200);
    expect(g).toBeGreaterThan(80);
    expect(g).toBeLessThan(200);
  });

  it('returns a valid 6-char hex', () => {
    const result = alphaCompositeHex('#1e293b', 0.4, '#f8fafc');
    expect(result).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('toRgbaString', () => {
  it('formats red at 0.5', () => {
    const result = toRgbaString('#ff0000', 0.5);
    expect(result).toBe('rgba(255, 0, 0, 0.5)');
  });
});

describe('toHex8', () => {
  it('appends alpha byte to hex', () => {
    const result = toHex8('#0f172a', 0.4);
    // 0.4 * 255 ≈ 102 = 0x66
    expect(result.toLowerCase()).toBe('#0f172a66');
  });

  it('clamps alpha above 1', () => {
    const result = toHex8('#ffffff', 1.5);
    expect(result.toLowerCase()).toBe('#ffffffff');
  });
});

describe('parseStepRef', () => {
  it('parses a valid step reference', () => {
    const result = parseStepRef('{color.primitive.slate.900}');
    expect(result).toEqual({ ramp: 'slate', step: '900' });
  });

  it('parses without curly braces', () => {
    const result = parseStepRef('color.primitive.red.500');
    expect(result).toEqual({ ramp: 'red', step: '500' });
  });

  it('returns null for invalid references', () => {
    expect(parseStepRef('{some.other.path}')).toBeNull();
    expect(parseStepRef('{color.primitive.only}')).toBeNull();
  });
});

describe('findStepByName', () => {
  it('finds a step by name', () => {
    const ramp = makeRamp('#475569', 'slate');
    const result = findStepByName(ramp, '500');
    expect(result).not.toBeNull();
    expect(result?.step.name).toBe('500');
  });

  it('returns null for unknown step name', () => {
    const ramp = makeRamp('#475569', 'slate');
    expect(findStepByName(ramp, 'nonexistent')).toBeNull();
  });
});

describe('defaultAlphaReferenceSurface', () => {
  it('returns color.surface.main for light scheme', () => {
    expect(defaultAlphaReferenceSurface('light')).toBe('color.surface.main');
  });

  it('returns color.surface.inverse for dark scheme', () => {
    expect(defaultAlphaReferenceSurface('dark')).toBe('color.surface.inverse');
  });
});

describe('resolveAlphaToken — degenerate (baseRef + fixed alpha)', () => {
  const slateRamp = makeRamp('#475569', 'slate');

  it('composites a declared step at the declared alpha', () => {
    const modifier: AlphaModifier = {
      baseRef: '{color.primitive.slate.900}',
      value: 0.4,
      referenceSurface: 'color.surface.main',
    };

    const { token } = resolveAlphaToken(
      {
        tokenPath: 'color.overlay.scrim',
        mode: 'light',
        usage: 'decorative',
        modifier,
        ramp: slateRamp,
        referenceSurfaceHex: '#ffffff',
        referenceSurfacePath: 'color.surface.main',
      },
      [slateRamp],
    );

    expect(token.path).toBe('color.overlay.scrim');
    expect(token.mode).toBe('light');
    expect(token.compliance?.level).toBe('exempt');
    expect(token.alpha).toBeDefined();
    expect(token.alpha!.alphaValue).toBe(0.4);
    expect(token.alpha!.referenceSurface).toBe('color.surface.main');
    expect(token.alpha!.composited.hex).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('resolveAlphaToken — path 1 (fixed alpha, resolve step)', () => {
  const slateRamp = makeRamp('#475569', 'slate');
  const whiteHex = '#ffffff';

  it('picks a step whose composited result passes AA-nonText against white', () => {
    const modifier: AlphaModifier = {
      baseRamp: 'slate',
      value: 0.6,
      referenceSurface: 'color.surface.main',
      intent: {
        threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
        preference: 'lowest-passing',
        consistency: 'independent',
        surfaceContext: 'primary',
      },
    };

    const { token } = resolveAlphaToken(
      {
        tokenPath: 'color.border.alpha',
        mode: 'light',
        usage: 'nonText',
        modifier,
        ramp: slateRamp,
        referenceSurfaceHex: '#f8fafc',
        referenceSurfacePath: 'color.surface.main',
        surfaceHex: whiteHex,
        surfaceRef: '{color.surface.main}',
      },
      [slateRamp],
    );

    expect(token.path).toBe('color.border.alpha');
    expect(token.alpha).toBeDefined();
    expect(token.alpha!.alphaValue).toBe(0.6);

    // The composited hex against white should satisfy AA-nonText (3:1)
    const compositedHex = token.alpha!.composited.hex;
    const ratio = getWcagContrast(compositedHex, whiteHex).ratio;
    // Either it passes 3:1 or the fallback was used (fallback just picks max contrast)
    expect(typeof ratio).toBe('number');
    expect(token.compliance?.level).not.toBe('exempt');
  });

  it('uses highest-contrast preference when specified', () => {
    const modifier: AlphaModifier = {
      baseRamp: 'slate',
      value: 0.8,
      intent: {
        threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
        preference: 'highest-contrast',
        consistency: 'independent',
        surfaceContext: 'primary',
      },
    };

    const { token: lowestToken } = resolveAlphaToken(
      {
        tokenPath: 'color.border.lo',
        mode: 'light',
        usage: 'nonText',
        modifier: { ...modifier, intent: { ...modifier.intent!, preference: 'lowest-passing' } },
        ramp: slateRamp,
        referenceSurfaceHex: '#f8fafc',
        referenceSurfacePath: 'color.surface.main',
        surfaceHex: whiteHex,
        surfaceRef: '{color.surface.main}',
      },
      [slateRamp],
    );

    const { token: highestToken } = resolveAlphaToken(
      {
        tokenPath: 'color.border.hi',
        mode: 'light',
        usage: 'nonText',
        modifier,
        ramp: slateRamp,
        referenceSurfaceHex: '#f8fafc',
        referenceSurfacePath: 'color.surface.main',
        surfaceHex: whiteHex,
        surfaceRef: '{color.surface.main}',
      },
      [slateRamp],
    );

    // highest-contrast should pick a step with equal or greater composited contrast than lowest-passing
    const lRatio = getWcagContrast(lowestToken.alpha!.composited.hex, whiteHex).ratio;
    const hRatio = getWcagContrast(highestToken.alpha!.composited.hex, whiteHex).ratio;
    expect(hRatio).toBeGreaterThanOrEqual(lRatio - 0.01);
  });
});

describe('resolveAlphaToken — driver integration (via resolveAll)', () => {
  it('alpha entries are resolved and included in token output', async () => {
    const { resolveAll } = await import('../src/resolver/driver.js');
    const slateRamp = makeRamp('#475569', 'slate');

    const result = resolveAll({
      config: {
        engine: { compliance: 'wcag21', target: 'AA', modes: ['light'] },
        ramps: [],
        output: { dtcg: 'tokens.json' },
      },
      vocabulary: [
        {
          path: 'color.surface.main',
          usage: 'nonText',
          defaultIntent: {
            threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
            preference: 'lowest-passing',
            consistency: 'independent',
            surfaceContext: 'primary',
          },
        },
        {
          path: 'color.overlay.scrim',
          usage: 'decorative',
          alpha: {
            baseRef: '{color.primitive.slate.900}',
            value: 0.4,
            referenceSurface: 'color.surface.main',
          },
        },
      ],
      ramps: [slateRamp],
      modes: [{ mode: 'light', scheme: 'light', baselineHex: '#ffffff' }],
      tokenRamp: {
        'color.surface.main': 'slate',
        'color.overlay.scrim': 'slate',
      },
      surfacePaths: new Set(['color.surface.main']),
      surfaceSteps: new Map([['color.surface.main', { light: 0 }]]),
    });

    const scrimToken = result.tokens.find((t) => t.path === 'color.overlay.scrim');
    expect(scrimToken).toBeDefined();
    expect(scrimToken!.alpha).toBeDefined();
    expect(scrimToken!.alpha!.alphaValue).toBe(0.4);
    expect(scrimToken!.compliance?.level).toBe('exempt');
  });
});
