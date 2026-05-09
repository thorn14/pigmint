import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useVocabStore } from '../../store/vocabStore';
import { useIntentStore } from '../../store/intentStore';
import { usePaletteStore } from '../../store/paletteStore';
import { generateRamp } from '../../lib/colorMath';
import { TokensPreview } from './TokensPreview';
import {
  alphaCompositeHex,
  parseStepRef,
} from '@pigmint/core';
import type {
  PortableAlphaToken,
  PortableSurfaceToken,
  PortableSemanticToken,
  GeneratedRamp,
  ColorScale,
} from '@pigmint/core';

// ─── Shared styles ────────────────────────────────────────────────────────────

const ROW_BASE: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  alignItems: 'center',
  padding: '4px 12px',
  borderBottom: '1px solid var(--p-border)',
  fontSize: 12,
};

// Semantic/decorative rows: name | ramp | surface | preference | consistency | delete
const ROW: React.CSSProperties = {
  ...ROW_BASE,
  gridTemplateColumns: '140px minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 28px',
};

const HEADER: React.CSSProperties = {
  ...ROW,
  background: 'var(--p-bg-subtle)',
  color: 'var(--p-text-secondary)',
  fontWeight: 600,
  fontSize: 11,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
};

const SECTION: React.CSSProperties = {
  padding: '14px 12px 5px',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--p-text-secondary)',
  textTransform: 'uppercase' as const,
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

