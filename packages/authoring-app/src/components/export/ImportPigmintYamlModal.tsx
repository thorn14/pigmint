import { useEffect, useId, useRef, useState } from 'react';
import { usePaletteStore } from '../../store/paletteStore';
import { useIntentStore } from '../../store/intentStore';
import { parsePigmintYaml, type ParsedPigmintYaml } from '../../lib/pigmintYaml';

interface Props {
  onClose: () => void;
}

export function ImportPigmintYamlModal({ onClose }: Props) {
  const textareaId = useId();
  const importScales = usePaletteStore((s) => s.importScales);
  const hasExisting = usePaletteStore((s) => s.scales.length > 0);
  const loadState = useIntentStore((s) => s.loadState);

  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedPigmintYaml | null>(null);
  const [replaceMode, setReplaceMode] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleParse(next: string) {
    setText(next);
    setError(null);
    setParsed(null);

    if (!next.trim()) return;

    try {
      setParsed(parsePigmintYaml(next));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse');
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => handleParse(reader.result as string);
    reader.readAsText(file);
  }

  function handleImport() {
    if (!parsed) return;
    importScales(parsed.scales, replaceMode);
    loadState({
      overrides: parsed.intents,
      engineTarget: parsed.engine.target,
      engineCompliance: parsed.engine.compliance,
      engineModes: parsed.engine.modes,
    });
    onClose();
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const intentCount = parsed ? Object.keys(parsed.intents).length : 0;

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
        aria-labelledby="import-pigmint-title"
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid var(--p-border)',
          }}
        >
          <h2 id="import-pigmint-title" style={{ fontSize: 15, fontWeight: 600, color: 'var(--p-text)', margin: 0 }}>
            Import pigmint.yaml
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
              Upload .yaml
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".yaml,.yml"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <span style={{ fontSize: 12, color: 'var(--p-text-tertiary)' }}>
              or paste YAML below
            </span>
          </div>

          <label htmlFor={textareaId} style={{ fontSize: 12, color: 'var(--p-text-secondary)' }}>
            pigmint.yaml
          </label>
          <textarea
            id={textareaId}
            name="import-yaml"
            value={text}
            onChange={(e) => handleParse(e.target.value)}
            placeholder="Paste pigmint.yaml content here…"
            spellCheck={false}
            aria-label="Paste pigmint.yaml content"
            className="focus-visible-ring"
            style={{
              width: '100%',
              minHeight: 220,
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

          {parsed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--p-text)' }}>
                Found {parsed.scales.length} ramp{parsed.scales.length !== 1 ? 's' : ''}
                {intentCount > 0 && ` · ${intentCount} intent override${intentCount !== 1 ? 's' : ''}`}
              </div>

              {parsed.scales.map((scale, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: scale.sourceHex,
                      border: '1px solid var(--p-border)',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ fontSize: 12, color: 'var(--p-text-secondary)' }}>
                    <strong style={{ color: 'var(--p-text)' }}>{scale.name}</strong> — {scale.sourceHex}
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
                  Replace existing ramps
                </label>
              )}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '14px 20px',
            borderTop: '1px solid var(--p-border)',
          }}
        >
          <button
            disabled={!parsed}
            onClick={handleImport}
            className="focus-visible-ring"
            style={{
              padding: '6px 14px',
              fontSize: 13,
              background: parsed ? 'var(--p-accent)' : 'var(--p-bg-subtle)',
              border: '1px solid',
              borderColor: parsed ? 'var(--p-accent)' : 'var(--p-border)',
              borderRadius: 6,
              cursor: parsed ? 'pointer' : 'default',
              color: parsed ? '#fff' : 'var(--p-text-tertiary)',
              fontWeight: 500,
              opacity: parsed ? 1 : 0.6,
            }}
          >
            Import {parsed ? `${parsed.scales.length} ramp${parsed.scales.length !== 1 ? 's' : ''}` : ''}
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
