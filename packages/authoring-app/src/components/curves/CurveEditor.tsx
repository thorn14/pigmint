import type { ColorScale } from '../../types/palette';
import { usePaletteStore } from '../../store/paletteStore';
import { CurveTrack } from './CurveTrack';

interface Props {
  scale: ColorScale;
}

export function CurveEditor({ scale }: Props) {
  const updateCurveValue = usePaletteStore((s) => s.updateCurveValue);

  return (
    <div className="space-y-4 p-4 bg-neutral-900 rounded-lg border border-neutral-800">
      <h3 className="text-sm font-semibold text-neutral-300">Curve Editor</h3>

      <CurveTrack
        label="Lightness (L)"
        values={scale.curves.lightness.values}
        min={0}
        max={1}
        step={0.001}
        previewColor="var(--p-text)"
        onChange={(i, v) => updateCurveValue(scale.id, 'lightness', i, v)}
      />

      <CurveTrack
        label="Chroma (C)"
        values={scale.curves.chroma.values}
        min={0}
        max={0.4}
        step={0.001}
        previewColor="var(--p-text-secondary)"
        onChange={(i, v) => updateCurveValue(scale.id, 'chroma', i, v)}
      />

      <CurveTrack
        label="Hue delta (H)"
        values={scale.curves.hue.values}
        min={-180}
        max={180}
        step={1}
        previewColor="var(--p-text-tertiary)"
        onChange={(i, v) => updateCurveValue(scale.id, 'hue', i, v)}
      />
    </div>
  );
}
