import { useMemo } from 'react';
import { usePaletteStore } from '../../store/paletteStore';
import { useIntentStore, useEffectiveMode } from '../../store/intentStore';
import { useVocabStore } from '../../store/vocabStore';
import { runResolve } from '../../lib/resolveState';
import type { ResolvedToken, ComplianceLevel } from '@pigmint/core';

// ─── Badge ────────────────────────────────────────────────────────────────────

const LEVEL_BADGE: Record<ComplianceLevel, { bg: string; text: string; label: string }> = {
  'AAA-text':    { bg: 'var(--badge-aaa-bg)',  text: 'var(--badge-aaa-text)',  label: 'AAA'     },
  'AAA-nonText': { bg: 'var(--badge-aaa-bg)',  text: 'var(--badge-aaa-text)',  label: 'AAA'     },
  'AA-text':     { bg: 'var(--badge-aa-bg)',   text: 'var(--badge-aa-text)',   label: 'AA'      },
  'AA-nonText':  { bg: 'var(--badge-aa-bg)',   text: 'var(--badge-aa-text)',   label: 'AA'      },
  'apca-pass':   { bg: 'var(--badge-aa-bg)',   text: 'var(--badge-aa-text)',   label: 'Lc pass' },
  'fail':        { bg: 'var(--badge-fail-bg)', text: 'var(--badge-fail-text)', label: 'Fail'    },
  'exempt':      { bg: 'var(--p-bg-subtle)',   text: 'var(--p-text-tertiary)', label: 'Exempt'  },
};

// ─── Token card ───────────────────────────────────────────────────────────────

