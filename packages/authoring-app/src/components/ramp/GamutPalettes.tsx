import type { GeneratedRamp } from '../../types/palette';
import { stepDisplayColor } from '../../lib/gamutDisplay';

const ROW_LABEL_WIDTH = 62;

const rowLabelStyle: React.CSSProperties = {
  width: ROW_LABEL_WIDTH,
  flexShrink: 0,
  fontSize: 10,
  fontFamily: 'monospace',
  color: 'var(--p-text-secondary)',
  whiteSpace: 'nowrap',
};

function Strip({
  label,
  cells,
  height,
}: {
  label: string;
  cells: { key: string; color: string; title: string; marked: boolean }[];
  height: number;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={rowLabelStyle}>{label}</span>
      <div style={{ flex: 1, display: 'flex', height, borderRadius: 3, overflow: 'hidden' }}>
        {cells.map((cell) => (
          <div
            key={cell.key}
            title={cell.title}
            style={{
              flex: 1,
              backgroundColor: cell.color,
              // A hairline on steps that differ between the two rows, so the
              // ones where the fallback is a compromise are findable at a glance.
              boxShadow: cell.marked ? 'inset 0 -2px 0 rgba(255,255,255,0.55)' : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * The ramp's Display-P3 palette with its sRGB-safe hex palette directly beneath
 * it, step for step. The two rows only diverge where a step needs P3, which is
 * exactly what an sRGB viewer will see instead.
 */
export function GamutPalettes({ ramp, height = 18 }: { ramp: GeneratedRamp; height?: number }) {
  const p3Cells = ramp.steps.map((step) => ({
    key: step.name,
    color: stepDisplayColor(step),
    title: `${step.name} — ${step.displayP3 ?? step.hex}`,
    marked: step.gamut === 'p3',
  }));
  const hexCells = ramp.steps.map((step) => ({
    key: step.name,
    color: step.hex,
    title: `${step.name} — ${step.hex}`,
    marked: step.gamut === 'p3',
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }} aria-hidden="true">
      <Strip label="P3" cells={p3Cells} height={height} />
      <Strip label="sRGB hex" cells={hexCells} height={height} />
    </div>
  );
}
