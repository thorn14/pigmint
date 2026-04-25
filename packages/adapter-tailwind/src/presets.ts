export type PresetName = 'generic' | 'shadcn';

export type NameMapper = (tokenPath: string) => string;

// Generic preset: dot-separated path → CSS custom property.
// e.g. "surface.main" → "--surface-main", "bgMain" → "--bg-main"
export const genericPreset: NameMapper = (tokenPath) =>
  `--${tokenPath.replace(/\./g, '-')}`;

// shadcn map keyed by DTCG paths (no color. prefix, matching the flat container root).
const SHADCN_MAP: Record<string, string> = {
  'surface.main': '--background',
  'surface.elevated': '--card',
  'surface.inverse': '--accent',
  'surface.subtle': '--muted',
  'foreground.main': '--foreground',
  'foreground.muted': '--muted-foreground',
  'foreground.subtle': '--foreground-subtle',
  'foreground.inverse': '--accent-foreground',
  'action.primary.background': '--primary',
  'action.primary.text': '--primary-foreground',
  'action.secondary.background': '--secondary',
  'action.secondary.text': '--secondary-foreground',
  'border.main': '--border',
  'border.subtle': '--border-subtle',
  'border.prominent': '--border-strong',
  'feedback.danger.background': '--destructive',
  'feedback.danger.text': '--destructive-foreground',
  'feedback.danger.border': '--destructive-border',
  'feedback.success.background': '--success',
  'feedback.success.text': '--success-foreground',
  'feedback.success.border': '--success-border',
  'feedback.warning.background': '--warning',
  'feedback.warning.text': '--warning-foreground',
  'feedback.info.background': '--info',
  'feedback.info.text': '--info-foreground',
  'focus.ring': '--ring',
  'focus.outline': '--focus-outline',
};

export function shadcnPreset(fallback: NameMapper = genericPreset): NameMapper {
  return (tokenPath) => {
    const mapped = SHADCN_MAP[tokenPath];
    return mapped ?? fallback(tokenPath);
  };
}

export function resolvePreset(name: PresetName | undefined): NameMapper {
  if (name === 'shadcn') return shadcnPreset();
  return genericPreset;
}
