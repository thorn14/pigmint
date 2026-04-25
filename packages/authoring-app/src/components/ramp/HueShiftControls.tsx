import type { CSSProperties } from 'react';
import type { ColorScale } from '../../types/palette';
import { usePaletteStore } from '../../store/paletteStore';
import { AppField, AppSlider } from '../base-ui';

interface Props {
  scale: ColorScale;
}

const panelStyle: CSSProperties = {
  display: 'flex',
  gap: 24,
  padding: 12,
  background: 'var(--p-bg-subtle)',
  borderRadius: 8,
  border: '1px solid var(--p-border)',
};

export function HueShiftControls({ scale }: Props) {
  const updateHueShift = usePaletteStore((s) => s.updateHueShift);
  const beginCurveEdit = usePaletteStore((s) => s.beginCurveEdit);
  const commitCurveEdit = usePaletteStore((s) => s.commitCurveEdit);
  const lightEndId = `hue-shift-light-${scale.id}`;
  const darkEndId = `hue-shift-dark-${scale.id}`;

  return (
    <div style={panelStyle}>
      <AppField
        style={{ flex: 1, minWidth: 0 }}
        label={`Light-end hue shift (warm) — ${scale.hueShift.lightEndAdjust}%`}
        htmlFor={lightEndId}
      >
        <AppSlider
          id={lightEndId}
          value={scale.hueShift.lightEndAdjust}
          min={0}
          max={100}
          step={1}
          thumbColor="var(--p-accent)"
          onValueChange={(v) => updateHueShift(scale.id, 'lightEndAdjust', Math.round(v))}
          onPointerDown={() => beginCurveEdit(scale.id)}
          onValueCommitted={() => commitCurveEdit()}
          aria-label="Light-end hue shift percentage"
        />
      </AppField>
      <AppField
        style={{ flex: 1, minWidth: 0 }}
        label={`Dark-end hue shift (cool) — ${scale.hueShift.darkEndAdjust}%`}
        htmlFor={darkEndId}
      >
        <AppSlider
          id={darkEndId}
          value={scale.hueShift.darkEndAdjust}
          min={0}
          max={100}
          step={1}
          thumbColor="var(--p-accent)"
          onValueChange={(v) => updateHueShift(scale.id, 'darkEndAdjust', Math.round(v))}
          onPointerDown={() => beginCurveEdit(scale.id)}
          onValueCommitted={() => commitCurveEdit()}
          aria-label="Dark-end hue shift percentage"
        />
      </AppField>
    </div>
  );
}
