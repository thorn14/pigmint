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
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 500,
              background: 'var(--p-surface)',
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
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 500,
              background: 'var(--p-surface)',
              border: destructive ? '1px solid rgba(229,85,85,0.4)' : '1px solid var(--p-border)',
              borderRadius: 6,
              cursor: 'pointer',
              color: destructive ? 'var(--p-danger)' : 'var(--p-text)',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </AppDialog>
  );
}
