import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AccessibleCombos } from './AccessibleCombos';

interface Props {
  onClose: () => void;
}

export function AccessibleCombosModal({ onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Accessible combos"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'var(--p-bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          background: 'var(--p-bg)',
          borderBottom: '1px solid var(--p-border)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--p-text)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Combos
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close combos"
          title="Close (Esc)"
          className="focus-visible-ring"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 28,
            padding: '0 10px',
            background: 'var(--p-bg)',
            border: '1px solid var(--p-border)',
            borderRadius: 6,
            color: 'var(--p-text-secondary)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          <span style={{ fontFamily: 'monospace', fontSize: 10, opacity: 0.7 }}>Esc</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <AccessibleCombos />
      </div>
    </div>,
    document.body,
  );
}
