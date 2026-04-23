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

  it('rejects apca compliance with a clear error', () => {
    const raw = {
      ...minimalValid,
      engine: { ...minimalValid.engine, compliance: 'apca' },
    };
    expect(() => validateProjectConfig(raw, '/tmp/p.yaml')).toThrow(ConfigError);
    try {
      validateProjectConfig(raw, '/tmp/p.yaml');
    } catch (err) {
      expect((err as Error).message).toMatch(/engine\.compliance/);
      expect((err as Error).message).toMatch(/OQ-12/);
    }
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
});
