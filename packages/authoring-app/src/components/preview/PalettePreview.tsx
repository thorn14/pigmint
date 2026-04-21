import { useState, useRef, useEffect } from 'react';
import { usePaletteStore } from '../../store/paletteStore';
import { useGeneratedRamp } from '../../hooks/useGeneratedRamp';
import type { ColorScale, GeneratedStep } from '../../types/palette';

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
          backgroundColor: (!srgbPreview && supportsP3 && step.displayP3) || step.hex,
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
          <div style={{ color: 'var(--p-text)', fontWeight: 600, marginBottom: 4 }}>
            {scale.name} / {step.name}
          </div>
          <div style={{ color: 'var(--p-text-secondary)', marginBottom: 6 }}>{step.hex}</div>
          <div style={{ color: 'var(--p-text-secondary)', fontSize: 11, marginBottom: 8 }}>
            L {step.oklch.l.toFixed(2)} C {step.oklch.c.toFixed(3)} h {step.oklch.h.toFixed(0)}°
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

function HeaderRow({ scale }: { scale: ColorScale }) {
  const ramp = useGeneratedRamp(scale);
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

interface PalettePreviewProps {
  onEditScale?: (scaleId: string) => void;
}

export function PalettePreview({ onEditScale }: PalettePreviewProps) {
  const scales = usePaletteStore((s) => s.scales);
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
  const gridColumns = `minmax(120px, 120px) repeat(${colCount}, minmax(0, 1fr))`;

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
      {/* Header */}
      <div role="table" aria-label="Palette preview">
        <div
          role="rowgroup"
          style={{
            display: 'grid',
            gridTemplateColumns: gridColumns,
            height: 28,
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
            <HeaderRow scale={firstScale} />
          </div>
        </div>

        {/* Rows */}
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
            <PreviewRow scale={scale} colCount={colCount} onEditScale={onEditScale} />
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}
