import { CurvePreview } from './CurvePreview';

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
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={val}
              onChange={(e) => onChange(i, parseFloat(e.target.value))}
              className="w-full cursor-pointer"
              style={{ writingMode: 'vertical-lr', direction: 'rtl', height: '80px', width: '100%', accentColor: 'var(--p-accent)' }}
              title={`Step ${i + 1}: ${val.toFixed(3)}`}
              aria-label={`${label} step ${i + 1}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
