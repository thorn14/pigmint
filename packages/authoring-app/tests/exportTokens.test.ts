import { describe, expect, it } from 'vitest';
import type { GeneratedRamp, GeneratedStep } from '../src/types/palette';
import {
  exportColors,
  exportToHexList,
  exportToJSON,
  exportToW3CTokens,
} from '../src/lib/exportTokens';

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
  it('returns an empty object for no ramps', () => {
    expect(exportToHexList([])).toBe('{}');
  });

  it('emits scale → hex array JSON', () => {
    const json = exportToHexList([ramp('Primary', ['#FFFFFF', '#1A1A1A'])]);
    expect(JSON.parse(json)).toEqual({
      Primary: ['#ffffff', '#1a1a1a'],
    });
  });

  it('includes every scale as its own hex array', () => {
    const json = exportToHexList([
      ramp('Primary', ['#FF0000', '#00FF00']),
      ramp('Secondary', ['#0000FF']),
    ]);
    expect(JSON.parse(json)).toEqual({
      Primary: ['#ff0000', '#00ff00'],
      Secondary: ['#0000ff'],
    });
  });

  it('disambiguates duplicate scale names', () => {
    const json = exportToHexList([
      ramp('Blue', ['#0000FF'], 'a'),
      ramp('Blue', ['#000099'], 'b'),
    ]);
    expect(JSON.parse(json)).toEqual({
      Blue: ['#0000ff'],
      'Blue 2': ['#000099'],
    });
  });

  it('pretty-prints', () => {
    const json = exportToHexList([ramp('Primary', ['#ABCDEF'])]);
    expect(json).toContain('\n');
    expect(json).toContain('  ');
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
  it('selects simple hex JSON vs DTCG JSON by format', () => {
    const ramps = [ramp('Primary', ['#AABBCC'])];
    expect(JSON.parse(exportColors(ramps, 'hex'))).toEqual({ Primary: ['#aabbcc'] });
    expect(exportColors(ramps, 'dtcg')).toBe(exportToJSON(ramps));
  });
});
