import { useRef, useState, useCallback, useEffect } from 'react';
import type { ColorScale, GeneratedRamp } from '../../types/palette';
import { usePaletteStore } from '../../store/paletteStore';
import { getContrast, getApcaContrast, computeHueShift, smoothCurveValues } from '../../lib/colorMath';
import { buildCurvePath } from '../../lib/curveInterpolation';

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

export function CurveOverlayEditor({ scale, ramp, activeStepIndex, onStepClick }: Props) {
  const contrastMode = usePaletteStore((s) => s.contrastMode);
  const updateCurveValue  = usePaletteStore((s) => s.updateCurveValue);
  const updateCurveValues = usePaletteStore((s) => s.updateCurveValues);
  const updateCurveNodeType = usePaletteStore((s) => s.updateCurveNodeType);
  const srgbPreview = usePaletteStore((s) => s.srgbPreview);
  const beginCurveEdit = usePaletteStore((s) => s.beginCurveEdit);
  const commitCurveEdit = usePaletteStore((s) => s.commitCurveEdit);
  const containerRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(scale);
  useEffect(() => { scaleRef.current = scale; }, [scale]);

  const [dragState, setDragState]   = useState<DragState | null>(null);
  const [preCancel, setPreCancel]   = useState<{ key: CurveKey; values: number[] } | null>(null);
  const [size, setSize]             = useState({ width: 800, height: 400 });
  const [showHelp, setShowHelp]     = useState(false);
  const n = ramp.steps.length;
  const PAD = 18;

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

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden" style={{ background: 'var(--p-bg)' }}>

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
        {ramp.steps.map((step, i) => (
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
        ))}

        {/* SVG curves overlay */}
        <svg
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: 'none', overflow: 'visible' }}
        >
          {/* P3 threshold lines */}
          {ramp.steps.map((step, i) => {
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
