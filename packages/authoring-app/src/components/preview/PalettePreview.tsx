import { useState, useRef, useEffect, useMemo } from 'react';
import { formatCss } from 'culori';
import { usePaletteStore } from '../../store/paletteStore';
import { useGeneratedRamp } from '../../hooks/useGeneratedRamp';
import { buildScaleLinearGradientCss } from '../../lib/curveInterpolation';
import type { ColorScale, GeneratedStep } from '../../types/palette';

type ViewMode = 'curves' | 'gradient';
const VIEW_MODES: readonly ViewMode[] = ['curves', 'gradient'];

const supportsP3 = typeof CSS !== 'undefined' && CSS.supports('color', 'color(display-p3 0 0 0)');

function ColorSwatchTooltip({
  scale,
  step,
  onEditScale,
}: {
  scale: ColorScale;
  step: GeneratedStep;
  onEditScale?: (scaleId: string) => void;
}) {
  const srgbPreview = usePaletteStore((s) => s.srgbPreview);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const stepAlpha = step.oklch.alpha;
  const swatchColor = (stepAlpha != null && stepAlpha < 1)
    ? (formatCss({ mode: 'oklch', ...step.oklch }) ?? step.hex)
    : ((!srgbPreview && supportsP3 && step.displayP3) || step.hex);

  useEffect(() => {
    if (!visible || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setCoords({
      x: rect.left + rect.width / 2,
      y: rect.bottom + 4,
    });
  }, [visible]);

  return (
    <div
      ref={wrapperRef}
      role="cell"
      style={{ position: 'relative', height: 48 }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <button
        type="button"
        style={{
          backgroundColor: swatchColor,
          height: 48,
          cursor: onEditScale ? 'pointer' : 'default',
          borderRight: '1px solid var(--p-border)',
          zIndex: visible ? 10 : 'auto',
          position: visible ? 'relative' : undefined,
          width: '100%',
        }}
        className="focus-visible-ring"
        aria-label={`${scale.name} ${step.name} ${step.hex}`}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        onClick={() => onEditScale?.(scale.id)}
      />
      {visible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          style={{
            position: 'fixed',
            left: coords.x,
            top: coords.y,
            transform: 'translate(-50%, 0)',
            zIndex: 50,
            pointerEvents: 'auto',
            minWidth: 160,
            padding: '8px 12px',
            background: 'var(--p-bg)',
            border: '1px solid var(--p-border)',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            fontSize: 12,
            fontFamily: 'monospace',
          }}
          onMouseEnter={() => setVisible(true)}
          onMouseLeave={() => setVisible(false)}
        >
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              marginBottom: 8,
            }}
          >
            <div
              role="img"
              aria-label={`${scale.name} ${step.name} swatch`}
              style={{
                width: 40,
                height: 40,
                flexShrink: 0,
                borderRadius: 6,
                backgroundColor: swatchColor,
                border: '1px solid var(--p-border)',
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)',
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: 'var(--p-text)', fontWeight: 600, marginBottom: 4 }}>
                {scale.name} / {step.name}
              </div>
              <div style={{ color: 'var(--p-text-secondary)', marginBottom: 4 }}>{step.hex}</div>
              <div style={{ color: 'var(--p-text-secondary)', fontSize: 11 }}>
                L {step.oklch.l.toFixed(2)} C {step.oklch.c.toFixed(3)} h {step.oklch.h.toFixed(0)}°
              </div>
            </div>
          </div>
          {onEditScale && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onEditScale(scale.id);
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '4px 8px',
                fontSize: 11,
                fontWeight: 500,
                background: 'var(--p-accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
              className="focus-visible-ring"
            >
              Edit scale →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PreviewRow({
  scale,
  colCount,
  onEditScale,
}: {
  scale: ColorScale;
  colCount: number;
  onEditScale?: (scaleId: string) => void;
}) {
  const ramp = useGeneratedRamp(scale);
  return (
    <>
      {ramp.steps.slice(0, colCount).map((step) => (
        <ColorSwatchTooltip
          key={step.name}
          scale={scale}
          step={step}
          onEditScale={onEditScale}
        />
      ))}
    </>
  );
}

function HeaderRow({ scale, viewMode, colCount }: { scale: ColorScale; viewMode: ViewMode; colCount: number }) {
  const ramp = useGeneratedRamp(scale);
  if (viewMode === 'gradient') {
    return (
      <div
        role="presentation"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
          minWidth: 0,
        }}
      >
        {ramp.steps.slice(0, colCount).map((step) => (
          <div
            key={step.name}
            role="columnheader"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontFamily: 'monospace',
              color: 'var(--p-text-secondary)',
              borderRight: '1px solid var(--p-border)',
            }}
          >
            {step.name}
          </div>
        ))}
      </div>
    );
  }
  return (
    <>
      {ramp.steps.map((step) => (
        <div
          key={step.name}
          role="columnheader"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontFamily: 'monospace',
            color: 'var(--p-text-secondary)',
            borderRight: '1px solid var(--p-border)',
          }}
        >
          {step.name}
        </div>
      ))}
    </>
  );
}

