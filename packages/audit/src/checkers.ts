import type { ComplianceLevel, ComplianceTarget, DtcgContainer } from '@pigmint/core';
import type { Violation } from './types.js';
import { collectSemanticTokens, type AuditToken } from './walker.js';

const LEVEL_RANK: Record<ComplianceLevel, number> = {
  'AAA-text': 4,
  'AAA-nonText': 3,
  'AA-text': 2,
  'AA-nonText': 1,
  fail: 0,
  exempt: 5,
};

function requiredLevelFor(
  usage: AuditToken['usage'],
  target: ComplianceTarget,
): ComplianceLevel | null {
  if (usage === 'decorative') return null;
  if (usage === 'text') return target === 'AAA' ? 'AAA-text' : 'AA-text';
  return target === 'AAA' ? 'AAA-nonText' : 'AA-nonText';
}

function declaredModes(container: DtcgContainer): string[] {
  const pig = container.$extensions['com.pigmint'];
  return pig.defaultMode ? uniq([pig.defaultMode]) : [];
}

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

export interface CheckInputs {
  container: DtcgContainer;
  target: ComplianceTarget;
  expectedModes: string[];
}

export function runCheckers(inputs: CheckInputs): {
  violations: Violation[];
  tokens: AuditToken[];
} {
  const tokens = collectSemanticTokens(inputs.container);
  const expectedModes = inputs.expectedModes.length
    ? inputs.expectedModes
    : declaredModes(inputs.container);

  const violations: Violation[] = [];

  for (const token of tokens) {
    for (const mode of expectedModes) {
      const entry = token.modes[mode];
      if (!entry) {
        violations.push({
          severity: 'error',
          type: 'missing-mode',
          token: token.path,
          mode,
          expected: { mode },
        });
        continue;
      }

      if (token.usage === 'decorative') continue;
      const compliance = entry.compliance;
      if (!compliance) continue;

      if (compliance.level === 'fail') {
        violations.push({
          severity: 'error',
          type: 'contrast-failure',
          token: token.path,
          mode,
          expected: {
            level: requiredLevelFor(token.usage, inputs.target),
            kind: 'wcag',
          },
          actual: {
            level: compliance.level,
            ratio: entry.contrast?.wcag21,
          },
        });
        continue;
      }
      if (compliance.level === 'exempt') continue;

      const required = requiredLevelFor(token.usage, inputs.target);
      if (!required) continue;
      if (LEVEL_RANK[compliance.level] < LEVEL_RANK[required]) {
        violations.push({
          severity: 'warning',
          type: 'contrast-under-target',
          token: token.path,
          mode,
          expected: { level: required, kind: 'wcag' },
          actual: {
            level: compliance.level,
            ratio: entry.contrast?.wcag21,
          },
        });
      }
    }
  }

  return { violations, tokens };
}
