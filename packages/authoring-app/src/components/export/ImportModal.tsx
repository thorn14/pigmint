import { useId, useRef, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Tabs } from '@base-ui/react/tabs';
import { usePaletteStore } from '../../store/paletteStore';
import { useIntentStore } from '../../store/intentStore';
import { useVocabStore } from '../../store/vocabStore';
import { parseW3CTokens, parseColorList, detectFormat, type ImportedScale } from '../../lib/importTokens';
import {
  parsePigmintPrimitives,
  parsePigmintYaml,
  type ParsedPigmintYaml,
} from '../../lib/pigmintYaml';
import { AppCheckbox, AppDialog } from '../base-ui';

interface Props {
  onClose: () => void;
}

type Tab = 'colors' | 'tokens' | 'pigmint';

type TabSpec = {
  id: Tab;
  label: string;
  filename: string;
  description: string;
};

const TAB_SPECS: readonly TabSpec[] = [
  {
    id: 'colors',
    label: 'Colors',
    filename: 'primitives.json',
    description:
      'Import primitive color ramps from a W3C Design Tokens JSON file (also accepts Figma Variables and lukasoppermann/design-tokens formats). Each top-level group becomes a scale. You can also paste a plain list of color values to build one scale. Expects JSON — paste YAML in the Tokens or Pigmint tab.',
  },
  {
    id: 'tokens',
    label: 'Tokens',
    filename: 'tokens.yaml',
    description:
      'Replace the semantic token vocabulary — surfaces, foreground, non-text, decorative, and alpha tokens — from a tokens.yaml file. The current ramps stay untouched.',
  },
  {
    id: 'pigmint',
    label: 'Pigmint',
    filename: 'pigmint.yaml',
    description:
      'Import a full pigmint.yaml — ramps, intent overrides, and engine settings in one go. Optionally pair with a primitives.json file if the YAML references `fromFile` ramps.',
  },
];

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '6px 14px',
  fontSize: 12,
  fontWeight: 500,
  background: active ? 'var(--p-surface)' : 'transparent',
  border: 'none',
  borderBottom: active ? '2px solid var(--p-accent)' : '2px solid transparent',
  cursor: 'pointer',
  color: active ? 'var(--p-text)' : 'var(--p-text-secondary)',
  whiteSpace: 'nowrap',
});

const sectionStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  padding: '16px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const descriptionStyle: React.CSSProperties = {
  padding: '12px 20px',
  borderBottom: '1px solid var(--p-border)',
  background: 'var(--p-bg)',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const filenameStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--p-text-tertiary)',
  fontFamily: 'monospace',
};

const descriptionTextStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--p-text-secondary)',
  lineHeight: 1.5,
};

const uploadButtonStyle: React.CSSProperties = {
  padding: '6px 14px',
  fontSize: 13,
  background: 'var(--p-surface)',
  border: '1px solid var(--p-border)',
  borderRadius: 6,
  cursor: 'pointer',
  color: 'var(--p-text)',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 220,
  padding: 12,
  fontSize: 12,
  fontFamily: 'monospace',
  background: 'var(--p-surface)',
  border: '1px solid var(--p-border)',
  borderRadius: 8,
  color: 'var(--p-text-secondary)',
  resize: 'vertical',
  boxSizing: 'border-box',
};

const errorStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 6,
  background: 'var(--p-danger-subtle)',
  color: 'var(--p-danger)',
  fontSize: 13,
};

type PanelProps = {
  onClose: () => void;
  registerImport: (handler: (() => void) | null, label: string, canImport: boolean) => void;
};