function TokenCard({
  token,
  surfaceHex,
  usage,
  useWcag,
}: {
  token: ResolvedToken;
  surfaceHex: string;
  usage: 'text' | 'nonText' | 'decorative';
  useWcag: boolean;
}) {
  const level = token.compliance?.level ?? null;
  const badge = level ? LEVEL_BADGE[level] : null;

  const contrast = useWcag
    ? (token.contrast?.wcag21 ?? null)
    : (token.contrast?.apca ?? null);

  const contrastStr = contrast !== null
    ? (useWcag ? `${contrast.toFixed(2)}:1` : `Lc ${Math.abs(contrast).toFixed(0)}`)
    : '—';

  const np = token.source.nearestPrimitive ?? '';
  const stepLabel = np.includes('.') ? np.slice(np.lastIndexOf('.') + 1) : np;

  return (
    <div style={{
      width: 168,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      {/* Preview area */}
      <div style={{
        background: surfaceHex,
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 78,
        overflow: 'hidden',
        boxSizing: 'border-box',
        width: '100%',
        ...(usage !== 'text' ? { border: `1px solid ${token.hex}` } : {}),
      }}>
        {usage !== 'text' && (
          <div style={{
            height: 3,
            flexShrink: 0,
            width: '100%',
            background: token.hex,
          }} />
        )}
        <div style={{
          padding: usage !== 'text' ? '8px 12px 10px' : '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          flex: 1,
        }}>
          {usage === 'text' && (
            <span style={{ color: token.hex, fontSize: 18, fontWeight: 700, lineHeight: 1, fontFamily: 'monospace' }}>
              {stepLabel || '—'}
            </span>
          )}
          <span style={{
            color: token.hex,
            fontSize: 10,
            opacity: 0.85,
            fontFamily: 'monospace',
            lineHeight: 1.3,
            wordBreak: 'break-all' as const,
          }}>
            {token.path}
          </span>
        </div>
      </div>
      {/* Footer */}
      <div style={{
        padding: '0 4px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 4,
      }}>
        {badge ? (
          <span style={{
            background: badge.bg,
            color: badge.text,
            fontSize: 9,
            fontWeight: 700,
            padding: '1px 5px',
            borderRadius: 3,
            flexShrink: 0,
          }}>
            {badge.label}
          </span>
        ) : <span />}
        <span style={{ fontSize: 10, color: 'var(--p-text-secondary)', fontFamily: 'monospace' }}>
          {contrastStr}
        </span>
      </div>
    </div>
  );
}

// ─── Main preview ─────────────────────────────────────────────────────────────

export function TokensPreview() {
  const scales           = usePaletteStore((s) => s.scales);
  const engineModes      = useIntentStore((s) => s.engineModes);
  const engineTarget     = useIntentStore((s) => s.engineTarget);
  const engineCompliance = useIntentStore((s) => s.engineCompliance);
  const engineResolver   = useIntentStore((s) => s.engineResolver);
  const appTheme         = useIntentStore((s) => s.appTheme);
  const highContrast     = useIntentStore((s) => s.highContrast);
  const setHighContrast  = useIntentStore((s) => s.setHighContrast);
  const effectiveMode    = useEffectiveMode();

  const hcVariant        = appTheme === 'dark' ? 'dark-high-contrast' : 'light-high-contrast';
  const hcAvailable      = engineModes.includes(hcVariant);

  const vocabEntries      = useVocabStore((s) => s.entries);
  const vocabRaw          = useVocabStore((s) => s.raw);
  const vocabSurfacePaths = useVocabStore((s) => s.surfacePaths);
  const vocabSurfaceSteps = useVocabStore((s) => s.surfaceSteps);

  const useWcag = engineCompliance !== 'apca';

  const vocabCtx = useMemo(() => {
    if (!vocabEntries || !vocabRaw) return null;
    return {
      vocabulary: vocabEntries,
      tokenRamp: Object.fromEntries(
        Object.entries({
          ...vocabRaw.surfaces,
          ...vocabRaw.foreground,
          ...vocabRaw.nonText,
          ...(vocabRaw.decorative ?? {}),
        }).map(([n, e]) => [n, (e as { ramp: string }).ramp]),
      ),
      surfacePaths: vocabSurfacePaths ?? undefined,
      surfaceSteps: vocabSurfaceSteps ?? undefined,
    };
  }, [vocabEntries, vocabRaw, vocabSurfacePaths, vocabSurfaceSteps]);

  const resolution = useMemo(
    () => runResolve(scales, engineModes, engineTarget, engineCompliance, vocabCtx, engineResolver),
    [scales, engineModes, engineTarget, engineCompliance, vocabCtx, engineResolver],
  );

  /** Same surface hex the resolver used (avoids duplicating ramp/step logic and a bogus preview fallback). */
  const surfacePathSet = useMemo(
    () => (vocabRaw ? new Set(Object.keys(vocabRaw.surfaces)) : null),
    [vocabRaw],
  );

  const surfaceHexMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!resolution.ok || !surfacePathSet) return map;
    for (const t of resolution.tokens) {
      if (t.mode !== effectiveMode) continue;
      if (!surfacePathSet.has(t.path)) continue;
      map.set(t.path, t.hex);
    }
    return map;
  }, [resolution, effectiveMode, surfacePathSet]);

  const surfaceStepLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!resolution.ok || !surfacePathSet) return map;
    for (const t of resolution.tokens) {
      if (t.mode !== effectiveMode) continue;
      if (!surfacePathSet.has(t.path)) continue;
      const label = t.source.nearestPrimitive
        ?? `${t.source.ramp}@${(t.source.position * 100).toFixed(0)}%`;
      map.set(t.path, label);
    }
    return map;
  }, [resolution, effectiveMode, surfacePathSet]);

  // token path → 'text' | 'nonText' | 'decorative'
  const usageMap = useMemo(() => {
    const map = new Map<string, 'text' | 'nonText' | 'decorative'>();
    if (!vocabRaw) return map;
    for (const name of Object.keys(vocabRaw.foreground)) map.set(name, 'text');
    for (const name of Object.keys(vocabRaw.nonText)) map.set(name, 'nonText');
    for (const name of Object.keys(vocabRaw.decorative ?? {})) map.set(name, 'decorative');
    return map;
  }, [vocabRaw]);

  // group resolved tokens by surface for the active mode
  const grouped = useMemo(() => {
    if (!resolution.ok) return new Map<string, ResolvedToken[]>();
    const out = new Map<string, ResolvedToken[]>();
    for (const t of resolution.tokens) {
      if (t.mode !== effectiveMode || t.resolvedAgainst === null) continue;
      const arr = out.get(t.resolvedAgainst);
      if (arr) arr.push(t);
      else out.set(t.resolvedAgainst, [t]);
    }
    return out;
  }, [resolution, effectiveMode]);

  // ─── Empty states ──────────────────────────────────────────────────────────

  if (!vocabRaw) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--p-text-tertiary)', fontSize: 13,
      }}>
        Load a tokens.yaml to see the preview
      </div>
    );
  }

  if (!resolution.ok) {
    return (
      <div style={{ flex: 1, padding: '24px', color: 'var(--p-text-secondary)', fontSize: 12 }}>
        {resolution.error}
      </div>
    );
  }

  // ─── Preview ───────────────────────────────────────────────────────────────

  return (
    <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* HC toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 16px',
        borderBottom: '1px solid var(--p-border)',
        flexShrink: 0,
        fontSize: 11,
        color: 'var(--p-text-secondary)',
      }}>
        <span style={{ fontWeight: 600, color: 'var(--p-text)', textTransform: 'capitalize' }}>
          {effectiveMode.replace(/-/g, ' ')}
        </span>
        <label style={{
          display: 'flex', alignItems: 'center', gap: 5,
          cursor: hcAvailable ? 'pointer' : 'default',
          opacity: hcAvailable ? 1 : 0.4,
          marginLeft: 'auto',
          userSelect: 'none',
        }}>
          <input
            type="checkbox"
            checked={highContrast && hcAvailable}
            disabled={!hcAvailable}
            onChange={(e) => setHighContrast(e.target.checked)}
            style={{ cursor: hcAvailable ? 'pointer' : 'default', accentColor: 'var(--p-accent)' }}
          />
          High contrast
        </label>
      </div>

      {/* Surface groups */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 32,
      }}>
        {grouped.size === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--p-text-tertiary)' }}>
            No tokens resolved against a surface in this mode. Add foreground or nonText tokens in the Edit view.
          </span>
        ) : (
          Array.from(grouped.entries()).map(([surface, tokens]) => {
            const surfaceKey = surface.replace(/^\{|\}$/g, '');
            const bgHex = surfaceHexMap.get(surfaceKey) ?? '#cccccc';
            const stepLabel = surfaceStepLabelMap.get(surfaceKey);
            return (
              <div key={surface}>
                {/* Surface header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <div style={{
                    width: 16,
                    height: 16,
                    borderRadius: 3,
                    background: bgHex,
                    border: '1px solid var(--p-border)',
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--p-text)', fontFamily: 'monospace' }}>
                    {surfaceKey}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--p-text-tertiary)', fontFamily: 'monospace' }}>
                    {bgHex}
                  </span>
                  {stepLabel && (
                    <span style={{ fontSize: 11, color: 'var(--p-text-tertiary)', fontFamily: 'monospace' }}>
                      {stepLabel}
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--p-text-tertiary)', marginLeft: 4 }}>
                    {tokens.length} token{tokens.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {/* Cards */}
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 10 }}>
                  {tokens.map((t) => (
                    <TokenCard
                      key={t.path}
                      token={t}
                      surfaceHex={bgHex}
                      usage={usageMap.get(t.path) ?? 'text'}
                      useWcag={useWcag}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
