import { useEffect, useId, useMemo, useState } from 'react';
import type { ColorScale } from '../../types/palette';
import { resolveStepNames } from '../../constants/stepPresets';
import { usePaletteStore } from '../../store/paletteStore';

interface Props {
  scale: ColorScale;
  mode: 'names' | 'lightness';
  applyToAll?: boolean;
  onClose: () => void;
}

function parseNameList(text: string): string[] {
  return text
    .split(/[\n,]+/g)
    .map((n) => n.trim())
    .filter(Boolean);
}

function parseLightnessList(text: string): number[] {
  return text
    .split(/[\s,]+/g)
    .map((n) => n.trim())
    .filter(Boolean)
    .map((n) => {
      const v = parseFloat(n);
      if (Number.isNaN(v)) return null;
      const normalized = v > 1 ? v / 100 : v;
      return Math.max(0, Math.min(1, normalized));
    })
    .filter((v): v is number => v !== null);
}

export function StepListModal({ scale, mode, applyToAll = false, onClose }: Props) {
  const textareaId = useId();
  const setStepsAndLightness = usePaletteStore((s) => s.setStepsAndLightness);
  const setLightnessAll = usePaletteStore((s) => s.setLightnessAll);
  const setStepsAll = usePaletteStore((s) => s.setStepsAll);

  const names = useMemo(
    () => resolveStepNames(scale.naming.preset, scale.stepCount, scale.naming.customNames),
    [scale.naming.preset, scale.naming.customNames, scale.stepCount]
  );

  const lightness = scale.curves.lightness.values;

  const [value, setValue] = useState(() =>
    mode === 'names'
      ? names.join(', ')
      : lightness.map((v) => v.toFixed(4)).join(', ')
  );

  const [error, setError] = useState<string | null>(null);

  const [applyToAllLightness, setApplyToAllLightness] = useState(true);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function handleApply() {
    if (mode === 'names') {
      const parsed = parseNameList(value);
      if (parsed.length === 0) {
        setError('Name list is empty.');
        return;
      }
      if (applyToAll) {
        setStepsAll(parsed);
      } else {
        setStepsAndLightness(scale.id, parsed, null);
      }
    } else {
      const parsed = parseLightnessList(value);
      if (parsed.length === 0) {
        setError('Lightness list is empty.');
        return;
      }
      if (parsed.length !== scale.stepCount) {
        setError(`Expected ${scale.stepCount} values — one per step.`);
        return;
      }
      if (applyToAllLightness) {
        setLightnessAll(parsed);
      } else {
        setStepsAndLightness(scale.id, null, parsed);
      }
    }
    setError(null);
    onClose();
  }

  const title = mode === 'names' ? 'Edit Step Names' : 'Edit Lightness Values';
  const placeholder = mode === 'names' ? '50, 100, 200, 300, 400' : '0.9927, 0.9745, 0.9344, 0.8511';
  const hint = mode === 'names'
    ? `Comma or newline separated. Changing the count adds or removes steps.${applyToAll ? ' Applies to all scales.' : ''}`
    : `${scale.stepCount} values required (0–1 or 0–100), comma or space separated. Applies to all scales by default.`;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        padding: 16,
        overscrollBehavior: 'contain',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="step-list-modal-title"
        style={{
          background: 'var(--p-bg)',
          border: '1px solid var(--p-border)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 440,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 32px rgba(0,0,0,0.25)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid var(--p-border)',
          }}
        >
          <h2 id="step-list-modal-title" style={{ fontSize: 15, fontWeight: 600, margin: 0, color: 'var(--p-text)' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label={`Close ${title.toLowerCase()}`}
            className="focus-visible-ring"
            style={{
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: '1px solid var(--p-border)',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 16,
              color: 'var(--p-text-secondary)',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label htmlFor={textareaId} style={{ fontSize: 12, color: 'var(--p-text-secondary)' }}>
          {mode === 'names' ? 'Step names' : 'Lightness values'}
        </label>
        <textarea
          id={textareaId}
          name={mode === 'names' ? 'step-names' : 'lightness-values'}
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(null); }}
          placeholder={placeholder}
          rows={6}
          className="focus-visible-ring"
          style={{
            width: '100%',
            padding: 10,
            borderRadius: 8,
            border: '1px solid var(--p-border)',
              background: 'var(--p-bg-subtle)',
              color: 'var(--p-text)',
              fontSize: 13,
              fontFamily: 'monospace',
              resize: 'vertical',
              boxSizing: 'border-box',
          }}
        />
        {error && (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--p-danger)' }}>{error}</p>
        )}
        {mode === 'lightness' && (
          <label style={{ fontSize: 11, color: 'var(--p-text-tertiary)' }}>
            <input
              type="checkbox"
              checked={applyToAllLightness}
              onChange={(e) => setApplyToAllLightness(e.target.checked)}
              style={{ marginRight: 6 }}
            />
            Apply to all scales
          </label>
        )}
        <p style={{ margin: 0, fontSize: 11, color: 'var(--p-text-tertiary)', lineHeight: 1.5 }}>
          {hint}
        </p>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '12px 20px',
            borderTop: '1px solid var(--p-border)',
          }}
        >
          <button
            onClick={onClose}
            className="focus-visible-ring"
            style={{
              padding: '6px 14px',
              fontSize: 13,
              background: 'transparent',
              border: '1px solid var(--p-border)',
              borderRadius: 6,
              cursor: 'pointer',
              color: 'var(--p-text-secondary)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="focus-visible-ring"
            style={{
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 600,
              background: 'var(--p-accent)',
              border: '1px solid var(--p-accent)',
              borderRadius: 6,
              cursor: 'pointer',
              color: '#fff',
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
