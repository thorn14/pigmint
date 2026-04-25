import { useId } from 'react';
import type { StepNamingConfig, StepNamingPreset } from '../../types/palette';
import { AppField, AppStringSelect } from '../base-ui';

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
    <AppField label="Step naming" htmlFor={selectId}>
      <AppStringSelect
        id={selectId}
        name="step-naming"
        value={value.preset}
        onValueChange={(v) => onChange({ ...value, preset: v as StepNamingPreset })}
        className="focus-visible-ring"
        style={{ width: '100%' }}
        options={PRESETS}
      />
    </AppField>
  );
}
