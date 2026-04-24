import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type {
  AuditReport,
  Suggestion,
  Violation,
} from '@pigmint/audit';
import type { Consistency, Preference, SurfaceContext } from '@pigmint/core';
import {
  groupByToken,
  useAuditStore,
  type GroupedEntry,
  type SuggestionStatus,
} from '../../store/auditStore';
import { useIntentStore } from '../../store/intentStore';

type ApplyResult = { ok: true } | { ok: false; error: string };

function applySuggestion(suggestion: Suggestion): ApplyResult {
  const { change, target } = suggestion;
  if (change.op !== 'replace' && change.op !== 'add') {
    return { ok: false, error: `Unsupported op "${change.op}" — only add/replace land automatically.` };
  }
  const store = useIntentStore.getState();
  switch (change.field) {
    case 'defaultIntent.preference': {
      const value = change.value;
      if (!isPreference(value)) {
        return { ok: false, error: `Expected a Preference value, got ${JSON.stringify(value)}.` };
      }
      store.setPreference(target, value);
      return { ok: true };
    }
    case 'defaultIntent.consistency': {
      const value = change.value;
      if (!isConsistency(value)) {
        return { ok: false, error: `Expected a Consistency value, got ${JSON.stringify(value)}.` };
      }
      store.setConsistency(target, value);
      return { ok: true };
    }
    case 'defaultIntent.surfaceContext': {
      const value = change.value;
      if (!isSurfaceContext(value)) {
        return { ok: false, error: `Expected a SurfaceContext value, got ${JSON.stringify(value)}.` };
      }
      store.setSurfaceContext(target, value);
      return { ok: true };
    }
    default:
      return {
        ok: false,
        error: `No handler for field "${change.field}" — ramp and spec-gap channels don't auto-apply yet.`,
      };
  }
}

const PREFERENCES: readonly Preference[] = [
  'lowest-passing',
  'highest-contrast',
  'matched-to-set',
  'anchored',
];

const CONSISTENCIES: readonly Consistency[] = [
  'independent',
  'matched-across-ramps',
  'anchored-to-reference',
];

const SURFACE_CONTEXTS: readonly SurfaceContext[] = [
  'primary',
  'elevated',
  'inverse',
  'current',
];

function isPreference(x: unknown): x is Preference {
  return typeof x === 'string' && (PREFERENCES as readonly string[]).includes(x);
}
function isConsistency(x: unknown): x is Consistency {
  return typeof x === 'string' && (CONSISTENCIES as readonly string[]).includes(x);
}
function isSurfaceContext(x: unknown): x is SurfaceContext {
  return typeof x === 'string' && (SURFACE_CONTEXTS as readonly string[]).includes(x);
}

function severityColor(severity: Violation['severity']): string {
  if (severity === 'error') return '#d4574a';
  if (severity === 'warning') return '#e2a93a';
  return '#4a9bd4';
}

function statusColor(status: SuggestionStatus): string {
  if (status === 'accepted') return '#3ca86b';
  if (status === 'rejected') return '#8a8a8a';
  return '#e2a93a';
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function ReportHeader({ report, onClear }: { report: AuditReport; onClear: () => void }) {
  const { summary, run } = report;
  return (
    <div
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--p-border)',
        background: 'var(--p-bg-subtle)',
        display: 'flex',
        gap: 16,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--p-text)' }}>
          Run {run.id}
        </div>
        <div style={{ fontSize: 11, color: 'var(--p-text-tertiary)' }}>
          {formatTimestamp(run.timestamp)} · {run.profile}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Stat label="Errors" value={summary.violations.error} tone={severityColor('error')} />
        <Stat label="Warnings" value={summary.violations.warning} tone={severityColor('warning')} />
        <Stat label="Info" value={summary.violations.info} tone={severityColor('info')} />
        <Stat label="Tokens" value={summary.tokensAudited} tone="var(--p-text-secondary)" />
      </div>

      <div style={{ flex: 1 }} />

      <button
        type="button"
        onClick={onClear}
        className="focus-visible-ring"
        style={{
          padding: '4px 10px',
          fontSize: 11,
          background: 'transparent',
          border: '1px solid var(--p-border)',
          borderRadius: 4,
          color: 'var(--p-text-secondary)',
          cursor: 'pointer',
        }}
      >
        Clear report
      </button>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 6,
        padding: '4px 10px',
        border: '1px solid var(--p-border)',
        borderRadius: 6,
        background: 'var(--p-bg)',
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 700, color: tone }}>{value}</span>
      <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--p-text-tertiary)' }}>
        {label}
      </span>
    </div>
  );
}

