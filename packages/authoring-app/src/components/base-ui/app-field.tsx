import { Field } from '@base-ui/react/field';
import type { CSSProperties, ReactNode } from 'react';

type Props = {
  label: ReactNode;
  /** Shown between label and control; uses `Field.Description` semantics. */
  description?: ReactNode;
  /** When set, label is a native `<label htmlFor={htmlFor}>`. Omit for non-labelable children (set `aria-label` on the child instead). */
  htmlFor?: string;
  /** Validation message; shown when `invalid` is true. */
  error?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
  invalid?: boolean;
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  color: 'var(--p-text-secondary)',
  fontWeight: 500,
};

/**
 * Base UI `Field` shell: labeled groups with optional description, aligned with
 * pigmint `--p-*` tokens. Use `htmlFor` + matching `id` on inputs / `AppStringSelect`.
 */
export function AppField({ label, description, htmlFor, error, children, style, invalid }: Props) {
  return (
    <Field.Root
      invalid={invalid}
      style={{ display: 'flex', flexDirection: 'column', gap: description ? 6 : 4, ...style }}
    >
      <Field.Label
        htmlFor={htmlFor}
        nativeLabel={htmlFor !== undefined}
        style={labelStyle}
      >
        {label}
      </Field.Label>
      {description ? (
        <Field.Description
          style={{
            fontSize: 11,
            color: 'var(--p-text-tertiary)',
            lineHeight: 1.45,
          }}
        >
          {description}
        </Field.Description>
      ) : null}
      {children}
      {error ? (
        <Field.Error
          match
          style={{ fontSize: 11, color: 'var(--p-danger)', marginTop: 2, lineHeight: 1.35 }}
        >
          {error}
        </Field.Error>
      ) : null}
    </Field.Root>
  );
}
