import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useVocabStore } from '../../store/vocabStore';
import { useIntentStore } from '../../store/intentStore';
import { usePaletteStore } from '../../store/paletteStore';
import { generateRamp } from '../../lib/colorMath';
import { TokensPreview } from './TokensPreview';
import { AccessibleCombos } from '../accessibility/AccessibleCombos';
import {
  alphaCompositeHex,
  parseStepRef,
} from '@pigmint/core';
import type {
  PortableAlphaToken,
  PortableSurfaceToken,
  PortableSemanticToken,
  GeneratedRamp,
} from '@pigmint/core';
import {
  derivedConsistency,
  contrastBounds,
  type Pref,
  type TokenKind,
} from './tokenShared';
import { AppSelect } from './AppSelect';
import { MultiSurfaceSelect } from './MultiSurfaceSelect';
import {
  rampOptions,
  surfaceOptions,
  stepOptions,
  prefOptions,
  alphaPrefOptions,
} from './tokenOptions';

// ─── Shared styles ────────────────────────────────────────────────────────────

const ROW_BASE: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  alignItems: 'center',
  padding: '4px 12px',
  borderBottom: '1px solid var(--p-border)',
  fontSize: 12,
};

// Semantic/decorative rows: name | ramp | surface | preference | consistency | (move + decorative + delete)
const ROW: React.CSSProperties = {
  ...ROW_BASE,
  gridTemplateColumns: '140px minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 92px',
};

const HEADER: React.CSSProperties = {
  ...ROW,
  background: 'var(--p-bg-subtle)',
  color: 'var(--p-text-secondary)',
  fontWeight: 600,
  fontSize: 11,
  letterSpacing: '0.05em',
};

const SECTION: React.CSSProperties = {
  padding: '14px 12px 5px',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--p-text-secondary)',
  letterSpacing: '0.07em',
  borderTop: '2px solid var(--p-border)',
  borderBottom: '1px solid var(--p-border)',
  marginTop: 16,
};

const FIRST_SECTION: React.CSSProperties = {
  ...SECTION,
  marginTop: 0,
  borderTop: 'none',
};

const EMPTY_ROW: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 12,
  color: 'var(--p-text-tertiary)',
  fontStyle: 'italic',
  borderBottom: '1px solid var(--p-border)',
};

const inp: React.CSSProperties = {
  width: '100%',
  padding: '3px 6px',
  fontSize: 12,
  background: 'var(--p-bg)',
  border: '1px solid var(--p-border)',
  borderRadius: 4,
  color: 'var(--p-text)',
  boxSizing: 'border-box' as const,
};

const btn: React.CSSProperties = {
  padding: '3px 8px',
  fontSize: 11,
  background: 'var(--p-bg-subtle)',
  border: '1px solid var(--p-border)',
  borderRadius: 4,
  cursor: 'pointer',
  color: 'var(--p-text)',
  whiteSpace: 'nowrap' as const,
};

const delBtn: React.CSSProperties = {
  padding: '2px 6px',
  fontSize: 14,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--p-text-secondary)',
};


function ec() {
  const s = useIntentStore.getState();
  return { compliance: s.engineCompliance, target: s.engineTarget, modes: s.engineModes };
}

// Click-to-edit name field used by every token row.
function EditableName({ value, onCommit }: { value: string; onCommit: (next: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== value) onCommit(next);
    else setDraft(value);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        style={{ ...inp, fontFamily: 'monospace', minWidth: 0 }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          else if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
      />
    );
  }
  return (
    <span
      title="Click to rename"
      onClick={() => setEditing(true)}
      style={{
        fontFamily: 'monospace',
        color: 'var(--p-text)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        cursor: 'text',
        padding: '3px 6px',
        borderRadius: 4,
        border: '1px solid transparent',
      }}
    >
      {value}
    </span>
  );
}

