export {
  TAILWIND_LIGHTNESS,
  TAILWIND_STEPS,
  NUMERIC_STEPS_11,
  buildLightnessValues,
  resolveStepNames,
} from '@pigmint/core';
export type { LightnessPreset } from '@pigmint/core';

export const LIGHTNESS_PRESET_OPTIONS: { value: 'tailwind' | 'linear' | 'eased' | 'material' | 'custom'; label: string }[] = [
  { value: 'tailwind', label: 'Tailwind' },
  { value: 'linear', label: 'Linear' },
  { value: 'eased', label: 'Eased' },
  { value: 'material', label: 'Material' },
  { value: 'custom', label: 'Custom…' },
];
