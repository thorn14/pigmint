import { describe, expect, it } from 'vitest';
import {
  parsePigmintPrimitives,
  parsePigmintYaml,
  serializePigmintYaml,
} from '../src/lib/pigmintYaml';
import type { ColorScale } from '../src/types/palette';

function scale(id: string, name: string, sourceHex: string): ColorScale {
  return {
    id,
    name,
    sourceHex,
    sourceOklch: { l: 0.5, c: 0.1, h: 200 },
    sourceAlpha: 1,
    stepCount: 11,
    naming: { preset: 'tailwind' },
    curves: {
      lightness: { values: [] },
      chroma: { values: [] },
      hue: { values: [] },
    },
    hueShift: { lightEndAdjust: 0, darkEndAdjust: 0 },
    lightnessPreset: 'tailwind',
    chromaPeak: 0.2,
  };
}

describe('pigmintYaml', () => {
  it('serializes ramps as {name, source}', () => {
    const yaml = serializePigmintYaml({
      scales: [scale('1', 'blue', '#3366cc'), scale('2', 'neutral', '#888888')],
      intents: {},
    });
    expect(yaml).toContain('name: blue');
    expect(yaml).toContain('source: "#3366cc"');
    expect(yaml).toContain('name: neutral');
    expect(yaml).not.toContain('intents:');
  });

  it('emits engine block with defaults', () => {
    const yaml = serializePigmintYaml({
      scales: [scale('1', 'blue', '#3366cc')],
      intents: {},
    });
    expect(yaml).toContain('engine:');
    expect(yaml).toContain('compliance: wcag21');
    expect(yaml).toContain('target: AA');
  });

  it('emits engine.target override', () => {
    const yaml = serializePigmintYaml({
      scales: [scale('1', 'blue', '#3366cc')],
      intents: {},
      engine: { target: 'AAA', compliance: 'apca' },
    });
    expect(yaml).toContain('compliance: apca');
    expect(yaml).toContain('target: AAA');
  });

  it('emits engine.cvd and engine.resolver when provided', () => {
    const yaml = serializePigmintYaml({
      scales: [scale('1', 'blue', '#3366cc')],
      intents: {},
      engine: {
        cvd: ['deuteranopia', 'tritanopia'],
        resolver: { mode: 'continuous', fallbackSteps: 128 },
      },
    });
    expect(yaml).toContain('cvd:');
    expect(yaml).toContain('- deuteranopia');
    expect(yaml).toContain('- tritanopia');
    expect(yaml).toContain('resolver:');
    expect(yaml).toContain('mode: continuous');
    expect(yaml).toContain('fallbackSteps: 128');
  });

  it('emits intents block when overrides are present', () => {
    const yaml = serializePigmintYaml({
      scales: [scale('1', 'blue', '#3366cc')],
      intents: { 'color.foreground.main': { preference: 'highest-contrast' } },
    });
    expect(yaml).toContain('intents:');
    expect(yaml).toContain('color.foreground.main');
    expect(yaml).toContain('preference: highest-contrast');
  });

  it('parses a minimal pigmint.yaml into ramps + engine', () => {
    const text = [
      'engine:',
      '  compliance: wcag21',
      '  target: AA',
      '  modes: [light]',
      'ramps:',
      '  - name: blue',
      '    source: "#3366cc"',
      'output:',
      '  dtcg: ./tokens.json',
    ].join('\n');

    const parsed = parsePigmintYaml(text);
    expect(parsed.scales).toHaveLength(1);
    expect(parsed.scales[0].name).toBe('blue');
    expect(parsed.scales[0].sourceHex.toLowerCase()).toBe('#3366cc');
    expect(parsed.intents).toEqual({});
    expect(parsed.engine.target).toBe('AA');
    expect(parsed.engine.compliance).toBe('wcag21');
  });

  it('round-trips ramps, engine, and intents', () => {
    const input = [scale('1', 'blue', '#3366cc')];
    const intents = { 'color.foreground.main': { preference: 'anchored' as const } };
    const yaml = serializePigmintYaml({
      scales: input,
      intents,
      engine: {
        target: 'AAA',
        compliance: 'apca',
        cvd: ['deuteranopia'],
        resolver: { mode: 'continuous', fallbackSteps: 64 },
      },
    });
    const parsed = parsePigmintYaml(yaml);
    expect(parsed.scales[0].name).toBe('blue');
    expect(parsed.scales[0].sourceHex.toLowerCase()).toBe('#3366cc');
    expect(parsed.intents['color.foreground.main']).toEqual({ preference: 'anchored' });
    expect(parsed.engine.target).toBe('AAA');
    expect(parsed.engine.compliance).toBe('apca');
    expect(parsed.engine.cvd).toEqual(['deuteranopia']);
    expect(parsed.engine.resolver).toEqual({ mode: 'continuous', fallbackSteps: 64 });
  });

  it('rejects ramps with missing source', () => {
    const text = 'ramps:\n  - name: blue\n';
    expect(() => parsePigmintYaml(text)).toThrow();
  });

  it('rejects invalid source colors', () => {
    const text = 'ramps:\n  - name: blue\n    source: "not-a-color"\n';
    expect(() => parsePigmintYaml(text)).toThrow();
  });

  it('rejects fromFile ramps when no primitives are provided', () => {
    const text = 'ramps:\n  - name: brand\n    fromFile: ./primitives.json\n';
    expect(() => parsePigmintYaml(text)).toThrow(/fromFile/);
  });

  it('resolves fromFile ramps from a paired primitives map', () => {
    const yaml = [
      'ramps:',
      '  - name: brand',
      '    fromFile: ./primitives.json',
      '  - name: blue',
      '    source: "#3366cc"',
    ].join('\n');
    const primitivesJson = JSON.stringify({
      primitive: {
        brand: {
          $type: 'color',
          '50': { $value: { hex: '#fafafa' } },
          '500': { $value: { hex: '#7c3aed' } },
          '900': { $value: { hex: '#1f0a4a' } },
        },
      },
    });
    const primitives = parsePigmintPrimitives(primitivesJson);
    const parsed = parsePigmintYaml(yaml, { primitives });
    expect(parsed.scales).toHaveLength(2);
    const brand = parsed.scales[0]!;
    expect(brand.name).toBe('brand');
    expect(brand.steps.map((s) => s.name)).toEqual(['50', '500', '900']);
    expect(brand.steps.map((s) => s.hex)).toEqual(['#fafafa', '#7c3aed', '#1f0a4a']);
    expect(brand.sourceHex).toBe('#7c3aed');
    const blue = parsed.scales[1]!;
    expect(blue.name).toBe('blue');
    expect(blue.sourceHex).toBe('#3366cc');
  });

  it('round-trips engine.resolver.materializeInterpolatedPrimitives', () => {
    const scales = [scale('1', 'blue', '#3366cc')];
    const yaml = serializePigmintYaml({
      scales,
      intents: {},
      engine: {
        resolver: { mode: 'continuous', materializeInterpolatedPrimitives: false },
      },
    });
    const parsed = parsePigmintYaml(yaml);
    expect(parsed.engine.resolver).toEqual({
      mode: 'continuous',
      materializeInterpolatedPrimitives: false,
    });
  });

  it('emits engine.modes in canonical order and filters duplicates', () => {
    const yaml = serializePigmintYaml({
      scales: [scale('1', 'blue', '#3366cc')],
      intents: {},
      engine: { modes: ['dark', 'light', 'dark-high-contrast'] },
    });
    expect(yaml).toContain('- dark');
    expect(yaml).toContain('- light');
    expect(yaml).toContain('- dark-high-contrast');
  });

  it('parses known modes and drops unknown ones', () => {
    const text = [
      'engine:',
      '  compliance: wcag21',
      '  target: AA',
      '  modes:',
      '    - light',
      '    - dark',
      '    - bogus',
      'ramps:',
      '  - name: blue',
      '    source: "#3366cc"',
    ].join('\n');
    const parsed = parsePigmintYaml(text);
    expect(parsed.engine.modes).toEqual(['light', 'dark']);
  });

  it('falls back to [light] when parsed modes are all unknown', () => {
    const text = [
      'engine:',
      '  compliance: wcag21',
      '  target: AA',
      '  modes: [bogus, also-bogus]',
      'ramps:',
      '  - name: blue',
      '    source: "#3366cc"',
    ].join('\n');
    const parsed = parsePigmintYaml(text);
    expect(parsed.engine.modes).toEqual(['light', 'dark']);
  });

  it('parses known cvd profiles and sanitizes resolver config', () => {
    const text = [
      'engine:',
      '  compliance: wcag21',
      '  target: AA',
      '  modes: [light]',
      '  cvd:',
      '    - deuteranopia',
      '    - bogus',
      '  resolver:',
      '    mode: continuous',
      '    fallbackSteps: 95.5',
      'ramps:',
      '  - name: blue',
      '    source: "#3366cc"',
    ].join('\n');
    const parsed = parsePigmintYaml(text);
    expect(parsed.engine.cvd).toEqual(['deuteranopia']);
    expect(parsed.engine.resolver).toEqual({ mode: 'continuous', fallbackSteps: 95 });
  });
});
