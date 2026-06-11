import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import type { CSSProperties, ReactNode } from 'react';

type Opt<V extends string> = { value: V; label: ReactNode; 'aria-label'?: string; title?: string; disabled?: boolean };

type Props<V extends string> = {
  'aria-label': string;
  className?: string;
  value: V;
  onValueChange: (v: V) => void;
  options: readonly Opt<V>[];
  /** Slightly more padding for 6+ items (e.g. app mode row) */
  size?: 'compact' | 'comfortable';
  style?: CSSProperties;
};

const outer: CSSProperties = {
  display: 'flex',
  alignItems: 'stretch',
  border: '1px solid var(--p-border)',
  borderRadius: 6,
  overflow: 'hidden',
  flexShrink: 0,
  background: 'var(--p-bg)',
  height: 30,
  boxSizing: 'border-box',
};

const btn = (active: boolean, i: number, size: 'compact' | 'comfortable'): CSSProperties => ({
  border: 'none',
  borderLeft: i > 0 ? '1px solid var(--p-border)' : 'none',
  background: active ? 'var(--p-surface)' : 'var(--p-bg)',
  color: active ? 'var(--p-text)' : 'var(--p-text-secondary)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  margin: 0,
  outline: 'none',
  boxSizing: 'border-box' as const,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  ...(size === 'comfortable'
    ? { padding: '0 14px', fontSize: 12, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }
    : { padding: '0 10px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }),
});

/**
 * Bordered, split-button style toggle group (TopBar contrast, mode, gamut, etc.).
 */
export function AppToolbarSegmented<V extends string>({
  'aria-label': ariaLabel,
  className = 'focus-visible-ring',
  value,
  onValueChange,
  options,
  size = 'compact',
  style,
}: Props<V>) {
  return (
    <ToggleGroup
      className={className}
      aria-label={ariaLabel}
      value={[value] as readonly V[]}
      onValueChange={(arr) => {
        const v = arr[0];
        if (v) onValueChange(v as V);
      }}
      multiple={false}
      style={{ ...outer, ...style }}
    >
      {options.map((o, i) => (
        <Toggle
          key={o.value}
          value={o.value}
          className="focus-visible-ring"
          style={btn(value === o.value, i, size)}
          title={o.title}
          disabled={o.disabled}
          aria-label={o['aria-label']}
        >
          {o.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
