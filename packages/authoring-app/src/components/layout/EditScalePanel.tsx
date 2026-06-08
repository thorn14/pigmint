import { useState } from 'react';
import { selectActiveScale, usePaletteStore } from '../../store/paletteStore';
import type { GeneratedStep } from '../../types/palette';
import { DiagnosticsModal } from '../diagnostics/DiagnosticsModal';
import { RightPanel } from './RightPanel';

interface EditScalePanelProps {
  activeStep: GeneratedStep | null;
  onClose: () => void;
}

export function EditScalePanel({ activeStep, onClose }: EditScalePanelProps) {
  const scale = usePaletteStore(selectActiveScale);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--p-bg)',
        color: 'var(--p-text)',
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: '14px 16px 12px',
          borderBottom: '1px solid var(--p-border)',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--p-text)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span>Edit scale</span>
        <div style={{ flex: 1 }} />
        {scale && (
          <button
            type="button"
            onClick={() => setShowDiagnostics(true)}
            aria-label="Open diagnostics"
            title="Diagnostics"
            className="focus-visible-ring"
            style={{
              height: 28,
              padding: '0 10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'transparent',
              border: '1px solid var(--p-border)',
              borderRadius: 6,
              color: 'var(--p-text-secondary)',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 12 L6 7 L9 10 L14 3" />
              <circle cx="14" cy="3" r="0.8" fill="currentColor" />
            </svg>
            Diagnostics
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="focus-visible-ring"
          style={{
            width: 28,
            height: 28,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: '1px solid var(--p-border)',
            borderRadius: 6,
            color: 'var(--p-text-secondary)',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M2.5 2.5 9.5 9.5M9.5 2.5 2.5 9.5" />
          </svg>
        </button>
      </div>

      {scale ? (
        <RightPanel key={scale.id} scale={scale} activeStep={activeStep} />
      ) : (
        <div style={{ padding: '24px 16px', color: 'var(--p-text-secondary)', fontSize: 12 }}>
          No active scale to edit.
        </div>
      )}

      {showDiagnostics && scale && (
        <DiagnosticsModal scale={scale} onClose={() => setShowDiagnostics(false)} />
      )}
    </div>
  );
}