function GradientPreviewRow({
  scale,
  onEditScale,
}: {
  scale: ColorScale;
  onEditScale?: (scaleId: string) => void;
}) {
  const background = useMemo(() => buildScaleLinearGradientCss(scale), [scale]);
  return (
    <div
      role="cell"
      style={{
        minWidth: 0,
        height: 48,
        position: 'relative',
        display: 'flex',
        background,
        borderRight: '1px solid var(--p-border)',
      }}
    >
      <button
        type="button"
        onClick={() => onEditScale?.(scale.id)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 'none',
          padding: 0,
          background: 'transparent',
          cursor: onEditScale ? 'pointer' : 'default',
        }}
        className="focus-visible-ring"
        aria-label={onEditScale ? `${scale.name} ramp — open in editor` : `${scale.name} smooth gradient preview`}
      />
    </div>
  );
}

interface PalettePreviewProps {
  onEditScale?: (scaleId: string) => void;
}

export function PalettePreview({ onEditScale }: PalettePreviewProps) {
  const scales = usePaletteStore((s) => s.scales);
  const [viewMode, setViewMode] = useState<ViewMode>('curves');
  const firstScale = scales[0];

  if (!firstScale) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          fontSize: 14,
          color: 'var(--p-text-secondary)',
        }}
      >
        No color scales yet. Add one from the sidebar.
      </div>
    );
  }

  const colCount = firstScale.stepCount;
  const gridColumns =
    viewMode === 'curves'
      ? `minmax(120px, 120px) repeat(${colCount}, minmax(0, 1fr))`
      : `minmax(120px, 120px) minmax(0, 1fr)`;

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      style={{ background: 'var(--p-bg)' }}
    >
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
                className="focus-visible-ring"
              >
                {m}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {/* Header + body */}
        <div role="table" aria-label="Palette preview">
          <div
            role="rowgroup"
            style={{
              display: 'grid',
              gridTemplateColumns: gridColumns,
              minHeight: 28,
              borderBottom: '1px solid var(--p-border)',
              background: 'var(--p-bg-subtle)',
              position: 'sticky',
              top: 0,
              zIndex: 3,
            }}
          >
            <div role="row" style={{ display: 'contents' }}>
              <div
                role="columnheader"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  paddingInline: 12,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'monospace',
                  color: 'var(--p-text-secondary)',
                }}
              >
                Name
              </div>
              <HeaderRow
                scale={firstScale}
                viewMode={viewMode}
                colCount={colCount}
              />
            </div>
          </div>

          <div role="rowgroup">
            {scales.map((scale) => (
              <div
                key={scale.id}
                role="row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: gridColumns,
                  borderBottom: '1px solid var(--p-border)',
                }}
              >
                <div
                  role="rowheader"
                  style={{
                    height: 48,
                    display: 'flex',
                    alignItems: 'center',
                    paddingInline: 12,
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'monospace',
                    color: 'var(--p-text)',
                    borderRight: '1px solid var(--p-border)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  }}
                >
                  {scale.name}
                </div>
                {viewMode === 'curves' ? (
                  <PreviewRow scale={scale} colCount={colCount} onEditScale={onEditScale} />
                ) : (
                  <GradientPreviewRow scale={scale} onEditScale={onEditScale} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
