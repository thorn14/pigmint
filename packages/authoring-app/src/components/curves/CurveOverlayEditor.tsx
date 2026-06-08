import { useRef, useState, useCallback, useEffect, useMemo, type ComponentType } from 'react';
import { formatCss } from 'culori';
import type { ColorScale, GeneratedRamp } from '../../types/palette';
import { usePaletteStore } from '../../store/paletteStore';
import { useIntentStore, type EngineCompliance } from '../../store/intentStore';
import { getContrast, getApcaContrast, computeHueShift, smoothCurveValues } from '../../lib/colorMath';
import { buildCurvePath, buildScaleLinearGradientCss } from '../../lib/curveInterpolation';
import { ScaleDiagnosticsRow } from '../diagnostics/RampDiagnosticsView';
import { useIsNarrow } from '../../hooks/useViewportWidth';

const supportsP3 = typeof CSS !== 'undefined' && CSS.supports('color', 'color(display-p3 0 0 0)');

type CurveKey = 'lightness' | 'chroma' | 'hue';

const CURVES: { key: CurveKey; label: string; color: string; min: number; max: number }[] = [
  { key: 'lightness', label: 'L', color: '#d97706', min: 0,    max: 1   },
  { key: 'chroma',    label: 'C', color: '#059669', min: 0,    max: 0.4 },
  { key: 'hue',       label: 'H', color: '#7c3aed', min: -180, max: 180 },
];

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
  bottomReserve?: number;
  topInset?: number;
}

type ViewMode = 'gradient' | 'curves' | 'diagnostic';
const VIEW_MODES: readonly ViewMode[] = ['gradient', 'curves', 'diagnostic'];
const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  gradient: 'Gradient',
  curves: 'Steps',
  diagnostic: 'Diagnostic',
};

function GradientIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
      <defs>
        <linearGradient id="vm-gradient-icon" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="1" />
        </linearGradient>
      </defs>
      <rect x="2" y="4" width="12" height="8" rx="1" fill="url(#vm-gradient-icon)" />
    </svg>
  );
}

function StepsIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="2"   y="4" width="2.4" height="8" rx="0.5" opacity="0.35" />
      <rect x="5"   y="4" width="2.4" height="8" rx="0.5" opacity="0.6" />
      <rect x="8"   y="4" width="2.4" height="8" rx="0.5" opacity="0.8" />
      <rect x="11"  y="4" width="2.4" height="8" rx="0.5" />
    </svg>
  );
}

function DiagnosticIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12 L6 7 L9 10 L14 3" />
      <circle cx="14" cy="3" r="0.8" fill="currentColor" />
    </svg>
  );
}

