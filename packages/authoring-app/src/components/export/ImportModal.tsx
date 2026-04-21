import { useEffect, useId, useRef, useState } from 'react';
import { usePaletteStore } from '../../store/paletteStore';
import { parseW3CTokens, type ImportedScale } from '../../lib/importTokens';

interface Props {
  onClose: () => void;
}

export function ImportModal({ onClose }: Props) {
  const textareaId = useId();
  const importScales = usePaletteStore((s) => s.importScales);
  const hasExisting = usePaletteStore((s) => s.scales.length > 0);

  const [json, setJson] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportedScale[] | null>(null);
  const [replaceMode, setReplaceMode] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleParse(text: string) {
    setJson(text);
    setError(null);
    setPreview(null);

    if (!text.trim()) return;

    try {
      const scales = parseW3CTokens(text);
      setPreview(scales);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse');
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      handleParse(text);
    };
    reader.readAsText(file);
  }

  function handleImport() {
    if (!preview) return;
    importScales(preview, replaceMode);
    onClose();
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 16,
        overscrollBehavior: 'contain',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-modal-title"
        style={{
          background: 'var(--p-bg)',
          border: '1px solid var(--p-border)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 640,
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '80vh',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
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
          <h2 id="import-modal-title" style={{ fontSize: 15, fontWeight: 600, color: 'var(--p-text)', margin: 0 }}>
            Import Color Tokens
          </h2>
          <button
            onClick={onClose}
            aria-label="Close import modal"
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

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => fileRef.current?.click()}
              className="focus-visible-ring"
              style={{
                padding: '6px 14px',
                fontSize: 13,
                background: 'var(--p-bg-subtle)',
                border: '1px solid var(--p-border)',
                borderRadius: 6,
                cursor: 'pointer',
                color: 'var(--p-text)',
              }}
            >
              Upload .json
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,.tokens,.tokens.json"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <span style={{ fontSize: 12, color: 'var(--p-text-tertiary)' }}>
              or paste JSON below
            </span>
          </div>

          <label htmlFor={textareaId} style={{ fontSize: 12, color: 'var(--p-text-secondary)' }}>
            Token JSON
          </label>
          <textarea
            id={textareaId}
            name="import-json"
            value={json}
            onChange={(e) => handleParse(e.target.value)}
            placeholder='Paste design token JSON here (W3C DTCG, Figma Variables, or lukasoppermann/design-tokens format)…'
            spellCheck={false}
            aria-label="Paste W3C design token JSON"
            className="focus-visible-ring"
            style={{
              width: '100%',
              minHeight: 180,
              padding: 12,
              fontSize: 12,
              fontFamily: 'monospace',
              background: 'var(--p-bg-subtle)',
              border: '1px solid var(--p-border)',
              borderRadius: 8,
              color: 'var(--p-text-secondary)',
              resize: 'vertical',
            }}
          />

          {error && (
            <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(220,60,60,0.12)', color: '#e55', fontSize: 13 }}>
              {error}
            </div>
          )}

          {preview && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--p-text)' }}>
                Found {preview.length} color scale{preview.length !== 1 ? 's' : ''}
              </div>

              {preview.map((scale, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--p-text)' }}>{scale.name}</span>
                  <div style={{ display: 'flex', gap: 1, borderRadius: 6, overflow: 'hidden' }}>
                    {scale.steps.map((step, j) => (
                      <div
                        key={j}
                        title={`${step.name}: ${step.hex}`}
                        style={{
                          flex: 1,
                          height: 28,
                          background: step.hex,
                          minWidth: 0,
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {hasExisting && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--p-text-secondary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={replaceMode}
                    onChange={(e) => setReplaceMode(e.target.checked)}
                    style={{ accentColor: 'var(--p-accent)' }}
                  />
                  Replace existing scales
                </label>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '14px 20px',
            borderTop: '1px solid var(--p-border)',
          }}
        >
          <button
            disabled={!preview}
            onClick={handleImport}
            className="focus-visible-ring"
            style={{
              padding: '6px 14px',
              fontSize: 13,
              background: preview ? 'var(--p-accent)' : 'var(--p-bg-subtle)',
              border: '1px solid',
              borderColor: preview ? 'var(--p-accent)' : 'var(--p-border)',
              borderRadius: 6,
              cursor: preview ? 'pointer' : 'default',
              color: preview ? '#fff' : 'var(--p-text-tertiary)',
              fontWeight: 500,
              opacity: preview ? 1 : 0.6,
            }}
          >
            Import {preview ? `${preview.length} scale${preview.length !== 1 ? 's' : ''}` : ''}
          </button>
          <button
            onClick={onClose}
            className="focus-visible-ring"
            style={{
              marginLeft: 'auto',
              padding: '6px 14px',
              fontSize: 13,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--p-text-secondary)',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
