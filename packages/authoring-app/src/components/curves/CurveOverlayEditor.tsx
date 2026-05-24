import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { formatCss } from 'culori';
import type { ColorScale, GeneratedRamp } from '../../types/palette';
import { usePaletteStore } from '../../store/paletteStore';
import { useIntentStore, type EngineCompliance } from '../../store/intentStore';
import { getContrast, getApcaContrast, computeHueShift, smoothCurveValues } from '../../lib/colorMath';
import { buildCurvePath, buildScaleLinearGradientCss } from '../../lib/curveInterpolation';
import { ScaleDiagnosticsRow } from '../diagnostics/RampDiagnosticsView';
import { PanelLeftIcon } from '../icons/PanelIcons';

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
  panelsCollapsed: boolean;
  onTogglePanels: () => void;
  onShowPreview: () => void;
}

// Keyboard shortcut descriptions shown in the help tooltip
const SHORTCUTS = [
  { key: 'Drag line',         desc: 'Shift entire curve up/down' },
  { key: 'Drag node',         desc: 'Move single control point'  },
  { key: 'Alt + click node',  desc: 'Toggle smooth ↔ corner'     },
  { key: 'Shift + drag node', desc: 'Snap to smooth interpolation'},
  { key: 'Escape',            desc: 'Cancel drag'                 },
];

type ViewMode = 'gradient' | 'curves' | 'diagnostic';
const VIEW_MODES: readonly ViewMode[] = ['gradient', 'curves', 'diagnostic'];
const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  gradient: 'Gradient',
  curves: 'Steps',
  diagnostic: 'Diagnostic',
};
export function CurveOverlayEditor({ scale, ramp, activeStepIndex, onStepClick, panelsCollapsed, onTogglePanels, onShowPreview }: Props) {
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
  const [showHelp, setShowHelp]     = useState(false);
  const [viewMode, setViewMode]     = useState<ViewMode>('gradient');
  const isContinuous = engineResolver.mode === 'continuous';
  const effectiveBackground: ViewMode = isContinuous ? viewMode : 'curves';
  const n = ramp.steps.length;
  const PAD = 18;

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

      {/* Floating top-right controls: view-mode toggle (continuous only) + preview + panels */}
      <div
        className="absolute flex items-center gap-2 pointer-events-none"
        style={{ top: 8, right: 8, zIndex: 20 }}
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
          {isContinuous && (
            <div role="radiogroup" aria-label="Canvas view" style={{ display: 'inline-flex', gap: 2 }}>
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
                      background: active ? 'rgba(255,255,255,0.95)' : 'transparent',
                      color: active ? '#000' : 'rgba(255,255,255,0.7)',
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      padding: '3px 10px',
                      borderRadius: 6,
                      cursor: 'pointer',
                    }}
                  >
                    {VIEW_MODE_LABELS[m]}
                  </button>
                );
              })}
            </div>
          )}

          {isContinuous && (
            <div style={{ width: 1, alignSelf: 'stretch', margin: '4px 2px', background: 'rgba(255,255,255,0.12)' }} aria-hidden="true" />
          )}

          <button
            type="button"
            onClick={onShowPreview}
            title="Open palette preview (P)"
            aria-label="Open palette preview"
            className="focus-visible-ring"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 10px',
              background: 'transparent',
              border: 'none',
              borderRadius: 6,
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              boxSizing: 'border-box',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6V3h3" />
              <path d="M13 6V3h-3" />
              <path d="M3 10v3h3" />
              <path d="M13 10v3h-3" />
            </svg>
            Preview
            <span style={{ fontFamily: 'monospace', fontSize: 10, opacity: 0.7, textTransform: 'none', letterSpacing: 0 }}>P</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onTogglePanels}
          title={`${panelsCollapsed ? 'Show' : 'Hide'} panels (⌘/)`}
          aria-label={`${panelsCollapsed ? 'Show' : 'Hide'} panels`}
          aria-pressed={panelsCollapsed}
          className="focus-visible-ring pointer-events-auto"
          style={{
            ...floatingPillBase,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 8px',
            border: 'none',
            fontSize: 10,
            fontWeight: 600,
            cursor: 'pointer',
            boxSizing: 'border-box',
          }}
        >
          <PanelLeftIcon size={12} />
          <span style={{ fontFamily: 'monospace', fontSize: 10, opacity: 0.7 }}>⌘/</span>
        </button>
      </div>

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

          {/* Help button */}
          <foreignObject
            x={8}
            y={size.height - 32}
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
            <foreignObject x={8} y={size.height - 32 - (SHORTCUTS.length * 24 + 16) - 8} width={232} height={SHORTCUTS.length * 24 + 16} style={{ pointerEvents: 'none' }}>
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

        {/* Floating step badges: P3 (if present), contrast (if fails), step name */}
        <div
          className="absolute inset-x-0 bottom-0 flex pointer-events-none"
          style={{ padding: '0 0 12px 0' }}
        >
          {ramp.steps.map((step, i) => {
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
