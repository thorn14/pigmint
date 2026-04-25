import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import type { CSSProperties, ReactNode } from 'react';

type Option<V extends string> = { value: V; label: ReactNode; title?: string; disabled?: boolean };

type Props<V extends string> = {
  'aria-label': string;
  className?: string;
  value: V;
  onValueChange: (v: V) => void;
  options: readonly Option<V>[];
  style?: CSSProperties;
};

const segment: CSSProperties = {
  display: 'inline-flex',
  borderRadius: 6,
  background: 'var(--p-bg-inset, rgba(0,0,0,0.2))',
  padding: 2,
  gap: 2,
};

const btn = (active: boolean): CSSProperties => ({
  border: 'none',
  background: active ? 'var(--p-text)' : 'transparent',
  color: active ? 'var(--p-bg)' : 'var(--p-text-secondary)',
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  padding: '3px 8px',
  borderRadius: 4,
  cursor: 'pointer',
  fontFamily: 'inherit',
  lineHeight: 1.2,
  whiteSpace: 'nowrap' as const,
  outline: 'none',
  boxSizing: 'border-box' as const,
  margin: 0,
});

/**
 * Single-choice segmented control (e.g. app mode, canvas view) using
 * `ToggleGroup` with `multiple={false}` and compact pigmint button styling.
 */
export function AppSegmentedToggleGroup<V extends string>({
  'aria-label': ariaLabel,
  className = 'focus-visible-ring',
  value,
  onValueChange,
  options,
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
      style={{ ...segment, ...style }}
    >
      {options.map((o) => (
        <Toggle
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          title={o.title}
          className="focus-visible-ring"
          style={btn(value === o.value)}
        >
          {o.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
