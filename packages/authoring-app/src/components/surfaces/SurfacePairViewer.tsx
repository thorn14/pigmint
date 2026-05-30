import { useMemo } from 'react';
import type {
  ComplianceLevel,
  FormalIntent,
  GeneratedRamp,
  ResolvedToken,
} from '@pigmint/core';
import { usePaletteStore } from '../../store/paletteStore';
import { useIntentStore, type EngineMode } from '../../store/intentStore';
import { useVocabStore } from '../../store/vocabStore';
import { continuousStepLabel, runResolve } from '../../lib/resolveState';

const MODE_LABELS: Record<EngineMode, string> = {
  light: 'Light',
  dark: 'Dark',
  'light-high-contrast': 'Light HC',
  'dark-high-contrast': 'Dark HC',
};

function complianceTextColor(
  level: ComplianceLevel | undefined,
  apcaLc: { achieved: number; required: number } | undefined,
  useApcaLc: boolean,
): string {
  if (useApcaLc && apcaLc) {
    return apcaLc.achieved + 1e-9 >= apcaLc.required ? '#3ca86b' : '#d4574a';
  }
  switch (level) {
    case 'AAA-text':
    case 'AAA-nonText':
    case 'apca-pass':
      return '#3ca86b';
    case 'AA-text':
    case 'AA-nonText':
      return '#e2a93a';
    case 'exempt':
      return '#8a8a8a';
    default:
      return '#d4574a';
  }
}

/** Minimum |Lc| the resolver required for this row (achieved is in the APCA column). */
function formatApcaMinOnly(apcaLc: { required: number }): string {
  return Number.isInteger(apcaLc.required) ? String(apcaLc.required) : apcaLc.required.toFixed(1);
}

function ratioBadge(t: ResolvedToken, engineCompliance: 'wcag21' | 'apca'): string {
  if (engineCompliance === 'apca') {
    const lc = t.contrast?.apca;
    return typeof lc === 'number' && Number.isFinite(lc)
      ? `Lc ${Math.abs(lc).toFixed(1)}`
      : '—';
  }
  const ratio = t.contrast?.wcag21;
  return typeof ratio === 'number' ? `${ratio.toFixed(2)}:1` : '—';
}

function primitiveLabel(t: ResolvedToken, rampsByName: Map<string, GeneratedRamp>): string {
  const ramp = rampsByName.get(t.source.ramp);
  if (ramp) return continuousStepLabel(t.source.position, ramp);
  const np = t.source.nearestPrimitive;
  if (np) return np;
  return `${t.source.ramp}@${(t.source.position * 100).toFixed(0)}%`;
}

function ModeMatrix({
  mode,
  tokens,
  rampsByName,
  engineCompliance,
}: {
  mode: EngineMode;
  tokens: ResolvedToken[];
  rampsByName: Map<string, GeneratedRamp>;
  engineCompliance: 'wcag21' | 'apca';
}) {
  const useApcaCompliance = engineCompliance === 'apca';
  const modeTokens = tokens.filter((t) => t.mode === mode);
  const surfaces = modeTokens.filter((t) => t.path.startsWith('color.surface.'));
  const nonSurfaces = modeTokens.filter((t) => !t.path.startsWith('color.surface.'));

  if (modeTokens.length === 0) return null;

  const rows = [
    ...surfaces.map((token) => ({
      kind: 'Surface' as const,
      token,
    })),
    ...nonSurfaces.map((token) => ({
      kind: 'Token' as const,
      token,
    })),
  ];

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 20,
        borderBottom: '1px solid var(--p-border)',
      }}
    >
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--p-text)', margin: 0 }}>
          {MODE_LABELS[mode]}
        </h3>
        <span style={{ fontSize: 12, color: 'var(--p-text-tertiary)' }}>
          {surfaces.length} surface{surfaces.length === 1 ? '' : 's'} · {nonSurfaces.length} token{nonSurfaces.length === 1 ? '' : 's'}
        </span>
      </header>

      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          fontSize: 12,
          color: 'var(--p-text-secondary)',
        }}
      >
        <colgroup>
          <col style={{ width: '10%' }} />
          <col style={{ width: '36%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '10%' }} />
        </colgroup>
        <thead>
          <tr style={{ textAlign: 'left' }}>
            <th style={cellHeader}>Type</th>
            <th style={cellHeader}>Name</th>
            <th style={cellHeader}>Resolved</th>
            <th style={cellHeader}>
              {engineCompliance === 'apca' ? 'APCA' : 'Contrast'}
            </th>
            <th style={cellHeader}>{useApcaCompliance ? 'Min Lc' : 'Compliance'}</th>
            <th style={cellHeader}>Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ kind, token }) => (
            <tr key={token.path}>
              <td style={cellBody}>
                <span style={{ fontFamily: 'monospace', color: 'var(--p-text)' }}>
                  {kind}
                </span>
              </td>
              <td style={cellBody}>
                <span style={{ fontFamily: 'monospace', color: 'var(--p-text)' }}>
                  {token.path}
                </span>
              </td>
              <td style={cellBody}>
                <Swatch hex={token.hex} label={token.hex} />
              </td>
              <td style={cellBody}>
                {kind === 'Token' ? ratioBadge(token, engineCompliance) : '—'}
              </td>
              <td style={cellBody}>
                {kind === 'Token' ? (
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 12,
                      fontWeight: 600,
                      color: complianceTextColor(
                        token.compliance?.level,
                        token.compliance?.apcaLc,
                        useApcaCompliance,
                      ),
                    }}
                    title={
                      useApcaCompliance && token.compliance?.apcaLc
                        ? 'Minimum |Lc| the resolver used for this token; achieved is in the APCA column'
                        : `Intent preference: ${(token.intent as FormalIntent).preference}`
                    }
                  >
                    {useApcaCompliance && token.compliance?.apcaLc
                      ? formatApcaMinOnly(token.compliance.apcaLc)
                      : (token.compliance?.level ?? 'fail')}
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td style={cellBody}>
                <span style={{ fontFamily: 'monospace' }}>{primitiveLabel(token, rampsByName)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Swatch({ hex, label }: { hex: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span
        aria-hidden
        style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          border: '1px solid var(--p-border)',
          background: hex,
          flexShrink: 0,
        }}
      />
      <span style={{ fontFamily: 'monospace' }}>{label}</span>
    </span>
  );
}

