import { describe, expect, it } from 'vitest';
import { ConfigError, validateProjectConfig } from '../src/config.js';

const minimalValid = {
  engine: { compliance: 'wcag21', target: 'AA', modes: ['light'] },
  ramps: [{ name: 'neutral', source: '#888' }],
  output: { dtcg: './tokens.json' },
};

describe('validateProjectConfig', () => {
  it('accepts wcag21 compliance', () => {
    expect(() => validateProjectConfig(minimalValid, '/tmp/p.yaml')).not.toThrow();
  });

  it('accepts apca compliance', () => {
    const raw = {
      ...minimalValid,
      engine: { ...minimalValid.engine, compliance: 'apca' },
    };
    expect(() => validateProjectConfig(raw, '/tmp/p.yaml')).not.toThrow();
  });

  it('rejects unknown compliance values', () => {
    const raw = {
      ...minimalValid,
      engine: { ...minimalValid.engine, compliance: 'wcag22' },
    };
    expect(() => validateProjectConfig(raw, '/tmp/p.yaml')).toThrow(
      /engine\.compliance/,
    );
  });

  it('accepts known engine.cvd profiles', () => {
    const raw = {
      ...minimalValid,
      engine: {
        ...minimalValid.engine,
        cvd: ['deuteranopia', 'tritanopia'],
      },
    };
    expect(() => validateProjectConfig(raw, '/tmp/p.yaml')).not.toThrow();
  });

  it('rejects unknown engine.cvd profiles', () => {
    const raw = {
      ...minimalValid,
      engine: {
        ...minimalValid.engine,
        cvd: ['deuteranopia', 'bogus'],
      },
    };
    expect(() => validateProjectConfig(raw, '/tmp/p.yaml')).toThrow(
      /engine\.cvd/,
    );
  });

  it('accepts valid resolver config', () => {
    const raw = {
      ...minimalValid,
      engine: {
        ...minimalValid.engine,
        resolver: { mode: 'continuous', fallbackSteps: 128 },
      },
    };
    expect(() => validateProjectConfig(raw, '/tmp/p.yaml')).not.toThrow();
  });

  it('accepts ramp with inline curve fields', () => {
    const raw = {
      ...minimalValid,
      ramps: [
        {
          name: 'blue',
          source: '#2563eb',
          stepCount: 11,
          naming: 'tailwind',
          curves: {
            lightness: [0.98,0.95,0.88,0.78,0.68,0.55,0.44,0.35,0.28,0.20,0.12],
            chroma:    [0.03,0.06,0.10,0.15,0.18,0.20,0.18,0.15,0.12,0.08,0.04],
            hue:       [250,252,253,253,255,255,255,255,254,253,252],
            smoothing: 0.5,
          },
          hueShift: { lightEnd: 5, darkEnd: -3 },
          chromaPeak: 0.20,
          chromaLow: 0.03,
          chromaHigh: 0.04,
        },
      ],
    };
    expect(() => validateProjectConfig(raw, '/tmp/p.yaml')).not.toThrow();
  });

  it('rejects stepCount out of range', () => {
    const raw = {
      ...minimalValid,
      ramps: [{ name: 'x', source: '#888', stepCount: 1 }],
    };
    expect(() => validateProjectConfig(raw, '/tmp/p.yaml')).toThrow(/stepCount/);
  });

  it('rejects curves array with wrong length', () => {
    const raw = {
      ...minimalValid,
      ramps: [
        {
          name: 'x',
          source: '#888',
          stepCount: 5,
          curves: { lightness: [0.9, 0.7, 0.5] }, // length 3, not 5
        },
      ],
    };
    expect(() => validateProjectConfig(raw, '/tmp/p.yaml')).toThrow(/curves\.lightness/);
  });

  it('rejects invalid hueShift value', () => {
    const raw = {
      ...minimalValid,
      ramps: [{ name: 'x', source: '#888', hueShift: { lightEnd: 999 } }],
    };
    expect(() => validateProjectConfig(raw, '/tmp/p.yaml')).toThrow(/hueShift\.lightEnd/);
  });

  it('rejects negative chromaPeak', () => {
    const raw = {
      ...minimalValid,
      ramps: [{ name: 'x', source: '#888', chromaPeak: -0.1 }],
    };
    expect(() => validateProjectConfig(raw, '/tmp/p.yaml')).toThrow(/chromaPeak/);
  });
});
