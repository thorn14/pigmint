import { CurvePreview } from './CurvePreview';
import { AppSlider } from '../base-ui';

interface Props {
  label: string;
  values: number[];
  min: number;
  max: number;
  step?: number;
  previewColor?: string;
  onChange: (stepIndex: number, value: number) => void;
}

export function CurveTrack({ label, values, min, max, step = 0.001, previewColor, onChange }: Props) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">{label}</span>
        <CurvePreview values={values} min={min} max={max} color={previewColor} />
      </div>
      <div className="flex gap-1 items-end">
        {values.map((val, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
            <span className="text-[9px] text-neutral-500 tabular-nums">{val.toFixed(2)}</span>
            <AppSlider
              orientation="vertical"
              value={val}
              min={min}
              max={max}
              step={step}
              onValueChange={(v) => onChange(i, v)}
              style={{ height: 80 }}
              aria-label={`${label} step ${i + 1}`}
              getAriaValueText={(_f, v) => v.toFixed(3)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
