import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { AuditReport, Suggestion, Violation } from '@pigmint/audit';

const STORAGE_KEY = 'pigmint:audit:v1';
const REPORT_VERSION = 'audit-report@0.1';

export type SuggestionStatus = 'pending' | 'accepted' | 'rejected';

export interface PersistedAuditState {
  report: AuditReport | null;
  status: Record<string, SuggestionStatus>;
}

interface AuditState extends PersistedAuditState {}

interface AuditActions {
  loadReport: (report: AuditReport) => void;
  loadReportFromText: (text: string) => { ok: true } | { ok: false; error: string };
  clearReport: () => void;
  setStatus: (suggestionId: string, status: SuggestionStatus) => void;
  resetStatuses: () => void;
}

const DEFAULT_STATE: PersistedAuditState = { report: null, status: {} };

function loadFromStorage(): PersistedAuditState {
  if (typeof localStorage === 'undefined') return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      (parsed.report === null ||
        (typeof parsed.report === 'object' &&
          parsed.report?.artifactVersion === REPORT_VERSION))
    ) {
      return {
        report: parsed.report ?? null,
        status:
          parsed.status && typeof parsed.status === 'object'
            ? (parsed.status as Record<string, SuggestionStatus>)
            : {},
      };
    }
  } catch {
    /* corrupt — ignore */
  }
  return DEFAULT_STATE;
}

function persist(state: PersistedAuditState) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ report: state.report, status: state.status }),
    );
  } catch {
    /* quota/privacy — drop */
  }
}

function isAuditReport(value: unknown): value is AuditReport {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as AuditReport).artifactVersion === REPORT_VERSION &&
    Array.isArray((value as AuditReport).violations) &&
    Array.isArray((value as AuditReport).suggestions)
  );
}

export const useAuditStore = create<AuditState & AuditActions>()(
  immer((set) => ({
    ...loadFromStorage(),

    loadReport: (report) =>
      set((state) => {
        state.report = report;
        state.status = {};
        persist({ report: state.report, status: state.status });
      }),

    loadReportFromText: (text) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        return { ok: false, error: `JSON parse failed: ${(err as Error).message}` };
      }
      if (!isAuditReport(parsed)) {
        return {
          ok: false,
          error: `Expected an audit-report@0.1 JSON document (missing or mismatched artifactVersion).`,
        };
      }
      set((state) => {
        state.report = parsed;
        state.status = {};
        persist({ report: state.report, status: state.status });
      });
      return { ok: true };
    },

    clearReport: () =>
      set((state) => {
        state.report = null;
        state.status = {};
        persist({ report: null, status: {} });
      }),

    setStatus: (suggestionId, status) =>
      set((state) => {
        state.status[suggestionId] = status;
        persist({ report: state.report, status: state.status });
      }),

    resetStatuses: () =>
      set((state) => {
        state.status = {};
        persist({ report: state.report, status: {} });
      }),
  })),
);

export interface GroupedEntry {
  tokenPath: string;
  violations: Violation[];
  suggestions: Suggestion[];
}

export function groupByToken(report: AuditReport | null): GroupedEntry[] {
  if (!report) return [];
  const map = new Map<string, GroupedEntry>();
  for (const violation of report.violations) {
    const entry = map.get(violation.token) ?? {
      tokenPath: violation.token,
      violations: [],
      suggestions: [],
    };
    entry.violations.push(violation);
    if (violation.suggestion) {
      entry.suggestions.push(violation.suggestion);
    }
    map.set(violation.token, entry);
  }
  for (const suggestion of report.suggestions) {
    const entry = map.get(suggestion.target) ?? {
      tokenPath: suggestion.target,
      violations: [],
      suggestions: [],
    };
    if (!entry.suggestions.some((s) => s.id === suggestion.id)) {
      entry.suggestions.push(suggestion);
    }
    map.set(suggestion.target, entry);
  }
  return Array.from(map.values()).sort((a, b) => a.tokenPath.localeCompare(b.tokenPath));
}