const sel: React.CSSProperties = {
  ...inp,
  cursor: 'pointer',
  minWidth: 0,
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

const PREFS = [
  'lowest-passing',
  'midpoint',
  'median',
  'level-up',
  'highest-contrast',
  'matched-to-set',
] as const;
const CONS = ['independent', 'matched-across-ramps'] as const;
const ALPHA_PREFS = ['lowest-passing', 'highest-contrast'] as const;
type TokenKind = 'surface' | 'foreground' | 'nonText' | 'decorative' | 'alpha';

type Pref = PortableSemanticToken['preference'];
type Cons = NonNullable<PortableSemanticToken['consistency']>;

// Preference × consistency coupling — mirrors core/intent-validate.ts so the UI
// never lets a row reach the engine in a state that would throw.
//   matched-to-set        ⇒ matched-across-ramps (only valid pairing)
//   midpoint/median/level-up ⇒ independent (synchronized-T has no meaning)
//   lowest-passing/highest-contrast ⇒ either is fine
function coercePrefConsistency(pref: Pref, current: Cons | undefined): Cons {
  if (pref === 'matched-to-set') return 'matched-across-ramps';
  if (pref === 'midpoint' || pref === 'median' || pref === 'level-up') return 'independent';
  return current ?? 'independent';
}

function consistencyDisabledFor(pref: Pref, value: Cons): boolean {
  if (pref === 'matched-to-set') return value !== 'matched-across-ramps';
  if (pref === 'midpoint' || pref === 'median' || pref === 'level-up') {
    return value === 'matched-across-ramps';
  }
  return false;
}

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

// ─── Step select ──────────────────────────────────────────────────────────────

function StepSelect({ rampName, rampMap, value, onChange }: {
  rampName: string;
  rampMap: Map<string, GeneratedRamp>;
  value: number;
  onChange: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 160 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const ramp = rampMap.get(rampName);
  const steps = ramp?.steps ?? [];
  const safeIdx = steps.length > 0 ? Math.max(0, Math.min(value, steps.length - 1)) : 0;
  const current = steps[safeIdx];

  function openDropdown() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 2, left: rect.left, width: Math.max(180, rect.width) });
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (
        !dropRef.current?.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div style={{ position: 'relative', minWidth: 0 }}>
      <button
        ref={btnRef}
        type="button"
        onClick={openDropdown}
        style={{
          display: 'flex', alignItems: 'center', gap: 5, width: '100%',
          padding: '3px 6px', fontSize: 12,
          background: 'var(--p-bg)', border: '1px solid var(--p-border)',
          borderRadius: 4, cursor: 'pointer', color: 'var(--p-text)',
          boxSizing: 'border-box' as const, minWidth: 0,
        }}
      >
        {current ? (
          <>
            <ColorDot hex={current.hex} />
            <span style={{ fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1, textAlign: 'left' as const }}>
              {current.name}
            </span>
          </>
        ) : (
          <span style={{ color: 'var(--p-text-secondary)', flex: 1 }}>—</span>
        )}
        <span style={{ opacity: 0.4, fontSize: 8, flexShrink: 0 }}>▾</span>
      </button>

      {open && createPortal(
        <div
          ref={dropRef}
          style={{
            position: 'fixed',
            top: pos.top, left: pos.left, minWidth: pos.width,
            background: 'var(--p-bg)',
            border: '1px solid var(--p-border)',
            borderRadius: 6,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            zIndex: 300,
            maxHeight: 280, overflowY: 'auto' as const,
          }}
        >
          {steps.length === 0 && (
            <div style={{ padding: '8px 12px', color: 'var(--p-text-tertiary)', fontSize: 12 }}>
              Ramp "{rampName}" not available — check console
            </div>
          )}
          {steps.map((step, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { onChange(i); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 10px', width: '100%', textAlign: 'left' as const,
                background: i === safeIdx ? 'var(--p-bg-subtle)' : 'transparent',
                border: 'none',
                borderBottom: i < steps.length - 1 ? '1px solid var(--p-border)' : 'none',
                cursor: 'pointer', color: 'var(--p-text)', fontSize: 12,
              }}
            >
              <ColorDot hex={step.hex} size={20} />
              <span style={{ fontFamily: 'monospace', fontWeight: i === safeIdx ? 600 : 400 }}>
                {step.name}
              </span>
              <span style={{ fontSize: 10, color: 'var(--p-text-secondary)', marginLeft: 'auto', fontFamily: 'monospace' }}>
                {step.hex}
              </span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

// ─── Ramp select with swatch ──────────────────────────────────────────────────

function RampSelect({ rampNames, value, onChange, scales }: {
  rampNames: string[];
  value: string;
  onChange: (name: string) => void;
  scales: ColorScale[];
}) {
  const sourceHex = scales.find((s) => s.name === value)?.sourceHex;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
      <ColorDot hex={sourceHex} />
      <select style={{ ...sel, flex: 1 }} value={value} onChange={(e) => onChange(e.target.value)}>
        {rampNames.map((r) => <option key={r}>{r}</option>)}
      </select>
    </div>
  );
}

// ─── Surface select with swatch ───────────────────────────────────────────────

function SurfaceSelect({ surfaceNames, value, onChange, surfaces, rampMap }: {
  surfaceNames: string[];
  value: string;
  onChange: (name: string) => void;
  surfaces: Record<string, PortableSurfaceToken>;
  rampMap: Map<string, GeneratedRamp>;
}) {
  const surfaceToken = surfaces[value];
  const surfaceRamp = surfaceToken ? rampMap.get(surfaceToken.ramp) : null;
  const lightIdx = surfaceToken ? (surfaceToken.lightStep ?? surfaceToken.step ?? 0) : 0;
  const hex = surfaceRamp?.steps[Math.max(0, Math.min(lightIdx, surfaceRamp.steps.length - 1))]?.hex;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
      <ColorDot hex={hex} />
      <select style={{ ...sel, flex: 1 }} value={value} onChange={(e) => onChange(e.target.value)}>
        {surfaceNames.map((s) => <option key={s}>{s}</option>)}
      </select>
    </div>
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

function SurfaceRow({ name, token, rampNames, rampMap, scales, onUpdate, onDelete }: {
  name: string;
  token: PortableSurfaceToken;
  rampNames: string[];
  rampMap: Map<string, GeneratedRamp>;
  scales: ColorScale[];
  onUpdate: (u: Partial<PortableSurfaceToken>) => void;
  onDelete: () => void;
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
        <span style={{ fontFamily: 'monospace', color: 'var(--p-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </span>
        <RampSelect rampNames={rampNames} value={token.ramp} onChange={(r) => onUpdate({ ramp: r })} scales={scales} />
        <StepSelect rampName={token.ramp} rampMap={rampMap} value={unifiedIdx}
          onChange={(i) => onUpdate({ step: i, lightStep: undefined, darkStep: undefined })} />
        {modeToggle}
        <button style={delBtn} onClick={onDelete} title="Remove">✕</button>
      </div>
    );
  }

  return (
    <div style={SURFACE_ROW_SPLIT}>
      <span style={{ fontFamily: 'monospace', color: 'var(--p-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </span>
      <RampSelect rampNames={rampNames} value={token.ramp} onChange={(r) => onUpdate({ ramp: r })} scales={scales} />
      <StepSelect rampName={token.ramp} rampMap={rampMap} value={lightIdx}
        onChange={(i) => onUpdate({ lightStep: i, darkStep: darkIdx, step: undefined })} />
      <StepSelect rampName={token.ramp} rampMap={rampMap} value={darkIdx}
        onChange={(i) => onUpdate({ lightStep: lightIdx, darkStep: i, step: undefined })} />
      <button style={delBtn} onClick={onDelete} title="Remove">✕</button>
    </div>
  );
}

// ─── Semantic token row ────────────────────────────────────────────────────────

function SemanticRow({ name, token, rampNames, surfaceNames, rampMap, scales, surfaces, onUpdate, onDelete }: {
  name: string;
  token: PortableSemanticToken;
  rampNames: string[];
  surfaceNames: string[];
  rampMap: Map<string, GeneratedRamp>;
  scales: ColorScale[];
  surfaces: Record<string, PortableSurfaceToken>;
  onUpdate: (u: Partial<PortableSemanticToken>) => void;
  onDelete: () => void;
}) {
  return (
    <div style={ROW}>
      <span style={{ fontFamily: 'monospace', color: 'var(--p-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </span>
      <RampSelect rampNames={rampNames} value={token.ramp} onChange={(r) => onUpdate({ ramp: r })} scales={scales} />
      <SurfaceSelect
        surfaceNames={surfaceNames}
        value={token.surfaces[0] ?? ''}
        onChange={(s) => onUpdate({ surfaces: [s] })}
        surfaces={surfaces}
        rampMap={rampMap}
      />
      <select
        style={sel}
        value={token.preference}
        onChange={(e) => {
          const preference = e.target.value as Pref;
          const consistency = coercePrefConsistency(preference, token.consistency as Cons | undefined);
          onUpdate({ preference, consistency });
        }}
      >
        {PREFS.map((p) => <option key={p}>{p}</option>)}
      </select>
      <select
        style={sel}
        value={token.consistency ?? 'independent'}
        onChange={(e) => onUpdate({ consistency: e.target.value as PortableSemanticToken['consistency'] })}
      >
        {CONS.map((c) => (
          <option key={c} value={c} disabled={consistencyDisabledFor(token.preference, c)}>
            {c}
          </option>
        ))}
      </select>
      <button style={delBtn} onClick={onDelete} title="Remove">✕</button>
    </div>
  );
}

// ─── Alpha token row ──────────────────────────────────────────────────────────

const ALPHA_ROW: React.CSSProperties = {
  ...ROW_BASE,
  gridTemplateColumns: '140px minmax(0,1fr) minmax(0,1fr) 90px minmax(0,1fr) 28px',
};

function AlphaRow({ name, token, rampNames, surfaceNames, rampMap, scales, surfaces, onUpdate, onDelete }: {
  name: string;
  token: PortableAlphaToken;
  rampNames: string[];
  surfaceNames: string[];
  rampMap: Map<string, GeneratedRamp>;
  scales: ColorScale[];
  surfaces: Record<string, PortableSurfaceToken>;
  onUpdate: (u: Partial<PortableAlphaToken>) => void;
  onDelete: () => void;
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

  const surfaceName = token.surfaces?.[0] ?? surfaceNames[0] ?? '';

  return (
    <div style={ALPHA_ROW}>
      <span style={{ fontFamily: 'monospace', color: 'var(--p-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </span>
      <RampSelect rampNames={rampNames} value={rampName} onChange={handleRampChange} scales={scales} />
      {isDegenerate ? (
        <StepSelect rampName={rampName} rampMap={rampMap} value={stepIdx} onChange={handleStepChange} />
      ) : (
        <SurfaceSelect
          surfaceNames={surfaceNames}
          value={surfaceName}
          onChange={(s) => onUpdate({ surfaces: [s] })}
          surfaces={surfaces}
          rampMap={rampMap}
        />
      )}
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
        <select
          style={sel}
          value={token.referenceSurface ?? ''}
          onChange={(e) => onUpdate({ referenceSurface: e.target.value || undefined })}
        >
          <option value="">auto</option>
          {surfaceNames.map((s) => <option key={s}>{s}</option>)}
        </select>
      ) : (
        <select
          style={sel}
          value={token.preference ?? 'lowest-passing'}
          onChange={(e) => onUpdate({ preference: e.target.value as PortableAlphaToken['preference'] })}
        >
          {ALPHA_PREFS.map((p) => <option key={p}>{p}</option>)}
        </select>
      )}
      <button style={delBtn} onClick={onDelete} title="Remove">✕</button>
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
  textTransform: 'uppercase' as const,
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

const modalSel: React.CSSProperties = { ...modalInp, cursor: 'pointer' };

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

// Larger step select for the modal
function ModalStepSelect({ rampName, rampMap, value, onChange }: {
  rampName: string;
  rampMap: Map<string, GeneratedRamp>;
  value: number;
  onChange: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 200 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const ramp = rampMap.get(rampName);
  const steps = ramp?.steps ?? [];
  const safeIdx = steps.length > 0 ? Math.max(0, Math.min(value, steps.length - 1)) : 0;
  const current = steps[safeIdx];

  function openDropdown() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 2, left: rect.left, width: rect.width });
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (
        !dropRef.current?.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        type="button"
        onClick={openDropdown}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '6px 10px', fontSize: 13,
          background: 'var(--p-bg)', border: '1px solid var(--p-border)',
          borderRadius: 6, cursor: 'pointer', color: 'var(--p-text)',
          boxSizing: 'border-box' as const,
        }}
      >
        {current ? (
          <>
            <ColorDot hex={current.hex} size={16} />
            <span style={{ fontFamily: 'monospace', flex: 1, textAlign: 'left' as const }}>{current.name}</span>
            <span style={{ fontSize: 11, color: 'var(--p-text-secondary)', fontFamily: 'monospace' }}>{current.hex}</span>
          </>
        ) : (
          <span style={{ color: 'var(--p-text-secondary)' }}>Select step…</span>
        )}
        <span style={{ opacity: 0.4, fontSize: 10, flexShrink: 0, marginLeft: 4 }}>▾</span>
      </button>

      {open && createPortal(
        <div
          ref={dropRef}
          style={{
            position: 'fixed',
            top: pos.top, left: pos.left, width: pos.width,
            background: 'var(--p-bg)',
            border: '1px solid var(--p-border)',
            borderRadius: 6,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            zIndex: 400,
            maxHeight: 300, overflowY: 'auto' as const,
          }}
        >
          {steps.map((step, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { onChange(i); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 12px', width: '100%', textAlign: 'left' as const,
                background: i === safeIdx ? 'var(--p-bg-subtle)' : 'transparent',
                border: 'none',
                borderBottom: i < steps.length - 1 ? '1px solid var(--p-border)' : 'none',
                cursor: 'pointer', color: 'var(--p-text)', fontSize: 13,
              }}
            >
              <ColorDot hex={step.hex} size={22} />
              <span style={{ fontFamily: 'monospace', fontWeight: i === safeIdx ? 600 : 400, flex: 1 }}>
                {step.name}
              </span>
              <span style={{ fontSize: 11, color: 'var(--p-text-secondary)', fontFamily: 'monospace' }}>
                {step.hex}
              </span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

function AddTokenModal({ rampNames, surfaceNames, rampMap, scales, surfaces, onClose, onAddSurface, onAddSemantic, onAddAlpha }: {
  rampNames: string[];
  surfaceNames: string[];
  rampMap: Map<string, GeneratedRamp>;
  scales: ColorScale[];
  surfaces: Record<string, PortableSurfaceToken>;
  onClose: () => void;
  onAddSurface: (name: string, token: PortableSurfaceToken) => void;
  onAddSemantic: (kind: 'foreground' | 'nonText', name: string, token: PortableSemanticToken) => void;
  onAddAlpha: (name: string, token: PortableAlphaToken) => void;
}) {
  const [kind, setKind] = useState<TokenKind>('surface');
  const [name, setName] = useState('');
  const [ramp, setRamp] = useState(rampNames[0] ?? '');
  const [surface, setSurface] = useState(surfaceNames[0] ?? '');
  const [pref, setPref] = useState<PortableSemanticToken['preference']>('lowest-passing');
  const [cons, setCons] = useState<PortableSemanticToken['consistency']>('independent');
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  const rampObj = rampMap.get(ramp);
  const rampLastIdx = (rampObj?.steps.length ?? 1) - 1;
  const [lightStep, setLightStep] = useState(0);
  const [darkStep, setDarkStep] = useState(rampLastIdx);

  // Alpha-specific state
  const [alphaSubKind, setAlphaSubKind] = useState<'scrim' | 'token'>('scrim');
  const [alphaStep, setAlphaStep] = useState(rampLastIdx);
  const [alphaValue, setAlphaValue] = useState(0.4);
  const [alphaRefSurface, setAlphaRefSurface] = useState('');
  const [alphaPref, setAlphaPref] = useState<'lowest-passing' | 'highest-contrast'>('lowest-passing');
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
      if (!surface) { setError('Surface is required'); return; }
      onAddSemantic(kind, n, { ramp, surfaces: [surface], preference: pref, consistency: cons });
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
        if (!surface) { setError('Surface is required'); return; }
        const token: PortableAlphaToken = {
          baseRamp: ramp,
          value: alphaValue,
          surfaces: [surface],
          preference: alphaPref,
          usage: alphaUsage,
          ...(alphaRefSurface ? { referenceSurface: alphaRefSurface } : {}),
        };
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

  const selectedRampSourceHex = scales.find((s) => s.name === ramp)?.sourceHex;

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ColorDot hex={selectedRampSourceHex} size={16} />
              <select style={{ ...modalSel, flex: 1 }} value={ramp} onChange={(e) => setRamp(e.target.value)}>
                {rampNames.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
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
                <span style={label}>Surface</span>
                {surfaceNames.length === 0 ? (
                  <span style={{ fontSize: 12, color: 'var(--p-text-tertiary)', fontStyle: 'italic' }}>
                    Add a surface first
                  </span>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {(() => {
                      const st = surfaces[surface];
                      const sr = st ? rampMap.get(st.ramp) : null;
                      const li = st ? (st.lightStep ?? st.step ?? 0) : 0;
                      const hex = sr?.steps[Math.max(0, Math.min(li, sr.steps.length - 1))]?.hex;
                      return <ColorDot hex={hex} size={16} />;
                    })()}
                    <select style={{ ...modalSel, flex: 1 }} value={surface} onChange={(e) => setSurface(e.target.value)}>
                      {surfaceNames.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div style={field}>
                <span style={label}>Preference</span>
                <select
                  style={modalSel}
                  value={pref}
                  onChange={(e) => {
                    const next = e.target.value as typeof pref;
                    setPref(next);
                    setCons(coercePrefConsistency(next, cons as Cons));
                  }}
                >
                  {PREFS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div style={field}>
                <span style={label}>Consistency</span>
                <select style={modalSel} value={cons} onChange={(e) => setCons(e.target.value as typeof cons)}>
                  {CONS.map((c) => (
                    <option key={c} value={c} disabled={consistencyDisabledFor(pref, c)}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
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
                    <span style={label}>Contrast surface</span>
                    {surfaceNames.length === 0 ? (
                      <span style={{ fontSize: 12, color: 'var(--p-text-tertiary)', fontStyle: 'italic' }}>Add a surface first</span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {(() => {
                          const st = surfaces[surface];
                          const sr = st ? rampMap.get(st.ramp) : null;
                          const li = st ? (st.lightStep ?? st.step ?? 0) : 0;
                          const hex = sr?.steps[Math.max(0, Math.min(li, sr.steps.length - 1))]?.hex;
                          return <ColorDot hex={hex} size={16} />;
                        })()}
                        <select style={{ ...modalSel, flex: 1 }} value={surface} onChange={(e) => setSurface(e.target.value)}>
                          {surfaceNames.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={field}>
                      <span style={label}>Preference</span>
                      <select style={modalSel} value={alphaPref} onChange={(e) => setAlphaPref(e.target.value as typeof alphaPref)}>
                        {ALPHA_PREFS.map((p) => <option key={p}>{p}</option>)}
                      </select>
                    </div>
                    <div style={field}>
                      <span style={label}>Usage</span>
                      <select style={modalSel} value={alphaUsage} onChange={(e) => setAlphaUsage(e.target.value as typeof alphaUsage)}>
                        <option value="nonText">nonText</option>
                        <option value="text">text</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Reference surface (optional, both types) */}
              <div style={field}>
                <span style={label}>Reference surface <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></span>
                <select style={modalSel} value={alphaRefSurface} onChange={(e) => setAlphaRefSurface(e.target.value)}>
                  <option value="">auto (bgMain / bgInverse per mode)</option>
                  {surfaceNames.map((s) => <option key={s}>{s}</option>)}
                </select>
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
  const loadFromText = useVocabStore((s) => s.loadFromText);
  const addSurface = useVocabStore((s) => s.addSurface);
  const updateSurface = useVocabStore((s) => s.updateSurface);
  const removeSurface = useVocabStore((s) => s.removeSurface);
  const addToken = useVocabStore((s) => s.addToken);
  const updateToken = useVocabStore((s) => s.updateToken);
  const addDecorative = useVocabStore((s) => s.addDecorative);
  const removeToken = useVocabStore((s) => s.removeToken);
  const addAlpha = useVocabStore((s) => s.addAlpha);
  const updateAlpha = useVocabStore((s) => s.updateAlpha);
  const removeAlpha = useVocabStore((s) => s.removeAlpha);
  const exportYaml = useVocabStore((s) => s.exportYaml);
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

  const fileRef = useRef<HTMLInputElement>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [view, setView] = useState<'edit' | 'preview'>('edit');

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      loadFromText(reader.result as string, ec());
      setShowPaste(false);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleApplyPaste() {
    if (pasteText.trim()) {
      loadFromText(pasteText, ec());
      setPasteText('');
      setShowPaste(false);
    }
  }

  function handleExport() {
    const yaml = exportYaml();
    if (!yaml) return;
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'tokens.yaml'; a.click();
    URL.revokeObjectURL(url);
  }

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
          {(['edit', 'preview'] as const).map((v) => {
            const active = view === v;
            return (
              <button key={v} onClick={() => setView(v)} style={{
                border: 'none',
                background: active ? 'var(--p-text)' : 'transparent',
                color: active ? 'var(--p-bg)' : 'var(--p-text-secondary)',
                fontSize: 10, fontWeight: 600,
                textTransform: 'uppercase' as const, letterSpacing: '0.04em',
                padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
              }}>
                {v}
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
        <button style={btn} onClick={() => setShowPaste((v) => !v)}>
          {showPaste ? 'Cancel paste' : 'Paste YAML'}
        </button>
        <input ref={fileRef} type="file" accept=".yaml,.yml,.json" onChange={handleFileUpload} style={{ display: 'none' }} />
        <button style={btn} onClick={() => fileRef.current?.click()}>Upload</button>
        {raw && (
          <>
            <button style={btn} onClick={handleExport}>Export</button>
            <button style={{ ...btn, color: 'var(--p-text-secondary)' }} onClick={clear}>Clear</button>
          </>
        )}
        {error && <span style={{ fontSize: 12, color: '#e55' }}>{error}</span>}
      </div>

      {/* Paste area */}
      {showPaste && (
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--p-border)', background: 'var(--p-bg-subtle)', flexShrink: 0 }}>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste tokens.yaml content here…"
            style={{
              width: '100%', minHeight: 120, padding: 8, fontSize: 12,
              fontFamily: 'monospace', background: 'var(--p-bg)',
              border: '1px solid var(--p-border)', borderRadius: 6,
              color: 'var(--p-text-secondary)', resize: 'vertical' as const,
              boxSizing: 'border-box' as const,
            }}
          />
          <button style={{ ...btn, marginTop: 6, borderColor: 'var(--p-accent)', color: 'var(--p-accent)' }} onClick={handleApplyPaste}>
            Apply
          </button>
        </div>
      )}

      {/* No ramps hint (edit only) */}
      {view === 'edit' && rampNames.length === 0 && (
        <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--p-text-secondary)', borderBottom: '1px solid var(--p-border)' }}>
          Add ramps in the Primitives tab first — they become the available ramp options when defining tokens.
        </div>
      )}

      {/* Preview view */}
      {view === 'preview' && <TokensPreview />}

      {/* Edit view — sections */}
      {view === 'edit' && (
        <div style={{ flex: 1, overflow: 'auto' }}>

          {/* Surfaces */}
          <div style={FIRST_SECTION}>Surfaces</div>
          <div style={{ ...HEADER, gridTemplateColumns: SURFACE_ROW_SPLIT.gridTemplateColumns }}>
            <span>name</span><span>ramp</span><span>light / all</span><span>dark</span><span />
          </div>
          {Object.entries(surfaces).map(([name, token]) => (
            <SurfaceRow
              key={name}
              name={name}
              token={token}
              rampNames={rampNames}
              rampMap={rampMap}
              scales={scales}
              onUpdate={(u) => updateSurface(name, u, ec())}
              onDelete={() => removeSurface(name, ec())}
            />
          ))}
          {surfaceNames.length === 0 && (
            <div style={EMPTY_ROW}>No surfaces yet — use + Add to create one</div>
          )}

          {/* Foreground */}
          <div style={SECTION}>Foreground</div>
          <div style={HEADER}>
            <span>name</span><span>ramp</span><span>surface</span><span>preference</span><span>consistency</span><span />
          </div>
          {Object.entries(foreground).map(([name, token]) => (
            <SemanticRow
              key={name}
              name={name}
              token={token}
              rampNames={rampNames}
              surfaceNames={surfaceNames}
              rampMap={rampMap}
              scales={scales}
              surfaces={surfaces}
              onUpdate={(u) => updateToken('foreground', name, u, ec())}
              onDelete={() => removeToken('foreground', name, ec())}
            />
          ))}
          {Object.keys(foreground).length === 0 && (
            <div style={EMPTY_ROW}>No foreground tokens yet</div>
          )}

          {/* NonText */}
          <div style={SECTION}>NonText</div>
          <div style={HEADER}>
            <span>name</span><span>ramp</span><span>surface</span><span>preference</span><span>consistency</span><span />
          </div>
          {Object.entries(nonText).map(([name, token]) => (
            <SemanticRow
              key={name}
              name={name}
              token={token}
              rampNames={rampNames}
              surfaceNames={surfaceNames}
              rampMap={rampMap}
              scales={scales}
              surfaces={surfaces}
              onUpdate={(u) => updateToken('nonText', name, u, ec())}
              onDelete={() => removeToken('nonText', name, ec())}
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
                <span>name</span><span>ramp</span><span>step</span><span /><span />
              </div>
              {Object.entries(decorative).map(([name, token]) => {
                const stepIdx = token.step ?? 0;
                return (
                  <div key={name} style={SURFACE_ROW_SPLIT}>
                    <span style={{ fontFamily: 'monospace', color: 'var(--p-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                    <RampSelect
                      rampNames={rampNames}
                      value={token.ramp}
                      onChange={(r) => addDecorative(name, { ...token, ramp: r }, ec())}
                      scales={scales}
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
                <span>name</span><span>ramp</span><span>step / surface</span><span>α</span><span>ref / pref</span><span />
              </div>
              {Object.entries(alpha).map(([name, token]) => (
                <AlphaRow
                  key={name}
                  name={name}
                  token={token}
                  rampNames={rampNames}
                  surfaceNames={Object.keys(surfaces)}
                  rampMap={rampMap}
                  scales={scales}
                  surfaces={surfaces}
                  onUpdate={(u) => updateAlpha(name, u, ec())}
                  onDelete={() => removeAlpha(name, ec())}
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
          scales={scales}
          surfaces={surfaces}
          onClose={() => setShowAddModal(false)}
          onAddSurface={(n, t) => addSurface(n, t, ec())}
          onAddSemantic={(kind, n, t) => addToken(kind, n, t, ec())}
          onAddAlpha={(n, t) => addAlpha(n, t, ec())}
        />
      )}
    </div>
  );
}
