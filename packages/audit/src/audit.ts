import { randomUUID } from 'node:crypto';
import type { DtcgContainer, ProjectConfig } from '@pigmint/core';
import { runCheckers } from './checkers.js';
import { generateSuggestions } from './suggestions.js';
import type { AuditReport, AuditInputs, Violation } from './types.js';

function summarize(violations: Violation[], tokensAudited: number): AuditReport['summary'] {
  const counts = { error: 0, warning: 0, info: 0 };
  for (const v of violations) counts[v.severity] += 1;
  return {
    violations: counts,
    tokensAudited,
    tokensUsed: 0,
    surfacePairsObserved: 0,
    coverage: { tokenUsage: 0 },
  };
}

function buildRunId(now: Date): string {
  const ts = now.toISOString().replace(/[:.]/g, '-');
  return `${ts}-${randomUUID().slice(0, 6)}`;
}

export interface AuditDtcgInputs extends AuditInputs {
  container: DtcgContainer;
  projectConfig: ProjectConfig;
}

export function auditContainer(inputs: AuditDtcgInputs): AuditReport {
  const now = inputs.now ?? new Date();
  const profile = inputs.profile ?? 'wcag-srgb';
  const expectedModes = inputs.projectConfig.engine.modes;

  const { violations, tokens } = runCheckers({
    container: inputs.container,
    target: inputs.projectConfig.engine.target,
    expectedModes,
  });

  const runId = buildRunId(now);
  const { annotated, top } = generateSuggestions(violations, runId);

  return {
    $schema: 'https://pigmint.dev/schema/audit-report-0.1.json',
    artifactVersion: 'audit-report@0.1',
    run: {
      id: runId,
      timestamp: now.toISOString(),
      engineVersion: inputs.engineVersion,
      auditVersion: inputs.auditVersion ?? '0.0.0',
      dtcgSource: inputs.dtcgSource,
      builtSource: '',
      profile,
    },
    summary: summarize(annotated, tokens.length),
    violations: annotated,
    suggestions: top,
    observations: { undeclaredSurfacePairs: [] },
  };
}
