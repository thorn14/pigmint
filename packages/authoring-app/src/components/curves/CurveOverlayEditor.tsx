import { Fragment, useRef, useState, useCallback, useEffect, useMemo } from 'react';
import type { ColorScale, GeneratedRamp } from '../../types/palette';
import type { IntentOverride as CoreIntentOverride, ResolvedToken } from '@pigmint/core';
import { usePaletteStore } from '../../store/paletteStore';
import { useIntentStore, type EngineCompliance } from '../../store/intentStore';
import { getContrast, getApcaContrast, computeHueShift, smoothCurveValues } from '../../lib/colorMath';
import { buildCurvePath, buildScaleLinearGradientCss } from '../../lib/curveInterpolation';
import { runResolve } from '../../lib/resolveState';
import { IntentMarkerPopover, type IntentMarkerDetail } from './IntentMarkerPopover';

const supportsP3 = typeof CSS !== 'undefined' && CSS.supports('color', 'color(display-p3 0 0 0)');

type CurveKey = 'lightness' | 'chroma' | 'hue';

const CURVES: { key: CurveKey; label: string; color: string; min: number; max: number }[] = [
  { key: 'lightness', label: 'L', color: '#d97706', min: 0,    max: 1   },
  { key: 'chroma',    label: 'C', color: '#059669', min: 0,    max: 0.4 },
  { key: 'hue',       label: 'H', color: '#7c3aed', min: -180, max: 180 },
];

const WCAG_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  AAA:        { bg: 'var(--badge-aaa-bg)',  text: 'var(--badge-aaa-text)',  label: '7:1'  },
  AA:         { bg: 'var(--badge-aa-bg)',   text: 'var(--badge-aa-text)',   label: '4.5:1'},
  'AA-large': { bg: 'var(--badge-aal-bg)',  text: 'var(--badge-aal-text)',  label: '3:1'  },
  fail:       { bg: 'var(--badge-fail-bg)', text: 'var(--badge-fail-text)', label: 'Fail' },
};

function getApcaBadge(lc: number): { bg: string; text: string; label: string } {
  const absLc = Math.abs(lc);
  if (absLc >= 75) return { bg: 'var(--p-success-subtle)', text: 'var(--p-success)', label: 'Lc 75+' };
  if (absLc >= 60) return { bg: 'var(--p-success-subtle)', text: 'var(--p-success)', label: 'Lc 60+' };
  if (absLc >= 45) return { bg: 'var(--p-success-subtle)', text: 'var(--p-success)', label: 'Lc 45+' };
  return { bg: 'var(--badge-fail-bg)', text: 'var(--badge-fail-text)', label: 'Fail' };
}

interface DragState {
  curveKey: CurveKey;
  stepIndex: number;          // -1 for group drag
  mode: 'node' | 'group';
  dragStartClientY: number;
  groupStartValues: number[]; // snapshot of all values at group-drag start
}

interface Props {
  scale: ColorScale;
  ramp: GeneratedRamp;
  activeStepIndex: number | null;
  onStepClick: (idx: number) => void;
}

// Keyboard shortcut descriptions shown in the help tooltip
const SHORTCUTS = [
  { key: 'Drag line',         desc: 'Shift entire curve up/down' },
  { key: 'Drag node',         desc: 'Move single control point'  },
  { key: 'Alt + click node',  desc: 'Toggle smooth ↔ corner'     },
  { key: 'Shift + drag node', desc: 'Snap to smooth interpolation'},
  { key: 'Escape',            desc: 'Cancel drag'                 },
];

