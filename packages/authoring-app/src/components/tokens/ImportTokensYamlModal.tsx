import { useRef, useState, useId } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { AppDialog } from '../base-ui';
import { useIntentStore } from '../../store/intentStore';
import { useVocabStore } from '../../store/vocabStore';

interface Props {
  onClose: () => void;
}

function engineConfig() {
  const s = useIntentStore.getState();
  return { compliance: s.engineCompliance, target: s.engineTarget, modes: s.engineModes };
}

export function ImportTokensYamlModal({ onClose }: Props) {
  const textareaId = useId();
  const loadFromText = useVocabStore((s) => s.loadFromText);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        loadFromText(reader.result as string, engineConfig());
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleApply() {
    if (!text.trim()) return;
    try {
      loadFromText(text, engineConfig());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse YAML');
    }
  }

  return (
    <AppDialog onOpenChange={(open) => { if (!open) onClose(); }}>
      <div
        style={{
          background: 'var(--p-bg)',
          border: '1px solid var(--p-border)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 640,
          display: 'flex',
          flexDirection: 'column',
          flex: '1 1 auto',
          maxHeight: '80vh',
          minHeight: 0,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid var(--p-border)',
          }}
        >
          <Dialog.Title style={{ fontSize: 15, fontWeight: 600, color: 'var(--p-text)', margin: 0 }}>
            Import tokens.yaml
          </Dialog.Title>
          <Dialog.Close
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
            aria-label="Close"
          >
            ×
          </Dialog.Close>
        </div>

        <div
          style={{
            padding: '14px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            flex: 1,
            minHeight: 0,
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              ref={fileRef}
              type="file"
              accept=".yaml,.yml,.json"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="focus-visible-ring"
              style={{
                padding: '6px 14px',
                fontSize: 12,
                background: 'var(--p-bg)',
                border: '1px solid var(--p-border)',
                borderRadius: 6,
                color: 'var(--p-text)',
                cursor: 'pointer',
              }}
            >
              Upload file
            </button>
            <span style={{ fontSize: 11, color: 'var(--p-text-tertiary)', alignSelf: 'center' }}>
              or paste below
            </span>
          </div>

          <label htmlFor={textareaId} style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--p-text-secondary)' }}>
            Paste tokens YAML
          </label>
          <textarea
            id={textareaId}
            value={text}
            onChange={(e) => { setText(e.target.value); setError(null); }}
            placeholder="Paste tokens.yaml content here…"
            style={{
              flex: 1,
              minHeight: 200,
              padding: 8,
              fontSize: 12,
              fontFamily: 'monospace',
              background: 'var(--p-bg)',
              border: '1px solid var(--p-border)',
              borderRadius: 6,
              color: 'var(--p-text)',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />

          {error && (
            <div style={{ fontSize: 12, color: 'var(--p-danger)' }}>{error}</div>
          )}
        </div>

        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--p-border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="focus-visible-ring"
            style={{
              padding: '6px 14px',
              fontSize: 12,
              background: 'var(--p-bg)',
              border: '1px solid var(--p-border)',
              borderRadius: 6,
              color: 'var(--p-text-secondary)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!text.trim()}
            className="focus-visible-ring"
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              background: 'var(--p-accent, #6366f1)',
              border: '1px solid var(--p-accent, #6366f1)',
              borderRadius: 6,
              color: '#fff',
              cursor: text.trim() ? 'pointer' : 'default',
              opacity: text.trim() ? 1 : 0.5,
            }}
          >
            Import
          </button>
        </div>
      </div>
    </AppDialog>
  );
}
