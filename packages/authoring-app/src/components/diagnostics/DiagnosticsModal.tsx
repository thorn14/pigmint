import { Dialog } from '@base-ui/react/dialog';
import type { ColorScale } from '../../types/palette';
import { useGeneratedRamp } from '../../hooks/useGeneratedRamp';
import { AppDialog } from '../base-ui';
import { ScaleDiagnosticsRow } from './RampDiagnosticsView';

interface Props {
  scale: ColorScale;
  onClose: () => void;
}

export function DiagnosticsModal({ scale, onClose }: Props) {
  const ramp = useGeneratedRamp(scale);

  return (
    <AppDialog onOpenChange={(open) => { if (!open) onClose(); }}>
      <div
        style={{
          background: 'var(--p-bg)',
          border: '1px solid var(--p-border)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 900,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 32px rgba(0,0,0,0.25)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid var(--p-border)',
            flexShrink: 0,
          }}
        >
          <Dialog.Title style={{ fontSize: 15, fontWeight: 600, margin: 0, color: 'var(--p-text)' }}>
            Diagnostics — {scale.name}
          </Dialog.Title>
          <Dialog.Close
            aria-label="Close diagnostics"
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
          </Dialog.Close>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <ScaleDiagnosticsRow scale={scale} ramp={ramp} />
        </div>
      </div>
    </AppDialog>
  );
}
