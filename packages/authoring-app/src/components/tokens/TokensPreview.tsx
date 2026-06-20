import { useMemo, useState } from 'react';
import { formatCss } from 'culori';
import { usePaletteStore } from '../../store/paletteStore';
import { useIntentStore, useEffectiveMode } from '../../store/intentStore';
import { useVocabStore } from '../../store/vocabStore';
import { runResolve } from '../../lib/resolveState';
import { generateRamp, getRelativeLuminance } from '../../lib/colorMath';
import type { ResolvedToken, ComplianceLevel, GeneratedRamp } from '@pigmint/core';
import { EditTokenModal } from './EditTokenModal';


// ─── Badge ────────────────────────────────────────────────────────────────────

const LEVEL_BADGE: Record<ComplianceLevel, { bg: string; text: string; label: string }> = {
  'AAA-text':    { bg: 'var(--p-success-subtle)',  text: 'var(--p-success)',  label: 'AAA'     },
  'AAA-nonText': { bg: 'var(--p-success-subtle)',  text: 'var(--p-success)',  label: 'AAA'     },
  'AA-text':     { bg: 'var(--p-success-subtle)',   text: 'var(--p-success)',   label: 'AA'      },
  'AA-nonText':  { bg: 'var(--p-success-subtle)',   text: 'var(--p-success)',   label: 'AA'      },
  'apca-pass':   { bg: 'var(--p-success-subtle)',   text: 'var(--p-success)',   label: 'Lc pass' },
  'fail':        { bg: 'var(--p-danger-subtle)', text: 'var(--p-danger)', label: 'Fail'    },
  'exempt':      { bg: 'var(--p-surface)',   text: 'var(--p-text-tertiary)', label: 'Exempt'  },
};

// Responsive swatch grid: cards reflow to fill the available width and shrink to
// fit more columns on narrow panels (where fixed-width cards forced one per row).
const tokenGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
  alignItems: 'start',
  columnGap: 0,
  rowGap: 10,
};

// ─── Token card ───────────────────────────────────────────────────────────────

