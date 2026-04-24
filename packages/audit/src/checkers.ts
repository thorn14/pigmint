import type { ComplianceLevel, ComplianceTarget, DtcgContainer } from '@pigmint/core';
import type { Violation } from './types.js';
import { collectSemanticTokens, type AuditToken } from './walker.js';

// ADR-011 Option A: path-implied context for detecting mixed-usage declarations.
// Segments are matched against dot-split token paths under `color.*`.
type PathContext = 'text' | 'nonText' | 'decorative';
interface PathRule {
  match: (segments: string[]) => boolean;
  context: PathContext;
}
const PATH_RULES: PathRule[] = [
  { match: (s) => s[0] === 'decorative', context: 'decorative' },
  { match: (s) => s[0] === 'foreground', context: 'text' },
  { match: (s) => s[0] === 'surface', context: 'nonText' },
  { match: (s) => s[0] === 'border', context: 'nonText' },
  { match: (s) => s[0] === 'focus', context: 'nonText' },
  { match: (s) => s.at(-1) === 'text' || s.at(-1) === 'label', context: 'text' },
  {
    match: (s) => s.at(-1) === 'background' || s.at(-1) === 'border',
    context: 'nonText',
  },
];

function pathContextFor(tokenPath: string): PathContext | null {
  const segments = tokenPath.split('.').filter((s) => s !== 'color');
  for (const rule of PATH_RULES) {
    if (rule.match(segments)) return rule.context;
  }
  return null;
}

const LEVEL_RANK: Record<ComplianceLevel, number> = {
  'AAA-text': 4,
  'AAA-nonText': 3,
  'AA-text': 2,
  'AA-nonText': 1,
  'apca-pass': 3,
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
    const implied = pathContextFor(token.path);
    if (implied && implied !== token.usage) {
      violations.push({
        severity: 'warning',
        type: 'mixed-usage',
        token: token.path,
        expected: { usage: implied, source: 'path-convention' },
        actual: { usage: token.usage, source: 'vocabulary-declaration' },
      });
    }

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
      if (compliance.level === 'apca-pass' || compliance.apcaLc) continue;

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
