import { useId } from 'react';
import type { StepNamingConfig, StepNamingPreset } from '../../types/palette';

interface Props {
  value: StepNamingConfig;
  onChange: (config: StepNamingConfig) => void;
}

const PRESETS: { value: StepNamingPreset; label: string }[] = [
  { value: 'tailwind', label: 'Tailwind (50–950)' },
  { value: 'numeric', label: 'Numeric (1–11)' },
  { value: 'custom', label: 'Custom' },
];

export function StepNamingSelect({ value, onChange }: Props) {
  const selectId = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={selectId} className="text-xs text-neutral-400">Step naming</label>
      <select
        id={selectId}
        name="step-naming"
        value={value.preset}
        onChange={(e) => onChange({ ...value, preset: e.target.value as StepNamingPreset })}
        className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 cursor-pointer"
      >
        {PRESETS.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>
    </div>
  );
}
