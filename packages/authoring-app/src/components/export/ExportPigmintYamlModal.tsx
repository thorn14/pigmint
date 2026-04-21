import { useEffect, useMemo, useRef, useState } from 'react';
import { usePaletteStore } from '../../store/paletteStore';
import { useIntentStore } from '../../store/intentStore';
import { serializePigmintYaml } from '../../lib/pigmintYaml';
import {
  hasFileSystemAccess,
  saveToExistingHandle,
  saveToNewFile,
  type FileSystemFileHandleLike,
} from '../../lib/fileSystem';

interface Props {
  onClose: () => void;
}

const YAML_PICKER_TYPES = [
  {
    description: 'pigmint config',
    accept: { 'application/yaml': ['.yaml', '.yml'] },
  },
];

export function ExportPigmintYamlModal({ onClose }: Props) {
  const scales = usePaletteStore((s) => s.scales);
  const intents = useIntentStore((s) => s.overrides);
  const engineTarget = useIntentStore((s) => s.engineTarget);
  const engineCompliance = useIntentStore((s) => s.engineCompliance);
  const engineModes = useIntentStore((s) => s.engineModes);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<string>('');
  const handleRef = useRef<FileSystemFileHandleLike | null>(null);
  const canSaveToDisk = hasFileSystemAccess();

  const yaml = useMemo(
    () =>
      serializePigmintYaml({
        scales,
        intents,
        engine: {
          target: engineTarget,
          compliance: engineCompliance,
          modes: engineModes,
        },
      }),
    [scales, intents, engineTarget, engineCompliance, engineModes],
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function handleCopy() {
    navigator.clipboard.writeText(yaml).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleSaveAs() {
    try {
      const { result, handle } = await saveToNewFile(yaml, {
        suggestedName: 'pigmint.yaml',
        mimeType: 'application/yaml',
        types: YAML_PICKER_TYPES,
      });
      if (handle) handleRef.current = handle;
      if (result.kind === 'saved') setStatus(`Saved to ${result.fileName}`);
      else if (result.kind === 'downloaded') setStatus(`Downloaded ${result.fileName}`);
      else setStatus('');
    } catch (err) {
      setStatus(`Save failed: ${(err as Error).message}`);
    }
  }

  async function handleSaveExisting() {
    if (!handleRef.current) return handleSaveAs();
    try {
      const result = await saveToExistingHandle(handleRef.current, yaml);
      setStatus(`Saved to ${result.fileName}`);
    } catch (err) {
      setStatus(`Save failed: ${(err as Error).message}`);
    }
  }

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
        aria-labelledby="export-pigmint-title"
        style={{
          background: 'var(--p-bg)',
          border: '1px solid var(--p-border)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 680,
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
          <h2 id="export-pigmint-title" style={{ fontSize: 15, fontWeight: 600, color: 'var(--p-text)', margin: 0 }}>
            Export pigmint.yaml
          </h2>
          <button
            onClick={onClose}
            aria-label="Close export modal"
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

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            background: 'var(--p-bg-subtle)',
            padding: 16,
          }}
        >
          <pre
            style={{
              margin: 0,
              fontSize: 12,
              fontFamily: 'monospace',
              color: 'var(--p-text-secondary)',
              whiteSpace: 'pre',
            }}
          >
            {yaml}
          </pre>
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
            onClick={handleCopy}
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
            {copied ? 'Copied!' : 'Copy YAML'}
          </button>
          <span aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            {copied ? 'Copied to clipboard' : ''}
          </span>
          {canSaveToDisk && handleRef.current ? (
            <button
              onClick={handleSaveExisting}
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
              Save
            </button>
          ) : null}
          <button
            onClick={handleSaveAs}
            className="focus-visible-ring"
            style={{
              padding: '6px 14px',
              fontSize: 13,
              background: 'var(--p-accent)',
              border: '1px solid var(--p-accent)',
              borderRadius: 6,
              cursor: 'pointer',
              color: '#fff',
              fontWeight: 500,
            }}
          >
            {canSaveToDisk ? 'Save as…' : 'Download pigmint.yaml'}
          </button>
          <span
            aria-live="polite"
            style={{
              alignSelf: 'center',
              fontSize: 12,
              color: 'var(--p-text-secondary)',
            }}
          >
            {status}
          </span>
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
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
