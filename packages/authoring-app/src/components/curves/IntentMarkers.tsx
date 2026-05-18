import { Fragment, useEffect, useRef, useState } from 'react';
import type { ResolvedToken } from '@pigmint/core';
import type { GeneratedRamp } from '../../types/palette';
import { IntentMarkerPopover, type IntentMarkerDetail } from './IntentMarkerPopover';

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

export function IntentMarkers({
  tokens,
  resolveError,
  ramp,
  n,
  width,
  height,
  pad,
}: {
  tokens: ResolvedToken[];
  resolveError?: string;
  ramp: GeneratedRamp;
  n: number;
  width: number;
  height: number;
  pad: number;
}) {
  const [markerDetail, setMarkerDetail] = useState<IntentMarkerDetail | null>(null);
  const [hoverGkey, setHoverGkey] = useState<string | null>(null);
  const hitCircleRefs = useRef(new Map<string, SVGCircleElement>());
  const hoverOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHoverOpenTimer = () => {
    if (hoverOpenTimerRef.current != null) {
      clearTimeout(hoverOpenTimerRef.current);
      hoverOpenTimerRef.current = null;
    }
  };

  const clearHoverCloseTimer = () => {
    if (hoverCloseTimerRef.current != null) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  };

  const clearAllMarkerHoverTimers = () => {
    clearHoverOpenTimer();
    clearHoverCloseTimer();
  };

  useEffect(() => () => clearAllMarkerHoverTimers(), []);

  const schedulePopoverClose = (gkey: string) => {
    clearHoverCloseTimer();
    hoverCloseTimerRef.current = setTimeout(() => {
      hoverCloseTimerRef.current = null;
      setMarkerDetail((prev) => (prev?.key === gkey ? null : prev));
    }, 240);
  };

  if (tokens.length === 0) {
    const foW = 300;
    const foH = resolveError ? 132 : 96;
    const label = resolveError
      ? resolveError
      : 'No vocabulary tokens resolved to this ramp.';
    const isError = Boolean(resolveError);
    return (
      <foreignObject
        x={width / 2 - foW / 2}
        y={height / 2 - foH / 2}
        width={foW}
        height={foH}
        overflow="visible"
      >
        <div
          style={{
            boxSizing: 'border-box',
            width: '100%',
            minHeight: '100%',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.95)',
            background: isError ? 'rgba(88,28,28,0.88)' : 'rgba(0,0,0,0.58)',
            fontSize: isError ? 11 : 12,
            padding: '12px 14px',
            borderRadius: 8,
            textAlign: 'center',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            lineHeight: 1.4,
            wordBreak: 'break-word',
            border: isError ? '1px solid rgba(252,165,165,0.45)' : '1px solid rgba(255,255,255,0.14)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            overflow: 'auto',
          }}
        >
          {label}
        </div>
      </foreignObject>
    );
  }

  const placed = tokens
    .map((t) => {
      const px = (((t.source.position * (n - 1) + 0.5) / n) * width);
      const py = pad + (1 - t.oklch.l) * (height - pad * 2);
      const stepLabel = continuousStepLabel(t.source.position, ramp);
      const gkey = groupKeyForToken(t.hex, stepLabel, t.source.position);
      return { t, px, py, stepLabel, gkey };
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

  const lineStroke = 'rgba(255,255,255,0.7)';
  const markerRadius = 7;

  const pointerTargetIsInsideIntentPopover = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    return target.closest('[data-intent-marker-popover]') != null;
  };

  const openPopoverForGroup = (gkey: string) => {
    const el = hitCircleRefs.current.get(gkey);
    const g = groupCenters.get(gkey);
    if (!el || !g) return;
    setMarkerDetail({
      key: gkey,
      rect: el.getBoundingClientRect(),
      hex: g.hex,
      oklch: g.oklch,
      stepLabel: g.stepLabel,
      tokens: g.tokens,
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
              onPointerEnter={() => {
                setHoverGkey(gkey);
                clearHoverCloseTimer();
                clearHoverOpenTimer();
                hoverOpenTimerRef.current = setTimeout(() => {
                  hoverOpenTimerRef.current = null;
                  openPopoverForGroup(gkey);
                }, 140);
              }}
              onPointerLeave={(e) => {
                setHoverGkey(null);
                clearHoverOpenTimer();
                if (pointerTargetIsInsideIntentPopover(e.relatedTarget)) return;
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    const at = document.elementFromPoint(e.clientX, e.clientY);
                    if (pointerTargetIsInsideIntentPopover(at)) return;
                    schedulePopoverClose(gkey);
                  });
                });
              }}
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
                  ref={(node) => {
                    if (node) hitCircleRefs.current.set(gkey, node);
                    else hitCircleRefs.current.delete(gkey);
                  }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    clearAllMarkerHoverTimers();
                    try {
                      (e.currentTarget as SVGCircleElement).setPointerCapture(e.pointerId);
                    } catch {
                      /* unsupported or already captured */
                    }
                    openPopoverForGroup(gkey);
                  }}
                  onPointerUp={(e) => {
                    try {
                      const el = e.currentTarget as SVGCircleElement;
                      if (el.hasPointerCapture?.(e.pointerId)) {
                        el.releasePointerCapture(e.pointerId);
                      }
                    } catch {
                      /* ignore */
                    }
                  }}
                  onPointerCancel={(e) => {
                    try {
                      const el = e.currentTarget as SVGCircleElement;
                      if (el.hasPointerCapture?.(e.pointerId)) {
                        el.releasePointerCapture(e.pointerId);
                      }
                    } catch {
                      /* ignore */
                    }
                  }}
                />
              </g>
            </g>
          );
        })}
      </g>
      <IntentMarkerPopover
        detail={markerDetail}
        onClose={() => {
          clearAllMarkerHoverTimers();
          setMarkerDetail(null);
        }}
        onPopoverPointerEnter={clearHoverCloseTimer}
        onPopoverPointerLeave={() => {
          const k = markerDetail?.key;
          if (k) schedulePopoverClose(k);
        }}
        rampName={ramp.scaleName}
      />
    </Fragment>
  );
}
