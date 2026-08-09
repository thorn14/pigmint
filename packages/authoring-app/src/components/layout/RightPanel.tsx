import { useState, useEffect, useRef, useId, useMemo } from 'react';
import type { ColorScale, GamutTarget, GeneratedRamp, GeneratedStep } from '../../types/palette';
import { formatCss } from 'culori';
import { useIntentStore } from '../../store/intentStore';
import { usePaletteStore, useTargetGamut } from '../../store/paletteStore';
import {
  getContrast,
  getApcaContrast,
  sourceWithChromaToHex,
  pinChromaCurveToGamut,
  validateRampGamut,
} from '../../lib/colorMath';
import { useGeneratedRamp } from '../../hooks/useGeneratedRamp';
import { canonicalScaleName } from '../../lib/scaleNaming';
import { supportsP3 } from '../../lib/gamutDisplay';
import { GamutPalettes } from '../ramp/GamutPalettes';
import { AppField, AppSlider, ConfirmDialog } from '../base-ui';

const PIN_TARGETS: readonly { gamut: GamutTarget; label: string }[] = [
  { gamut: 'srgb', label: 'sRGB' },
  { gamut: 'p3', label: 'P3' },
];

/**
 * Live read-out of how the ramp sits relative to its gamut boundary, so a pin
 * can be confirmed instead of assumed: right after pinning every step reports
 * as on the boundary, and any later chroma edit moves the count back down.
 */
