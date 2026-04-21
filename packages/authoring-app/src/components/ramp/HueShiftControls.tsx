import type { ColorScale } from '../../types/palette';
import { usePaletteStore } from '../../store/paletteStore';

interface Props {
  scale: ColorScale;
}

export function HueShiftControls({ scale }: Props) {
  const updateHueShift = usePaletteStore((s) => s.updateHueShift);
  const beginCurveEdit = usePaletteStore((s) => s.beginCurveEdit);
  const commitCurveEdit = usePaletteStore((s) => s.commitCurveEdit);
  const lightEndId = `hue-shift-light-${scale.id}`;
  const darkEndId = `hue-shift-dark-${scale.id}`;

  return (
    <div className="flex gap-6 p-3 bg-neutral-900 rounded-lg border border-neutral-800">
      <div className="flex-1 space-y-1">
        <label htmlFor={lightEndId} className="text-xs text-neutral-400">
          Light-end hue shift (warm) — {scale.hueShift.lightEndAdjust}%
        </label>
        <input
          id={lightEndId}
          type="range"
          min={0}
          max={100}
          value={scale.hueShift.lightEndAdjust}
          onPointerDown={() => beginCurveEdit(scale.id)}
          onChange={(e) => updateHueShift(scale.id, 'lightEndAdjust', parseInt(e.target.value))}
          onPointerUp={() => commitCurveEdit()}
          className="w-full"
          style={{ accentColor: 'var(--p-accent)' }}
        />
      </div>
      <div className="flex-1 space-y-1">
        <label htmlFor={darkEndId} className="text-xs text-neutral-400">
          Dark-end hue shift (cool) — {scale.hueShift.darkEndAdjust}%
        </label>
        <input
          id={darkEndId}
          type="range"
          min={0}
          max={100}
          value={scale.hueShift.darkEndAdjust}
          onPointerDown={() => beginCurveEdit(scale.id)}
          onChange={(e) => updateHueShift(scale.id, 'darkEndAdjust', parseInt(e.target.value))}
          onPointerUp={() => commitCurveEdit()}
          className="w-full"
          style={{ accentColor: 'var(--p-accent)' }}
        />
      </div>
    </div>
  );
}
