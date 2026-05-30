import { Dialog } from '@base-ui/react/dialog';
import type { ReactNode } from 'react';
import { AppDialog } from './app-dialog';

type Props = {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  const confirmBg = destructive ? 'var(--p-danger)' : 'var(--p-accent)';
  return (
    <AppDialog onOpenChange={(open) => { if (!open) onCancel(); }}>
      <div
        style={{
          background: 'var(--p-bg)',
          border: '1px solid var(--p-border)',
          borderRadius: 12,
          width: 'min(420px, 90vw)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--p-border)' }}>
          <Dialog.Title style={{ fontSize: 15, fontWeight: 600, color: 'var(--p-text)', margin: 0 }}>
            {title}
          </Dialog.Title>
        </div>

        <div style={{ padding: '16px 20px', fontSize: 13, color: 'var(--p-text-secondary)', lineHeight: 1.5 }}>
          {message}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '12px 20px',
            borderTop: '1px solid var(--p-border)',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            className="focus-visible-ring"
            style={{
              padding: '6px 14px',
              fontSize: 13,
              background: 'transparent',
              border: '1px solid var(--p-border)',
              borderRadius: 6,
              cursor: 'pointer',
              color: 'var(--p-text)',
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className="focus-visible-ring"
            style={{
              padding: '6px 14px',
              fontSize: 13,
              background: confirmBg,
              border: `1px solid ${confirmBg}`,
              borderRadius: 6,
              cursor: 'pointer',
              color: '#fff',
              fontWeight: 500,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </AppDialog>
  );
}