function ColorsPanel({ onClose, registerImport }: PanelProps) {
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
    if (!text.trim()) {
      registerImport(null, 'Import', false);
      return;
    }
    const fmt = detectFormat(text);
    try {
      let scales: ImportedScale[];
      if (fmt === 'json') {
        scales = parseW3CTokens(text);
      } else if (fmt === 'yaml') {
        throw new Error(
          'This looks like YAML, not JSON. Use the Tokens or Pigmint tab for YAML files — ' +
          'or paste W3C / Figma tokens JSON here. To build a ramp from raw colors, paste a ' +
          'plain list of color values (e.g. #ffffff, #1a1a1a, oklch(…)).',
        );
      } else {
        // Not JSON and not obviously YAML — treat as a plain list of color values.
        scales = [parseColorList(text)];
      }
      setPreview(scales);
      registerImport(
        () => {
          importScales(scales, replaceMode);
          onClose();
        },
        `Import ${scales.length} scale${scales.length !== 1 ? 's' : ''}`,
        true,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse');
      registerImport(null, 'Import', false);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => handleParse(reader.result as string);
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div style={sectionStyle}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={() => fileRef.current?.click()} className="focus-visible-ring" style={uploadButtonStyle}>
          Upload .json
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.tokens,.tokens.json"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
        <span style={{ fontSize: 12, color: 'var(--p-text-tertiary)' }}>or paste JSON / a list of colors below</span>
      </div>

      <label htmlFor={textareaId} style={{ fontSize: 12, color: 'var(--p-text-secondary)' }}>
        Token JSON or color values
      </label>
      <textarea
        id={textareaId}
        name="import-colors-json"
        value={json}
        onChange={(e) => handleParse(e.target.value)}
        placeholder="Paste design token JSON here, or a plain list of colors (e.g. #ffffff, #1a1a1a, oklch(…))…"
        spellCheck={false}
        className="focus-visible-ring"
        style={textareaStyle}
      />

      {error && <div style={errorStyle}>{error}</div>}

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
                    style={{ flex: 1, height: 28, background: step.hex, minWidth: 0 }}
                  />
                ))}
              </div>
            </div>
          ))}

          {hasExisting && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--p-text-secondary)', cursor: 'pointer' }}>
              <AppCheckbox
                checked={replaceMode}
                onCheckedChange={(c) => {
                  setReplaceMode(c);
                  if (preview) {
                    registerImport(
                      () => {
                        importScales(preview, c);
                        onClose();
                      },
                      `Import ${preview.length} scale${preview.length !== 1 ? 's' : ''}`,
                      true,
                    );
                  }
                }}
              />
              Replace existing scales
            </label>
          )}
        </div>
      )}
    </div>
  );
}

function engineConfig() {
  const s = useIntentStore.getState();
  return { compliance: s.engineCompliance, target: s.engineTarget, modes: s.engineModes };
}