// Compact icon toggle. Used for the decorative flag on contrast-bearing rows.
function DecorativeToggle({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      title={value ? 'Decorative — a11y enforcement skipped' : 'Mark as decorative (skip a11y)'}
      onClick={() => onChange(!value)}
      style={{
        padding: '2px 5px',
        fontSize: 11,
        lineHeight: 1,
        background: value ? 'var(--p-accent, #6366f1)' : 'transparent',
        color: value ? '#fff' : 'var(--p-text-secondary)',
        border: '1px solid ' + (value ? 'var(--p-accent, #6366f1)' : 'var(--p-border)'),
        borderRadius: 3,
        cursor: 'pointer',
      }}
    >
      ◌
    </button>
  );
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

// ─── Row-density wrappers around AppSelect ──────────────────────────────────

function StepSelect({ rampName, rampMap, value, onChange }: {
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
      variant="compact"
      options={stepOptions(ramp)}
      value={String(safeIdx)}
      onChange={(v) => onChange(Number(v))}
    />
  );
}

function RampSelect({ rampNames, value, onChange, rampMap }: {
  rampNames: string[];
  value: string;
  onChange: (name: string) => void;
  rampMap: Map<string, GeneratedRamp>;
}) {
  return (
    <AppSelect
      variant="compact"
      options={rampOptions(rampNames, rampMap)}
      value={value}
      onChange={onChange}
    />
  );
}

// ─── Surface row ──────────────────────────────────────────────────────────────

// Surface rows: name | ramp | step(s) | mode-toggle | delete
const SURFACE_ROW_UNIFIED: React.CSSProperties = {
  ...ROW_BASE,
  gridTemplateColumns: '140px minmax(0,1fr) minmax(0,2.8fr) 26px 28px',
};
const SURFACE_ROW_SPLIT: React.CSSProperties = {
  ...ROW_BASE,
  gridTemplateColumns: '140px minmax(0,1fr) minmax(0,1.4fr) minmax(0,1.4fr) 28px',
};

function SurfaceRow({ name, token, rampNames, rampMap, onUpdate, onDelete, onRename }: {
  name: string;
  token: PortableSurfaceToken;
  rampNames: string[];
  rampMap: Map<string, GeneratedRamp>;
  onUpdate: (u: Partial<PortableSurfaceToken>) => void;
  onDelete: () => void;
  onRename: (next: string) => void;
}) {
  const ramp = rampMap.get(token.ramp);
  const lastIdx = (ramp?.steps.length ?? 1) - 1;

  const isUnified = token.step !== undefined;
  const unifiedIdx = token.step ?? 0;
  const lightIdx = token.lightStep ?? token.step ?? 0;
  const darkIdx = token.darkStep ?? (token.step !== undefined ? lastIdx : 0);

  function toSplit() {
    onUpdate({ lightStep: unifiedIdx, darkStep: lastIdx, step: undefined });
  }
  function toUnified() {
    onUpdate({ lightStep: undefined, darkStep: undefined, step: lightIdx });
  }

  const modeToggle = (
    <button
      type="button"
      title={isUnified ? 'Split into separate light / dark steps' : 'Use one step for all modes'}
      onClick={isUnified ? toSplit : toUnified}
      style={{
        padding: '2px 4px', fontSize: 10, lineHeight: 1,
        background: 'var(--p-bg-subtle)', border: '1px solid var(--p-border)',
        borderRadius: 3, cursor: 'pointer', color: 'var(--p-text-secondary)',
        whiteSpace: 'nowrap' as const,
      }}
    >
      {isUnified ? '↔' : '='}
    </button>
  );

  if (isUnified) {
    return (
      <div style={SURFACE_ROW_UNIFIED}>
        <EditableName value={name} onCommit={onRename} />
        <RampSelect rampNames={rampNames} value={token.ramp} onChange={(r) => onUpdate({ ramp: r })} rampMap={rampMap} />
        <StepSelect rampName={token.ramp} rampMap={rampMap} value={unifiedIdx}
          onChange={(i) => onUpdate({ step: i, lightStep: undefined, darkStep: undefined })} />
        {modeToggle}
        <button style={delBtn} onClick={onDelete} title="Remove">✕</button>
      </div>
    );
  }

  return (
    <div style={SURFACE_ROW_SPLIT}>
      <EditableName value={name} onCommit={onRename} />
      <RampSelect rampNames={rampNames} value={token.ramp} onChange={(r) => onUpdate({ ramp: r })} rampMap={rampMap} />
      <StepSelect rampName={token.ramp} rampMap={rampMap} value={lightIdx}
        onChange={(i) => onUpdate({ lightStep: i, darkStep: darkIdx, step: undefined })} />
      <StepSelect rampName={token.ramp} rampMap={rampMap} value={darkIdx}
        onChange={(i) => onUpdate({ lightStep: lightIdx, darkStep: i, step: undefined })} />
      <button style={delBtn} onClick={onDelete} title="Remove">✕</button>
    </div>
  );
}

// ─── Semantic token row ────────────────────────────────────────────────────────

function SemanticRow({ name, token, section, rampNames, surfaceNames, rampMap, surfaces, compliance, onUpdate, onDelete, onRename, onMove }: {
  name: string;
  token: PortableSemanticToken;
  section: 'foreground' | 'nonText';
  rampNames: string[];
  surfaceNames: string[];
  rampMap: Map<string, GeneratedRamp>;
  surfaces: Record<string, PortableSurfaceToken>;
  compliance: 'wcag21' | 'apca';
  onUpdate: (u: Partial<PortableSemanticToken>) => void;
  onDelete: () => void;
  onRename: (next: string) => void;
  onMove: (to: 'foreground' | 'nonText') => void;
}) {
  const isPreferredContrast = token.preference === 'preferred-contrast';
  const isDecorative = Boolean(token.decorative);
  const dim: React.CSSProperties = isDecorative ? { opacity: 0.45 } : {};
  const bounds = contrastBounds(compliance);
  const consistency = derivedConsistency(token.preference);

  // One-shot reconciliation for legacy tokens whose stored consistency
  // disagrees with the now-derived value.
  useEffect(() => {
    if (token.consistency !== consistency) onUpdate({ consistency });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token.preference]);

  function handlePrefChange(preference: Pref) {
    const updates: Partial<PortableSemanticToken> = {
      preference,
      consistency: derivedConsistency(preference),
    };
    if (preference === 'preferred-contrast' && typeof token.targetContrast !== 'number') {
      // Seed with a sensible mid-range value so the picker has something to aim at.
      updates.targetContrast = compliance === 'apca' ? 60 : 5;
    }
    onUpdate(updates);
  }

  return (
    <div style={ROW}>
      <EditableName value={name} onCommit={onRename} />
      <div style={dim}>
        <RampSelect rampNames={rampNames} value={token.ramp} onChange={(r) => onUpdate({ ramp: r })} rampMap={rampMap} />
      </div>
      <div style={dim}>
        <MultiSurfaceSelect
          variant="compact"
          surfaceNames={surfaceNames}
          surfaces={surfaces}
          rampMap={rampMap}
          value={token.surfaces}
          onChange={(next) => { if (next.length > 0) onUpdate({ surfaces: next }); }}
        />
      </div>
      <div style={dim}>
        <AppSelect
          variant="compact"
          options={prefOptions()}
          value={token.preference}
          onChange={(p) => handlePrefChange(p as Pref)}
        />
      </div>
      {isPreferredContrast ? (
        <input
          type="number"
          min={bounds.min} max={bounds.max} step={bounds.step}
          style={{ ...inp, ...dim }}
          title={`Target ${compliance === 'apca' ? 'APCA |Lc|' : 'WCAG ratio'}`}
          value={token.targetContrast ?? (compliance === 'apca' ? 60 : 5)}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (Number.isFinite(v)) onUpdate({ targetContrast: v });
          }}
        />
      ) : (
        <span
          title="Derived from preference — matched-to-set syncs across ramps; everything else is independent."
          style={{
            ...dim,
            fontSize: 12,
            color: 'var(--p-text-tertiary)',
            padding: '3px 6px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {consistency}
        </span>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
        <div style={{ width: 44 }}>
          <AppSelect
            variant="compact"
            title={`Type — currently ${section === 'foreground' ? 'text' : 'non-text'}. Switch to convert.`}
            options={[{ value: 'foreground', label: 'fg' }, { value: 'nonText', label: 'nt' }]}
            value={section}
            onChange={(next) => { if (next !== section) onMove(next as 'foreground' | 'nonText'); }}
          />
        </div>
        <DecorativeToggle value={isDecorative} onChange={(next) => onUpdate({ decorative: next || undefined })} />
        <button style={delBtn} onClick={onDelete} title="Remove">✕</button>
      </div>
    </div>
  );
}

// ─── Alpha token row ──────────────────────────────────────────────────────────

const ALPHA_ROW: React.CSSProperties = {
  ...ROW_BASE,
  gridTemplateColumns: '140px minmax(0,1fr) minmax(0,1fr) 90px minmax(0,1fr) 56px',
};

function AlphaRow({ name, token, rampNames, surfaceNames, rampMap, surfaces, compliance, onUpdate, onDelete, onRename }: {
  name: string;
  token: PortableAlphaToken;
  rampNames: string[];
  surfaceNames: string[];
  rampMap: Map<string, GeneratedRamp>;
  surfaces: Record<string, PortableSurfaceToken>;
  compliance: 'wcag21' | 'apca';
  onUpdate: (u: Partial<PortableAlphaToken>) => void;
  onDelete: () => void;
  onRename: (next: string) => void;
}) {
  const isDegenerate = Boolean(token.base);
  const parsed = token.base ? parseStepRef(token.base) : null;
  const rampName = token.baseRamp ?? parsed?.ramp ?? rampNames[0] ?? '';
  const ramp = rampMap.get(rampName);

  // Resolve step index from step name (degenerate case)
  const stepName = parsed?.step ?? '';
  const stepIdx = ramp
    ? Math.max(0, ramp.steps.findIndex((s) => s.name === stepName))
    : 0;

  // Composite preview: only when ref surface is explicitly set
  const refSurfaceToken = token.referenceSurface ? surfaces[token.referenceSurface] : undefined;
  const refRamp = refSurfaceToken ? rampMap.get(refSurfaceToken.ramp) : undefined;
  const refLightIdx = refSurfaceToken ? (refSurfaceToken.lightStep ?? refSurfaceToken.step ?? 0) : 0;
  const refHex = refRamp?.steps[Math.max(0, Math.min(refLightIdx, (refRamp.steps.length ?? 1) - 1))]?.hex;
  const baseHex = isDegenerate ? ramp?.steps[stepIdx]?.hex : undefined;
  const compositedHex = baseHex && refHex ? alphaCompositeHex(baseHex, token.value, refHex) : undefined;
  const previewHex = compositedHex ?? baseHex;
  const previewAlpha = compositedHex ? undefined : (baseHex ? token.value : undefined);

  function handleRampChange(r: string) {
    if (isDegenerate) {
      const newStepName = rampMap.get(r)?.steps[stepIdx]?.name ?? stepName;
      onUpdate({ base: `{color.primitive.${r}.${newStepName}}` });
    } else {
      onUpdate({ baseRamp: r });
    }
  }

  function handleStepChange(idx: number) {
    const newStepName = ramp?.steps[idx]?.name ?? String(idx);
    onUpdate({ base: `{color.primitive.${rampName}.${newStepName}}` });
  }

  const tokenSurfaces = token.surfaces ?? (surfaceNames[0] ? [surfaceNames[0]] : []);

  const isDecorative = Boolean(token.decorative);
  const dim: React.CSSProperties = isDecorative ? { opacity: 0.45 } : {};
  const isPreferredContrast = !isDegenerate && token.preference === 'preferred-contrast';
  const bounds = contrastBounds(compliance);

  function handlePrefChange(preference: PortableAlphaToken['preference']) {
    const updates: Partial<PortableAlphaToken> = { preference };
    if (preference === 'preferred-contrast' && typeof token.targetContrast !== 'number') {
      updates.targetContrast = compliance === 'apca' ? 60 : 5;
    }
    onUpdate(updates);
  }

  return (
    <div style={ALPHA_ROW}>
      <EditableName value={name} onCommit={onRename} />
      <div style={dim}>
        <RampSelect rampNames={rampNames} value={rampName} onChange={handleRampChange} rampMap={rampMap} />
      </div>
      <div style={dim}>
        {isDegenerate ? (
          <StepSelect rampName={rampName} rampMap={rampMap} value={stepIdx} onChange={handleStepChange} />
        ) : (
          <MultiSurfaceSelect
            variant="compact"
            surfaceNames={surfaceNames}
            surfaces={surfaces}
            rampMap={rampMap}
            value={tokenSurfaces}
            onChange={(next) => { if (next.length > 0) onUpdate({ surfaces: next }); }}
          />
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
        {previewHex && <ColorDot hex={previewHex} alpha={previewAlpha} />}
        <input
          type="number"
          min={0} max={1} step={0.05}
          style={{ ...inp, minWidth: 0, flex: 1 }}
          value={token.value}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v)) onUpdate({ value: Math.min(1, Math.max(0, Math.round(v * 100) / 100)) });
          }}
        />
      </div>
      {isDegenerate ? (
        <AppSelect
          variant="compact"
          options={[
            { value: '', label: 'auto' },
            ...surfaceOptions(surfaceNames, surfaces, rampMap),
          ]}
          value={token.referenceSurface ?? ''}
          onChange={(v) => onUpdate({ referenceSurface: v || undefined })}
        />
      ) : isPreferredContrast ? (
        <div style={{ display: 'flex', gap: 4, minWidth: 0 }}>
          <div style={{ ...dim, flex: 1, minWidth: 0 }}>
            <AppSelect
              variant="compact"
              options={alphaPrefOptions()}
              value={token.preference ?? 'lowest-passing'}
              onChange={(p) => handlePrefChange(p as PortableAlphaToken['preference'])}
            />
          </div>
          <input
            type="number"
            min={bounds.min} max={bounds.max} step={bounds.step}
            style={{ ...inp, ...dim, width: 60 }}
            title={`Target ${compliance === 'apca' ? 'APCA |Lc|' : 'WCAG ratio'}`}
            value={token.targetContrast ?? (compliance === 'apca' ? 60 : 5)}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (Number.isFinite(v)) onUpdate({ targetContrast: v });
            }}
          />
        </div>
      ) : (
        <div style={dim}>
          <AppSelect
            variant="compact"
            options={alphaPrefOptions()}
            value={token.preference ?? 'lowest-passing'}
            onChange={(p) => handlePrefChange(p as PortableAlphaToken['preference'])}
          />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
        {!isDegenerate && (
          <DecorativeToggle value={isDecorative} onChange={(next) => onUpdate({ decorative: next || undefined })} />
        )}
        <button style={delBtn} onClick={onDelete} title="Remove">✕</button>
      </div>
    </div>
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
  background: active ? 'var(--p-bg-inset)' : 'transparent',
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

function AddTokenModal({ rampNames, surfaceNames, rampMap, surfaces, compliance, onClose, onAddSurface, onAddSemantic, onAddAlpha }: {
  rampNames: string[];
  surfaceNames: string[];
  rampMap: Map<string, GeneratedRamp>;
  surfaces: Record<string, PortableSurfaceToken>;
  compliance: 'wcag21' | 'apca';
  onClose: () => void;
  onAddSurface: (name: string, token: PortableSurfaceToken) => void;
  onAddSemantic: (kind: 'foreground' | 'nonText', name: string, token: PortableSemanticToken) => void;
  onAddAlpha: (name: string, token: PortableAlphaToken) => void;
}) {
  const [kind, setKind] = useState<TokenKind>('surface');
  const [name, setName] = useState('');
  const [ramp, setRamp] = useState(rampNames[0] ?? '');
  const [surfaceList, setSurfaceList] = useState<string[]>(surfaceNames[0] ? [surfaceNames[0]] : []);
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
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

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

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 100,
        }}
      />
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 101,
        background: 'var(--p-bg)',
        border: '1px solid var(--p-border)',
        borderRadius: 10,
        width: 420,
        maxWidth: 'calc(100vw - 32px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        <div style={{
          padding: '14px 16px 12px',
          borderBottom: '1px solid var(--p-border)',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--p-text)',
        }}>
          Add token
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px' }}>
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
                  <input
                    type="number"
                    min={bounds.min} max={bounds.max} step={bounds.step}
                    style={modalInp}
                    value={targetContrast}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isFinite(v)) setTargetContrast(v);
                    }}
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
                        background: alphaSubKind === sk ? 'var(--p-bg-inset)' : 'transparent',
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
                      <input
                        type="number"
                        min={bounds.min} max={bounds.max} step={bounds.step}
                        style={modalInp}
                        value={targetContrast}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (Number.isFinite(v)) setTargetContrast(v);
                        }}
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
            <span style={{ fontSize: 12, color: '#e55' }}>{error}</span>
          )}
        </div>

        <div style={{
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
          padding: '12px 16px',
          borderTop: '1px solid var(--p-border)',
          background: 'var(--p-bg-subtle)',
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
      </div>
    </>,
    document.body,
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function TokensPanel() {
  const raw = useVocabStore((s) => s.raw);
  const error = useVocabStore((s) => s.error);
  const addSurface = useVocabStore((s) => s.addSurface);
  const updateSurface = useVocabStore((s) => s.updateSurface);
  const removeSurface = useVocabStore((s) => s.removeSurface);
  const renameSurface = useVocabStore((s) => s.renameSurface);
  const addToken = useVocabStore((s) => s.addToken);
  const updateToken = useVocabStore((s) => s.updateToken);
  const addDecorative = useVocabStore((s) => s.addDecorative);
  const removeToken = useVocabStore((s) => s.removeToken);
  const renameToken = useVocabStore((s) => s.renameToken);
  const moveToken = useVocabStore((s) => s.moveToken);
  const addAlpha = useVocabStore((s) => s.addAlpha);
  const updateAlpha = useVocabStore((s) => s.updateAlpha);
  const removeAlpha = useVocabStore((s) => s.removeAlpha);
  const renameAlpha = useVocabStore((s) => s.renameAlpha);
  const engineCompliance = useIntentStore((s) => s.engineCompliance);
  const compliance: 'wcag21' | 'apca' = engineCompliance === 'apca' ? 'apca' : 'wcag21';
  const clear = useVocabStore((s) => s.clear);

  const scales = usePaletteStore((s) => s.scales);
  const rampNames = scales.map((s) => s.name);
  const surfaces = raw?.surfaces ?? {};
  const foreground = raw?.foreground ?? {};
  const nonText = raw?.nonText ?? {};
  const decorative = raw?.decorative ?? {};
  const alpha = raw?.alpha ?? {};
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

  const [showAddModal, setShowAddModal] = useState(false);
  const [view, setView] = useState<'edit' | 'preview' | 'combos'>('edit');
  const VIEW_LABELS: Record<'edit' | 'preview' | 'combos', string> = {
    edit: 'Edit',
    preview: 'Preview',
    combos: 'Create',
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
          background: 'var(--p-bg-inset, rgba(0,0,0,0.15))',
          padding: 2,
          gap: 2,
        }}>
          {(['edit', 'preview', 'combos'] as const).map((v) => {
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

        {view === 'edit' && rampNames.length > 0 && (
          <button
            style={{
              ...btn,
              background: 'var(--p-accent, #6366f1)',
              borderColor: 'var(--p-accent, #6366f1)',
              color: '#fff',
              fontWeight: 600,
              padding: '3px 12px',
            }}
            onClick={() => setShowAddModal(true)}
          >
            + Add
          </button>
        )}
        <div style={{ flex: 1 }} />
        {raw && (
          <button style={{ ...btn, color: 'var(--p-text-secondary)' }} onClick={clear}>Clear</button>
        )}
        {error && <span style={{ fontSize: 12, color: '#e55' }}>{error}</span>}
      </div>


      {/* No ramps hint (edit only) */}
      {view === 'edit' && rampNames.length === 0 && (
        <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--p-text-secondary)', borderBottom: '1px solid var(--p-border)' }}>
          Add ramps in the Primitives tab first — they become the available ramp options when defining tokens.
        </div>
      )}

      {/* Preview view */}
      {view === 'preview' && <TokensPreview />}

      {/* Combos / Create view */}
      {view === 'combos' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <AccessibleCombos />
        </div>
      )}

      {/* Edit view — sections */}
      {view === 'edit' && (
        <div style={{ flex: 1, overflow: 'auto' }}>

          {/* Surfaces */}
          <div style={FIRST_SECTION}>Surfaces</div>
          <div style={{ ...HEADER, gridTemplateColumns: SURFACE_ROW_SPLIT.gridTemplateColumns }}>
            <span>Name</span><span>Ramp</span><span>Light / All</span><span>Dark</span><span />
          </div>
          {Object.entries(surfaces).map(([name, token]) => (
            <SurfaceRow
              key={name}
              name={name}
              token={token}
              rampNames={rampNames}
              rampMap={rampMap}
              onUpdate={(u) => updateSurface(name, u, ec())}
              onDelete={() => removeSurface(name, ec())}
              onRename={(next) => renameSurface(name, next, ec())}
            />
          ))}
          {surfaceNames.length === 0 && (
            <div style={EMPTY_ROW}>No surfaces yet — use + Add to create one</div>
          )}

          {/* Foreground */}
          <div style={SECTION}>Foreground</div>
          <div style={HEADER}>
            <span>Name</span><span>Ramp</span><span>Surface</span><span>Preference</span><span>Consistency</span><span />
          </div>
          {Object.entries(foreground).map(([name, token]) => (
            <SemanticRow
              key={name}
              name={name}
              token={token}
              section="foreground"
              rampNames={rampNames}
              surfaceNames={surfaceNames}
              rampMap={rampMap}
              surfaces={surfaces}
              compliance={compliance}
              onUpdate={(u) => updateToken('foreground', name, u, ec())}
              onDelete={() => removeToken('foreground', name, ec())}
              onRename={(next) => renameToken('foreground', name, next, ec())}
              onMove={(to) => moveToken('foreground', to, name, ec())}
            />
          ))}
          {Object.keys(foreground).length === 0 && (
            <div style={EMPTY_ROW}>No foreground tokens yet</div>
          )}

          {/* NonText */}
          <div style={SECTION}>NonText</div>
          <div style={HEADER}>
            <span>Name</span><span>Ramp</span><span>Surface</span><span>Preference</span><span>Consistency</span><span />
          </div>
          {Object.entries(nonText).map(([name, token]) => (
            <SemanticRow
              key={name}
              name={name}
              token={token}
              section="nonText"
              rampNames={rampNames}
              surfaceNames={surfaceNames}
              rampMap={rampMap}
              surfaces={surfaces}
              compliance={compliance}
              onUpdate={(u) => updateToken('nonText', name, u, ec())}
              onDelete={() => removeToken('nonText', name, ec())}
              onRename={(next) => renameToken('nonText', name, next, ec())}
              onMove={(to) => moveToken('nonText', to, name, ec())}
            />
          ))}
          {Object.keys(nonText).length === 0 && (
            <div style={EMPTY_ROW}>No nonText tokens yet</div>
          )}

          {/* Decorative */}
          {Object.keys(decorative).length > 0 && (
            <>
              <div style={SECTION}>Decorative</div>
              <div style={{ ...HEADER, gridTemplateColumns: SURFACE_ROW_SPLIT.gridTemplateColumns }}>
                <span>Name</span><span>Ramp</span><span>Step</span><span /><span />
              </div>
              {Object.entries(decorative).map(([name, token]) => {
                const stepIdx = token.step ?? 0;
                return (
                  <div key={name} style={SURFACE_ROW_SPLIT}>
                    <EditableName value={name} onCommit={(next) => renameToken('decorative', name, next, ec())} />
                    <RampSelect
                      rampNames={rampNames}
                      value={token.ramp}
                      onChange={(r) => addDecorative(name, { ...token, ramp: r }, ec())}
                      rampMap={rampMap}
                    />
                    <StepSelect
                      rampName={token.ramp}
                      rampMap={rampMap}
                      value={stepIdx}
                      onChange={(i) => addDecorative(name, { ...token, step: i }, ec())}
                    />
                    <span />
                    <button style={delBtn} onClick={() => removeToken('decorative', name, ec())}>✕</button>
                  </div>
                );
              })}
            </>
          )}

          {/* Alpha */}
          {Object.keys(alpha).length > 0 && (
            <>
              <div style={SECTION}>Alpha</div>
              <div style={{ ...HEADER, gridTemplateColumns: ALPHA_ROW.gridTemplateColumns }}>
                <span>Name</span><span>Ramp</span><span>Step / Surface</span><span>α</span><span>Ref / Pref</span><span />
              </div>
              {Object.entries(alpha).map(([name, token]) => (
                <AlphaRow
                  key={name}
                  name={name}
                  token={token}
                  rampNames={rampNames}
                  surfaceNames={Object.keys(surfaces)}
                  rampMap={rampMap}
                  surfaces={surfaces}
                  compliance={compliance}
                  onUpdate={(u) => updateAlpha(name, u, ec())}
                  onDelete={() => removeAlpha(name, ec())}
                  onRename={(next) => renameAlpha(name, next, ec())}
                />
              ))}
            </>
          )}

        </div>
      )}

      {/* Add token modal */}
      {showAddModal && (
        <AddTokenModal
          rampNames={rampNames}
          surfaceNames={surfaceNames}
          rampMap={rampMap}
          surfaces={surfaces}
          compliance={compliance}
          onClose={() => setShowAddModal(false)}
          onAddSurface={(n, t) => addSurface(n, t, ec())}
          onAddSemantic={(kind, n, t) => addToken(kind, n, t, ec())}
          onAddAlpha={(n, t) => addAlpha(n, t, ec())}
        />
      )}
    </div>
  );
}
