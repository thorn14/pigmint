import { useEffect, useId, useState } from 'react';
import { tryParseHex } from '../../lib/colorMath';
import { AppField } from '../base-ui';

interface Props {
  value: string;
  onChange: (hex: string) => void;
  label?: string;
}

const textInputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '6px 10px',
  fontSize: 13,
  fontFamily: 'monospace',
  background: 'var(--p-bg-subtle)',
  border: '1px solid var(--p-border)',
  borderRadius: 6,
  color: 'var(--p-text)',
  boxSizing: 'border-box',
};

export function ColorInput({ value, onChange, label = 'Source color' }: Props) {
  const idBase = useId();
  const textId = `${idBase}-hex`;
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState(false);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setDraft(raw);
    const hex = raw.startsWith('#') ? raw : `#${raw}`;
    const parsed = tryParseHex(hex);
    if (parsed) {
      setError(false);
      onChange(hex.toLowerCase());
    } else {
      setError(true);
    }
  }

  function handleColorPicker(e: React.ChangeEvent<HTMLInputElement>) {
    const hex = e.target.value;
    setDraft(hex);
    setError(false);
    onChange(hex);
  }

  return (
    <AppField
      label={label}
      htmlFor={textId}
      invalid={error}
      error={error ? 'Invalid hex' : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="color"
          className="p-color-input focus-visible-ring"
          value={value.startsWith('#') ? value : `#${value}`}
          onChange={handleColorPicker}
          style={{
            width: 36,
            height: 36,
            padding: 0,
            border: '1px solid var(--p-border)',
            borderRadius: 6,
            cursor: 'pointer',
            background: 'none',
          }}
          title="Pick color"
          aria-label={`${label} picker`}
        />
        <input
          id={textId}
          name="hex-color"
          type="text"
          value={draft}
          onChange={handleChange}
          placeholder="#808080…"
          spellCheck={false}
          className="focus-visible-ring"
          style={{
            ...textInputStyle,
            borderColor: error ? 'var(--p-danger)' : 'var(--p-border)',
          }}
        />
      </div>
    </AppField>
  );
}
