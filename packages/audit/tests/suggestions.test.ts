import { describe, it, expect } from 'vitest';
import { generateSuggestions, suggestionForViolation } from '../src/suggestions.js';
import type { Violation } from '../src/types.js';

const RUN_ID = 'run-2026-04-19-test';

function v(overrides: Partial<Violation> = {}): Violation {
  return {
    severity: 'error',
    type: 'contrast-failure',
    token: 'color.action.primary.background',
    ...overrides,
  };
}

describe('suggestionForViolation', () => {
  it('emits an intent-refinement suggestion for contrast-failure', () => {
    const s = suggestionForViolation(v({ mode: 'dark' }), RUN_ID);
    expect(s).not.toBeNull();
    expect(s!.channel).toBe('intent-refinement');
    expect(s!.change.field).toBe('defaultIntent.preference');
    expect(s!.change.value).toBe('highest-contrast');
    expect(s!.target).toBe('color.action.primary.background');
  });

  it('emits a suggestion for contrast-under-target', () => {
    const s = suggestionForViolation(
      v({ severity: 'warning', type: 'contrast-under-target' }),
      RUN_ID,
    );
    expect(s).not.toBeNull();
    expect(s!.channel).toBe('intent-refinement');
  });

  it('returns null for missing-mode violations', () => {
    const s = suggestionForViolation(
      v({ type: 'missing-mode', mode: 'dark' }),
      RUN_ID,
    );
    expect(s).toBeNull();
  });

  it('produces stable ids for the same violation + run', () => {
    const a = suggestionForViolation(v(), RUN_ID);
    const b = suggestionForViolation(v(), RUN_ID);
    expect(a!.id).toBe(b!.id);
  });
});

describe('generateSuggestions', () => {
  it('annotates violations and returns deduped top-level suggestions', () => {
    const violations: Violation[] = [
      v({ mode: 'light' }),
      v({ mode: 'dark' }),
      v({ type: 'missing-mode', mode: 'dark' }),
    ];
    const { annotated, top } = generateSuggestions(violations, RUN_ID);
    expect(annotated).toHaveLength(3);
    expect(annotated[0]!.suggestion).toBeDefined();
    expect(annotated[1]!.suggestion).toBeDefined();
    expect(annotated[2]!.suggestion).toBeUndefined();
    expect(top).toHaveLength(2);
  });
});