function TokensPanel({ onClose, registerImport }: PanelProps) {
  const textareaId = useId();
  const loadFromText = useVocabStore((s) => s.loadFromText);

  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function setBody(next: string) {
    setText(next);
    setError(null);
    const trimmed = next.trim();
    if (!trimmed) {
      registerImport(null, 'Import', false);
      return;
    }
    registerImport(
      () => {
        try {
          loadFromText(next, engineConfig());
          onClose();
        } catch (err) {
          const base = err instanceof Error ? err.message : 'Failed to parse YAML';
          setError(
            detectFormat(next) === 'json'
              ? `${base} — this looks like JSON. Primitive color JSON goes in the Colors tab; this tab expects a tokens.yaml.`
              : base,
          );
        }
      },
      'Import vocabulary',
      true,
    );
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const next = reader.result as string;
      setText(next);
      try {
        loadFromText(next, engineConfig());
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div style={sectionStyle}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={() => fileRef.current?.click()} className="focus-visible-ring" style={uploadButtonStyle}>
          Upload .yaml
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".yaml,.yml,.json"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
        <span style={{ fontSize: 12, color: 'var(--p-text-tertiary)' }}>or paste YAML below</span>
      </div>

      <label htmlFor={textareaId} style={{ fontSize: 12, color: 'var(--p-text-secondary)' }}>
        tokens.yaml
      </label>
      <textarea
        id={textareaId}
        name="import-tokens-yaml"
        value={text}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Paste tokens.yaml content here…"
        spellCheck={false}
        className="focus-visible-ring"
        style={textareaStyle}
      />

      {error && <div style={errorStyle}>{error}</div>}
    </div>
  );
}

function PigmintPanel({ onClose, registerImport }: PanelProps) {
  const textareaId = useId();
  const importScales = usePaletteStore((s) => s.importScales);
  const hasExisting = usePaletteStore((s) => s.scales.length > 0);
  const loadState = useIntentStore((s) => s.loadState);

  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedPigmintYaml | null>(null);
  const [primitives, setPrimitives] = useState<Record<string, ImportedScale> | null>(null);
  const [primitivesFileName, setPrimitivesFileName] = useState<string | null>(null);
  const [replaceMode, setReplaceMode] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const primitivesFileRef = useRef<HTMLInputElement>(null);

  function applyParsed(p: ParsedPigmintYaml, replace: boolean) {
    importScales(p.scales, replace);
    loadState({
      overrides: p.intents,
      engineTarget: p.engine.target,
      engineCompliance: p.engine.compliance,
      engineModes: p.engine.modes,
      engineCvd: p.engine.cvd,
      engineResolver: p.engine.resolver,
    });
    onClose();
  }

  function reparse(next: string, prims: Record<string, ImportedScale> | null, replace: boolean) {
    setError(null);
    setParsed(null);
    if (!next.trim()) {
      registerImport(null, 'Import', false);
      return;
    }
    try {
      const result = parsePigmintYaml(next, prims ? { primitives: prims } : {});
      setParsed(result);
      registerImport(
        () => applyParsed(result, replace),
        `Import ${result.scales.length} ramp${result.scales.length !== 1 ? 's' : ''}`,
        true,
      );
    } catch (e) {
      const base = e instanceof Error ? e.message : 'Failed to parse';
      setError(
        detectFormat(next) === 'json'
          ? `${base} — this looks like JSON. Primitive color JSON goes in the Colors tab; this tab expects a pigmint.yaml.`
          : base,
      );
      registerImport(null, 'Import', false);
    }
  }

  function handleBody(next: string) {
    setText(next);
    reparse(next, primitives, replaceMode);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => handleBody(reader.result as string);
    reader.readAsText(file);
    e.target.value = '';
  }

  function handlePrimitivesUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const map = parsePigmintPrimitives(reader.result as string);
        setPrimitives(map);
        setPrimitivesFileName(file.name);
        reparse(text, map, replaceMode);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse primitives.json');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function clearPrimitives() {
    setPrimitives(null);
    setPrimitivesFileName(null);
    reparse(text, null, replaceMode);
  }

  const intentCount = parsed ? Object.keys(parsed.intents).length : 0;

  return (
    <div style={sectionStyle}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={() => fileRef.current?.click()} className="focus-visible-ring" style={uploadButtonStyle}>
          Upload .yaml
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".yaml,.yml"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
        <span style={{ fontSize: 12, color: 'var(--p-text-tertiary)' }}>or paste YAML below</span>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={() => primitivesFileRef.current?.click()} className="focus-visible-ring" style={uploadButtonStyle}>
          Upload primitives.json
        </button>
        <input
          ref={primitivesFileRef}
          type="file"
          accept=".json"
          onChange={handlePrimitivesUpload}
          style={{ display: 'none' }}
        />
        {primitivesFileName ? (
          <span style={{ fontSize: 12, color: 'var(--p-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            {primitivesFileName} ({primitives ? Object.keys(primitives).length : 0} ramps)
            <button
              onClick={clearPrimitives}
              className="focus-visible-ring"
              style={{
                padding: '2px 6px',
                fontSize: 11,
                background: 'transparent',
                border: '1px solid var(--p-border)',
                borderRadius: 4,
                cursor: 'pointer',
                color: 'var(--p-text-tertiary)',
              }}
            >
              clear
            </button>
          </span>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--p-text-tertiary)' }}>
            optional — only required for `fromFile` ramps
          </span>
        )}
      </div>

      <label htmlFor={textareaId} style={{ fontSize: 12, color: 'var(--p-text-secondary)' }}>
        pigmint.yaml
      </label>
      <textarea
        id={textareaId}
        name="import-pigmint-yaml"
        value={text}
        onChange={(e) => handleBody(e.target.value)}
        placeholder="Paste pigmint.yaml content here…"
        spellCheck={false}
        className="focus-visible-ring"
        style={textareaStyle}
      />

      {error && <div style={errorStyle}>{error}</div>}

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
              <AppCheckbox
                checked={replaceMode}
                onCheckedChange={(c) => {
                  setReplaceMode(c);
                  if (parsed) {
                    registerImport(
                      () => applyParsed(parsed, c),
                      `Import ${parsed.scales.length} ramp${parsed.scales.length !== 1 ? 's' : ''}`,
                      true,
                    );
                  }
                }}
              />
              Replace existing ramps
            </label>
          )}
        </div>
      )}
    </div>
  );
}

