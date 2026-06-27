import { Checkbox } from '@base-ui/react/checkbox';
import type { CheckboxRootProps } from '@base-ui/react/checkbox';
import type { CSSProperties } from 'react';

const rootBase: CSSProperties = {
  width: 16,
  height: 16,
  minWidth: 16,
  minHeight: 16,
  borderRadius: 4,
  border: '1px solid var(--p-border)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  background: 'var(--p-bg)',
  boxSizing: 'border-box',
  padding: 0,
};

type Props = CheckboxRootProps;

/**
 * Small checkbox matching app borders; pairs with inline labels in modals and intent UI.
 */
export function AppCheckbox({ className = 'focus-visible-ring', style, ...rest }: Props) {
  return (
    <Checkbox.Root
      className={className}
      style={{ ...rootBase, ...style }}
      {...rest}
    >
      <Checkbox.Indicator
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--p-text)',
        }}
      >
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M2.5 6.2 4.8 8.5 9.5 3.8"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Checkbox.Indicator>
    </Checkbox.Root>
  );
}
