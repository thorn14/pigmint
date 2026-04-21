import { useMemo } from 'react';
import {
  generateRamp,
  resolveAll,
  VOCABULARY_V1_SLICE,
  type ComplianceLevel,
  type FormalIntent,
  type GeneratedRamp,
  type IntentOverride as CoreIntentOverride,
  type ModeBinding,
  type ProjectConfig,
  type ResolvedToken,
  type VocabularyEntry,
} from '@pigmint/core';
import { usePaletteStore } from '../../store/paletteStore';
import { useIntentStore, type EngineMode } from '../../store/intentStore';
import type { ColorScale } from '../../types/palette';

const MODE_SCHEMES: Record<EngineMode, 'light' | 'dark'> = {
  light: 'light',
  dark: 'dark',
  'light-high-contrast': 'light',
  'dark-high-contrast': 'dark',
};

const MODE_BASELINES: Record<EngineMode, string> = {
  light: '#ffffff',
  dark: '#0a0a0a',
  'light-high-contrast': '#ffffff',
  'dark-high-contrast': '#000000',
};

const MODE_LABELS: Record<EngineMode, string> = {
  light: 'Light',
  dark: 'Dark',
  'light-high-contrast': 'Light HC',
  'dark-high-contrast': 'Dark HC',
};

export function buildTokenRamp(
  vocabulary: VocabularyEntry[],
  rampNames: string[],
): Record<string, string> {
  const neutral = rampNames.find((n) => n === 'neutral') ?? rampNames[0];
  const accent = rampNames.find((n) => n !== 'neutral') ?? neutral;
  if (!neutral || !accent) return {};
  const map: Record<string, string> = {};
  for (const entry of vocabulary) {
    if (entry.usage === 'decorative') continue;
    const isSurface = entry.path.startsWith('color.surface.');
    const isForeground = entry.path.startsWith('color.foreground.');
    map[entry.path] = isSurface || isForeground ? neutral : accent;
  }
  return map;
}

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

interface ResolutionSuccess {
  ok: true;
  tokens: ResolvedToken[];
  ramps: GeneratedRamp[];
  vocabulary: VocabularyEntry[];
}

interface ResolutionFailure {
  ok: false;
  error: string;
}

type ResolutionState = ResolutionSuccess | ResolutionFailure;

export function runResolve(
  scales: ColorScale[],
  engineModes: EngineMode[],
  engineTarget: 'AA' | 'AAA',
  intents: Record<string, CoreIntentOverride>,
): ResolutionState {
  if (scales.length === 0) {
    return { ok: false, error: 'Add at least one ramp in Edit mode to see resolved surface pairs.' };
  }
  let ramps: GeneratedRamp[];
  try {
    ramps = scales.map((s) => generateRamp(s));
  } catch (err) {
    return { ok: false, error: `Ramp generation failed: ${(err as Error).message}` };
  }
  const vocabulary = VOCABULARY_V1_SLICE;
  const tokenRamp = buildTokenRamp(vocabulary, ramps.map((r) => r.scaleName));
  if (Object.keys(tokenRamp).length === 0) {
    return { ok: false, error: 'Could not derive a token → ramp mapping; ramps are empty.' };
  }
  const modes: ModeBinding[] = engineModes.map((mode) => ({
    mode,
    scheme: MODE_SCHEMES[mode],
    baselineHex: MODE_BASELINES[mode],
  }));
  const config: ProjectConfig = {
    engine: {
      compliance: 'wcag21',
      target: engineTarget,
      modes: engineModes,
    },
    ramps: scales.map((s) => ({ name: s.name, source: s.sourceHex })),
    output: { dtcg: './tokens.json' },
    intents,
  };

  try {
    const { tokens } = resolveAll({
      config,
      vocabulary,
      ramps,
      modes,
      tokenRamp,
    });
    return { ok: true, tokens, ramps, vocabulary };
  } catch (err) {
    return { ok: false, error: `Resolve failed: ${(err as Error).message}` };
  }
}

function ratioBadge(t: ResolvedToken): string {
  const ratio = t.contrast?.wcag21;
  return typeof ratio === 'number' ? `${ratio.toFixed(2)}:1` : '—';
}

function primitiveLabel(t: ResolvedToken): string {
  const np = t.source.nearestPrimitive;
  if (np) return np;
  return `${t.source.ramp}@${(t.source.position * 100).toFixed(0)}%`;
}

function ModeMatrix({
  mode,
  tokens,
}: {
  mode: EngineMode;
  tokens: ResolvedToken[];
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
                <span style={{ fontFamily: 'monospace' }}>{primitiveLabel(s)}</span>
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
              <th style={cellHeader}>Against</th>
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
                <td style={cellBody}>
                  <span style={{ fontFamily: 'monospace' }}>
                    {t.resolvedAgainst ?? '—'}
                  </span>
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
                  <span style={{ fontFamily: 'monospace' }}>{primitiveLabel(t)}</span>
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
  const overrides = useIntentStore((s) => s.overrides);

  const state = useMemo(
    () => runResolve(scales, engineModes, engineTarget, overrides as Record<string, CoreIntentOverride>),
    [scales, engineModes, engineTarget, overrides],
  );

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
          <ModeMatrix key={m} mode={m} tokens={state.tokens} />
        ))
      )}
    </div>
  );
}