export function ImportModal({ onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('colors');
  const importStateRef = useRef<{ handler: (() => void) | null; label: string; canImport: boolean }>({
    handler: null,
    label: 'Import',
    canImport: false,
  });
  const [, forceRender] = useState(0);

  function registerImport(handler: (() => void) | null, label: string, canImport: boolean) {
    importStateRef.current = { handler, label, canImport };
    forceRender((n) => n + 1);
  }

  const activeSpec = TAB_SPECS.find((t) => t.id === activeTab) ?? TAB_SPECS[0];
  const { handler, label, canImport } = importStateRef.current;

  return (
    <AppDialog onOpenChange={(open) => { if (!open) onClose(); }}>
      <div
        style={{
          background: 'var(--p-bg)',
          border: '1px solid var(--p-border)',
          borderRadius: 12,
          width: 'min(1100px, 95vw)',
          display: 'flex',
          flexDirection: 'column',
          flex: '1 1 auto',
          maxHeight: '85vh',
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
          <Dialog.Title id="import-modal-title" style={{ fontSize: 15, fontWeight: 600, color: 'var(--p-text)', margin: 0 }}>
            Import
          </Dialog.Title>
          <Dialog.Close
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
          </Dialog.Close>
        </div>

        <Tabs.Root
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v as Tab);
            importStateRef.current = { handler: null, label: 'Import', canImport: false };
            forceRender((n) => n + 1);
          }}
          style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0 }}
        >
          <Tabs.List
            aria-label="Import source"
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--p-border)',
              padding: '0 8px',
              overflowX: 'auto',
              flexShrink: 0,
            }}
          >
            {TAB_SPECS.map((spec) => (
              <Tabs.Tab
                key={spec.id}
                value={spec.id}
                className="focus-visible-ring"
                style={tabStyle(activeTab === spec.id)}
              >
                {spec.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>

          <div style={descriptionStyle}>
            <div style={filenameStyle}>{activeSpec.filename}</div>
            <div style={descriptionTextStyle}>{activeSpec.description}</div>
          </div>

          <Tabs.Panel value="colors" style={{ display: activeTab === 'colors' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column' }}>
            {activeTab === 'colors' && <ColorsPanel onClose={onClose} registerImport={registerImport} />}
          </Tabs.Panel>
          <Tabs.Panel value="tokens" style={{ display: activeTab === 'tokens' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column' }}>
            {activeTab === 'tokens' && <TokensPanel onClose={onClose} registerImport={registerImport} />}
          </Tabs.Panel>
          <Tabs.Panel value="pigmint" style={{ display: activeTab === 'pigmint' ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column' }}>
            {activeTab === 'pigmint' && <PigmintPanel onClose={onClose} registerImport={registerImport} />}
          </Tabs.Panel>
        </Tabs.Root>

        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '14px 20px',
            borderTop: '1px solid var(--p-border)',
          }}
        >
          <button
            disabled={!canImport}
            onClick={() => handler?.()}
            className="focus-visible-ring"
            style={{
              padding: '6px 14px',
              fontSize: 13,
              background: canImport ? 'var(--p-accent)' : 'var(--p-surface)',
              border: '1px solid',
              borderColor: canImport ? 'var(--p-accent)' : 'var(--p-border)',
              borderRadius: 6,
              cursor: canImport ? 'pointer' : 'default',
              color: canImport ? '#fff' : 'var(--p-text-tertiary)',
              fontWeight: 500,
              opacity: canImport ? 1 : 0.6,
            }}
          >
            {label}
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
    </AppDialog>
  );
}