function SuggestionRow({
  suggestion,
  status,
  onApply,
  onReject,
  onReset,
}: {
  suggestion: Suggestion;
  status: SuggestionStatus;
  onApply: () => void;
  onReject: () => void;
  onReset: () => void;
}) {
  const { change } = suggestion;
  const changeLabel =
    change.op === 'replace' || change.op === 'add'
      ? `${change.op} ${change.field} → ${JSON.stringify(change.value)}`
      : `${change.op} ${change.field}`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '10px 12px',
        border: '1px solid var(--p-border)',
        borderRadius: 6,
        background: 'var(--p-bg)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 999,
            background: statusColor(status),
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {status}
        </span>
        <span style={{ fontSize: 11, color: 'var(--p-text-tertiary)' }}>
          {suggestion.channel} · confidence {suggestion.confidence ?? 'n/a'}
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--p-text)' }}>{suggestion.rationale}</div>
      <div
        style={{
          fontFamily: 'monospace',
          fontSize: 11,
          color: 'var(--p-text-secondary)',
          padding: '4px 6px',
          background: 'var(--p-bg-inset)',
          borderRadius: 4,
          display: 'inline-block',
          alignSelf: 'flex-start',
        }}
      >
        {changeLabel}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
        {status === 'pending' && (
          <>
            <button
              type="button"
              onClick={onApply}
              className="focus-visible-ring"
              style={actionBtn('accent')}
            >
              Accept
            </button>
            <button
              type="button"
              onClick={onReject}
              className="focus-visible-ring"
              style={actionBtn('subtle')}
            >
              Reject
            </button>
          </>
        )}
        {status !== 'pending' && (
          <button
            type="button"
            onClick={onReset}
            className="focus-visible-ring"
            style={actionBtn('subtle')}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

function actionBtn(variant: 'accent' | 'subtle'): React.CSSProperties {
  if (variant === 'accent') {
    return {
      padding: '4px 12px',
      fontSize: 11,
      fontWeight: 600,
      background: 'var(--p-accent)',
      color: 'var(--p-accent-foreground, #fff)',
      border: 'none',
      borderRadius: 4,
      cursor: 'pointer',
    };
  }
  return {
    padding: '4px 12px',
    fontSize: 11,
    background: 'transparent',
    color: 'var(--p-text-secondary)',
    border: '1px solid var(--p-border)',
    borderRadius: 4,
    cursor: 'pointer',
  };
}

function TokenCard({
  entry,
  onApply,
  onReject,
  onReset,
}: {
  entry: GroupedEntry;
  onApply: (suggestionId: string) => void;
  onReject: (suggestionId: string) => void;
  onReset: (suggestionId: string) => void;
}) {
  const statusMap = useAuditStore((s) => s.status);

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 16,
        borderBottom: '1px solid var(--p-border)',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>
          {entry.tokenPath}
        </h3>
        <span style={{ fontSize: 11, color: 'var(--p-text-tertiary)' }}>
          {entry.violations.length} violation{entry.violations.length === 1 ? '' : 's'} ·{' '}
          {entry.suggestions.length} suggestion{entry.suggestions.length === 1 ? '' : 's'}
        </span>
      </header>

      {entry.violations.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {entry.violations.map((v, i) => (
            <li
              key={`${v.type}-${v.mode ?? 'base'}-${i}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 10px',
                borderRadius: 4,
                background: 'var(--p-bg-inset)',
                fontSize: 12,
                color: 'var(--p-text-secondary)',
              }}
            >
              <span
                style={{
                  padding: '1px 6px',
                  borderRadius: 3,
                  background: severityColor(v.severity),
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                {v.severity}
              </span>
              <span style={{ fontFamily: 'monospace' }}>{v.type}</span>
              {v.mode && (
                <span style={{ fontSize: 11, color: 'var(--p-text-tertiary)' }}>
                  mode: {v.mode}
                </span>
              )}
              {typeof v.actual?.ratio === 'number' && (
                <span style={{ fontSize: 11 }}>{(v.actual.ratio as number).toFixed(2)}:1</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {entry.suggestions.map((s) => (
          <SuggestionRow
            key={s.id}
            suggestion={s}
            status={statusMap[s.id] ?? 'pending'}
            onApply={() => onApply(s.id)}
            onReject={() => onReject(s.id)}
            onReset={() => onReset(s.id)}
          />
        ))}
        {entry.suggestions.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--p-text-tertiary)', fontStyle: 'italic' }}>
            No auto-applicable suggestions for this token.
          </div>
        )}
      </div>
    </section>
  );
}

function EmptyState({
  onOpenFile,
  lastError,
}: {
  onOpenFile: () => void;
  lastError: string | null;
}) {
  return (
    <div
      style={{
        padding: '40px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        alignItems: 'center',
        textAlign: 'center',
        maxWidth: 640,
        margin: '0 auto',
      }}
    >
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--p-text)' }}>
        Load an audit report
      </h2>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--p-text-secondary)', lineHeight: 1.5 }}>
        Run <code>pigmint audit</code> on a project to produce an audit-report@0.1 JSON file, then
        open it here to review suggestions and apply them to your intents. Suggestions flagged as
        <code> intent-refinement</code> can be applied in-place; <code>ramp-suggestion</code> and
        <code> spec-gap</code> channels surface read-only.
      </p>
      <button
        type="button"
        onClick={onOpenFile}
        className="focus-visible-ring"
        style={{
          padding: '8px 18px',
          fontSize: 12,
          fontWeight: 600,
          background: 'var(--p-accent)',
          color: 'var(--p-accent-foreground, #fff)',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
        }}
      >
        Open audit report…
      </button>
      {lastError && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 6,
            background: 'rgba(212, 87, 74, 0.12)',
            color: '#d4574a',
            fontSize: 12,
            border: '1px solid rgba(212, 87, 74, 0.4)',
          }}
        >
          {lastError}
        </div>
      )}
    </div>
  );
}

export function AuditIntegrator() {
  const report = useAuditStore((s) => s.report);
  const loadReportFromText = useAuditStore((s) => s.loadReportFromText);
  const clearReport = useAuditStore((s) => s.clearReport);
  const setStatus = useAuditStore((s) => s.setStatus);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const grouped = useMemo(() => groupByToken(report), [report]);

  function openFile() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const text = await file.text();
    const result = loadReportFromText(text);
    if (!result.ok) {
      setLastError(result.error);
      setLastMessage(null);
    } else {
      setLastError(null);
      setLastMessage(`Loaded ${file.name}.`);
    }
  }

  function handleApply(suggestionId: string) {
    const found = grouped
      .flatMap((g) => g.suggestions)
      .find((s) => s.id === suggestionId);
    if (!found) return;
    const result = applySuggestion(found);
    if (!result.ok) {
      setStatus(suggestionId, 'rejected');
      setLastError(result.error);
      setLastMessage(null);
      return;
    }
    setStatus(suggestionId, 'accepted');
    setLastError(null);
    setLastMessage(
      `Applied ${found.change.field} → ${JSON.stringify(found.change.value)} on ${found.target}.`,
    );
  }

  function handleReject(suggestionId: string) {
    setStatus(suggestionId, 'rejected');
    setLastMessage(null);
  }

  function handleReset(suggestionId: string) {
    setStatus(suggestionId, 'pending');
    setLastMessage(null);
  }

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        background: 'var(--p-bg)',
        color: 'var(--p-text)',
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 16px 12px',
          borderBottom: '1px solid var(--p-border)',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Audit</h2>
          <div style={{ fontSize: 11, color: 'var(--p-text-tertiary)', marginTop: 4 }}>
            Consume audit-report@0.1 JSON. Accept suggestions to update intents in place.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={openFile}
            className="focus-visible-ring"
            style={{
              padding: '4px 12px',
              fontSize: 11,
              background: 'transparent',
              color: 'var(--p-text)',
              border: '1px solid var(--p-border)',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {report ? 'Load another report…' : 'Open report…'}
          </button>
        </div>
      </div>

      {report && <ReportHeader report={report} onClear={clearReport} />}

      {lastError && (
        <div
          role="alert"
          style={{
            margin: '12px 16px 0',
            padding: '8px 12px',
            borderRadius: 6,
            background: 'rgba(212, 87, 74, 0.12)',
            color: '#d4574a',
            fontSize: 12,
            border: '1px solid rgba(212, 87, 74, 0.4)',
          }}
        >
          {lastError}
        </div>
      )}

      {lastMessage && (
        <div
          role="status"
          style={{
            margin: '12px 16px 0',
            padding: '8px 12px',
            borderRadius: 6,
            background: 'rgba(60, 168, 107, 0.12)',
            color: '#3ca86b',
            fontSize: 12,
            border: '1px solid rgba(60, 168, 107, 0.4)',
          }}
        >
          {lastMessage}
        </div>
      )}

      {!report ? (
        <EmptyState onOpenFile={openFile} lastError={lastError} />
      ) : grouped.length === 0 ? (
        <div style={{ padding: 24, fontSize: 13, color: 'var(--p-text-secondary)' }}>
          No violations or suggestions in this report — nothing to review.
        </div>
      ) : (
        grouped.map((entry) => (
          <TokenCard
            key={entry.tokenPath}
            entry={entry}
            onApply={handleApply}
            onReject={handleReject}
            onReset={handleReset}
          />
        ))
      )}
    </div>
  );
}
