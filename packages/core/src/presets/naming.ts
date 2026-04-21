import type { StepNamingPreset } from '../types/palette.js';

export const TAILWIND_STEPS = [
  '50',
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900',
  '950',
] as const;

export const NUMERIC_STEPS_11 = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
] as const;

export function resolveStepNames(
  preset: StepNamingPreset,
  stepCount: number,
  customNames?: string[],
): string[] {
  if (preset === 'tailwind') {
    if (stepCount === 11) return [...TAILWIND_STEPS];
    return Array.from({ length: stepCount }, (_, i) =>
      String(Math.round((i / (stepCount - 1)) * 900 + 50)),
    );
  }
  if (preset === 'numeric') {
    return Array.from({ length: stepCount }, (_, i) => String(i + 1));
  }
  if (preset === 'custom' && customNames && customNames.length === stepCount) {
    return customNames;
  }
  return Array.from({ length: stepCount }, (_, i) => String(i + 1));
}
