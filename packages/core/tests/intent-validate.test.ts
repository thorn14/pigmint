import { describe, it, expect } from 'vitest';
import { assertValidFormalIntent } from '../src/resolver/intent-validate.js';
import type { FormalIntent } from '../src/index.js';

const baseIntent: Omit<FormalIntent, 'preference' | 'consistency'> = {
  threshold: { kind: 'wcag', level: 'AA', usage: 'text' },
  surfaceContext: 'primary',
};

describe('assertValidFormalIntent', () => {
  for (const preference of ['midpoint', 'median', 'level-up'] as const) {
    it(`rejects ${preference} + matched-across-ramps`, () => {
      const intent: FormalIntent = {
        ...baseIntent,
        preference,
        consistency: 'matched-across-ramps',
      };
      expect(() => assertValidFormalIntent('color.x', intent)).toThrow(
        /cannot pair with "matched-across-ramps"/,
      );
    });

    it(`accepts ${preference} + independent`, () => {
      const intent: FormalIntent = {
        ...baseIntent,
        preference,
        consistency: 'independent',
      };
      expect(() => assertValidFormalIntent('color.x', intent)).not.toThrow();
    });
  }
});