const VIEW_MODE_ICONS: Record<ViewMode, ComponentType> = {
  gradient: GradientIcon,
  curves: StepsIcon,
  diagnostic: DiagnosticIcon,
};
export function CurveOverlayEditor({ scale, ramp, activeStepIndex, onStepClick, bottomReserve = 0, topInset = 0 }: Props) {
  const updateCurveValue  = usePaletteStore((s) => s.updateCurveValue);
  const updateCurveValues = usePaletteStore((s) => s.updateCurveValues);
  const updateCurveNodeType = usePaletteStore((s) => s.updateCurveNodeType);
  const srgbPreview = usePaletteStore((s) => s.srgbPreview);
  const beginCurveEdit = usePaletteStore((s) => s.beginCurveEdit);
  const commitCurveEdit = usePaletteStore((s) => s.commitCurveEdit);
  const engineCompliance = useIntentStore((s) => s.engineCompliance) as EngineCompliance;
  const contrastMode = engineCompliance === 'apca' ? 'apca' : 'wcag';
  const engineResolver = useIntentStore((s) => s.engineResolver);
  const containerRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(scale);
  useEffect(() => { scaleRef.current = scale; }, [scale]);

  const [dragState, setDragState]   = useState<DragState | null>(null);
  const [preCancel, setPreCancel]   = useState<{ key: CurveKey; values: number[] } | null>(null);
  const [size, setSize]             = useState({ width: 800, height: 400 });
  const [viewMode, setViewMode]     = useState<ViewMode>('gradient');
  const narrow = useIsNarrow();
  const isContinuous = engineResolver.mode === 'continuous';
  const effectiveBackground: ViewMode = isContinuous ? viewMode : 'curves';
  const n = ramp.steps.length;
  const PAD = 18;
  // Top reserve clears the floating step-name badges. The view-mode pill and the
  // global Scales/Edit bar sit at the same y on opposite sides; bottomReserve
  // covers both. topInset accounts for an overlapping floating topbar so badges
  // render below it.
  const topReserve = 52 + topInset;
  const effectiveBottomReserve = bottomReserve;
  const padTop = PAD + topReserve;
  const padBottom = PAD + effectiveBottomReserve;

  const gradientCss = useMemo(() => {
    if (effectiveBackground !== 'gradient') return '';
    return buildScaleLinearGradientCss(scale);
  }, [effectiveBackground, scale]);


  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setSize({ width: el.clientWidth, height: el.clientHeight });
    const ro = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [effectiveBackground]);

  // ─── Pointer move ─────────────────────────────────────────────────────────
  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!dragState || !containerRef.current) return;
    const s = scaleRef.current;
    const meta = CURVES.find((c) => c.key === dragState.curveKey)!;
    const rect = containerRef.current.getBoundingClientRect();

    if (dragState.mode === 'group') {
      const deltaY = e.clientY - dragState.dragStartClientY;
      const valueDelta = -(deltaY / (size.height - padTop - padBottom)) * (meta.max - meta.min);
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
    const norm = 1 - (e.clientY - rect.top - padTop) / (size.height - padTop - padBottom);
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
    const y = padTop + (1 - norm) * (size.height - padTop - padBottom);
    return { x, y };
  }


  const floatingPillBase: React.CSSProperties = {
    background: 'rgba(20, 20, 22, 0.78)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    borderRadius: 8,
    color: '#fff',
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative" style={{ background: 'var(--p-bg)' }}>

      {/* Floating bottom-right view-mode toggle (continuous only) */}
      {isContinuous && (
        <div
          className="absolute flex items-center gap-2 pointer-events-none"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
            right: 14,
            zIndex: 20,
          }}
        >
          <div
            className="pointer-events-auto"
            style={{
              ...floatingPillBase,
              display: 'inline-flex',
              alignItems: 'center',
              padding: 2,
              gap: 2,
            }}
          >
            <div role="radiogroup" aria-label="Canvas view" style={{ display: 'inline-flex', gap: 2 }}>
              {VIEW_MODES.map((m) => {
                const active = viewMode === m;
                const Icon = VIEW_MODE_ICONS[m];
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className="focus-visible-ring"
                    onClick={() => setViewMode(m)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      border: 'none',
                      background: active ? 'rgba(255,255,255,0.95)' : 'transparent',
                      color: active ? '#000' : 'rgba(255,255,255,0.7)',
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      padding: '3px 10px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      transition: 'background-color 0.12s ease-out, color 0.12s ease-out',
                    }}
                  >
                    <Icon />
                    {VIEW_MODE_LABELS[m]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {effectiveBackground === 'diagnostic' ? (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <ScaleDiagnosticsRow scale={scale} ramp={ramp} />
        </div>
      ) : (
      <>
      {/* Color columns + SVG curve overlay */}
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 flex select-none"
      >
        {topReserve > 0 && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: topReserve,
              left: 0,
              right: 0,
              height: 1,
              background: 'rgba(255,255,255,0.18)',
              pointerEvents: 'none',
              zIndex: 15,
            }}
          />
        )}
        {effectiveBottomReserve > 0 && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              bottom: effectiveBottomReserve,
              left: 0,
              right: 0,
              height: 1,
              background: 'rgba(255,255,255,0.18)',
              pointerEvents: 'none',
              zIndex: 15,
            }}
          />
        )}
        {effectiveBackground === 'gradient' ? (
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
              className="flex-1 relative cursor-pointer"
              style={{
                backgroundColor: step.oklch.alpha != null && step.oklch.alpha < 1
                  ? (formatCss({ mode: 'oklch', ...step.oklch }) ?? step.hex)
                  : ((!srgbPreview && supportsP3 && step.displayP3) || step.hex),
                border: 'none',
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
          {/* P3 threshold lines — drawn in raw-chroma space so handle ↔ line
              comparison matches the gamut decision (which uses smoothed chroma). */}
          {ramp.steps.map((step, i) => {
            const chromaMeta = CURVES.find((c) => c.key === 'chroma')!;
            const chromaSmoothing = scale.curves.chroma.smoothing ?? 0;
            const rawC = scale.curves.chroma.values;
            const isInterior = i > 0 && i < n - 1;
            const t = Math.min(1, Math.max(0, chromaSmoothing));
            let lineValue = step.maxSrgbC;
            if (t > 0 && isInterior) {
              const prev = rawC[i - 1] ?? step.maxSrgbC;
              const next = rawC[i + 1] ?? step.maxSrgbC;
              const k = 1 - 0.5 * t;
              if (k > 1e-4) {
                lineValue = (step.maxSrgbC - (prev + next) * 0.25 * t) / k;
              }
            }
            const pt = getPoint(lineValue, i, chromaMeta.min, chromaMeta.max);
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

          {CURVES.map((curve) => {
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
                {/* Label on left edge: white fill with #444 stroke outline for legibility */}
                {nodePoints[0] && (
                  <text
                    x={8}
                    y={nodePoints[0].y}
                    dy={4}
                    fontSize={12}
                    fontWeight={700}
                    fill="white"
                    stroke="#444"
                    strokeWidth={2.5}
                    paintOrder="stroke"
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

                {/* Visible curve path: 3px white with 1px black outline */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="#444"
                  strokeWidth={5}
                  opacity={isGroupDragging ? 1 : 0.9}
                  style={{ pointerEvents: 'none' }}
                />
                <path
                  d={pathD}
                  fill="none"
                  stroke="white"
                  strokeWidth={3}
                  opacity={isGroupDragging ? 1 : 0.9}
                  style={{ pointerEvents: 'none' }}
                />

                {/* Draggable control points */}
                {nodePoints.map((pt, i) => {
                  const isCorner = resolvedNodeTypes[i] === 'corner';
                  const isActive = isAnyDragging && dragState?.stepIndex === i && dragState?.mode === 'node';
                  const r = isActive ? 8 : 6;
                  const stepHex = ramp.steps[i]?.hex ?? 'transparent';

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
                        // Diamond shape for corner nodes: 3px white ring + 1px black outline, step-color fill
                        <>
                          <rect
                            x={pt.x - r * 0.75}
                            y={pt.y - r * 0.75}
                            width={r * 1.5}
                            height={r * 1.5}
                            transform={`rotate(45 ${pt.x} ${pt.y})`}
                            fill={stepHex}
                            stroke="black"
                            strokeWidth={5}
                            style={{ cursor: 'ns-resize' }}
                          />
                          <rect
                            x={pt.x - r * 0.75}
                            y={pt.y - r * 0.75}
                            width={r * 1.5}
                            height={r * 1.5}
                            transform={`rotate(45 ${pt.x} ${pt.y})`}
                            fill={stepHex}
                            stroke="white"
                            strokeWidth={3}
                            style={{ cursor: 'ns-resize' }}
                          />
                        </>
                      ) : (
                        // Circle for smooth nodes: 3px white ring + 1px black outline, step-color fill
                        <>
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={r}
                            fill={stepHex}
                            stroke="black"
                            strokeWidth={5}
                            style={{ cursor: 'ns-resize' }}
                          />
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={r}
                            fill={stepHex}
                            stroke="white"
                            strokeWidth={3}
                            style={{ cursor: 'ns-resize' }}
                          />
                        </>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}

        </svg>

        {/* Floating step badges: P3 (if present), contrast (if fails), step name.
            On narrow viewports the badges overflow, so we show only the min/max
            in gradient mode and only the selected step in stepped mode. */}
        <div
          className="absolute inset-x-0 flex pointer-events-none"
          style={{ left: 0, right: 0, top: 12 + topInset, padding: 0 }}
        >
          {ramp.steps.map((step, i) => {
            const showBadge = !narrow
              ? true
              : effectiveBackground === 'gradient'
                ? (i === 0 || i === n - 1)
                : activeStepIndex === i;

            if (!showBadge) {
              return <div key={step.name} className="flex-1" aria-hidden="true" />;
            }

            const activeHex =
              activeStepIndex !== null ? ramp.steps[activeStepIndex]?.hex : null;
            const hasP3 = step.gamut === 'p3';

            let contrastFails = false;
            let contrastTitle: string | undefined;

            if (contrastMode === 'apca') {
              let lc: number | null = null;
              if (activeHex !== null && i !== activeStepIndex) {
                lc = getApcaContrast(step.hex, activeHex);
              } else if (activeStepIndex === null) {
                const lcWhite = getApcaContrast('#ffffff', step.hex);
                const lcBlack = getApcaContrast('#000000', step.hex);
                lc = Math.abs(lcBlack) >= Math.abs(lcWhite) ? lcBlack : lcWhite;
              }
              if (lc !== null) {
                contrastFails = Math.abs(lc) < 45;
                contrastTitle = `APCA Lc: ${lc.toFixed(1)}`;
              }
            } else {
              let result;
              if (activeHex !== null && i !== activeStepIndex) {
                result = getContrast(step.hex, activeHex);
              } else if (activeStepIndex === null) {
                const cw = getContrast(step.hex, '#ffffff');
                const cb = getContrast(step.hex, '#000000');
                result = cw.ratio > cb.ratio ? cw : cb;
              }
              if (result) {
                contrastFails = result.level === 'fail';
                contrastTitle = `${result.ratio.toFixed(2)}:1`;
              }
            }

            return (
              <div key={step.name} className="flex-1 flex justify-center">
                <div
                  title={contrastTitle}
                  style={{
                    display: 'flex',
                    flexDirection: 'column-reverse',
                    alignItems: 'center',
                    gap: 2,
                    padding: '4px 8px',
                    borderRadius: 8,
                    background: 'rgba(20, 20, 22, 0.78)',
                    color: '#fff',
                    fontSize: 10,
                    fontFamily: 'monospace',
                    lineHeight: 1.1,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06)',
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{step.name}</span>
                  {contrastFails && (
                    <span style={{ color: 'var(--p-danger, #ff5d5d)', fontWeight: 700 }}>FAIL</span>
                  )}
                  {hasP3 && <span style={{ opacity: 0.85 }}>P3</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </>
      )}
    </div>
  );
}
