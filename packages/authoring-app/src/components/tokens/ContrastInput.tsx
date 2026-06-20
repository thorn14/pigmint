import { useEffect, useRef, useState } from 'react';

type Bounds = { min: number; max: number; step: number };

type Props = {
  value: number;
  bounds: Bounds;
  onCommit: (v: number) => void;
  style?: React.CSSProperties;
};

/**
 * Number input for a target-contrast value. Keeps a local string draft so the
 * field can be emptied and freely retyped — a raw controlled `<input>` that only
 * accepts finite parses snaps back to the old value the moment you delete the
 * last digit, which makes it impossible to lower the number. We commit live
 * while the draft parses to a finite number, and on blur fall back to the last
 * committed value (empty/NaN) or clamp into bounds.
 */
export function ContrastInput({ value, bounds, onCommit, style }: Props) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);

  return (
    <input
      type="number"
      min={bounds.min}
      max={bounds.max}
      step={bounds.step}
      style={style}
      value={draft}
      onFocus={() => { focused.current = true; }}
      onChange={(e) => {
        const next = e.target.value;
        setDraft(next);
        const v = parseFloat(next);
        if (Number.isFinite(v)) onCommit(v);
      }}
      onBlur={() => {
        focused.current = false;
        const v = parseFloat(draft);
        if (!Number.isFinite(v)) {
          setDraft(String(value));
          return;
        }
        const clamped = Math.min(bounds.max, Math.max(bounds.min, v));
        if (clamped !== value) onCommit(clamped);
        setDraft(String(clamped));
      }}
    />
  );
}