type ViewMode = 'curves' | 'gradient';
const VIEW_MODES: readonly ViewMode[] = ['curves', 'gradient'];
export function CurveOverlayEditor({ scale, ramp, activeStepIndex, onStepClick }: Props) {
  const updateCurveValue  = usePaletteStore((s) => s.updateCurveValue);
  const updateCurveValues = usePaletteStore((s) => s.updateCurveValues);
  const updateCurveNodeType = usePaletteStore((s) => s.updateCurveNodeType);
  const srgbPreview = usePaletteStore((s) => s.srgbPreview);
  const beginCurveEdit = usePaletteStore((s) => s.beginCurveEdit);
  const commitCurveEdit = usePaletteStore((s) => s.commitCurveEdit);
  const scales = usePaletteStore((s) => s.scales);
  const engineModes = useIntentStore((s) => s.engineModes);
  const engineTarget = useIntentStore((s) => s.engineTarget);
  const engineCompliance = useIntentStore((s) => s.engineCompliance) as EngineCompliance;
  const contrastMode = engineCompliance === 'apca' ? 'apca' : 'wcag';
  const engineResolver = useIntentStore((s) => s.engineResolver);
  const overrides = useIntentStore((s) => s.overrides);
  const containerRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(scale);
  useEffect(() => { scaleRef.current = scale; }, [scale]);

  const [dragState, setDragState]   = useState<DragState | null>(null);
  const [preCancel, setPreCancel]   = useState<{ key: CurveKey; values: number[] } | null>(null);
  const [size, setSize]             = useState({ width: 800, height: 400 });
  const [showHelp, setShowHelp]     = useState(false);
  const [viewMode, setViewMode]     = useState<ViewMode>('curves');
  const [markerMode, setMarkerMode] = useState<string | null>(null);
  const n = ramp.steps.length;
  const PAD = 18;

  const gradientCss = useMemo(() => {
    if (viewMode !== 'gradient') return '';
    return buildScaleLinearGradientCss(scale);
  }, [viewMode, scale]);

  const activeMarkerMode = markerMode && engineModes.includes(markerMode as (typeof engineModes)[number])
    ? markerMode
    : engineModes[0];

  const intentMarkers = useMemo(() => {
    if (viewMode !== 'gradient') return [];
    const state = runResolve(
      scales,
      engineModes,
      engineTarget,
      engineCompliance,
      overrides as Record<string, CoreIntentOverride>,
      engineResolver.mode === 'continuous'
        ? engineResolver
        : {
            mode: 'continuous',
            ...(engineResolver.fallbackSteps !== undefined
              ? { fallbackSteps: engineResolver.fallbackSteps }
              : {}),
          },
    );
    if (!state.ok) return [];
    return state.tokens.filter(
      (t) => t.source.ramp === scale.name && t.mode === activeMarkerMode,
    );
  }, [viewMode, scales, engineModes, engineTarget, engineCompliance, engineResolver, overrides, scale.name, activeMarkerMode]);


  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ─── Pointer move ─────────────────────────────────────────────────────────
  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!dragState || !containerRef.current) return;
    const s = scaleRef.current;
    const meta = CURVES.find((c) => c.key === dragState.curveKey)!;
    const rect = containerRef.current.getBoundingClientRect();

    if (dragState.mode === 'group') {
      const deltaY = e.clientY - dragState.dragStartClientY;
      const valueDelta = -(deltaY / (size.height - PAD * 2)) * (meta.max - meta.min);
      const newValues = dragState.groupStartValues.map((v) =>
        Math.max(meta.min, Math.min(meta.max, v + valueDelta))
      );
      // For hue: adjust each stored delta so display stays coherent
      if (dragState.curveKey === 'hue') {
        const adjusted = newValues.map((displayV, i) => {
          const t = n <= 1 ? 0 : i / (n - 1);
          const shift = computeHueShift(s.sourceOklch.h, t, s.hueShift.lightEndAdjust, s.hueShift.darkEndAdjust);
          return displayV - shift;
        });
        updateCurveValues(s.id, dragState.curveKey, adjusted);
      } else {
        updateCurveValues(s.id, dragState.curveKey, newValues);
      }
      return;
    }

    // Node drag
    const norm = 1 - (e.clientY - rect.top - PAD) / (size.height - PAD * 2);
    const clamped = Math.max(0, Math.min(1, norm));
    let value = meta.min + clamped * (meta.max - meta.min);

    // Shift held: snap value toward smooth neighbor average
    if (e.shiftKey && n >= 3) {
      const i = dragState.stepIndex;
      const rawValues = s.curves[dragState.curveKey].values;
      if (i > 0 && i < n - 1) {
        let prev = rawValues[i - 1] ?? value;
        let next = rawValues[i + 1] ?? value;
        // For hue: compute neighbors in display space (raw + hueShift) to match `value`
        if (dragState.curveKey === 'hue') {
          const tPrev = (i - 1) / (n - 1);
          const tNext = (i + 1) / (n - 1);
          prev += computeHueShift(s.sourceOklch.h, tPrev, s.hueShift.lightEndAdjust, s.hueShift.darkEndAdjust);
          next += computeHueShift(s.sourceOklch.h, tNext, s.hueShift.lightEndAdjust, s.hueShift.darkEndAdjust);
        }
        const smoothTarget = prev * 0.25 + value * 0.5 + next * 0.25;
        value = smoothTarget;
      }
    }

    // For H: store only the manual delta
    if (dragState.curveKey === 'hue') {
      const t = n <= 1 ? 0 : dragState.stepIndex / (n - 1);
      const shift = computeHueShift(s.sourceOklch.h, t, s.hueShift.lightEndAdjust, s.hueShift.darkEndAdjust);
      value = value - shift;
    }

    updateCurveValue(s.id, dragState.curveKey, dragState.stepIndex, value);
  }, [dragState, size.height, updateCurveValue, updateCurveValues, n]);

  // ─── Pointer up ───────────────────────────────────────────────────────────
  const handlePointerUp = useCallback(() => {
    commitCurveEdit();
    setDragState(null);
    setPreCancel(null);
    document.body.style.cursor = '';
  }, [commitCurveEdit]);

  // ─── Escape cancels drag ──────────────────────────────────────────────────
  useEffect(() => {
    if (!dragState) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && preCancel) {
        updateCurveValues(scaleRef.current.id, preCancel.key, preCancel.values);
        commitCurveEdit();
        setDragState(null);
        setPreCancel(null);
        document.body.style.cursor = '';
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dragState, preCancel, updateCurveValues, commitCurveEdit]);

  useEffect(() => {
    if (!dragState) return;
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.body.style.cursor = dragState.mode === 'group' ? 'grabbing' : 'ns-resize';
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState, handlePointerMove, handlePointerUp]);

  // ─── Coordinate helpers ───────────────────────────────────────────────────
  function getPoint(value: number, stepIndex: number, min: number, max: number) {
    const norm = (value - min) / (max - min);
    const x = (stepIndex + 0.5) / n * size.width;
    const y = PAD + (1 - norm) * (size.height - PAD * 2);
    return { x, y };
  }

  const shortModeLabel = (m: string) => m.replace(/-high-contrast$/, '-HC');

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden" style={{ background: 'var(--p-bg)' }}>

      {/* Toolbar: view-mode toggle + engine-mode selector */}
      <div
        className="flex shrink-0 items-center gap-2 border-b px-2"
        style={{ height: 32, borderColor: 'var(--p-border)', background: 'var(--p-bg-raised, var(--p-bg))' }}
      >
        <div
          role="radiogroup"
          aria-label="Canvas view"
          style={{
            display: 'inline-flex',
            borderRadius: 6,
            background: 'var(--p-bg-inset, rgba(0,0,0,0.2))',
            padding: 2,
            gap: 2,
          }}
        >
          {VIEW_MODES.map((m) => {
            const active = viewMode === m;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setViewMode(m)}
                style={{
                  border: 'none',
                  background: active ? 'var(--p-text)' : 'transparent',
                  color: active ? 'var(--p-bg)' : 'var(--p-text-secondary)',
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  padding: '3px 10px',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                {m}
              </button>
            );
          })}
        </div>

        {viewMode === 'gradient' && engineModes.length > 1 && (
          <div
            role="radiogroup"
            aria-label="Engine mode for intent markers"
            style={{
              display: 'inline-flex',
              borderRadius: 6,
              background: 'var(--p-bg-inset, rgba(0,0,0,0.2))',
              padding: 2,
              gap: 2,
            }}
          >
            {engineModes.map((m) => {
              const active = activeMarkerMode === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setMarkerMode(m)}
                  title={m}
                  style={{
                    border: 'none',
                    background: active ? 'var(--p-text)' : 'transparent',
                    color: active ? 'var(--p-bg)' : 'var(--p-text-secondary)',
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    padding: '3px 10px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {shortModeLabel(m)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Step name headers + gamut indicators */}
      <div
        className="flex shrink-0 border-b"
        style={{ height: 40, borderColor: 'var(--p-border)' }}
      >
        {ramp.steps.map((step) => {
          const gamutLabel = step.gamut === 'p3' ? { text: 'P3', color: '#7c3aed' } : null;
          return (
            <div
              key={step.name}
              className="flex-1 flex flex-col items-center justify-center border-r last:border-r-0 gap-1"
              style={{ borderColor: 'var(--p-border)' }}
            >
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--p-text-secondary)' }}>
                {step.name}
              </span>
              {gamutLabel ? (
                <span style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  lineHeight: 1,
                  padding: '1px 4px',
                  borderRadius: 3,
                  backgroundColor: gamutLabel.color,
                  color: '#fff',
                }}>
                  {gamutLabel.text}
                </span>
              ) : (
                <span style={{ fontSize: 9, lineHeight: 1 }}>&nbsp;</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Color columns + SVG curve overlay */}
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 flex select-none"
      >
        {viewMode === 'gradient' ? (
          <div
            className="flex-1 relative"
            style={{ background: gradientCss }}
            aria-label={`${scale.name} continuous gradient`}
          />
        ) : (
          ramp.steps.map((step, i) => (
            <button
              key={step.name}
              onClick={() => onStepClick(i)}
              aria-label={`${step.name}: ${step.hex}`}
              className="flex-1 relative border-r last:border-r-0 cursor-pointer"
              style={{
                backgroundColor: (!srgbPreview && supportsP3 && step.displayP3) || step.hex,
                borderColor: 'rgba(0,0,0,0.07)',
                boxShadow: activeStepIndex === i ? 'inset 0 0 0 2px rgba(255,255,255,0.9)' : undefined,
              }}
            />
          ))
        )}

        {/* SVG curves overlay */}
        <svg
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: 'none', overflow: 'visible' }}
        >
          {/* P3 threshold lines (curves view only) */}
          {viewMode === 'curves' && ramp.steps.map((step, i) => {
            const chromaMeta = CURVES.find((c) => c.key === 'chroma')!;
            const pt = getPoint(step.maxSrgbC, i, chromaMeta.min, chromaMeta.max);
            const colW = size.width / n;
            const x1 = i * colW;
            const x2 = x1 + colW;
            return (
              <line
                key={`p3-${i}`}
                x1={x1} y1={pt.y}
                x2={x2} y2={pt.y}
                stroke="rgba(255,255,255,0.75)"
                strokeWidth={1.5}
                strokeDasharray="3 2"
              />
            );
          })}

          {viewMode === 'curves' && CURVES.map((curve) => {
            const rawValues = scale.curves[curve.key].values;
            const smoothing = scale.curves[curve.key].smoothing ?? 0;
            const nodeTypes = scale.curves[curve.key].nodeTypes;

            // Smooth raw values first, then add hue shift — matches generateRamp order
            const smoothedRaw = smoothCurveValues(rawValues, smoothing);
            const effectiveSmoothed = curve.key === 'hue'
              ? smoothedRaw.map((v, i) => {
                  const t = n <= 1 ? 0 : i / (n - 1);
                  return v + computeHueShift(scale.sourceOklch.h, t, scale.hueShift.lightEndAdjust, scale.hueShift.darkEndAdjust);
                })
              : smoothedRaw;

            // Points for path (smoothed positions — matches color generation)
            const pathPoints = effectiveSmoothed.map((v, i) => getPoint(v, i, curve.min, curve.max));

            // Node display values: raw + hue shift (unsmoothed, showing actual control point positions)
            const nodeDisplay = curve.key === 'hue'
              ? rawValues.map((v, i) => {
                  const t = n <= 1 ? 0 : i / (n - 1);
                  return v + computeHueShift(scale.sourceOklch.h, t, scale.hueShift.lightEndAdjust, scale.hueShift.darkEndAdjust);
                })
              : rawValues;

            // Points for nodes (raw positions — show where the control points actually are)
            const nodePoints = nodeDisplay.map((v, i) => getPoint(v, i, curve.min, curve.max));

            const resolvedNodeTypes: ('smooth' | 'corner')[] =
              pathPoints.map((_, i) => nodeTypes?.[i] ?? 'smooth');

            const pathD = buildCurvePath(pathPoints, resolvedNodeTypes);

            const isGroupDragging = dragState?.mode === 'group' && dragState.curveKey === curve.key;
            const isAnyDragging   = dragState?.curveKey === curve.key;

            return (
              <g key={curve.key}>
                {/* Label on left edge */}
                {nodePoints[0] && (
                  <text
                    x={8}
                    y={nodePoints[0].y}
                    dy={4}
                    fontSize={11}
                    fontWeight={700}
                    fill={curve.color}
                    style={{ fontFamily: 'monospace', pointerEvents: 'none' }}
                  >
                    {curve.label}
                  </text>
                )}

                {/* Invisible wide hit area for group drag */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={12}
                  style={{ cursor: 'grab', pointerEvents: 'stroke' }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    beginCurveEdit(scale.id);
                    setPreCancel({ key: curve.key, values: rawValues.slice() });
                    setDragState({
                      curveKey: curve.key,
                      stepIndex: -1,
                      mode: 'group',
                      dragStartClientY: e.clientY,
                      groupStartValues: nodeDisplay.slice(),
                    });
                  }}
                />

                {/* Visible curve path */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={curve.color}
                  strokeWidth={isGroupDragging ? 2.5 : 1.5}
                  opacity={isGroupDragging ? 1 : 0.9}
                  style={{ pointerEvents: 'none' }}
                />

                {/* Draggable control points */}
                {nodePoints.map((pt, i) => {
                  const isCorner = resolvedNodeTypes[i] === 'corner';
                  const isActive = isAnyDragging && dragState?.stepIndex === i && dragState?.mode === 'node';
                  const r = isActive ? 6 : 4.5;

                  return (
                    <g
                      key={i}
                      style={{ pointerEvents: 'all' }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        // Alt+click: toggle smooth/corner
                        if (e.altKey) {
                          const current = nodeTypes?.[i] ?? 'smooth';
                          updateCurveNodeType(scale.id, curve.key, i, current === 'smooth' ? 'corner' : 'smooth');
                          return;
                        }

                        beginCurveEdit(scale.id);
                        setPreCancel({ key: curve.key, values: rawValues.slice() });
                        setDragState({
                          curveKey: curve.key,
                          stepIndex: i,
                          mode: 'node',
                          dragStartClientY: e.clientY,
                          groupStartValues: [],
                        });
                      }}
                    >
                      {isCorner ? (
                        // Diamond shape for corner nodes
                        <rect
                          x={pt.x - r * 0.75}
                          y={pt.y - r * 0.75}
                          width={r * 1.5}
                          height={r * 1.5}
                          transform={`rotate(45 ${pt.x} ${pt.y})`}
                          fill="white"
                          stroke={curve.color}
                          strokeWidth={2}
                          style={{ cursor: 'ns-resize' }}
                        />
                      ) : (
                        // Circle for smooth nodes
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={r}
                          fill="white"
                          stroke={curve.color}
                          strokeWidth={2}
                          style={{ cursor: 'ns-resize' }}
                        />
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Intent-resolved markers (gradient view) */}
          {viewMode === 'gradient' && (
            <IntentMarkers
              tokens={intentMarkers}
              ramp={ramp}
              n={n}
              width={size.width}
              height={size.height}
              pad={PAD}
            />
          )}

          {/* Help button */}
          <foreignObject
            x={size.width - 28}
            y={4}
            width={24}
            height={24}
            style={{ pointerEvents: 'all' }}
          >
            <button
              onMouseEnter={() => setShowHelp(true)}
              onMouseLeave={() => setShowHelp(false)}
              onFocus={() => setShowHelp(true)}
              onBlur={() => setShowHelp(false)}
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.35)',
                color: 'rgba(255,255,255,0.85)',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
              }}
              aria-label="Keyboard shortcuts"
            >
              ?
            </button>
          </foreignObject>

          {/* Shortcut tooltip */}
          {showHelp && (
            <foreignObject x={size.width - 240} y={32} width={232} height={SHORTCUTS.length * 24 + 16} style={{ pointerEvents: 'none' }}>
              <div
                style={{
                  background: 'rgba(0,0,0,0.82)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  backdropFilter: 'blur(4px)',
                }}
              >
                {SHORTCUTS.map(({ key, desc }) => (
                  <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 2 }}>
                    <span style={{
                      fontFamily: 'monospace',
                      fontSize: 10,
                      color: 'rgba(255,255,255,0.6)',
                      flexShrink: 0,
                      minWidth: 120,
                    }}>
                      {key}
                    </span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.9)' }}>
                      {desc}
                    </span>
                  </div>
                ))}
              </div>
            </foreignObject>
          )}
        </svg>

      </div>

      {/* Contrast badges row */}
      <div
        className="flex shrink-0 border-t"
        style={{ height: 34, borderColor: 'var(--p-border)' }}
      >
        {ramp.steps.map((step, i) => {
          const activeHex =
            activeStepIndex !== null ? ramp.steps[activeStepIndex]?.hex : null;

          let badge: { bg: string; text: string; label: string } | null = null;
          let title: string | undefined;

          if (contrastMode === 'apca') {
            if (activeHex !== null && i !== activeStepIndex) {
              const lc = getApcaContrast(step.hex, activeHex);
              badge = getApcaBadge(lc);
              title = `APCA Lc: ${lc.toFixed(1)}`;
            } else if (activeStepIndex === null) {
              const lcWhite = getApcaContrast('#ffffff', step.hex);
              const lcBlack = getApcaContrast('#000000', step.hex);
              const bestLc = Math.abs(lcBlack) >= Math.abs(lcWhite) ? lcBlack : lcWhite;
              badge = getApcaBadge(bestLc);
              title = `APCA Lc: ${bestLc.toFixed(1)}`;
            }
          } else {
            let result;
            if (activeHex !== null && i !== activeStepIndex) {
              result = getContrast(step.hex, activeHex);
            } else if (activeStepIndex === null) {
              const cw = getContrast(step.hex, '#ffffff');
              const cb = getContrast(step.hex, '#000000');
              result = cw.ratio > cb.ratio ? cw : cb;
            } else {
              result = null;
            }
            if (result) {
              badge = WCAG_STYLES[result.level] ?? WCAG_STYLES.fail;
              title = `${result.ratio.toFixed(2)}:1`;
            }
          }

          return (
            <div
              key={step.name}
              className="flex-1 flex items-center justify-center border-r last:border-r-0"
              style={{ borderColor: 'var(--p-border)' }}
            >
              {badge ? (
                <span
                  title={title}
                  style={{
                    backgroundColor: badge.bg,
                    color: badge.text,
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '2px 5px',
                    borderRadius: 3,
                    cursor: 'default',
                  }}
                >
                  {badge.label}
                </span>
              ) : (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: 'var(--p-border)',
                    display: 'block',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function continuousStepLabel(position: number, ramp: GeneratedRamp): string | null {
  if (ramp.steps.length < 2) return null;
  const fIdx = Math.max(0, Math.min(ramp.steps.length - 1, position * (ramp.steps.length - 1)));
  const lo = Math.floor(fIdx);
  const hi = Math.min(lo + 1, ramp.steps.length - 1);
  const frac = fIdx - lo;
  const loName = ramp.steps[lo]?.name ?? '';
  const hiName = ramp.steps[hi]?.name ?? '';
  const loNum = Number(loName);
  const hiNum = Number(hiName);
  if (Number.isFinite(loNum) && Number.isFinite(hiNum)) {
    return `${ramp.scaleName} ${Math.round(loNum + (hiNum - loNum) * frac)}`;
  }
  return `${ramp.scaleName}.${loName}`;
}

function groupKeyForToken(
  hex: string,
  stepLabel: string | null,
  position: number,
): string {
  if (stepLabel) {
    return `${hex}§${stepLabel}`;
  }
  const q = Math.round(position * 200) / 200;
  return `${hex}§${q.toFixed(3)}`;
}

function IntentMarkers({
  tokens,
  ramp,
  n,
  width,
  height,
  pad,
}: {
  tokens: ResolvedToken[];
  ramp: GeneratedRamp;
  n: number;
  width: number;
  height: number;
  pad: number;
}) {
  const [markerDetail, setMarkerDetail] = useState<IntentMarkerDetail | null>(null);
  const [hoverGkey, setHoverGkey] = useState<string | null>(null);

  if (tokens.length === 0) {
    return (
      <foreignObject x={width / 2 - 140} y={height / 2 - 20} width={280} height={40}>
        <div
          style={{
            color: 'rgba(255,255,255,0.9)',
            background: 'rgba(0,0,0,0.55)',
            fontSize: 12,
            padding: '8px 12px',
            borderRadius: 6,
            textAlign: 'center',
            backdropFilter: 'blur(4px)',
          }}
        >
          No vocabulary tokens resolved to this ramp.
        </div>
      </foreignObject>
    );
  }

  const LABEL_WIDTH = 160;
  const ROW_HEIGHT = 14;
  const placed = tokens
    .map((t) => {
      const px = (((t.source.position * (n - 1) + 0.5) / n) * width);
      const py = pad + (1 - t.oklch.l) * (height - pad * 2);
      const shortPath = t.path.replace(/^color\./, '');
      const stepLabel = continuousStepLabel(t.source.position, ramp);
      const gkey = groupKeyForToken(t.hex, stepLabel, t.source.position);
      return { t, px, py, shortPath, stepLabel, gkey };
    })
    .sort((a, b) => a.px - b.px);

  const groupAcc = new Map<
    string,
    { sumX: number; sumY: number; n: number; tokens: ResolvedToken[]; stepLabel: string | null; hex: string; oklch: ResolvedToken['oklch'] }
  >();
  for (const p of placed) {
    let g = groupAcc.get(p.gkey);
    if (!g) {
      g = {
        sumX: 0,
        sumY: 0,
        n: 0,
        tokens: [],
        stepLabel: p.stepLabel,
        hex: p.t.hex,
        oklch: p.t.oklch,
      };
      groupAcc.set(p.gkey, g);
    }
    g.sumX += p.px;
    g.sumY += p.py;
    g.n += 1;
    g.tokens.push(p.t);
    if (p.stepLabel) g.stepLabel = p.stepLabel;
  }

  const groupCenters = new Map<
    string,
    { cx: number; cy: number; tokens: ResolvedToken[]; stepLabel: string | null; hex: string; oklch: ResolvedToken['oklch'] }
  >();
  for (const [gk, g] of groupAcc) {
    groupCenters.set(gk, {
      cx: g.sumX / g.n,
      cy: g.sumY / g.n,
      tokens: g.tokens,
      stepLabel: g.stepLabel,
      hex: g.hex,
      oklch: g.oklch,
    });
  }

  const placedWithCenter = placed.map((p) => {
    const c = groupCenters.get(p.gkey)!;
    return { ...p, cx: c.cx, cy: c.cy };
  });

  const rowEndPx: number[] = [];
  const rows = new Map<string, number>();
  for (const item of placedWithCenter) {
    const start = item.cx + 10;
    let row = 0;
    while (row < rowEndPx.length && rowEndPx[row]! > start) row++;
    rowEndPx[row] = start + LABEL_WIDTH;
    rows.set(item.t.path, row);
  }

  const lineStroke = 'rgba(255,255,255,0.7)';
  const markerRadius = 7;
  const openGroupPopover = (gk: string, el: SVGCircleElement) => {
    setMarkerDetail((prev) => {
      if (prev?.key === gk) {
        return null;
      }
      const g = groupCenters.get(gk);
      if (!g) {
        return null;
      }
      return {
        key: gk,
        rect: el.getBoundingClientRect(),
        hex: g.hex,
        oklch: g.oklch,
        stepLabel: g.stepLabel,
        tokens: g.tokens,
      };
    });
  };

  return (
    <Fragment>
      <g>
        {Array.from(groupCenters.entries()).map(([gkey, g]) => {
          const isHover = hoverGkey === gkey;
          return (
            <g
              key={gkey}
              pointerEvents="all"
              onPointerEnter={() => setHoverGkey(gkey)}
              onPointerLeave={() => setHoverGkey(null)}
              style={{ cursor: 'pointer' }}
            >
              <line
                x1={g.cx}
                y1={g.cy}
                x2={g.cx}
                y2={height - pad}
                stroke={lineStroke}
                strokeWidth={isHover ? 1.75 : 1.5}
                strokeDasharray="2 3"
                opacity={isHover ? 0.9 : 0.6}
                style={{ transition: 'opacity 0.16s ease-out, stroke-width 0.16s ease-out' }}
              />
              <g
                style={{
                  transform: `translate(${g.cx}px, ${g.cy}px) scale(${isHover ? 1.08 : 1}) translate(${-g.cx}px, ${-g.cy}px)`,
                  transition: 'transform 0.16s ease-out, filter 0.16s ease-out',
                  filter: isHover ? 'drop-shadow(0 0 5px rgba(255,255,255,0.4))' : 'none',
                }}
              >
                <circle
                  cx={g.cx}
                  cy={g.cy}
                  r={markerRadius + 3}
                  fill="none"
                  stroke="rgba(0,0,0,0.9)"
                  strokeWidth={isHover ? 2.8 : 2.5}
                  style={{ transition: 'stroke-width 0.16s ease-out' }}
                />
                <circle
                  cx={g.cx}
                  cy={g.cy}
                  r={markerRadius + 1}
                  fill="none"
                  stroke="rgba(255,255,255,0.98)"
                  strokeWidth={isHover ? 2.4 : 2}
                  style={{ transition: 'stroke-width 0.16s ease-out' }}
                />
                <circle
                  cx={g.cx}
                  cy={g.cy}
                  r={markerRadius}
                  fill={g.hex}
                  stroke="rgba(0,0,0,0.3)"
                  strokeWidth={0.75}
                />
                <circle
                  data-intent-marker-hit
                  cx={g.cx}
                  cy={g.cy}
                  r={markerRadius + 5}
                  fill="transparent"
                  stroke="none"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openGroupPopover(gkey, e.currentTarget);
                  }}
                />
              </g>
            </g>
          );
        })}

        {placedWithCenter.map(({ t, cx, cy, shortPath, stepLabel }) => {
          const row = rows.get(t.path) ?? 0;
          const labelY = cy + row * ROW_HEIGHT;
          return (
            <g key={t.path} pointerEvents="none">
              {row > 0 && (
                <line
                  x1={cx}
                  y1={cy}
                  x2={cx + 8}
                  y2={labelY}
                  stroke="rgba(255,255,255,0.45)"
                  strokeWidth={1}
                />
              )}
              <text
                x={cx + 10}
                y={labelY}
                dy={4}
                fontSize={10}
                fontWeight={600}
                fill="rgba(255,255,255,0.95)"
                style={{
                  fontFamily: 'monospace',
                  paintOrder: 'stroke',
                  stroke: 'rgba(0,0,0,0.7)',
                  strokeWidth: 3,
                }}
              >
                {shortPath}
                {stepLabel ? (
                  <tspan fill="rgba(255,255,255,0.7)" style={{ fontWeight: 400 }}>
                    {` · ${stepLabel}`}
                  </tspan>
                ) : null}
              </text>
            </g>
          );
        })}
      </g>
      <IntentMarkerPopover
        detail={markerDetail}
        onClose={() => setMarkerDetail(null)}
        rampName={ramp.scaleName}
      />
    </Fragment>
  );
}
