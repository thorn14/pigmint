import { useMemo } from 'react';
import type {
  ComplianceLevel,
  FormalIntent,
  GeneratedRamp,
  IntentOverride as CoreIntentOverride,
  ResolvedToken,
} from '@pigmint/core';
import { usePaletteStore } from '../../store/paletteStore';
import { useIntentStore, type EngineMode } from '../../store/intentStore';
import { continuousStepLabel, runResolve } from '../../lib/resolveState';

const MODE_LABELS: Record<EngineMode, string> = {
  light: 'Light',
  dark: 'Dark',
  'light-high-contrast': 'Light HC',
  'dark-high-contrast': 'Dark HC',
};

function complianceColor(level: ComplianceLevel | undefined): string {
  switch (level) {
    case 'AAA-text':
    case 'AAA-nonText':
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

function ratioBadge(t: ResolvedToken): string {
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
}: {
  mode: EngineMode;
  tokens: ResolvedToken[];
  rampsByName: Map<string, GeneratedRamp>;
}) {
  const modeTokens = tokens.filter((t) => t.mode === mode);
  const surfaces = modeTokens.filter((t) => t.path.startsWith('color.surface.'));
  const nonSurfaces = modeTokens.filter((t) => !t.path.startsWith('color.surface.'));

  if (modeTokens.length === 0) return null;

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
          borderCollapse: 'collapse',
          fontSize: 12,
          color: 'var(--p-text-secondary)',
        }}
      >
        <thead>
          <tr style={{ textAlign: 'left' }}>
            <th style={cellHeader}>Surface</th>
            <th style={cellHeader}>Resolved</th>
            <th style={cellHeader}>Source</th>
          </tr>
        </thead>
        <tbody>
          {surfaces.map((s) => (
            <tr key={s.path}>
              <td style={cellBody}>
                <span style={{ fontFamily: 'monospace', color: 'var(--p-text)' }}>
                  {s.path}
                </span>
              </td>
              <td style={cellBody}>
                <Swatch hex={s.hex} label={s.hex} />
              </td>
              <td style={cellBody}>
                <span style={{ fontFamily: 'monospace' }}>{primitiveLabel(s, rampsByName)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {nonSurfaces.length > 0 && (
        <table
          style={{
            borderCollapse: 'collapse',
            fontSize: 12,
            color: 'var(--p-text-secondary)',
          }}
        >
          <thead>
            <tr style={{ textAlign: 'left' }}>
              <th style={cellHeader}>Token</th>
              <th style={cellHeader}>Resolved</th>
              <th style={cellHeader}>Contrast</th>
              <th style={cellHeader}>Compliance</th>
              <th style={cellHeader}>Source</th>
            </tr>
          </thead>
          <tbody>
            {nonSurfaces.map((t) => (
              <tr key={t.path}>
                <td style={cellBody}>
                  <span style={{ fontFamily: 'monospace', color: 'var(--p-text)' }}>
                    {t.path}
                  </span>
                </td>
                <td style={cellBody}>
                  <Swatch hex={t.hex} label={t.hex} />
                </td>
                <td style={cellBody}>{ratioBadge(t)}</td>
                <td style={cellBody}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: complianceColor(t.compliance?.level),
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                    title={`Intent preference: ${(t.intent as FormalIntent).preference}`}
                  >
                    {t.compliance?.level ?? 'fail'}
                  </span>
                </td>
                <td style={cellBody}>
                  <span style={{ fontFamily: 'monospace' }}>{primitiveLabel(t, rampsByName)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
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
};

export function SurfacePairViewer() {
  const scales = usePaletteStore((s) => s.scales);
  const engineModes = useIntentStore((s) => s.engineModes);
  const engineTarget = useIntentStore((s) => s.engineTarget);
  const engineResolver = useIntentStore((s) => s.engineResolver);
  const overrides = useIntentStore((s) => s.overrides);

  const state = useMemo(
    () =>
      runResolve(
        scales,
        engineModes,
        engineTarget,
        overrides as Record<string, CoreIntentOverride>,
        engineResolver,
      ),
    [scales, engineModes, engineTarget, engineResolver, overrides],
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
          background: 'var(--p-bg-subtle)',
        }}
      >
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--p-text)', margin: 0 }}>
          Surface pairs
        </h2>
        <p style={{ fontSize: 12, color: 'var(--p-text-tertiary)', margin: '4px 0 0' }}>
          Every vocabulary token resolved against its surface, per engine mode.
          Target {engineTarget} · WCAG 2.1.
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
          <ModeMatrix key={m} mode={m} tokens={state.tokens} rampsByName={rampsByName} />
        ))
      )}
    </div>
  );
}
