export type PresetName = 'generic' | 'shadcn';

export type NameMapper = (tokenPath: string) => string;

export const genericPreset: NameMapper = (tokenPath) => {
  const rest = tokenPath.startsWith('color.') ? tokenPath.slice('color.'.length) : tokenPath;
  return `--color-${rest.replace(/\./g, '-')}`;
};

const SHADCN_MAP: Record<string, string> = {
  'color.surface.main': '--background',
  'color.surface.elevated': '--card',
  'color.surface.inverse': '--accent',
  'color.surface.subtle': '--muted',
  'color.foreground.main': '--foreground',
  'color.foreground.muted': '--muted-foreground',
  'color.foreground.inverse': '--accent-foreground',
  'color.action.primary.background': '--primary',
  'color.action.primary.text': '--primary-foreground',
  'color.action.secondary.background': '--secondary',
  'color.action.secondary.text': '--secondary-foreground',
  'color.border.main': '--border',
  'color.focus.ring': '--ring',
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
