import { useState, useEffect, useRef, useId } from 'react';
import type { ColorScale, GeneratedStep } from '../../types/palette';
import { usePaletteStore } from '../../store/paletteStore';
import { getContrast, getApcaContrast, sourceWithChromaToHex, autoHueShiftBase, nearestPrimary, maxP3Chroma, maxSrgbChroma } from '../../lib/colorMath';
import { useGeneratedRamp } from '../../hooks/useGeneratedRamp';
import { LockIcon } from '../icons/LockIcon';
import { canonicalScaleName } from '../../lib/scaleNaming';

const supportsP3 = typeof CSS !== 'undefined' && CSS.supports('color', 'color(display-p3 0 0 0)');

interface Props {
  scale: ColorScale;
  activeStep: GeneratedStep | null;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--p-text-secondary)', marginBottom: 8 }}>
      {children}
    </div>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} style={{ fontSize: 12, color: 'var(--p-text-secondary)', marginBottom: 4, display: 'block' }}>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  fontSize: 13,
  background: 'var(--p-bg)',
  border: '1px solid var(--p-border)',
  borderRadius: 6,
  color: 'var(--p-text)',
};

const sectionStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid var(--p-border)',
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function RightPanel({ scale, activeStep }: Props) {
  const idBase = useId();
  const nameId = `${idBase}-scale-name`;
  const sourceHexId = `${idBase}-source-hex`;
  const chromaRangeId = `${idBase}-chroma-range`;
  const chromaLowRangeId = `${idBase}-chroma-low-range`;
  const chromaHighRangeId = `${idBase}-chroma-high-range`;
  const lightEndAdjustId = `${idBase}-light-end-adjust`;
  const darkEndAdjustId = `${idBase}-dark-end-adjust`;
  const updateSourceHex = usePaletteStore((s) => s.updateSourceHex);
  const updateScaleName = usePaletteStore((s) => s.updateScaleName);
  const nameKey = canonicalScaleName(scale.name);
  const nameConflict = usePaletteStore((s) =>
    s.scales.some(
      (candidateScale) =>
        candidateScale.id !== scale.id && canonicalScaleName(candidateScale.name) === nameKey,
    ),
  );
  const updateHueShift = usePaletteStore((s) => s.updateHueShift);
  const updateChromaPeak = usePaletteStore((s) => s.updateChromaPeak);
  const updateChromaLow = usePaletteStore((s) => s.updateChromaLow);
  const updateChromaHigh = usePaletteStore((s) => s.updateChromaHigh);
  const setChromaShapeAll = usePaletteStore((s) => s.setChromaShapeAll);
  const setChromaCurveValues = usePaletteStore((s) => s.setChromaCurveValues);
  const updateCurveSmoothing = usePaletteStore((s) => s.updateCurveSmoothing);
  const beginCurveEdit = usePaletteStore((s) => s.beginCurveEdit);
  const commitCurveEdit = usePaletteStore((s) => s.commitCurveEdit);
  const removeScale = usePaletteStore((s) => s.removeScale);
  const toggleScaleLock = usePaletteStore((s) => s.toggleScaleLock);
  const contrastMode = usePaletteStore((s) => s.contrastMode);
  const ramp = useGeneratedRamp(scale);

  const [confirmDelete, setConfirmDelete] = useState(false);

  // --- Hex input draft ---
  const [hexDraft, setHexDraft] = useState(scale.sourceHex);
  const hexFocused = useRef(false);
  useEffect(() => {
    if (!hexFocused.current) setHexDraft(scale.sourceHex);
  }, [scale.sourceHex]);

  function commitHex() {
    hexFocused.current = false;
    if (HEX_RE.test(hexDraft)) updateSourceHex(scale.id, hexDraft);
    else setHexDraft(scale.sourceHex);
  }

  // --- Chroma draft (number next to slider) ---
  const [chromaDraft, setChromaDraft] = useState(scale.chromaPeak.toFixed(3));
  const chromaFocused = useRef(false);
  useEffect(() => {
    if (!chromaFocused.current) setChromaDraft(scale.chromaPeak.toFixed(3));
  }, [scale.chromaPeak]);

  function commitChroma() {
    chromaFocused.current = false;
    const v = parseFloat(chromaDraft);
    if (isFinite(v)) updateChromaPeak(scale.id, v);
    else setChromaDraft(scale.chromaPeak.toFixed(3));
  }

  // --- Chroma low draft ---
  const chromaLowVal = scale.chromaLow ?? 0;
  const [chromaLowDraft, setChromaLowDraft] = useState(chromaLowVal.toFixed(3));
  const chromaLowFocused = useRef(false);
  useEffect(() => {
    if (!chromaLowFocused.current) setChromaLowDraft(chromaLowVal.toFixed(3));
  }, [chromaLowVal]);

  function commitChromaLow() {
    chromaLowFocused.current = false;
    const v = parseFloat(chromaLowDraft);
    if (isFinite(v)) updateChromaLow(scale.id, v);
    else setChromaLowDraft(chromaLowVal.toFixed(3));
  }

  // --- Chroma high draft ---
  const chromaHighVal = scale.chromaHigh ?? 0;
  const [chromaHighDraft, setChromaHighDraft] = useState(chromaHighVal.toFixed(3));
  const chromaHighFocused = useRef(false);
  useEffect(() => {
    if (!chromaHighFocused.current) setChromaHighDraft(chromaHighVal.toFixed(3));
  }, [chromaHighVal]);

  function commitChromaHigh() {
    chromaHighFocused.current = false;
    const v = parseFloat(chromaHighDraft);
    if (isFinite(v)) updateChromaHigh(scale.id, v);
    else setChromaHighDraft(chromaHighVal.toFixed(3));
  }

  return (
    <aside
      className="shrink-0 overflow-y-auto"
      style={{ width: 260, background: 'var(--p-bg-subtle)', borderLeft: '1px solid var(--p-border)' }}
    >
      {/* Scale name + source color */}
      <div style={sectionStyle}>
        <SectionLabel>Scale</SectionLabel>

        <FieldLabel htmlFor={nameId}>Name</FieldLabel>
        <input
          id={nameId}
          name="scale-name"
          type="text"
          value={scale.name}
          onChange={(e) => updateScaleName(scale.id, e.target.value)}
          style={{
            ...inputStyle,
            ...(nameConflict ? { borderColor: 'var(--p-warning)' } : {}),
          }}
          className="focus-visible-ring"
          autoComplete="off"
          aria-invalid={nameConflict || undefined}
          aria-describedby={nameConflict ? `${nameId}-warning` : undefined}
        />
        {nameConflict && (
          <div
            id={`${nameId}-warning`}
            role="status"
            style={{ fontSize: 11, color: 'var(--p-warning)', marginTop: 4, lineHeight: 1.4 }}
          >
            Another scale in this palette has the same name. Export will suffix this one (e.g. “{nameKey} 2”) to keep both.
          </div>
        )}

        <button
          type="button"
          onClick={() => toggleScaleLock(scale.id)}
          title={scale.lockedFromOverrides ? 'Unlock from global overrides' : 'Lock from global overrides'}
          className="focus-visible-ring"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 8,
            padding: '4px 0',
            fontSize: 12,
            color: scale.lockedFromOverrides ? 'var(--p-accent)' : 'var(--p-text-secondary)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <LockIcon locked={scale.lockedFromOverrides} />
          {scale.lockedFromOverrides ? 'Locked from overrides' : 'Lock from overrides'}
        </button>

        <div style={{ marginTop: 12 }}>
          <FieldLabel htmlFor={sourceHexId}>Source color</FieldLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <input
              type="color"
              value={sourceWithChromaToHex(scale.sourceOklch.l, scale.chromaPeak, scale.sourceOklch.h)}
              onChange={(e) => updateSourceHex(scale.id, e.target.value)}
              aria-label="Source color picker"
              style={{
                width: 32,
                height: 32,
                padding: 0,
                border: '1px solid var(--p-border)',
                borderRadius: 4,
                cursor: 'pointer',
                background: 'none',
              }}
            />
            <input
              id={sourceHexId}
              name="source-hex"
              type="text"
              value={hexDraft}
              onFocus={() => { hexFocused.current = true; }}
              onChange={(e) => setHexDraft(e.target.value)}
              onBlur={commitHex}
              onKeyDown={(e) => { if (e.key === 'Enter') commitHex(); }}
              style={{ ...inputStyle, width: 'auto', flex: 1, fontFamily: 'monospace', fontSize: 12 }}
              className="focus-visible-ring"
            />
          </div>
          <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--p-text-secondary)', lineHeight: 1.8 }}>
            <div>L {scale.sourceOklch.l.toFixed(4)}</div>
            <div>C {scale.sourceOklch.c.toFixed(4)}</div>
            <div>H {scale.sourceOklch.h.toFixed(2)}°</div>
          </div>
        </div>
      </div>

      {/* Chroma */}
      <div style={sectionStyle}>
        <SectionLabel>Chroma</SectionLabel>
        <FieldLabel htmlFor={chromaLowRangeId}>Low-end chroma (light)</FieldLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            id={chromaLowRangeId}
            type="range"
            min={0}
            max={0.4}
            step={0.001}
            value={chromaLowVal}
            onPointerDown={() => beginCurveEdit(scale.id)}
            onChange={(e) => updateChromaLow(scale.id, parseFloat(e.target.value))}
            onPointerUp={() => commitCurveEdit()}
            style={{ flex: 1, accentColor: 'var(--p-accent)' }}
            aria-label="Low-end chroma"
          />
          <input
            name="low-chroma"
            type="number"
            min={0}
            max={0.4}
            step={0.001}
            value={chromaLowDraft}
            onFocus={() => { chromaLowFocused.current = true; }}
            onChange={(e) => setChromaLowDraft(e.target.value)}
            onBlur={commitChromaLow}
            onKeyDown={(e) => { if (e.key === 'Enter') commitChromaLow(); }}
            style={{
              ...inputStyle,
              width: 64,
              textAlign: 'right',
              fontFamily: 'monospace',
              fontSize: 12,
              padding: '4px 6px',
            }}
            className="focus-visible-ring"
            aria-label="Low-end chroma numeric value"
          />
        </div>

        <FieldLabel htmlFor={chromaRangeId}>Mid chroma (0 – 0.4)</FieldLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            id={chromaRangeId}
            type="range"
            min={0}
            max={0.4}
            step={0.001}
            value={scale.chromaPeak}
            onPointerDown={() => beginCurveEdit(scale.id)}
            onChange={(e) => updateChromaPeak(scale.id, parseFloat(e.target.value))}
            onPointerUp={() => commitCurveEdit()}
            style={{ flex: 1, accentColor: 'var(--p-accent)' }}
            aria-label="Mid chroma"
          />
          <input
            name="mid-chroma"
            type="number"
            min={0}
            max={0.4}
            step={0.001}
            value={chromaDraft}
            onFocus={() => { chromaFocused.current = true; }}
            onChange={(e) => setChromaDraft(e.target.value)}
            onBlur={commitChroma}
            onKeyDown={(e) => { if (e.key === 'Enter') commitChroma(); }}
            style={{
              ...inputStyle,
              width: 64,
              textAlign: 'right',
              fontFamily: 'monospace',
              fontSize: 12,
              padding: '4px 6px',
            }}
            className="focus-visible-ring"
            aria-label="Mid chroma numeric value"
          />
        </div>

        <FieldLabel htmlFor={chromaHighRangeId}>High-end chroma (dark)</FieldLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            id={chromaHighRangeId}
            type="range"
            min={0}
            max={0.4}
            step={0.001}
            value={chromaHighVal}
            onPointerDown={() => beginCurveEdit(scale.id)}
            onChange={(e) => updateChromaHigh(scale.id, parseFloat(e.target.value))}
            onPointerUp={() => commitCurveEdit()}
            style={{ flex: 1, accentColor: 'var(--p-accent)' }}
            aria-label="High-end chroma"
          />
          <input
            name="high-chroma"
            type="number"
            min={0}
            max={0.4}
            step={0.001}
            value={chromaHighDraft}
            onFocus={() => { chromaHighFocused.current = true; }}
            onChange={(e) => setChromaHighDraft(e.target.value)}
            onBlur={commitChromaHigh}
            onKeyDown={(e) => { if (e.key === 'Enter') commitChromaHigh(); }}
            style={{
              ...inputStyle,
              width: 64,
              textAlign: 'right',
              fontFamily: 'monospace',
              fontSize: 12,
              padding: '4px 6px',
            }}
            className="focus-visible-ring"
            aria-label="High-end chroma numeric value"
          />
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button
            onClick={() => setChromaShapeAll(chromaLowVal, scale.chromaPeak, chromaHighVal)}
            className="focus-visible-ring"
            style={{
              flex: 1,
              padding: '5px 8px',
              fontSize: 12,
              background: 'var(--p-bg)',
              border: '1px solid var(--p-border)',
              borderRadius: 6,
              color: 'var(--p-text-secondary)',
              cursor: 'pointer',
            }}
          >
            Apply to all
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button
            onClick={() => {
              const values = ramp.steps.map((step) => maxSrgbChroma(step.oklch.l, step.oklch.h));
              setChromaCurveValues(scale.id, values);
            }}
            className="focus-visible-ring"
            style={{
              flex: 1,
              padding: '5px 8px',
              fontSize: 12,
              background: 'var(--p-bg)',
              border: '1px solid var(--p-border)',
              borderRadius: 6,
              color: 'var(--p-text-secondary)',
              cursor: 'pointer',
            }}
          >
            Pin to sRGB
          </button>
          <button
            onClick={() => {
              const values = ramp.steps.map((step) => maxP3Chroma(step.oklch.l, step.oklch.h));
              setChromaCurveValues(scale.id, values);
            }}
            className="focus-visible-ring"
            style={{
              flex: 1,
              padding: '5px 8px',
              fontSize: 12,
              background: 'var(--p-bg)',
              border: '1px solid var(--p-border)',
              borderRadius: 6,
              color: 'var(--p-text-secondary)',
              cursor: 'pointer',
            }}
          >
            Pin to P3
          </button>
        </div>
      </div>

      {/* Curve Smoothing */}
      <div style={sectionStyle}>
        <SectionLabel>Curve Smoothing</SectionLabel>
        <p style={{ fontSize: 11, color: 'var(--p-text-tertiary)', marginBottom: 10, lineHeight: 1.4 }}>
          Blends interior nodes toward a smooth average. Leaf nodes (first/last) are always preserved.
        </p>
        {(
          [
            { key: 'lightness' as const, label: 'Lightness', color: '#d97706' },
            { key: 'chroma'    as const, label: 'Chroma',    color: '#059669' },
            { key: 'hue'       as const, label: 'Hue',       color: '#7c3aed' },
          ]
        ).map(({ key, label, color }) => {
          const value = scale.curves[key].smoothing ?? 0;
          return (
            <label key={key} style={{ display: 'block', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--p-text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, display: 'inline-block', flexShrink: 0 }} />
                  {label}
                </span>
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--p-text-tertiary)' }}>
                  {(value * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={value}
                onPointerDown={() => beginCurveEdit(scale.id)}
                onChange={(e) => updateCurveSmoothing(scale.id, key, parseFloat(e.target.value))}
                onPointerUp={() => commitCurveEdit()}
                style={{ width: '100%', accentColor: color }}
                aria-label={`${label} smoothing`}
              />
            </label>
          );
        })}
      </div>

      {/* Hue shift */}
      <div style={sectionStyle}>
        <SectionLabel>Hue shift</SectionLabel>
        {(() => {
          const lightStep = ramp.steps[0];
          const darkStep = ramp.steps[ramp.steps.length - 1];
          const primaryNameFor = (p: number) => p === 0 ? 'R' : p === 120 ? 'G' : 'B';
          const ends = [
            { key: 'lightEndAdjust' as const, label: 'Light', dotColor: 'var(--p-text-secondary)', stepHue: lightStep?.oklch.h ?? scale.sourceOklch.h },
            { key: 'darkEndAdjust'  as const, label: 'Dark',  dotColor: 'var(--p-text-tertiary)',  stepHue: darkStep?.oklch.h ?? scale.sourceOklch.h },
          ] as const;
          return ends.map(({ key, label, dotColor, stepHue }) => {
            const adjust = scale.hueShift[key];
            const primary = nearestPrimary(stepHue);
            const pName = primaryNameFor(primary);
            const dist = Math.round(Math.abs(((stepHue - primary + 180) % 360) - 180));
            const autoBase = Math.round(autoHueShiftBase(stepHue));
            const effectiveDeg = Math.round(autoBase + adjust);
            return (
              <div key={key} style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label htmlFor={key === 'lightEndAdjust' ? lightEndAdjustId : darkEndAdjustId} style={{ fontSize: 11, color: 'var(--p-text-secondary)', display: 'flex', alignItems: 'center', gap: 4, width: 48, flexShrink: 0 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: dotColor, display: 'inline-block', flexShrink: 0 }} />
                    {label}
                  </label>
                  <input
                    id={key === 'lightEndAdjust' ? lightEndAdjustId : darkEndAdjustId}
                    name={key}
                    type="number"
                    min={-90}
                    max={90}
                    value={adjust}
                    onChange={(e) => {
                      const v = Math.max(-90, Math.min(90, parseInt(e.target.value) || 0));
                      updateHueShift(scale.id, key, v);
                    }}
                    style={{
                      ...inputStyle,
                      width: 52,
                      textAlign: 'right',
                      fontFamily: 'monospace',
                      fontSize: 12,
                      padding: '3px 6px',
                      flexShrink: 0,
                    }}
                    className="focus-visible-ring"
                  />
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--p-text-tertiary)', whiteSpace: 'nowrap' }}>
                    = {effectiveDeg}°
                  </span>
                </div>
                <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--p-text-tertiary)', marginTop: 2, paddingLeft: 58 }}>
                  h {Math.round(stepHue)}° → {pName} ({primary}°) · {dist}° away · auto {autoBase}°
                </div>
              </div>
            );
          });
        })()}
      </div>

      {/* Active step detail */}
      {activeStep && (
        <div style={sectionStyle}>
          {/* Step name + gamut badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--p-text-secondary)', margin: 0 }}>
              {activeStep.name}
            </p>
            <span
              title={activeStep.gamut === 'p3'
                ? 'Wide-gamut Display P3 color — appears more vivid on supported displays; hex is the sRGB fallback'
                : 'Standard sRGB color — renders identically on all displays'}
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: 4,
                background: activeStep.gamut === 'p3' ? '#78350f' : 'var(--p-bg-inset)',
                color: activeStep.gamut === 'p3' ? '#fde68a' : 'var(--p-text-secondary)',
                letterSpacing: '0.03em',
                cursor: 'default',
              }}
            >
              {activeStep.gamut === 'p3' ? 'P3' : 'sRGB'}
            </span>
          </div>

          {/* Swatches */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
              <div
                style={{ width: 32, height: activeStep.gamut === 'p3' ? 13 : 32, borderRadius: 3, backgroundColor: activeStep.hex, border: '1px solid var(--p-border)' }}
                title="sRGB hex — safe fallback for all displays"
              />
              {activeStep.gamut === 'p3' && activeStep.displayP3 && (
                <div
                  style={{ width: 32, height: 13, borderRadius: 3, backgroundColor: supportsP3 ? activeStep.displayP3 : activeStep.hex, border: '1px solid var(--p-border)' }}
                  title="Display P3 — wide-gamut rendering on supported displays"
                />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Hex row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: 'var(--p-text-secondary)', flexShrink: 0 }}>
                  Hex (sRGB)
                </span>
                <button
                  aria-label={`Copy hex value ${activeStep.hex}`}
                  className="focus-visible-ring copyable-value"
                  style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--p-text)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                  title="Click to copy"
                  onClick={() => navigator.clipboard?.writeText(activeStep.hex)?.catch(() => {})}
                >
                  {activeStep.hex}
                </button>
              </div>
              {/* Display P3 row */}
              {activeStep.gamut === 'p3' && activeStep.displayP3 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--p-text-secondary)', flexShrink: 0 }}>
                    Display P3
                  </span>
                  <button
                    aria-label={`Copy Display P3 value ${activeStep.displayP3}`}
                    className="focus-visible-ring copyable-value"
                    style={{ fontFamily: 'monospace', fontSize: 9, color: 'var(--p-text)', cursor: 'pointer', textAlign: 'right', wordBreak: 'break-all', background: 'none', border: 'none', padding: 0 }}
                    title="Click to copy"
                    onClick={() => navigator.clipboard?.writeText(activeStep.displayP3!)?.catch(() => {})}
                  >
                    {activeStep.displayP3}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* OKLCH */}
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--p-text-tertiary)', marginBottom: 3 }}>
            OKLCH
          </div>
          <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--p-text-secondary)', lineHeight: 1.8, marginBottom: 8 }}>
            <div>L {activeStep.oklch.l.toFixed(4)}</div>
            <div>C {activeStep.oklch.c.toFixed(4)}</div>
            <div>H {activeStep.oklch.h.toFixed(2)}°</div>
          </div>

          {/* Contrast */}
          <div style={{ fontSize: 12, color: 'var(--p-text-secondary)' }}>
            {contrastMode === 'apca'
              ? [['#ffffff', 'on white'] as const, ['#000000', 'on black'] as const].map(([bg, label]) => {
                  const lc = getApcaContrast(activeStep.hex, bg);
                  const absLc = Math.abs(lc);
                  const passing = absLc >= 45;
                  return (
                    <div key={bg} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span>{label}</span>
                      <span style={{ fontFamily: 'monospace', color: 'var(--p-text)' }}>
                        Lc {lc.toFixed(1)}
                        <span style={{ marginLeft: 6, fontSize: 10, color: passing ? 'var(--p-success)' : 'var(--p-danger)', fontWeight: 600 }}>
                          {absLc >= 75 ? '75+' : absLc >= 60 ? '60+' : absLc >= 45 ? '45+' : 'Fail'}
                        </span>
                      </span>
                    </div>
                  );
                })
              : [['#ffffff', 'on white'] as const, ['#000000', 'on black'] as const].map(([bg, label]) => {
                  const c = getContrast(activeStep.hex, bg);
                  return (
                    <div key={bg} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span>{label}</span>
                      <span style={{ fontFamily: 'monospace', color: 'var(--p-text)' }}>
                        {c.ratio.toFixed(2)}
                        <span style={{ marginLeft: 6, fontSize: 10, color: c.level === 'fail' ? 'var(--p-danger)' : 'var(--p-success)', fontWeight: 600 }}>
                          {c.level === 'fail' ? 'Fail' : c.level}
                        </span>
                      </span>
                    </div>
                  );
                })}
          </div>
        </div>
      )}

      {/* Delete scale — last section */}
      <div style={{ ...sectionStyle, borderBottom: 'none' }}>
        <SectionLabel>Danger zone</SectionLabel>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="focus-visible-ring"
            style={{
              width: '100%',
              padding: '5px 8px',
              fontSize: 12,
              background: 'var(--p-bg)',
              border: '1px solid var(--p-border)',
              borderRadius: 6,
              color: 'var(--p-danger)',
              cursor: 'pointer',
            }}
          >
            Delete scale
          </button>
        ) : (
          <div>
            <p style={{ fontSize: 12, color: 'var(--p-text)', marginBottom: 8, lineHeight: 1.4 }}>
              Delete <strong>{scale.name}</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => removeScale(scale.id)}
                className="focus-visible-ring"
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  fontSize: 12,
                  fontWeight: 600,
                  background: 'var(--p-danger)',
                  border: '1px solid var(--p-danger)',
                  borderRadius: 6,
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="focus-visible-ring"
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  fontSize: 12,
                  background: 'var(--p-bg)',
                  border: '1px solid var(--p-border)',
                  borderRadius: 6,
                  color: 'var(--p-text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
