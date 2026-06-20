import { useMemo, useRef, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Tabs } from '@base-ui/react/tabs';
import { useVirtualizer } from '@tanstack/react-virtual';
import { usePaletteStore } from '../../store/paletteStore';
import { useIntentStore } from '../../store/intentStore';
import { generateRamp } from '../../lib/colorMath';
import { exportToJSON } from '../../lib/exportTokens';
import { buildPigmintTokensJson } from '../../lib/resolveState';
import { serializePigmintYaml } from '../../lib/pigmintYaml';
import { useVocabStore } from '../../store/vocabStore';
import { AppDialog } from '../base-ui/app-dialog';

interface Props {
  onClose: () => void;
}

type Tab = 'colors' | 'tokens-yaml' | 'tokens-json' | 'pigmint';

type TabSpec = {
  id: Tab;
  label: string;
  filename: string;
  mimeType: string;
  description: string;
};

const TAB_SPECS: readonly TabSpec[] = [
  {
    id: 'colors',
    label: 'Colors',
    filename: 'primitives.json',
    mimeType: 'application/json',
    description:
      'Primitive color ramps in W3C Design Tokens format. One group per scale, with hex and display-p3 values for every step plus the OKLCH source in `$extensions.oklch`. Use this when you want the raw color values without semantic tokens.',
  },
  {
    id: 'tokens-yaml',
    label: 'Tokens (source)',
    filename: 'tokens.yaml',
    mimeType: 'application/yaml',
    description:
      'Semantic token vocabulary — the editable source for surfaces, foreground, non-text, decorative, and alpha tokens. This is the file you keep in source control and edit by hand.',
  },
  {
    id: 'tokens-json',
    label: 'Tokens (resolved)',
    filename: 'tokens.json',
    mimeType: 'application/json',
    description:
      'Design tokens with concrete color values for every step and mode. Generated from the vocabulary plus engine settings — drop this straight into apps or design tools.',
  },
  {
    id: 'pigmint',
    label: 'Pigmint',
    filename: 'pigmint.yaml',
    mimeType: 'application/yaml',
    description:
      'Full project configuration — ramps, intent overrides, and engine settings in a single pigmint.yaml. Commit this to reproduce the entire palette setup elsewhere.',
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

function VirtualizedPre({ text }: { text: string }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => text.split('\n'), [text]);

  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 18,
    overscan: 30,
  });

  return (
    <div
      ref={parentRef}
      style={{
        flex: 1,
        overflow: 'auto',
        background: 'var(--p-surface)',
        padding: '12px 0',
      }}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((vItem) => (
          <div
            key={vItem.index}
            style={{
              position: 'absolute',
              top: vItem.start,
              left: 0,
              right: 0,
              height: vItem.size,
              padding: '0 20px',
              fontSize: 12,
              fontFamily: 'monospace',
              whiteSpace: 'pre',
              lineHeight: '18px',
              display: 'flex',
            }}
          >
            <span style={{ display: 'inline-block', width: 44, textAlign: 'right', marginRight: 12, color: 'var(--p-text-tertiary)', userSelect: 'none', flexShrink: 0 }}>
              {vItem.index + 1}
            </span>
            <span style={{ color: 'var(--p-text-secondary)' }}>{lines[vItem.index]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const EMPTY_PLACEHOLDER: Record<Tab, string> = {
  colors: '# No color scales defined yet.\n',
  'tokens-yaml': '# No vocabulary defined yet. Edit tokens in the Tokens panel first.\n',
  'tokens-json': '{\n  "info": "No vocabulary defined yet. Edit tokens in the Tokens panel first."\n}\n',
  pigmint: '# No project state yet.\n',
};

export function ExportModal({ onClose }: Props) {
  const scales = usePaletteStore((s) => s.scales);
  const intents = useIntentStore((s) => s.overrides);
  const engineModes = useIntentStore((s) => s.engineModes);
  const engineTarget = useIntentStore((s) => s.engineTarget);
  const engineCompliance = useIntentStore((s) => s.engineCompliance);
  const engineCvd = useIntentStore((s) => s.engineCvd);
  const engineResolver = useIntentStore((s) => s.engineResolver);
  const vocabEntries = useVocabStore((s) => s.entries);
  const vocabRaw = useVocabStore((s) => s.raw);
  const surfacePaths = useVocabStore((s) => s.surfacePaths);
  const surfaceSteps = useVocabStore((s) => s.surfaceSteps);
  const semanticSteps = useVocabStore((s) => s.semanticSteps);

  const ramps = useMemo(() => scales.map((scale) => generateRamp(scale)), [scales]);

  const colorsJson = useMemo(() => {
    if (ramps.length === 0) return EMPTY_PLACEHOLDER.colors;
    return exportToJSON(ramps);
  }, [ramps]);

  const tokensYaml = useMemo(() => {
    if (!vocabRaw) return EMPTY_PLACEHOLDER['tokens-yaml'];
    return useVocabStore.getState().exportYaml() || EMPTY_PLACEHOLDER['tokens-yaml'];
  }, [vocabRaw]);

  const tokensJson = useMemo(() => {
    const vocabCtx = vocabEntries && vocabRaw
      ? {
          vocabulary: vocabEntries,
          tokenRamp: Object.fromEntries(
            Object.entries({
              ...vocabRaw.surfaces,
              ...vocabRaw.foreground,
              ...vocabRaw.nonText,
              ...(vocabRaw.decorative ?? {}),
            }).map(([n, e]) => [n, (e as { ramp: string }).ramp]),
          ),
          surfacePaths: surfacePaths ?? undefined,
          surfaceSteps: surfaceSteps ?? undefined,
          semanticSteps: semanticSteps ?? undefined,
        }
      : null;
    const result = buildPigmintTokensJson(
      scales,
      engineModes,
      engineTarget,
      engineCompliance,
      vocabCtx,
      engineResolver,
    );
    return result.ok ? result.json : `{\n  "error": ${JSON.stringify(result.error)}\n}\n`;
  }, [scales, engineModes, engineTarget, engineCompliance, engineResolver, vocabEntries, vocabRaw, surfacePaths, surfaceSteps, semanticSteps]);

  const pigmintYaml = useMemo(
    () =>
      serializePigmintYaml({
        scales,
        intents,
        engine: {
          target: engineTarget,
          compliance: engineCompliance,
          modes: engineModes,
          cvd: engineCvd,
          resolver: engineResolver,
        },
      }),
    [scales, intents, engineTarget, engineCompliance, engineModes, engineCvd, engineResolver],
  );

  const contentByTab: Record<Tab, string> = {
    colors: colorsJson,
    'tokens-yaml': tokensYaml,
    'tokens-json': tokensJson,
    pigmint: pigmintYaml,
  };

  const [activeTab, setActiveTab] = useState<Tab>('colors');
  const [copied, setCopied] = useState(false);

  const activeSpec = TAB_SPECS.find((t) => t.id === activeTab) ?? TAB_SPECS[0];
  const activeContent = contentByTab[activeTab];

  function handleCopy() {
    navigator.clipboard.writeText(activeContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <AppDialog
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
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
          <Dialog.Title id="export-modal-title" style={{ fontSize: 15, fontWeight: 600, color: 'var(--p-text)', margin: 0 }}>
            Export
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
            aria-label="Close export modal"
          >
            ×
          </Dialog.Close>
        </div>

        <Tabs.Root
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v as Tab);
            setCopied(false);
          }}
          style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0 }}
        >
          <Tabs.List
            aria-label="Export format"
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
          {TAB_SPECS.map((spec) => (
            <Tabs.Panel
              key={spec.id}
              value={spec.id}
              style={{ display: activeTab === spec.id ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column' }}
            >
              <div
                style={{
                  padding: '12px 20px',
                  borderBottom: '1px solid var(--p-border)',
                  background: 'var(--p-bg)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <div style={{ fontSize: 12, color: 'var(--p-text-tertiary)', fontFamily: 'monospace' }}>
                  {spec.filename}
                </div>
                <div style={{ fontSize: 13, color: 'var(--p-text-secondary)', lineHeight: 1.5 }}>
                  {spec.description}
                </div>
              </div>
              {activeTab === spec.id ? <VirtualizedPre text={activeContent} /> : null}
            </Tabs.Panel>
          ))}
        </Tabs.Root>

        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '14px 20px',
            borderTop: '1px solid var(--p-border)',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={handleCopy}
            className="focus-visible-ring"
            style={{
              padding: '6px 14px',
              fontSize: 13,
              background: 'var(--p-surface)',
              border: '1px solid var(--p-border)',
              borderRadius: 6,
              cursor: 'pointer',
              color: 'var(--p-text)',
            }}
          >
            {copied ? 'Copied…' : 'Copy'}
          </button>
          <span aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            {copied ? 'Copied to clipboard…' : ''}
          </span>
          <button
            type="button"
            onClick={() => downloadFile(activeContent, activeSpec.filename, activeSpec.mimeType)}
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
            Download {activeSpec.filename}
          </button>
          <button
            type="button"
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
    </AppDialog>
  );
}
