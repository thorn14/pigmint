import { useMemo } from 'react';
import { usePaletteStore } from '../../store/paletteStore';
import { generateRamp } from '../../lib/colorMath';
import {
  buildScaleAxisGradientCss,
  buildScaleLinearGradientCss,
  computeAdjacentDeltaE,
} from '../../lib/curveInterpolation';
import type { ColorScale, GeneratedRamp } from '../../types/palette';

const MAIN_HEIGHT = 120;
const AXIS_HEIGHT = 44;
const DE_ROW_HEIGHT = 32;

interface RowProps {
  scale: ColorScale;
  ramp: GeneratedRamp;
}

function GradientStrip({ label, srgb, p3, height }: { label: string; srgb: string; p3: string; height: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '2px 12px',
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--p-text-secondary)',
          background: 'var(--p-bg-subtle, var(--p-bg))',
          borderBottom: '1px solid var(--p-border)',
        }}
      >
        {label}
      </div>
      <div style={{ position: 'relative', height, background: srgb }}>
        <div
          className="pigmint-p3-layer"
          style={{ position: 'absolute', inset: 0, background: p3 }}
          aria-hidden
        />
      </div>
    </div>
  );
}

export function ScaleDiagnosticsRow({ scale, ramp }: RowProps) {
  const srgbMain = useMemo(() => buildScaleLinearGradientCss(scale, { gamut: 'srgb' }), [scale]);
  const p3Main = useMemo(() => buildScaleLinearGradientCss(scale, { gamut: 'p3' }), [scale]);
  const srgbL = useMemo(() => buildScaleAxisGradientCss(scale, 'lightness', { gamut: 'srgb' }), [scale]);
  const p3L = useMemo(() => buildScaleAxisGradientCss(scale, 'lightness', { gamut: 'p3' }), [scale]);
  const srgbC = useMemo(() => buildScaleAxisGradientCss(scale, 'chroma', { gamut: 'srgb' }), [scale]);
  const p3C = useMemo(() => buildScaleAxisGradientCss(scale, 'chroma', { gamut: 'p3' }), [scale]);
  const deltaEs = useMemo(() => computeAdjacentDeltaE(ramp), [ramp]);

  const median = useMemo(() => {
    if (deltaEs.length === 0) return 0;
    const sorted = [...deltaEs].sort((a, b) => a - b);
    const m = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[m - 1] + sorted[m]) / 2 : sorted[m];
  }, [deltaEs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--p-border)' }}>
      {/* Scale title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 32,
          padding: '0 12px',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--p-text)',
          background: 'var(--p-bg-subtle, var(--p-bg))',
          borderBottom: '1px solid var(--p-border)',
        }}
      >
        {scale.name}
      </div>

      {/* Step labels (aligned with main gradient cells) */}
      <div className="flex shrink-0 border-b" style={{ height: 24, borderColor: 'var(--p-border)' }}>
        {ramp.steps.map((step) => (
          <div
            key={step.name}
            className="flex-1 flex items-center justify-center border-r last:border-r-0"
            style={{ borderColor: 'var(--p-border)' }}
          >
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--p-text-secondary)' }}>
              {step.name}
            </span>
          </div>
        ))}
      </div>

      <GradientStrip label="Main" srgb={srgbMain} p3={p3Main} height={MAIN_HEIGHT} />
      <GradientStrip label="Lightness only" srgb={srgbL} p3={p3L} height={AXIS_HEIGHT} />
      <GradientStrip label="Chroma only" srgb={srgbC} p3={p3C} height={AXIS_HEIGHT} />

      {/* ΔE row — one cell per adjacent step pair, centered between step labels */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            padding: '2px 12px',
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--p-text-secondary)',
            background: 'var(--p-bg-subtle, var(--p-bg))',
            borderBottom: '1px solid var(--p-border)',
          }}
        >
          ΔE (OKLab) — adjacent steps
        </div>
        <div className="flex" style={{ height: DE_ROW_HEIGHT }}>
          {/* leading half-cell to align centers with the gap between step 0 and step 1 */}
          <div style={{ flex: 0.5 }} />
          {deltaEs.map((de, i) => {
            const ratio = median === 0 ? 1 : de / median;
            const intensity = Math.max(0, Math.min(1, Math.abs(ratio - 1)));
            const bg = `oklch(0.92 ${(0.12 * intensity).toFixed(3)} 30)`;
            return (
              <div
                key={i}
                title={`Δ${de.toFixed(4)}  (median ${median.toFixed(4)})`}
                className="flex-1 flex items-center justify-center border-r last:border-r-0"
                style={{
                  borderColor: 'var(--p-border)',
                  background: bg,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'monospace',
                  color: '#1a1a1a',
                }}
              >
                {de.toFixed(3)}
              </div>
            );
          })}
          <div style={{ flex: 0.5 }} />
        </div>
      </div>
    </div>
  );
}

export function RampDiagnosticsView() {
  const scales = usePaletteStore((s) => s.scales);

  const ramps = useMemo(() => {
    const map = new Map<string, GeneratedRamp>();
    for (const scale of scales) {
      try {
        map.set(scale.name, generateRamp(scale));
      } catch (e) {
        console.warn(`[RampDiagnosticsView] generateRamp failed for "${scale.name}":`, e);
      }
    }
    return map;
  }, [scales]);

  if (scales.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          color: 'var(--p-text-secondary)',
        }}
      >
        Add ramps in the Primitives tab to see diagnostics.
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      {scales.map((scale) => {
        const ramp = ramps.get(scale.name);
        if (!ramp) return null;
        return <ScaleDiagnosticsRow key={scale.id} scale={scale} ramp={ramp} />;
      })}
    </div>
  );
}