function describePinState(ramp: GeneratedRamp, gamut: GamutTarget): string {
  const validation = validateRampGamut(ramp, gamut);
  const label = gamut === 'srgb' ? 'sRGB' : 'P3';

  if (!validation.ok) {
    const names = validation.offenders.map((o) => o.name).join(', ');
    return `${validation.offenders.length} step(s) fall outside ${label}: ${names}.`;
  }
  if (validation.stepCount === 0) return 'No steps to check.';
  if (validation.pinnedCount === validation.stepCount) {
    return `All ${validation.stepCount} steps sit on the ${label} boundary.`;
  }
  const shortfall = validation.maxShortfall.toFixed(3);
  if (validation.pinnedCount === 0) {
    return `Chroma is up to ${shortfall} inside the ${label} boundary.`;
  }
  return `${validation.pinnedCount} of ${validation.stepCount} steps sit on the ${label} boundary; the rest are up to ${shortfall} inside it.`;
}

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

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  fontSize: 13,
  background: 'var(--p-surface)',
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
  const updateSourceAlpha = usePaletteStore((s) => s.updateSourceAlpha);
  const setChromaShapeAll = usePaletteStore((s) => s.setChromaShapeAll);
  const setChromaCurveValues = usePaletteStore((s) => s.setChromaCurveValues);
  const updateCurveSmoothing = usePaletteStore((s) => s.updateCurveSmoothing);
  const beginCurveEdit = usePaletteStore((s) => s.beginCurveEdit);
  const commitCurveEdit = usePaletteStore((s) => s.commitCurveEdit);
  const removeScale = usePaletteStore((s) => s.removeScale);
  const apca = useIntentStore((s) => s.engineCompliance === 'apca');
  const targetGamut = useTargetGamut();
  const ramp = useGeneratedRamp(scale);
  const p3StepCount = ramp.steps.filter((step) => step.gamut === 'p3').length;

  const [confirmDelete, setConfirmDelete] = useState(false);
  // Report against the boundary that was last pinned, so pinning to sRGB inside
  // a P3 palette is checked against sRGB rather than against the wider target.
  const [pinnedGamut, setPinnedGamut] = useState<GamutTarget | null>(null);
  const checkedGamut: GamutTarget = targetGamut === 'srgb' ? 'srgb' : pinnedGamut ?? 'p3';
  const pinSummary = useMemo(() => describePinState(ramp, checkedGamut), [ramp, checkedGamut]);

  // --- Name input draft ---
  // Keep the displayed name in a local draft so clearing the field (e.g. select-all
  // + delete before retyping) never pushes an empty name to the store. An empty name
  // would desync token ramp refs from the scale; we only commit non-empty values and
  // revert to the last committed name on blur.
  const [nameDraft, setNameDraft] = useState(scale.name);
  const nameFocused = useRef(false);
  useEffect(() => {
    if (!nameFocused.current) setNameDraft(scale.name);
  }, [scale.name]);

  function commitName() {
    nameFocused.current = false;
    if (nameDraft.trim() === '') setNameDraft(scale.name);
  }

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
    <div
      style={{
        width: '100%',
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        background: 'var(--p-bg)',
      }}
    >
      {/* Scale name + source color */}
      <div style={sectionStyle}>
        <SectionLabel>Scale</SectionLabel>

        <AppField label="Name" htmlFor={nameId} invalid={nameConflict}>
          <input
            id={nameId}
            name="scale-name"
            type="text"
            value={nameDraft}
            onFocus={() => { nameFocused.current = true; }}
            onChange={(e) => {
              const v = e.target.value;
              setNameDraft(v);
              if (v.trim() !== '') updateScaleName(scale.id, v);
            }}
            onBlur={commitName}
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
        </AppField>

        <div style={{ marginTop: 12 }}>
          <AppField label="Source color" htmlFor={sourceHexId}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <input
                type="color"
                className="p-color-input focus-visible-ring"
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
          </AppField>
        </div>

        <div style={{ marginTop: 12 }}>
          <AppField label={`Alpha — ${Math.round(scale.sourceAlpha * 100)}%`} htmlFor={`${idBase}-alpha`}>
            <AppSlider
              id={`${idBase}-alpha`}
              value={scale.sourceAlpha}
              min={0}
              max={1}
              step={0.01}
              onValueChange={(v: number) => updateSourceAlpha(scale.id, v)}
            />
            {scale.sourceAlpha < 1 && (
              <div style={{ fontSize: 11, color: 'var(--p-text-secondary)', marginTop: 4 }}>
                Steps emit <code style={{ fontFamily: 'monospace' }}>oklch(L C H / {Math.round(scale.sourceAlpha * 100)}%)</code>
              </div>
            )}
          </AppField>
        </div>
      </div>

      {/* Chroma */}
      <div style={sectionStyle}>
        <SectionLabel>Chroma</SectionLabel>
        {([
          {
            id: chromaLowRangeId,
            name: 'low-chroma',
            label: 'Light',
            ariaLabel: 'Low-end chroma',
            value: chromaLowVal,
            draft: chromaLowDraft,
            setDraft: setChromaLowDraft,
            focusedRef: chromaLowFocused,
            commit: commitChromaLow,
            onChange: (v: number) => updateChromaLow(scale.id, v),
          },
          {
            id: chromaRangeId,
            name: 'mid-chroma',
            label: 'Mid',
            ariaLabel: 'Mid chroma',
            value: scale.chromaPeak,
            draft: chromaDraft,
            setDraft: setChromaDraft,
            focusedRef: chromaFocused,
            commit: commitChroma,
            onChange: (v: number) => updateChromaPeak(scale.id, v),
          },
          {
            id: chromaHighRangeId,
            name: 'high-chroma',
            label: 'Dark',
            ariaLabel: 'High-end chroma',
            value: chromaHighVal,
            draft: chromaHighDraft,
            setDraft: setChromaHighDraft,
            focusedRef: chromaHighFocused,
            commit: commitChromaHigh,
            onChange: (v: number) => updateChromaHigh(scale.id, v),
          },
        ] as const).map((row) => (
          <div key={row.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label
                htmlFor={row.id}
                style={{ flex: 1, fontSize: 12, color: 'var(--p-text-secondary)', fontWeight: 500 }}
              >
                {row.label}
              </label>
              <input
                name={row.name}
                type="number"
                min={0}
                max={0.4}
                step={0.001}
                value={row.draft}
                onFocus={() => { row.focusedRef.current = true; }}
                onChange={(e) => row.setDraft(e.target.value)}
                onBlur={row.commit}
                onKeyDown={(e) => { if (e.key === 'Enter') row.commit(); }}
                style={{
                  ...inputStyle,
                  width: 64,
                  textAlign: 'right',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  padding: '4px 6px',
                  flexShrink: 0,
                }}
                className="focus-visible-ring"
                aria-label={`${row.ariaLabel} numeric value`}
              />
            </div>
            <AppSlider
              id={row.id}
              value={row.value}
              min={0}
              max={0.4}
              step={0.001}
              onValueChange={row.onChange}
              onPointerDown={() => beginCurveEdit(scale.id)}
              onValueCommitted={() => commitCurveEdit()}
              aria-label={row.ariaLabel}
              style={{ width: '100%', flex: 'initial' }}
            />
          </div>
        ))}

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
      </div>

      {/* Gamut: pin chroma to a boundary, and compare P3 against its sRGB fallback */}
      <div style={sectionStyle}>
        <SectionLabel>Gamut</SectionLabel>

        {targetGamut === 'p3' ? (
          <>
            <GamutPalettes ramp={ramp} />
            <p style={{ fontSize: 11, color: 'var(--p-text-secondary)', margin: '8px 0 0', lineHeight: 1.4 }}>
              {p3StepCount === 0
                ? 'Every step already fits in sRGB, so both rows are identical.'
                : `${p3StepCount} of ${ramp.steps.length} steps reach into Display P3. The sRGB row is the hex fallback those steps export, and what an sRGB display shows.`}
            </p>
          </>
        ) : (
          <p style={{ fontSize: 11, color: 'var(--p-text-secondary)', margin: 0, lineHeight: 1.4 }}>
            This palette is sRGB-only: chroma is capped at the sRGB boundary and no
            step carries a Display P3 value. Set Gamut to Display P3 in the
            top-bar menu to author wide-gamut steps.
          </p>
        )}

        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {PIN_TARGETS.filter((target) => targetGamut === 'p3' || target.gamut === 'srgb').map(
            (target) => (
              <button
                key={target.gamut}
                onClick={() => {
                  const { values, smoothing } = pinChromaCurveToGamut(scale, target.gamut);
                  setChromaCurveValues(scale.id, values, smoothing);
                  setPinnedGamut(target.gamut);
                }}
                className="focus-visible-ring"
                title={`Set every step's chroma to the highest value that stays inside ${target.label}. Chroma smoothing is cleared, since smoothing would pull steps off the boundary.`}
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
                Pin to {target.label}
              </button>
            ),
          )}
        </div>

        <p
          role="status"
          style={{ fontSize: 11, color: 'var(--p-text-secondary)', margin: '6px 0 0', lineHeight: 1.4 }}
        >
          {pinSummary}
        </p>
      </div>

      {/* Curve Smoothing */}
      <div style={sectionStyle}>
        <SectionLabel>Curve Smoothing</SectionLabel>
        <p style={{ fontSize: 11, color: 'var(--p-text-secondary)', marginBottom: 10, lineHeight: 1.4 }}>
          Smooths interior nodes.
        </p>
        {(
          [
            { key: 'lightness' as const, label: 'Lightness' },
            { key: 'chroma'    as const, label: 'Chroma' },
            { key: 'hue'       as const, label: 'Hue' },
          ]
        ).map(({ key, label }) => {
          const value = scale.curves[key].smoothing ?? 0;
          const smoothId = `${idBase}-smooth-${key}`;
          return (
            <div key={key} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label htmlFor={smoothId} style={{ fontSize: 12, color: 'var(--p-text-secondary)', cursor: 'pointer' }}>
                  {label}
                </label>
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--p-text-secondary)' }}>
                  {(value * 100).toFixed(0)}%
                </span>
              </div>
              <AppSlider
                id={smoothId}
                value={value}
                min={0}
                max={1}
                step={0.01}
                onValueChange={(v) => updateCurveSmoothing(scale.id, key, v)}
                onPointerDown={() => beginCurveEdit(scale.id)}
                onValueCommitted={() => commitCurveEdit()}
                style={{ width: '100%' }}
                aria-label={`${label} smoothing`}
              />
            </div>
          );
        })}
      </div>

      {/* Hue shift */}
      <div style={sectionStyle}>
        <SectionLabel>Hue shift</SectionLabel>
        {(() => {
          const lightStep = ramp.steps[0];
          const darkStep = ramp.steps[ramp.steps.length - 1];
          const ends = [
            { key: 'lightEndAdjust' as const, label: 'Light', stepHue: lightStep?.oklch.h ?? scale.sourceOklch.h },
            { key: 'darkEndAdjust'  as const, label: 'Dark',  stepHue: darkStep?.oklch.h ?? scale.sourceOklch.h },
          ] as const;
          return (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {ends.map(({ key, label }) => {
                const adjust = scale.hueShift[key];
                const endId = key === 'lightEndAdjust' ? lightEndAdjustId : darkEndAdjustId;
                return (
                  <AppField
                    key={key}
                    style={{ flex: 1, minWidth: 0 }}
                    label={label}
                    htmlFor={endId}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        aria-label={`Decrease ${label.toLowerCase()} hue shift`}
                        onClick={() => {
                          const v = Math.max(-90, Math.min(90, adjust - 1));
                          updateHueShift(scale.id, key, v);
                        }}
                        className="focus-visible-ring"
                        style={{
                          width: 28,
                          height: 28,
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 16,
                          lineHeight: 1,
                          background: 'var(--p-surface)',
                          border: '1px solid var(--p-border)',
                          borderRadius: 6,
                          color: 'var(--p-text)',
                          cursor: 'pointer',
                        }}
                      >
                        −
                      </button>
                      <input
                        id={endId}
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
                          textAlign: 'center',
                          fontFamily: 'monospace',
                          fontSize: 12,
                          padding: '3px 6px',
                          flexShrink: 0,
                        }}
                        className="focus-visible-ring"
                      />
                      <button
                        type="button"
                        aria-label={`Increase ${label.toLowerCase()} hue shift`}
                        onClick={() => {
                          const v = Math.max(-90, Math.min(90, adjust + 1));
                          updateHueShift(scale.id, key, v);
                        }}
                        className="focus-visible-ring"
                        style={{
                          width: 28,
                          height: 28,
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 16,
                          lineHeight: 1,
                          background: 'var(--p-surface)',
                          border: '1px solid var(--p-border)',
                          borderRadius: 6,
                          color: 'var(--p-text)',
                          cursor: 'pointer',
                        }}
                      >
                        +
                      </button>
                    </div>
                  </AppField>
                );
              })}
            </div>
          );
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
                background: activeStep.gamut === 'p3' ? '#78350f' : 'var(--p-surface)',
                color: activeStep.gamut === 'p3' ? '#fde68a' : 'var(--p-text-secondary)',
                letterSpacing: '0.03em',
                cursor: 'default',
              }}
            >
              {activeStep.gamut === 'p3' ? 'P3' : 'sRGB'}
            </span>
          </div>

          {/* Swatches */}
          {(() => {
            const stepAlpha = activeStep.oklch.alpha;
            const isTransparent = stepAlpha != null && stepAlpha < 1;
            const { l: sl, c: sc, h: sh } = activeStep.oklch;
            const rgbaColor = isTransparent
              ? (formatCss({ mode: 'oklch', l: sl, c: sc, h: sh, alpha: stepAlpha }) ?? activeStep.hex)
              : activeStep.hex;
            const swatchStyle = (color: string): React.CSSProperties => ({ backgroundColor: color });
            return (
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
              <div
                style={{ width: 32, height: activeStep.gamut === 'p3' ? 13 : 32, borderRadius: 3, ...swatchStyle(rgbaColor), border: '1px solid var(--p-border)' }}
                title="sRGB hex — safe fallback for all displays"
              />
              {activeStep.gamut === 'p3' && activeStep.displayP3 && (
                <div
                  style={{ width: 32, height: 13, borderRadius: 3, ...swatchStyle(supportsP3 ? activeStep.displayP3 : rgbaColor), border: '1px solid var(--p-border)' }}
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
            );
          })()}

          {/* OKLCH */}
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--p-text-secondary)', marginBottom: 3 }}>
            OKLCH
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            gap: '6px 14px',
            fontSize: 12,
            fontFamily: 'monospace',
            color: 'var(--p-text-secondary)',
            lineHeight: 1.5,
            marginBottom: 8,
          }}>
            <span style={{ whiteSpace: 'nowrap' }}>L {activeStep.oklch.l.toFixed(4)}</span>
            <span style={{ whiteSpace: 'nowrap' }}>C {activeStep.oklch.c.toFixed(4)}</span>
            <span style={{ whiteSpace: 'nowrap' }}>H {activeStep.oklch.h.toFixed(2)}°</span>
          </div>

          {/* Contrast */}
          <div style={{ fontSize: 12, color: 'var(--p-text-secondary)' }}>
            {apca
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
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete scale"
          message={<>Delete scale <strong>{scale.name}</strong>? This cannot be undone.</>}
          confirmLabel="Delete"
          destructive
          onConfirm={() => {
            setConfirmDelete(false);
            removeScale(scale.id);
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
