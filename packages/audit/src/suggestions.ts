import { createHash } from 'node:crypto';
import type { Suggestion, Violation } from './types.js';

function suggestionId(violation: Violation, runId: string): string {
  const input = `${runId}:${violation.type}:${violation.token}:${violation.mode ?? ''}`;
  return `sug-${createHash('sha1').update(input).digest('hex').slice(0, 10)}`;
}

export function suggestionForViolation(
  violation: Violation,
  runId: string,
): Suggestion | null {
  if (
    violation.type !== 'contrast-failure' &&
    violation.type !== 'contrast-under-target'
  ) {
    return null;
  }

  const expectedLevel = violation.expected?.level;
  const actualRatio = violation.actual?.ratio;
  const mode = violation.mode ? ` in mode ${violation.mode}` : '';
  const rationale =
    violation.type === 'contrast-failure'
      ? `Token ${violation.token} fails required contrast${mode} (actual ${actualRatio ?? 'n/a'}:1). Switching preference to "highest-contrast" steers the resolver to the darkest/lightest passing step.`
      : `Token ${violation.token} passes ${violation.actual?.level ?? 'a lower level'} but target requires ${expectedLevel}${mode}. "highest-contrast" preference increases the margin.`;

  return {
    id: suggestionId(violation, runId),
    channel: 'intent-refinement',
    target: violation.token,
    rationale,
    change: {
      field: 'defaultIntent.preference',
      op: 'replace',
      value: 'highest-contrast',
    },
    confidence: violation.type === 'contrast-failure' ? 'medium' : 'medium',
  };
}

export function generateSuggestions(
  violations: Violation[],
  runId: string,
): { annotated: Violation[]; top: Suggestion[] } {
  const annotated: Violation[] = [];
  const bySuggestionId = new Map<string, Suggestion>();

  for (const v of violations) {
    const suggestion = suggestionForViolation(v, runId);
    if (!suggestion) {
      annotated.push(v);
      continue;
    }
    annotated.push({ ...v, suggestion });
    if (!bySuggestionId.has(suggestion.id)) {
      bySuggestionId.set(suggestion.id, suggestion);
    }
  }

  return { annotated, top: Array.from(bySuggestionId.values()) };
}
