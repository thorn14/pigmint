import { useState, useEffect } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { usePaletteStore } from '../../store/paletteStore';
import { AppDialog, ConfirmDialog } from '../base-ui';

interface Props {
  onClose: () => void;
}

interface RowProps {
  id: string;
  name: string;
  isActive: boolean;
  canDelete: boolean;
  onRename: (next: string) => void;
  onDelete: () => void;
}

function PaletteRow({ id, name, isActive, canDelete, onRename, onDelete }: RowProps) {
  const [value, setValue] = useState(name);
  useEffect(() => { setValue(name); }, [name]);

  function commit() {
    const trimmed = value.trim();
    if (trimmed && trimmed !== name) {
      onRename(trimmed);
    } else {
      setValue(name);
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderBottom: '1px solid var(--p-border)',
      }}
    >
      <input
        aria-label={`Rename ${name}`}
        name={`palette-name-${id}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { commit(); (e.target as HTMLInputElement).blur(); }
          if (e.key === 'Escape') { setValue(name); (e.target as HTMLInputElement).blur(); }
        }}
        className="focus-visible-ring"
        style={{
          flex: 1,
          minWidth: 0,
          padding: '5px 8px',
          fontSize: 13,
          background: 'var(--p-bg)',
          border: '1px solid var(--p-border)',
          borderRadius: 5,
          color: 'var(--p-text)',
          boxSizing: 'border-box',
        }}
      />
      {isActive && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '2px 6px',
            borderRadius: 4,
            background: 'var(--p-surface)',
            color: 'var(--p-accent, #6366f1)',
            flexShrink: 0,
          }}
        >
          Active
        </span>
      )}
      <button
        onClick={onDelete}
        disabled={!canDelete}
        title={canDelete ? 'Delete palette' : 'At least one palette is required'}
        aria-label={`Delete ${name}`}
        className="focus-visible-ring"
        style={{
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: '1px solid var(--p-border)',
          borderRadius: 5,
          cursor: canDelete ? 'pointer' : 'not-allowed',
          color: canDelete ? 'var(--p-text-secondary)' : 'var(--p-text-secondary)',
          opacity: canDelete ? 1 : 0.4,
          flexShrink: 0,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 3h8M5 3V2h2v1M4.5 3v6.5h3V3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

export function ManagePalettesModal({ onClose }: Props) {
  const savedPalettes = usePaletteStore((s) => s.savedPalettes);
  const activePaletteId = usePaletteStore((s) => s.activePaletteId);
  const createPalette = usePaletteStore((s) => s.createPalette);
  const deletePalette = usePaletteStore((s) => s.deletePalette);
  const renamePalette = usePaletteStore((s) => s.renamePalette);

  const canDelete = savedPalettes.length > 1;
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  function handleCreate() {
    createPalette(`Palette ${savedPalettes.length + 1}`);
  }

  return (
    <AppDialog onOpenChange={(open) => { if (!open) onClose(); }}>
      <div
        style={{
          background: 'var(--p-bg)',
          border: '1px solid var(--p-border)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 480,
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
          <Dialog.Title style={{ fontSize: 15, fontWeight: 600, margin: 0, color: 'var(--p-text)' }}>
            Manage palettes
          </Dialog.Title>
          <Dialog.Close
            aria-label="Close manage palettes"
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

        {/* Body */}
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {savedPalettes.map((p) => (
            <PaletteRow
              key={p.id}
              id={p.id}
              name={p.name}
              isActive={p.id === activePaletteId}
              canDelete={canDelete}
              onRename={(next) => renamePalette(p.id, next)}
              onDelete={() => setPendingDelete({ id: p.id, name: p.name })}
            />
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            padding: '12px 20px',
            borderTop: '1px solid var(--p-border)',
          }}
        >
          <button
            onClick={handleCreate}
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
            + New palette
          </button>
          <button
            onClick={onClose}
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
            Done
          </button>
        </div>
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete palette"
          message={<>Delete palette <strong>{pendingDelete.name}</strong>? All ramps and tokens inside will be lost. This cannot be undone.</>}
          confirmLabel="Delete palette"
          destructive
          onConfirm={() => {
            const { id } = pendingDelete;
            setPendingDelete(null);
            deletePalette(id);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </AppDialog>
  );
}
