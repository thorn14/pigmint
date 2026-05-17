import { useCallback, useMemo, useRef, useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Tabs } from '@base-ui/react/tabs';
import { useVirtualizer } from '@tanstack/react-virtual';
import { usePaletteStore } from '../../store/paletteStore';
import { useIntentStore } from '../../store/intentStore';
import { generateRamp } from '../../lib/colorMath';
import { exportToJSON } from '../../lib/exportTokens';
import { buildPigmintTokensJson } from '../../lib/resolveState';
import { useVocabStore } from '../../store/vocabStore';
import { AppDialog } from '../base-ui/app-dialog';

interface Props {
  onClose: () => void;
}

type Tab = 'pigmint-tokens' | 'colors';

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '6px 14px',
  fontSize: 12,
  fontWeight: 500,
  background: active ? 'var(--p-bg-inset)' : 'transparent',
  border: 'none',
  borderBottom: active ? '2px solid var(--p-accent)' : '2px solid transparent',
  cursor: 'pointer',
  color: active ? 'var(--p-text)' : 'var(--p-text-secondary)',
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
        background: 'var(--p-bg-subtle)',
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

function downloadJSON(json: string, filename: string) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function ExportModal({ onClose }: Props) {
  const scales = usePaletteStore((s) => s.scales);
  const engineModes = useIntentStore((s) => s.engineModes);
  const engineTarget = useIntentStore((s) => s.engineTarget);
  const engineCompliance = useIntentStore((s) => s.engineCompliance);
  const engineResolver = useIntentStore((s) => s.engineResolver);
  const vocabEntries = useVocabStore((s) => s.entries);
  const vocabRaw = useVocabStore((s) => s.raw);
  const surfacePaths = useVocabStore((s) => s.surfacePaths);
  const surfaceSteps = useVocabStore((s) => s.surfaceSteps);
  const vocabCtx = vocabEntries && vocabRaw
    ? {
        vocabulary: vocabEntries,
        tokenRamp: Object.fromEntries(
          Object.entries({ ...vocabRaw.surfaces, ...vocabRaw.foreground, ...vocabRaw.nonText, ...(vocabRaw.decorative ?? {}) })
            .map(([n, e]) => [n, (e as { ramp: string }).ramp])
        ),
        surfacePaths: surfacePaths ?? undefined,
        surfaceSteps: surfaceSteps ?? undefined,
      }
    : null;
  const ramps = useMemo(() => scales.map((scale) => generateRamp(scale)), [scales]);

  const tabIds: Tab[] = ['pigmint-tokens', 'colors'];
  const [activeTab, setActiveTab] = useState<Tab>('pigmint-tokens');
  const [copied, setCopied] = useState(false);

  const exportCacheRef = useRef<{
    key: string | null;
    pigmintTokens?: string;
    colors?: string;
  }>({ key: null });

  const cacheKey = `${ramps.length}|${engineModes.join(',')}|${engineTarget}|${engineCompliance}|${JSON.stringify(engineResolver)}|${vocabEntries?.length ?? 0}`;
  if (exportCacheRef.current.key !== cacheKey) {
    exportCacheRef.current = { key: cacheKey };
  }

  const getJson = useCallback(
    (t: Tab): string => {
      if (exportCacheRef.current.key !== cacheKey) {
        exportCacheRef.current = { key: cacheKey };
      }
      const cache = exportCacheRef.current;
      if (t === 'pigmint-tokens') {
        if (cache.pigmintTokens === undefined) {
          const result = buildPigmintTokensJson(
            scales,
            engineModes,
            engineTarget,
            engineCompliance,
            vocabCtx,
            engineResolver,
          );
          cache.pigmintTokens = result.ok
            ? result.json
            : `{\n  "error": ${JSON.stringify(result.error)}\n}\n`;
        }
        return cache.pigmintTokens;
      }
      if (cache.colors === undefined) cache.colors = exportToJSON(ramps);
      return cache.colors;
    },
    [cacheKey, scales, engineModes, engineTarget, engineCompliance, engineResolver, vocabCtx, ramps],
  );

  const json = getJson(activeTab);
  const downloadName = activeTab === 'pigmint-tokens' ? 'tokens.json' : 'colors.json';

  function handleCopy() {
    navigator.clipboard.writeText(json).then(() => {
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
          width: '100%',
          maxWidth: 680,
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
            }}
          >
            {tabIds.map((tab) => {
              const label = tab === 'pigmint-tokens' ? 'Tokens (resolved)' : 'Colors (primitives)';
              return (
                <Tabs.Tab
                  key={tab}
                  value={tab}
                  className="focus-visible-ring"
                  style={tabStyle(activeTab === tab)}
                >
                  {label}
                </Tabs.Tab>
              );
            })}
          </Tabs.List>
          {tabIds.map((tab) => (
            <Tabs.Panel key={tab} value={tab} style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: 'column' }}>
              {activeTab === tab ? <VirtualizedPre text={getJson(tab)} /> : null}
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
              background: 'var(--p-bg-subtle)',
              border: '1px solid var(--p-border)',
              borderRadius: 6,
              cursor: 'pointer',
              color: 'var(--p-text)',
            }}
          >
            {copied ? 'Copied…' : 'Copy JSON'}
          </button>
          <span aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            {copied ? 'Copied to clipboard…' : ''}
          </span>
          <button
            type="button"
            onClick={() => downloadJSON(json, downloadName)}
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
            Download {downloadName}
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
