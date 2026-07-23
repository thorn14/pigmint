export {
  TAILWIND_LIGHTNESS,
  TAILWIND_STEPS,
  NUMERIC_STEPS_11,
  buildLightnessValues,
  buildLightnessFromEnds,
  resolveStepNames,
  EASING_FAMILIES,
  EASING_VARIANTS,
  resolveEasingFunction,
  easingFamilyHasVariants,
} from '@pigmint/core';
export type { LightnessPreset, EasingFamily, EasingVariant } from '@pigmint/core';

import type { EasingFamily, EasingVariant } from '@pigmint/core';

export const LIGHTNESS_PRESET_OPTIONS: { value: 'tailwind' | 'linear' | 'eased' | 'material' | 'custom'; label: string }[] = [
  { value: 'tailwind', label: 'Tailwind' },
  { value: 'linear', label: 'Linear' },
  { value: 'eased', label: 'Eased' },
  { value: 'material', label: 'Material' },
  { value: 'custom', label: 'Custom…' },
];

export const EASING_FAMILY_OPTIONS: { value: EasingFamily; label: string }[] = [
  { value: 'linear', label: 'Linear' },
  { value: 'quadratic', label: 'Quadratic' },
  { value: 'cubic', label: 'Cubic' },
  { value: 'quartic', label: 'Quartic' },
  { value: 'quintic', label: 'Quintic' },
  { value: 'sine', label: 'Sine' },
  { value: 'circular', label: 'Circular' },
  { value: 'exponential', label: 'Exponential' },
];

export const EASING_VARIANT_OPTIONS: { value: EasingVariant; label: string }[] = [
  { value: 'in', label: 'In' },
  { value: 'out', label: 'Out' },
  { value: 'inOut', label: 'In-out' },
];