function TokenCard({
  token,
  surfaceFg,
  usage,
  useWcag,
  onEdit,
}: {
  token: ResolvedToken;
  surfaceFg: string;
  usage: 'text' | 'nonText' | 'decorative';
  useWcag: boolean;
  onEdit: () => void;
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

  // ADR-016 alpha tokens carry alphaValue; ramp-alpha tokens carry it on oklch.alpha
  const tokenAlpha = token.alpha?.alphaValue ?? token.oklch.alpha;
  const isTransparent = tokenAlpha != null && tokenAlpha < 1;
  // Use oklch() CSS format so alpha is never stripped (formatHex always drops it)
  const { l, c, h } = token.oklch;
  const colorValue = isTransparent
    ? (formatCss({ mode: 'oklch', l, c, h, alpha: tokenAlpha }) ?? token.hex)
    : token.hex;

  return (
    <button
      type="button"
      onClick={onEdit}
      className="swatch-hover"
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 12,
        background: 'transparent',
        border: 'none',
        borderRadius: 8,
        cursor: 'pointer',
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {usage === 'text' ? (
        <span style={{ color: colorValue, fontSize: 18, fontWeight: 700, lineHeight: 1, fontFamily: 'monospace' }}>
          {stepLabel || '—'}
        </span>
      ) : (
        <span
          aria-hidden="true"
          style={{
            width: 28,
            height: 16,
            borderRadius: 4,
            ...(usage === 'nonText'
              ? { background: colorValue }
              : { border: `1.5px solid ${colorValue}`, background: 'transparent' }),
          }}
        />
      )}
      <span style={{
        color: surfaceFg,
        fontSize: 10,
        opacity: 0.85,
        fontFamily: 'monospace',
        lineHeight: 1.3,
        wordBreak: 'break-all' as const,
      }}>
        {token.path}
      </span>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
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
        <span style={{ fontSize: 10, color: surfaceFg, fontFamily: 'monospace' }}>
          {contrastStr}
        </span>
      </div>
    </button>
  );
}

// ─── Main preview ─────────────────────────────────────────────────────────────

type Props = {
  onAdd?: (initialSurface?: string) => void;
};

function AddTokenSwatch({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      aria-label="Add token"
      style={{
        width: 168,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: 0,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
      }}
    >
      <div className="swatch-hover" style={{
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 78,
        width: '100%',
        border: '1px dashed var(--p-border)',
        background: 'transparent',
        color: 'var(--p-text-secondary)',
        gap: 6,
        fontSize: 13,
        fontWeight: 600,
      }}>
        <span style={{ fontSize: 18, lineHeight: 1 }} aria-hidden="true">+</span>
        <span>Add token</span>
      </div>
      <div style={{ padding: '0 4px', fontSize: 10, color: 'var(--p-text-tertiary)' }}>
        Surface, foreground, nonText, alpha
      </div>
    </button>
  );
}

export function TokensPreview({ onAdd }: Props = {}) {
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
  const vocabSemanticSteps = useVocabStore((s) => s.semanticSteps);

  const useWcag = engineCompliance !== 'apca';
  const [editingPath, setEditingPath] = useState<string | null>(null);

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
      semanticSteps: vocabSemanticSteps ?? undefined,
    };
  }, [vocabEntries, vocabRaw, vocabSurfacePaths, vocabSurfaceSteps, vocabSemanticSteps]);

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

  /** CSS color for surfaces — uses oklch() with alpha when the ramp has sourceAlpha < 1. */
  const surfaceColorMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!resolution.ok || !surfacePathSet) return map;
    for (const t of resolution.tokens) {
      if (t.mode !== effectiveMode) continue;
      if (!surfacePathSet.has(t.path)) continue;
      const alpha = t.oklch.alpha;
      const color = (alpha != null && alpha < 1)
        ? (formatCss({ mode: 'oklch', ...t.oklch }) ?? t.hex)
        : t.hex;
      map.set(t.path, color);
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

  // group resolved tokens by surface for the active mode — every surface gets
  // a section header (even if no tokens resolve against it yet), so a brand-new
  // surface is visible immediately after creation.
  const grouped = useMemo(() => {
    const out = new Map<string, ResolvedToken[]>();
    if (vocabRaw) {
      for (const name of Object.keys(vocabRaw.surfaces)) {
        out.set(`{${name}}`, []);
      }
    }
    if (!resolution.ok) return out;
    for (const t of resolution.tokens) {
      if (t.mode !== effectiveMode || t.resolvedAgainst === null) continue;
      // The resolver picks one primary surface per token, but a foreground/nonText/alpha
      // token can declare multiple surfaces. Show it under every declared surface so
      // the preview matches the vocab; editing one card edits the shared record.
      const declared =
        vocabRaw?.foreground[t.path]?.surfaces
        ?? vocabRaw?.nonText[t.path]?.surfaces
        ?? vocabRaw?.alpha?.[t.path]?.surfaces;
      const surfaceKeys = declared && declared.length > 0
        ? Array.from(new Set(declared.map((s) => `{${s}}`)))
        : [t.resolvedAgainst];
      for (const key of surfaceKeys) {
        const arr = out.get(key);
        if (arr) arr.push(t);
        else out.set(key, [t]);
      }
    }
    return out;
  }, [resolution, effectiveMode, vocabRaw]);

  // Tokens with no surface anchor: alpha scrims (resolver emits resolvedAgainst=null
  // for those) plus the standalone `vocab.decorative` section which the resolver
  // currently skips entirely. They go in a "Standalone" group at the bottom — never hide them.
  const standaloneResolved = useMemo(() => {
    if (!resolution.ok || !surfacePathSet) return [] as ResolvedToken[];
    const out: ResolvedToken[] = [];
    for (const t of resolution.tokens) {
      if (t.mode !== effectiveMode) continue;
      if (t.resolvedAgainst !== null) continue;
      if (surfacePathSet.has(t.path)) continue; // surface itself — already shown as a section header
      out.push(t);
    }
    return out;
  }, [resolution, effectiveMode, surfacePathSet]);

  const standaloneDecorative = useMemo(() => {
    if (!vocabRaw?.decorative) return [] as Array<{ path: string; hex: string; stepLabel: string }>;
    const ramps = new Map<string, GeneratedRamp>();
    for (const scale of scales) {
      try { ramps.set(scale.name, generateRamp(scale)); } catch { /* skip */ }
    }
    const out: Array<{ path: string; hex: string; stepLabel: string }> = [];
    for (const [name, entry] of Object.entries(vocabRaw.decorative)) {
      const ramp = ramps.get(entry.ramp);
      if (!ramp) continue;
      const idx = Math.max(0, Math.min(entry.step ?? 0, ramp.steps.length - 1));
      const step = ramp.steps[idx];
      if (!step) continue;
      out.push({ path: name, hex: step.hex, stepLabel: `${entry.ramp}.${step.name}` });
    }
    return out;
  }, [vocabRaw, scales]);

  // ─── Empty states ──────────────────────────────────────────────────────────

  if (!vocabRaw) {
    const canAdd = Boolean(onAdd) && scales.length > 0;
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 12, padding: 24,
        color: 'var(--p-text-tertiary)', fontSize: 13, textAlign: 'center',
      }}>
        <span>
          {scales.length === 0
            ? 'Create a palette scale first, then add tokens.'
            : 'No tokens yet.'}
        </span>
        {canAdd && (
          <button
            type="button"
            onClick={() => onAdd!()}
            style={{
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 600,
              background: 'var(--p-accent, #6366f1)',
              border: '1px solid var(--p-accent, #6366f1)',
              borderRadius: 6,
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            + Add your first token
          </button>
        )}
        <span style={{ fontSize: 11, color: 'var(--p-text-tertiary)' }}>
          or import a tokens.yaml
        </span>
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
        {onAdd && (
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 10 }}>
            <AddTokenSwatch onAdd={onAdd} />
          </div>
        )}
        {grouped.size === 0 && standaloneResolved.length === 0 && standaloneDecorative.length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--p-text-tertiary)' }}>
            No surfaces yet. Use + Add to create one.
          </span>
        ) : (
          Array.from(grouped.entries()).map(([surface, tokens]) => {
            const surfaceKey = surface.replace(/^\{|\}$/g, '');
            const bgHex = surfaceHexMap.get(surfaceKey) ?? '#cccccc';
            const bgColor = surfaceColorMap.get(surfaceKey) ?? bgHex;
            const stepLabel = surfaceStepLabelMap.get(surfaceKey);
            const surfaceFg = getRelativeLuminance(bgHex) > 0.5 ? '#000000' : '#ffffff';
            return (
              <div
                key={surface}
                style={{
                  background: bgColor,
                  borderRadius: 8,
                  padding: '14px 18px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                {/* Header — name + details stacked, Add button to the right */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: surfaceFg }}>
                  <button
                    type="button"
                    onClick={() => setEditingPath(surfaceKey)}
                    title="Click to edit surface"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 2,
                      padding: 0,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      font: 'inherit',
                      color: 'inherit',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: surfaceFg }}>
                      {surfaceKey}
                    </span>
                    <span style={{ display: 'flex', gap: 8, fontSize: 11, opacity: 0.7, fontFamily: 'monospace', color: surfaceFg }}>
                      <span>{bgHex}</span>
                      {stepLabel && <span>{stepLabel}</span>}
                    </span>
                  </button>
                  {onAdd && (() => {
                    const isLightSurface = surfaceFg === '#000000';
                    const btnBg = isLightSurface ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.14)';
                    const btnBorder = isLightSurface ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.32)';
                    return (
                      <button
                        type="button"
                        onClick={() => onAdd(surfaceKey)}
                        title={`Add token to ${surfaceKey}`}
                        aria-label={`Add token to ${surfaceKey}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 500,
                          background: btnBg,
                          border: `1px solid ${btnBorder}`,
                          borderRadius: 6,
                          color: surfaceFg,
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>+</span>
                        <span>Add</span>
                      </button>
                    );
                  })()}
                </div>
                {/* Tokens */}
                {tokens.length > 0 && (
                  <div style={tokenGrid}>
                    {tokens.map((t) => (
                      <TokenCard
                        key={t.path}
                        token={t}
                        surfaceFg={surfaceFg}
                        usage={usageMap.get(t.path) ?? 'text'}
                        useWcag={useWcag}
                        onEdit={() => setEditingPath(t.path)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
        {(standaloneResolved.length > 0 || standaloneDecorative.length > 0) && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--p-text)', fontFamily: 'monospace' }}>
                Standalone
              </span>
              <span style={{ fontSize: 11, color: 'var(--p-text-tertiary)' }}>
                no surface anchor — decorative, alpha scrim
              </span>
              <span style={{ fontSize: 11, color: 'var(--p-text-tertiary)', marginLeft: 4 }}>
                {standaloneResolved.length + standaloneDecorative.length} token
                {standaloneResolved.length + standaloneDecorative.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={{
              ...tokenGrid,
              background: 'var(--p-surface)',
              border: '1px solid var(--p-border)',
              borderRadius: 6,
              padding: '20px 24px',
              width: '100%',
              boxSizing: 'border-box',
            }}>
              {standaloneResolved.map((t) => (
                <TokenCard
                  key={t.path}
                  token={t}
                  surfaceFg="var(--p-text-secondary)"
                  usage={usageMap.get(t.path) ?? 'decorative'}
                  useWcag={useWcag}
                  onEdit={() => setEditingPath(t.path)}
                />
              ))}
              {standaloneDecorative.map((d) => (
                <button
                  key={d.path}
                  type="button"
                  onClick={() => setEditingPath(d.path)}
                  className="swatch-hover"
                  style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: 12,
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    textAlign: 'left',
                    font: 'inherit',
                    color: 'inherit',
                    boxSizing: 'border-box',
                  }}
                >
                  <span aria-hidden="true" style={{ width: 28, height: 16, borderRadius: 4, background: d.hex }} />
                  <span style={{
                    color: 'var(--p-text-secondary)',
                    fontSize: 10,
                    opacity: 0.85,
                    fontFamily: 'monospace',
                    lineHeight: 1.3,
                    wordBreak: 'break-all' as const,
                  }}>
                    {d.path}
                  </span>
                  <span style={{
                    fontSize: 10,
                    color: 'var(--p-text-tertiary)',
                    fontFamily: 'monospace',
                  }}>
                    {d.stepLabel}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {editingPath && <EditTokenModal path={editingPath} onClose={() => setEditingPath(null)} />}
    </div>
  );
}
