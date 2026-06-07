import { Select } from '@base-ui/react/select';
import type { CSSProperties, ReactNode } from 'react';

export type AppStringSelectOption = { value: string; label: ReactNode };

type Props = {
  value: string;
  onValueChange: (v: string) => void;
  options: readonly AppStringSelectOption[];
  'aria-label'?: string;
  name?: string;
  className?: string;
  style?: CSSProperties;
  /** Match native &lt;select&gt; in compact top bars / forms */
  size?: 'compact' | 'default';
  disabled?: boolean;
  /** @default false — avoids full-page pointer lock in toolbars */
  modal?: boolean;
  placeholder?: ReactNode;
  id?: string;
};

const compactTrigger: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 6,
  padding: '3px 6px',
  fontSize: 12,
  /** Must stay ≤ maxWidth below — min 110 + max 90 was invalid and clipped borders in the top bar */
  minWidth: 0,
  background: 'var(--p-bg)',
  border: '1px solid var(--p-border)',
  borderRadius: 5,
  color: 'var(--p-text)',
  cursor: 'pointer',
  fontFamily: 'monospace, inherit',
  boxSizing: 'border-box',
  width: '100%',
};

const defaultTrigger: CSSProperties = {
  ...compactTrigger,
  minWidth: 0,
  width: '100%',
};

/**
 * Single-select for string values; styled like the app’s previous native
 * &lt;select&gt; elements.
 */
export function AppStringSelect({
  value,
  onValueChange,
  options,
  'aria-label': ariaLabel,
  name,
  className = 'focus-visible-ring',
  style,
  size = 'default',
  disabled = false,
  modal = false,
  placeholder = '—',
  id,
}: Props) {
  const triggerStyle: CSSProperties = {
    ...(size === 'compact' ? compactTrigger : defaultTrigger),
    maxWidth: size === 'compact' ? 120 : undefined,
    fontSize: size === 'compact' ? 11 : 12,
    color: size === 'compact' ? 'var(--p-text-secondary)' : 'var(--p-text)',
    ...style,
  };

  return (
    <Select.Root
      name={name}
      value={value}
      disabled={disabled}
      modal={modal}
      onValueChange={(v) => {
        if (v != null) onValueChange(String(v));
      }}
    >
      <Select.Trigger id={id} className={className} style={triggerStyle} aria-label={ariaLabel} disabled={disabled}>
        <Select.Value placeholder={placeholder}>
          {(v) => {
            if (v == null) return placeholder;
            const found = options.find((o) => o.value === v);
            return found ? found.label : String(v);
          }}
        </Select.Value>
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="currentColor"
          aria-hidden="true"
          style={{ flexShrink: 0, color: 'var(--p-text-tertiary)' }}
        >
          <path d="M0 0h10L5 6z" />
        </svg>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner side="bottom" align="start" sideOffset={4} className="app-select-positioner" style={{ zIndex: 60_000 }}>
          <Select.Popup
            className="focus-visible-ring"
            style={{
              minWidth: 'var(--anchor-width, 8rem)',
              maxWidth: 320,
              maxHeight: 360,
              overflow: 'auto',
              background: 'var(--p-bg)',
              color: 'var(--p-text)',
              border: '1px solid var(--p-border)',
              borderRadius: 6,
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            }}
          >
            <Select.List
              className="app-select-list"
              style={{ padding: 4, listStyle: 'none', margin: 0, fontSize: 12, fontFamily: 'monospace, inherit' }}
            >
              {options.map((o) => (
                <Select.Item
                  key={o.value}
                  value={o.value}
                  className="app-select-item"
                  style={{
                    padding: '6px 8px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    outline: 'none',
                    color: 'var(--p-text)',
                  }}
                >
                  <Select.ItemText style={{ display: 'block' }}>{o.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
