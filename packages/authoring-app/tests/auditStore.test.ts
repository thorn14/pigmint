import { beforeEach, describe, expect, it } from 'vitest';
import type { AuditReport, Suggestion, Violation } from '@pigmint/audit';

const memoryStore = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  get length() {
    return memoryStore.size;
  },
  clear: () => memoryStore.clear(),
  getItem: (key: string) => memoryStore.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memoryStore.set(key, value);
  },
  removeItem: (key: string) => {
    memoryStore.delete(key);
  },
  key: (index: number) => Array.from(memoryStore.keys())[index] ?? null,
};

const { groupByToken, useAuditStore } = await import('../src/store/auditStore');

const SAMPLE_VIOLATION: Violation = {
  severity: 'error',
  type: 'contrast.textAA',
  token: 'color.foreground.main',
  mode: 'light',
  actual: { ratio: 3.8 },
  expected: { ratio: 4.5 },
};

const SAMPLE_SUGGESTION: Suggestion = {
  id: 'sugg-1',
  channel: 'intent-refinement',
  target: 'color.foreground.main',
  rationale: 'Lift to AAA or switch preference to highest-contrast.',
  confidence: 'high',
  change: {
    field: 'defaultIntent.preference',
    op: 'replace',
    value: 'highest-contrast',
  },
};

const SAMPLE_REPORT: AuditReport = {
  artifactVersion: 'audit-report@0.1',
  run: {
    id: 'run-abc',
    timestamp: '2026-04-23T12:00:00.000Z',
    dtcgSource: 'tokens.json',
    builtSource: 'dist/tokens.css',
    profile: 'wcag-srgb',
  },
  summary: {
    violations: { error: 1, warning: 0, info: 0 },
    tokensAudited: 12,
    tokensUsed: 10,
    surfacePairsObserved: 3,
    coverage: { tokenUsage: 0.83 },
  },
  violations: [SAMPLE_VIOLATION],
  suggestions: [SAMPLE_SUGGESTION],
  observations: { undeclaredSurfacePairs: [] },
};

beforeEach(() => {
  localStorage.clear();
  useAuditStore.getState().clearReport();
});

describe('auditStore', () => {
  it('loadReport sets state and resets statuses', () => {
    useAuditStore.getState().setStatus('stale', 'accepted');
    useAuditStore.getState().loadReport(SAMPLE_REPORT);
    const state = useAuditStore.getState();
    expect(state.report?.run.id).toBe('run-abc');
    expect(state.status).toEqual({});
  });

  it('loadReportFromText parses valid JSON and flags invalid payloads', () => {
    const ok = useAuditStore.getState().loadReportFromText(JSON.stringify(SAMPLE_REPORT));
    expect(ok.ok).toBe(true);
    expect(useAuditStore.getState().report?.run.id).toBe('run-abc');

    const badJson = useAuditStore.getState().loadReportFromText('not json');
    expect(badJson.ok).toBe(false);

    const wrongShape = useAuditStore
      .getState()
      .loadReportFromText(JSON.stringify({ artifactVersion: 'other@1', violations: [], suggestions: [] }));
    expect(wrongShape.ok).toBe(false);
  });

  it('setStatus persists per-suggestion state across store reads', () => {
    useAuditStore.getState().loadReport(SAMPLE_REPORT);
    useAuditStore.getState().setStatus(SAMPLE_SUGGESTION.id, 'accepted');
    expect(useAuditStore.getState().status[SAMPLE_SUGGESTION.id]).toBe('accepted');

    useAuditStore.getState().setStatus(SAMPLE_SUGGESTION.id, 'rejected');
    expect(useAuditStore.getState().status[SAMPLE_SUGGESTION.id]).toBe('rejected');
  });

  it('resetStatuses clears per-suggestion map', () => {
    useAuditStore.getState().loadReport(SAMPLE_REPORT);
    useAuditStore.getState().setStatus(SAMPLE_SUGGESTION.id, 'accepted');
    useAuditStore.getState().resetStatuses();
    expect(useAuditStore.getState().status).toEqual({});
  });

  it('clearReport wipes report and statuses', () => {
    useAuditStore.getState().loadReport(SAMPLE_REPORT);
    useAuditStore.getState().setStatus(SAMPLE_SUGGESTION.id, 'accepted');
    useAuditStore.getState().clearReport();
    const state = useAuditStore.getState();
    expect(state.report).toBeNull();
    expect(state.status).toEqual({});
  });

  it('persists round-trip via localStorage on reload', () => {
    useAuditStore.getState().loadReport(SAMPLE_REPORT);
    useAuditStore.getState().setStatus(SAMPLE_SUGGESTION.id, 'accepted');
    const raw = localStorage.getItem('pigmint:audit:v1');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.report.run.id).toBe('run-abc');
    expect(parsed.status[SAMPLE_SUGGESTION.id]).toBe('accepted');
  });
});

describe('groupByToken', () => {
  it('returns [] for null report', () => {
    expect(groupByToken(null)).toEqual([]);
  });

  it('groups violations and suggestions sharing a token path', () => {
    const grouped = groupByToken(SAMPLE_REPORT);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].tokenPath).toBe('color.foreground.main');
    expect(grouped[0].violations).toHaveLength(1);
    expect(grouped[0].suggestions).toHaveLength(1);
  });

  it('merges violation.suggestion and top-level suggestions without duplication', () => {
    const report: AuditReport = {
      ...SAMPLE_REPORT,
      violations: [{ ...SAMPLE_VIOLATION, suggestion: SAMPLE_SUGGESTION }],
      suggestions: [SAMPLE_SUGGESTION],
    };
    const grouped = groupByToken(report);
    expect(grouped[0].suggestions).toHaveLength(1);
  });

  it('sorts groups alphabetically by token path', () => {
    const v2: Violation = { ...SAMPLE_VIOLATION, token: 'color.background.main' };
    const v3: Violation = { ...SAMPLE_VIOLATION, token: 'color.accent.500' };
    const grouped = groupByToken({
      ...SAMPLE_REPORT,
      violations: [SAMPLE_VIOLATION, v2, v3],
      suggestions: [],
    });
    expect(grouped.map((g) => g.tokenPath)).toEqual([
      'color.accent.500',
      'color.background.main',
      'color.foreground.main',
    ]);
  });
});
