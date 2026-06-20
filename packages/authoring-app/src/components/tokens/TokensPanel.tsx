import { useEffect, useMemo, useRef, useState } from 'react';
import { useVocabStore } from '../../store/vocabStore';
import { useIntentStore } from '../../store/intentStore';
import { usePaletteStore } from '../../store/paletteStore';
import { generateRamp } from '../../lib/colorMath';
import { TokensPreview } from './TokensPreview';
import { AccessibleCombos } from '../accessibility/AccessibleCombos';
import { alphaCompositeHex } from '@pigmint/core';
import type {
  PortableAlphaToken,
  PortableSurfaceToken,
  PortableSemanticToken,
  GeneratedRamp,
} from '@pigmint/core';
import {
  derivedConsistency,
  contrastBounds,
  type TokenKind,
} from './tokenShared';
import { AppSelect } from './AppSelect';
import { ContrastInput } from './ContrastInput';
import { MultiSurfaceSelect } from './MultiSurfaceSelect';
import { ResponsivePanel } from '../base-ui';
import {
  rampOptions,
  surfaceOptions,
  stepOptions,
  prefOptions,
  alphaPrefOptions,
} from './tokenOptions';

// ─── Shared styles ────────────────────────────────────────────────────────────

const btn: React.CSSProperties = {
  padding: '3px 8px',
  fontSize: 11,
  background: 'var(--p-surface)',
  border: '1px solid var(--p-border)',
  borderRadius: 4,
  cursor: 'pointer',
  color: 'var(--p-text)',
  whiteSpace: 'nowrap' as const,
};

function ec() {
  const s = useIntentStore.getState();
  return { compliance: s.engineCompliance, target: s.engineTarget, modes: s.engineModes };
}

// ─── Color dot ────────────────────────────────────────────────────────────────

function ColorDot({ hex, alpha, size = 12 }: { hex?: string; alpha?: number; size?: number }) {
  if (!hex) return null;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const color = (alpha !== undefined && alpha < 1) ? `rgba(${r},${g},${b},${alpha})` : hex;
  return (
    <div style={{
      width: size, height: size, borderRadius: 2, flexShrink: 0,
      background: color, border: '1px solid rgba(0,0,0,0.14)',
    }} />
  );
}

// ─── Add token modal ──────────────────────────────────────────────────────────

const field: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
};

const label: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--p-text-secondary)',
  letterSpacing: '0.05em',
};

const modalInp: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  fontSize: 13,
  background: 'var(--p-bg)',
  border: '1px solid var(--p-border)',
  borderRadius: 6,
  color: 'var(--p-text)',
  boxSizing: 'border-box' as const,
};

const kindTab: (active: boolean) => React.CSSProperties = (active) => ({
  flex: 1,
  padding: '6px 0',
  fontSize: 12,
  fontWeight: active ? 600 : 400,
  background: active ? 'var(--p-surface)' : 'transparent',
  border: 'none',
  borderBottom: active ? '2px solid var(--p-accent)' : '2px solid transparent',
  color: active ? 'var(--p-text)' : 'var(--p-text-secondary)',
  cursor: 'pointer',
});

// Modal-density step select — same swatch behavior, larger trigger.
function ModalStepSelect({ rampName, rampMap, value, onChange }: {
  rampName: string;
  rampMap: Map<string, GeneratedRamp>;
  value: number;
  onChange: (index: number) => void;
}) {
  const ramp = rampMap.get(rampName);
  const steps = ramp?.steps ?? [];
  const safeIdx = steps.length > 0 ? Math.max(0, Math.min(value, steps.length - 1)) : 0;
  return (
    <AppSelect
      options={stepOptions(ramp)}
      value={String(safeIdx)}
      onChange={(v) => onChange(Number(v))}
    />
  );
}