const cellHeader: React.CSSProperties = {
  padding: '8px 12px',
  borderBottom: '1px solid var(--p-border)',
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--p-text-tertiary)',
};

const cellBody: React.CSSProperties = {
  padding: '8px 12px',
  borderBottom: '1px solid var(--p-border)',
  verticalAlign: 'middle',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export function SurfacePairViewer() {
  const scales = usePaletteStore((s) => s.scales);
  const engineModes = useIntentStore((s) => s.engineModes);
  const engineTarget = useIntentStore((s) => s.engineTarget);
  const engineCompliance = useIntentStore((s) => s.engineCompliance);
  const engineResolver = useIntentStore((s) => s.engineResolver);
  const vocabEntries = useVocabStore((s) => s.entries);
  const vocabTokenRamp = useVocabStore((s) => s.raw
    ? Object.fromEntries(
        Object.entries({
          ...s.raw.surfaces,
          ...s.raw.foreground,
          ...s.raw.nonText,
          ...(s.raw.decorative ?? {}),
        }).map(([name, entry]) => [name, (entry as { ramp: string }).ramp])
      )
    : {});
  const surfacePaths = useVocabStore((s) => s.surfacePaths);
  const surfaceSteps = useVocabStore((s) => s.surfaceSteps);
  const vocabCtx = vocabEntries
    ? { vocabulary: vocabEntries, tokenRamp: vocabTokenRamp, surfacePaths: surfacePaths ?? undefined, surfaceSteps: surfaceSteps ?? undefined }
    : null;

  const state = useMemo(
    () =>
      runResolve(
        scales,
        engineModes,
        engineTarget,
        engineCompliance,
        vocabCtx,
        engineResolver,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scales, engineModes, engineTarget, engineCompliance, engineResolver, vocabEntries],
  );

  const rampsByName = useMemo(() => {
    const map = new Map<string, GeneratedRamp>();
    if (state.ok) for (const r of state.ramps) map.set(r.scaleName, r);
    return map;
  }, [state]);

  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        background: 'var(--p-bg)',
      }}
    >
      <header
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--p-border)',
          background: 'var(--p-surface)',
        }}
      >
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--p-text)', margin: 0 }}>
          Surface pairs
        </h2>
        <p style={{ fontSize: 12, color: 'var(--p-text-tertiary)', margin: '4px 0 0' }}>
          Every vocabulary token resolved against its surface, per engine mode.
          {engineCompliance === 'apca' ? (
            <>
              APCA · text min |Lc| {engineTarget === 'AAA' ? '90' : '60'} (non-text from vocabulary).
            </>
          ) : (
            <>
              WCAG 2.1 · target {engineTarget}.
            </>
          )}
        </p>
      </header>

      {!state.ok ? (
        <div
          style={{
            padding: 20,
            color: 'var(--p-text-secondary)',
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          {state.error}
        </div>
      ) : (
        engineModes.map((m) => (
          <ModeMatrix
            key={m}
            mode={m}
            tokens={state.tokens}
            rampsByName={rampsByName}
            engineCompliance={engineCompliance}
          />
        ))
      )}
    </div>
  );
}
