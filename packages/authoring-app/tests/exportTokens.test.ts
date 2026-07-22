import { describe, expect, it } from 'vitest';
import type { GeneratedRamp, GeneratedStep } from '../src/types/palette';
import {
  exportColors,
  exportToHexList,
  exportToJSON,
  exportToW3CTokens,
} from '../src/lib/exportTokens';
import { parseColorList } from '../src/lib/importTokens';

function step(name: string, hex: string): GeneratedStep {
  return {
    name,
    hex,
    oklch: { l: 0.5, c: 0.1, h: 240 },
    srgb: { r: 0.2, g: 0.4, b: 0.8 },
    relativeLuminance: 0.2,
    gamut: 'srgb',
    maxSrgbC: 0.1,
  };
}

function ramp(scaleName: string, hexes: string[], scaleId = scaleName): GeneratedRamp {
  return {
    scaleId,
    scaleName,
    steps: hexes.map((hex, i) => step(String((i + 1) * 100), hex)),
  };
}

describe('exportToHexList', () => {
  it('returns empty string for no ramps', () => {
    expect(exportToHexList([])).toBe('');
  });

  it('emits one hex per line for a single scale (no name label)', () => {
    const text = exportToHexList([ramp('Primary', ['#FFFFFF', '#1A1A1A'])]);
    expect(text).toBe('#ffffff\n#1a1a1a\n');
  });

  it('labels multi-scale exports and separates blocks with a blank line', () => {
    const text = exportToHexList([
      ramp('Primary', ['#FF0000', '#00FF00']),
      ramp('Secondary', ['#0000FF']),
    ]);
    expect(text).toBe('Primary\n#ff0000\n#00ff00\n\nSecondary\n#0000ff\n');
  });

  it('disambiguates duplicate scale names', () => {
    const text = exportToHexList([
      ramp('Blue', ['#0000FF'], 'a'),
      ramp('Blue', ['#000099'], 'b'),
    ]);
    expect(text).toContain('Blue\n#0000ff');
    expect(text).toContain('Blue 2\n#000099');
  });

  it('round-trips through parseColorList (names skipped)', () => {
    const text = exportToHexList([
      ramp('Primary', ['#ABCDEF']),
      ramp('Secondary', ['#123456']),
    ]);
    const scale = parseColorList(text);
    expect(scale.steps.map((s) => s.hex)).toEqual(['#abcdef', '#123456']);
  });
});

describe('exportToW3CTokens / exportToJSON', () => {
  it('emits DTCG groups keyed by scale name', () => {
    const tokens = exportToW3CTokens([ramp('Primary', ['#FFFFFF'])]);
    expect(tokens).toHaveProperty('Primary');
    const group = tokens.Primary as Record<string, unknown>;
    expect(group.$type).toBe('color');
    expect(group).toHaveProperty('100');
  });

  it('pretty-prints JSON', () => {
    const json = exportToJSON([ramp('Primary', ['#FFFFFF'])]);
    expect(json).toContain('\n');
    expect(JSON.parse(json)).toHaveProperty('Primary');
  });
});

describe('exportColors', () => {
  it('selects hex list vs DTCG JSON by format', () => {
    const ramps = [ramp('Primary', ['#AABBCC'])];
    expect(exportColors(ramps, 'hex')).toBe('#aabbcc\n');
    expect(exportColors(ramps, 'dtcg')).toBe(exportToJSON(ramps));
  });
});
