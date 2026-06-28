import { selectActiveScale, usePaletteStore } from '../../store/paletteStore';
import type { GeneratedStep } from '../../types/palette';
import { LockIcon } from '../icons/LockIcon';
import { RightPanel } from './RightPanel';

interface EditScalePanelProps {
  activeStep: GeneratedStep | null;
  onClose: () => void;
}

export function EditScalePanel({ activeStep, onClose }: EditScalePanelProps) {
  const scale = usePaletteStore(selectActiveScale);
  const toggleScaleLock = usePaletteStore((s) => s.toggleScaleLock);

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
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--p-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Edit scale</span>
        <div style={{ flex: 1 }} />
        {scale && (
          <button
            type="button"
            onClick={() => toggleScaleLock(scale.id)}
            aria-label={scale.lockedFromOverrides ? 'Unlock from global overrides' : 'Lock from global overrides'}
            aria-pressed={scale.lockedFromOverrides}
            title={scale.lockedFromOverrides ? 'Unlock from global overrides' : 'Lock from global overrides'}
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
              color: scale.lockedFromOverrides ? 'var(--p-accent)' : 'var(--p-text-secondary)',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <LockIcon locked={scale.lockedFromOverrides} />
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
    </div>
  );
}