function AddTokenModal({ rampNames, surfaceNames, rampMap, surfaces, compliance, initialSurface, onClose, onAddSurface, onAddSemantic, onAddAlpha }: {
  rampNames: string[];
  surfaceNames: string[];
  rampMap: Map<string, GeneratedRamp>;
  surfaces: Record<string, PortableSurfaceToken>;
  compliance: 'wcag21' | 'apca';
  initialSurface?: string;
  onClose: () => void;
  onAddSurface: (name: string, token: PortableSurfaceToken) => void;
  onAddSemantic: (kind: 'foreground' | 'nonText', name: string, token: PortableSemanticToken) => void;
  onAddAlpha: (name: string, token: PortableAlphaToken) => void;
}) {
  const [kind, setKind] = useState<TokenKind>(initialSurface ? 'foreground' : 'surface');
  const [name, setName] = useState('');
  const [ramp, setRamp] = useState(rampNames[0] ?? '');
  const [surfaceList, setSurfaceList] = useState<string[]>(
    initialSurface && surfaceNames.includes(initialSurface)
      ? [initialSurface]
      : (surfaceNames[0] ? [surfaceNames[0]] : []),
  );
  const [pref, setPref] = useState<PortableSemanticToken['preference']>('lowest-passing');
  const [decorative, setDecorative] = useState(false);
  const defaultTarget = compliance === 'apca' ? 60 : 5;
  const [targetContrast, setTargetContrast] = useState<number>(defaultTarget);
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const bounds = contrastBounds(compliance);

  const rampObj = rampMap.get(ramp);
  const rampLastIdx = (rampObj?.steps.length ?? 1) - 1;
  const [lightStep, setLightStep] = useState(0);
  const [darkStep, setDarkStep] = useState(rampLastIdx);

  // Alpha-specific state
  const [alphaSubKind, setAlphaSubKind] = useState<'scrim' | 'token'>('scrim');
  const [alphaStep, setAlphaStep] = useState(rampLastIdx);
  const [alphaValue, setAlphaValue] = useState(0.4);
  const [alphaRefSurface, setAlphaRefSurface] = useState('');
  const [alphaPref, setAlphaPref] = useState<NonNullable<PortableAlphaToken['preference']>>('lowest-passing');
  const [alphaUsage, setAlphaUsage] = useState<'text' | 'nonText'>('nonText');

  // Reset dark step when ramp changes
  useEffect(() => {
    const r = rampMap.get(ramp);
    const last = (r?.steps.length ?? 1) - 1;
    setDarkStep(last);
    setLightStep(0);
    setAlphaStep(last);
  }, [ramp, rampMap]);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Composite preview for alpha scrim
  const alphaRamp = rampMap.get(ramp);
  const alphaBaseHex = alphaRamp?.steps[Math.max(0, Math.min(alphaStep, (alphaRamp.steps.length ?? 1) - 1))]?.hex;
  const alphaRefToken = alphaRefSurface ? surfaces[alphaRefSurface] : undefined;
  const alphaRefRamp = alphaRefToken ? rampMap.get(alphaRefToken.ramp) : undefined;
  const alphaRefLightIdx = alphaRefToken ? (alphaRefToken.lightStep ?? alphaRefToken.step ?? 0) : 0;
  const alphaRefHex = alphaRefRamp?.steps[Math.max(0, Math.min(alphaRefLightIdx, (alphaRefRamp.steps.length ?? 1) - 1))]?.hex;
  const alphaCompositePreview = alphaSubKind === 'scrim' && alphaBaseHex && alphaRefHex
    ? alphaCompositeHex(alphaBaseHex, alphaValue, alphaRefHex)
    : undefined;

  function commit() {
    const n = name.trim();
    if (!n) { setError('Name is required'); return; }
    if (!ramp) { setError('Ramp is required'); return; }

    if (kind === 'surface') {
      onAddSurface(n, { ramp, lightStep, darkStep });
    } else if (kind === 'foreground' || kind === 'nonText') {
      if (surfaceList.length === 0) { setError('At least one surface is required'); return; }
      const token: PortableSemanticToken = { ramp, surfaces: surfaceList, preference: pref, consistency: derivedConsistency(pref) };
      if (pref === 'preferred-contrast') token.targetContrast = targetContrast;
      if (decorative) token.decorative = true;
      onAddSemantic(kind, n, token);
    } else if (kind === 'alpha') {
      if (alphaSubKind === 'scrim') {
        const stepName = alphaRamp?.steps[Math.max(0, Math.min(alphaStep, (alphaRamp.steps.length ?? 1) - 1))]?.name ?? String(alphaStep);
        const token: PortableAlphaToken = {
          base: `{color.primitive.${ramp}.${stepName}}`,
          value: alphaValue,
          ...(alphaRefSurface ? { referenceSurface: alphaRefSurface } : {}),
        };
        onAddAlpha(n, token);
      } else {
        if (surfaceList.length === 0) { setError('At least one surface is required'); return; }
        const token: PortableAlphaToken = {
          baseRamp: ramp,
          value: alphaValue,
          surfaces: surfaceList,
          preference: alphaPref,
          usage: alphaUsage,
          ...(alphaRefSurface ? { referenceSurface: alphaRefSurface } : {}),
        };
        if (alphaPref === 'preferred-contrast') token.targetContrast = targetContrast;
        if (decorative) token.decorative = true;
        onAddAlpha(n, token);
      }
    }
    onClose();
  }

  const kinds: { id: TokenKind; label: string }[] = [
    { id: 'surface', label: 'Surface' },
    { id: 'foreground', label: 'Foreground' },
    { id: 'nonText', label: 'NonText' },
    { id: 'alpha', label: 'Alpha' },
  ];

  return (
    <ResponsivePanel onOpenChange={(open) => { if (!open) onClose(); }}>
      <div style={{
        padding: '14px 16px 12px',
        borderBottom: '1px solid var(--p-border)',
        fontSize: 14,
        fontWeight: 600,
        color: 'var(--p-text)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span>Add token</span>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="focus-visible-ring"
          style={{
            width: 28,
            height: 28,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: '1px solid var(--p-border)',
            borderRadius: 6,
            color: 'var(--p-text-secondary)',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M2.5 2.5 9.5 9.5M9.5 2.5 2.5 9.5" />
          </svg>
        </button>
      </div>

      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--p-border)',
        padding: '0 16px',
      }}>
        {kinds.map((k) => (
          <button key={k.id} style={kindTab(kind === k.id)} onClick={() => { setKind(k.id); setError(''); }}>
            {k.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, padding: '16px' }}>
          <div style={field}>
            <span style={label}>Name</span>
            <input
              ref={nameRef}
              style={modalInp}
              placeholder={kind === 'surface' ? 'e.g. page, card' : 'e.g. text.default'}
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
            />
          </div>

          <div style={field}>
            <span style={label}>Ramp</span>
            <AppSelect
              options={rampOptions(rampNames, rampMap)}
              value={ramp}
              onChange={setRamp}
            />
          </div>

          {kind === 'surface' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={field}>
                <span style={label}>Light step</span>
                <ModalStepSelect rampName={ramp} rampMap={rampMap} value={lightStep} onChange={setLightStep} />
              </div>
              <div style={field}>
                <span style={label}>Dark step</span>
                <ModalStepSelect rampName={ramp} rampMap={rampMap} value={darkStep} onChange={setDarkStep} />
              </div>
            </div>
          )}

          {(kind === 'foreground' || kind === 'nonText') && (
            <>
              <div style={field}>
                <span style={label}>Surfaces</span>
                {surfaceNames.length === 0 ? (
                  <span style={{ fontSize: 12, color: 'var(--p-text-tertiary)', fontStyle: 'italic' }}>
                    Add a surface first
                  </span>
                ) : (
                  <MultiSurfaceSelect
                    surfaceNames={surfaceNames}
                    surfaces={surfaces}
                    rampMap={rampMap}
                    value={surfaceList}
                    onChange={setSurfaceList}
                  />
                )}
              </div>
              <div style={field}>
                <span style={label}>Preference</span>
                <AppSelect
                  options={prefOptions()}
                  value={pref}
                  onChange={(p) => setPref(p as typeof pref)}
                />
              </div>
              {pref === 'preferred-contrast' ? (
                <div style={field}>
                  <span style={label}>Target {compliance === 'apca' ? 'APCA |Lc|' : 'WCAG ratio'}</span>
                  <ContrastInput
                    bounds={bounds}
                    style={modalInp}
                    value={targetContrast}
                    onCommit={(v) => setTargetContrast(v)}
                  />
                </div>
              ) : (
                <div style={field}>
                  <span style={label}>Consistency</span>
                  <span
                    style={{
                      ...modalInp,
                      color: 'var(--p-text-tertiary)',
                      cursor: 'default',
                    }}
                    title="Derived from preference — matched-to-set syncs across ramps; everything else is independent."
                  >
                    {derivedConsistency(pref)}
                  </span>
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--p-text-secondary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={decorative}
                  onChange={(e) => setDecorative(e.target.checked)}
                />
                Decorative — skip a11y compliance check
              </label>
            </>
          )}

          {kind === 'alpha' && (
            <>
              {/* Sub-kind toggle */}
              <div style={field}>
                <span style={label}>Type</span>
                <div style={{ display: 'flex', gap: 0, border: '1px solid var(--p-border)', borderRadius: 6, overflow: 'hidden' }}>
                  {(['scrim', 'token'] as const).map((sk) => (
                    <button
                      key={sk}
                      type="button"
                      onClick={() => setAlphaSubKind(sk)}
                      style={{
                        flex: 1, padding: '6px 0', fontSize: 12, border: 'none', cursor: 'pointer',
                        background: alphaSubKind === sk ? 'var(--p-surface)' : 'transparent',
                        color: alphaSubKind === sk ? 'var(--p-text)' : 'var(--p-text-secondary)',
                        fontWeight: alphaSubKind === sk ? 600 : 400,
                        borderBottom: alphaSubKind === sk ? '2px solid var(--p-accent)' : '2px solid transparent',
                      }}
                    >
                      {sk === 'scrim' ? 'Scrim (fixed step)' : 'Token (resolve step)'}
                    </button>
                  ))}
                </div>
                <span style={{ fontSize: 11, color: 'var(--p-text-tertiary)' }}>
                  {alphaSubKind === 'scrim'
                    ? 'Fixed step + alpha — composite and emit. Decorative / exempt.'
                    : 'Fixed alpha — resolver picks the passing step. Contrast-checked.'}
                </span>
              </div>

              {/* Step picker (scrim only) */}
              {alphaSubKind === 'scrim' && (
                <div style={field}>
                  <span style={label}>Step</span>
                  <ModalStepSelect rampName={ramp} rampMap={rampMap} value={alphaStep} onChange={setAlphaStep} />
                </div>
              )}

              {/* Alpha value */}
              <div style={field}>
                <span style={label}>Alpha</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {alphaCompositePreview && <ColorDot hex={alphaCompositePreview} size={20} />}
                  <input
                    type="range"
                    min={0} max={1} step={0.05}
                    style={{ flex: 1, accentColor: 'var(--p-accent)' }}
                    value={alphaValue}
                    onChange={(e) => setAlphaValue(parseFloat(e.target.value))}
                  />
                  <span style={{ fontSize: 12, color: 'var(--p-text-secondary)', minWidth: 32, textAlign: 'right' as const }}>
                    {Math.round(alphaValue * 100)}%
                  </span>
                </div>
              </div>

              {/* Surface (token only — contrast target) */}
              {alphaSubKind === 'token' && (
                <>
                  <div style={field}>
                    <span style={label}>Contrast surfaces</span>
                    {surfaceNames.length === 0 ? (
                      <span style={{ fontSize: 12, color: 'var(--p-text-tertiary)', fontStyle: 'italic' }}>Add a surface first</span>
                    ) : (
                      <MultiSurfaceSelect
                        surfaceNames={surfaceNames}
                        surfaces={surfaces}
                        rampMap={rampMap}
                        value={surfaceList}
                        onChange={setSurfaceList}
                      />
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={field}>
                      <span style={label}>Preference</span>
                      <AppSelect
                        options={alphaPrefOptions()}
                        value={alphaPref}
                        onChange={(p) => setAlphaPref(p as typeof alphaPref)}
                      />
                    </div>
                    <div style={field}>
                      <span style={label}>Usage</span>
                      <AppSelect
                        options={[{ value: 'nonText', label: 'nonText' }, { value: 'text', label: 'text' }]}
                        value={alphaUsage}
                        onChange={(u) => setAlphaUsage(u as typeof alphaUsage)}
                      />
                    </div>
                  </div>
                  {alphaPref === 'preferred-contrast' && (
                    <div style={field}>
                      <span style={label}>Target {compliance === 'apca' ? 'APCA |Lc|' : 'WCAG ratio'}</span>
                      <ContrastInput
                        bounds={bounds}
                        style={modalInp}
                        value={targetContrast}
                        onCommit={(v) => setTargetContrast(v)}
                      />
                    </div>
                  )}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--p-text-secondary)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={decorative}
                      onChange={(e) => setDecorative(e.target.checked)}
                    />
                    Decorative — skip a11y compliance check
                  </label>
                </>
              )}

              {/* Reference surface (optional, both types) */}
              <div style={field}>
                <span style={label}>Reference surface <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></span>
                <AppSelect
                  options={[
                    { value: '', label: 'auto (bgMain / bgInverse per mode)' },
                    ...surfaceOptions(surfaceNames, surfaces, rampMap),
                  ]}
                  value={alphaRefSurface}
                  onChange={setAlphaRefSurface}
                />
              </div>
            </>
          )}

          {error && (
          <span style={{ fontSize: 12, color: 'var(--p-danger)' }}>{error}</span>
        )}
      </div>

      <div style={{
        display: 'flex',
        gap: 8,
        justifyContent: 'flex-end',
        padding: '12px 16px',
        borderTop: '1px solid var(--p-border)',
        background: 'var(--p-surface)',
      }}>
        <button style={btn} onClick={onClose}>Cancel</button>
        <button
          style={{
            ...btn,
            background: 'var(--p-accent, #6366f1)',
            borderColor: 'var(--p-accent, #6366f1)',
            color: '#fff',
            fontWeight: 600,
          }}
          onClick={commit}
          disabled={(kind === 'foreground' || kind === 'nonText') && surfaceNames.length === 0}
        >
          Add
        </button>
      </div>
    </ResponsivePanel>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function TokensPanel() {
  const raw = useVocabStore((s) => s.raw);
  const error = useVocabStore((s) => s.error);
  const addSurface = useVocabStore((s) => s.addSurface);
  const addToken = useVocabStore((s) => s.addToken);
  const addAlpha = useVocabStore((s) => s.addAlpha);
  const engineCompliance = useIntentStore((s) => s.engineCompliance);
  const compliance: 'wcag21' | 'apca' = engineCompliance === 'apca' ? 'apca' : 'wcag21';

  const scales = usePaletteStore((s) => s.scales);
  const rampNames = scales.map((s) => s.name);
  const surfaces = raw?.surfaces ?? {};
  const surfaceNames = Object.keys(surfaces);

  const rampMap = useMemo(() => {
    const map = new Map<string, GeneratedRamp>();
    for (const scale of scales) {
      try {
        map.set(scale.name, generateRamp(scale));
      } catch (e) {
        console.warn(`[TokensPanel] generateRamp failed for "${scale.name}":`, e);
      }
    }
    return map;
  }, [scales]);

  const [addModal, setAddModal] = useState<{ open: boolean; initialSurface?: string }>({ open: false });
  const [view, setView] = useState<'preview' | 'combos'>('preview');
  const VIEW_LABELS: Record<'preview' | 'combos', string> = {
    preview: 'Preview',
    combos: 'Discover',
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 8, padding: '10px 12px',
        borderBottom: '1px solid var(--p-border)', background: 'var(--p-bg)',
        alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' as const,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--p-text)', marginRight: 4 }}>Tokens</span>

        {/* View toggle */}
        <div style={{
          display: 'inline-flex',
          borderRadius: 6,
          background: 'var(--p-surface))',
          padding: 2,
          gap: 2,
        }}>
          {(['preview', 'combos'] as const).map((v) => {
            const active = view === v;
            return (
              <button key={v} onClick={() => setView(v)} style={{
                border: 'none',
                background: active ? 'var(--p-text)' : 'transparent',
                color: active ? 'var(--p-bg)' : 'var(--p-text-secondary)',
                fontSize: 10, fontWeight: 600,
                letterSpacing: '0.04em',
                padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
              }}>
                {VIEW_LABELS[v]}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />
        {error && <span style={{ fontSize: 12, color: 'var(--p-danger)' }}>{error}</span>}
        <button
          type="button"
          onClick={() => setAddModal({ open: true })}
          disabled={rampNames.length === 0}
          title={rampNames.length === 0 ? 'Create a palette scale first' : 'Add a token'}
          style={{
            ...btn,
            background: rampNames.length === 0 ? 'var(--p-surface)' : 'var(--p-accent, #6366f1)',
            borderColor: rampNames.length === 0 ? 'var(--p-border)' : 'var(--p-accent, #6366f1)',
            color: rampNames.length === 0 ? 'var(--p-text-tertiary)' : '#fff',
            fontWeight: 600,
            cursor: rampNames.length === 0 ? 'default' : 'pointer',
          }}
        >
          + Add token
        </button>
      </div>


      {/* Preview view */}
      {view === 'preview' && (
        <TokensPreview
          onAdd={rampNames.length > 0
            ? (initialSurface) => setAddModal({ open: true, initialSurface })
            : undefined}
        />
      )}

      {/* Discover view */}
      {view === 'combos' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <AccessibleCombos />
        </div>
      )}

      {/* Add token modal */}
      {addModal.open && (
        <AddTokenModal
          rampNames={rampNames}
          surfaceNames={surfaceNames}
          rampMap={rampMap}
          surfaces={surfaces}
          compliance={compliance}
          initialSurface={addModal.initialSurface}
          onClose={() => setAddModal({ open: false })}
          onAddSurface={(n, t) => addSurface(n, t, ec())}
          onAddSemantic={(kind, n, t) => addToken(kind, n, t, ec())}
          onAddAlpha={(n, t) => addAlpha(n, t, ec())}
        />
      )}

    </div>
  );
}
