import { describe, expect, it } from 'vitest';
import { detectFormat, parseColorList, parseW3CTokens } from '../src/lib/importTokens';

describe('detectFormat', () => {
  it('detects JSON from an object/array start', () => {
    expect(detectFormat('{ "color": {} }')).toBe('json');
    expect(detectFormat('  [1, 2, 3]')).toBe('json');
  });

  it('detects YAML from a document marker or top-level mapping key', () => {
    expect(detectFormat('---\nsurfaces:\n  main: {}')).toBe('yaml');
    expect(detectFormat('surfaces:\n  main:\n    ramp: stone')).toBe('yaml');
  });

  it('returns unknown for a bare color list', () => {
    expect(detectFormat('#ffffff\n#1a1a1a')).toBe('unknown');
    expect(detectFormat('')).toBe('unknown');
  });
});

describe('parseColorList', () => {
  it('parses newline/comma/space separated colors into one scale', () => {
    const scale = parseColorList('#ffffff, #1a1a1a\nrgb(0 128 255)');
    expect(scale.steps).toHaveLength(3);
    expect(scale.steps[0].hex).toBe('#ffffff');
    expect(scale.sourceHex).toBeTruthy();
  });

  it('skips unparseable entries but keeps valid ones', () => {
    const scale = parseColorList('#fff notacolor #000');
    expect(scale.steps.map((s) => s.hex)).toEqual(['#ffffff', '#000000']);
  });

  it('throws when nothing parses', () => {
    expect(() => parseColorList('nope, still nope')).toThrow(/No valid color values/);
  });
});

describe('parseW3CTokens still works alongside the new helpers', () => {
  it('parses a minimal W3C color group', () => {
    const json = JSON.stringify({
      blue: {
        '500': { $type: 'color', $value: '#3b82f6' },
        '700': { $type: 'color', $value: '#1d4ed8' },
      },
    });
    const scales = parseW3CTokens(json);
    expect(scales).toHaveLength(1);
    expect(scales[0].steps).toHaveLength(2);
  });

  it('parses a plain nested hex map with no W3C token envelope', () => {
    const json = JSON.stringify({
      grayish: {
        '50': '#F4F9F3',
        '100': '#DEE4DE',
        '500': '#869089',
        '800': '#344339',
      },
    });
    const scales = parseW3CTokens(json);
    expect(scales).toHaveLength(1);
    expect(scales[0].name).toBe('grayish');
    expect(scales[0].steps).toHaveLength(4);
    expect(scales[0].steps.map((s) => s.name)).toEqual(['50', '100', '500', '800']);
    expect(scales[0].steps[0].hex.toLowerCase()).toBe('#f4f9f3');
  });

  it('parses multiple plain nested hex-map scales', () => {
    const json = JSON.stringify({
      grayish: { '50': '#F4F9F3', '500': '#869089' },
      blue: { '50': '#eff6ff', '500': '#3b82f6' },
    });
    const scales = parseW3CTokens(json);
    expect(scales).toHaveLength(2);
    expect(scales.map((s) => s.name).sort()).toEqual(['blue', 'grayish']);
  });
});
