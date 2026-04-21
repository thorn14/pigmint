import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { usePaletteStore } from '../../store/paletteStore';
import { generateRamp } from '../../lib/colorMath';
import { exportToJSON } from '../../lib/exportTokens';
import { exportWcagContrastMapJSON, exportApcaContrastMapJSON } from '../../lib/exportContrastMap';

interface Props {
  onClose: () => void;
}

type Tab = 'tokens' | 'contrast-wcag' | 'contrast-apca';

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
  const ramps = useMemo(() => scales.map((scale) => generateRamp(scale)), [scales]);

  const tabs: Tab[] = ['tokens', 'contrast-wcag', 'contrast-apca'];
  const [activeTab, setActiveTab] = useState<Tab>('tokens');
  const [copied, setCopied] = useState(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleTabKeyDown = useCallback((event: React.KeyboardEvent) => {
    const currentIndex = tabs.indexOf(activeTab);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = tabs.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    setActiveTab(tabs[nextIndex]);
    setCopied(false);
    tabRefs.current[nextIndex]?.focus();
  }, [activeTab]);

  const exportCacheRef = useRef<{
    ramps: typeof ramps | null;
    tokens?: string;
    wcag?: string;
    apca?: string;
  }>({ ramps: null });

  if (exportCacheRef.current.ramps !== ramps) {
    exportCacheRef.current = { ramps };
  }

  const json = useMemo(() => {
    const cache = exportCacheRef.current;
    if (activeTab === 'tokens') {
      if (cache.tokens === undefined) cache.tokens = exportToJSON(ramps);
      return cache.tokens;
    }
    if (activeTab === 'contrast-wcag') {
      if (cache.wcag === undefined) cache.wcag = exportWcagContrastMapJSON(ramps);
      return cache.wcag;
    }
    if (cache.apca === undefined) cache.apca = exportApcaContrastMapJSON(ramps);
    return cache.apca;
  }, [ramps, activeTab]);
  const downloadName =
    activeTab === 'tokens' ? 'design-tokens.json'
    : activeTab === 'contrast-wcag' ? 'contrast-map-wcag.json'
    : 'contrast-map-apca.json';

  function handleCopy() {
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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
        aria-labelledby="export-modal-title"
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
          <h2 id="export-modal-title" style={{ fontSize: 15, fontWeight: 600, color: 'var(--p-text)', margin: 0 }}>
            Export
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

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Export format"
          onKeyDown={handleTabKeyDown}
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--p-border)',
            padding: '0 8px',
          }}
        >
          {tabs.map((tab, i) => {
            const label = tab === 'tokens' ? 'Design Tokens' : tab === 'contrast-wcag' ? 'Contrast — WCAG' : 'Contrast — APCA';
            return (
              <button
                key={tab}
                ref={(node) => { tabRefs.current[i] = node; }}
                role="tab"
                id={`export-tab-${tab}`}
                aria-selected={activeTab === tab}
                aria-controls={`export-tabpanel-${tab}`}
                tabIndex={activeTab === tab ? 0 : -1}
                style={tabStyle(activeTab === tab)}
                onClick={() => { setActiveTab(tab); setCopied(false); }}
                className="focus-visible-ring"
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Virtualized JSON content */}
        <div
          role="tabpanel"
          id={`export-tabpanel-${activeTab}`}
          aria-labelledby={`export-tab-${activeTab}`}
          style={{ display: 'flex', flex: 1, minHeight: 0 }}
        >
          <VirtualizedPre text={json} />
        </div>

        {/* Footer */}
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
            {copied ? 'Copied!' : 'Copy JSON'}
          </button>
          <span aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            {copied ? 'Copied to clipboard' : ''}
          </span>
          <button
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
          {activeTab === 'tokens' && (
            <>
              <button
                onClick={() => downloadJSON(exportWcagContrastMapJSON(ramps), 'contrast-map-wcag.json')}
                className="focus-visible-ring"
                style={{
                  padding: '6px 14px',
                  fontSize: 12,
                  background: 'var(--p-bg-subtle)',
                  border: '1px solid var(--p-border)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: 'var(--p-text-secondary)',
                }}
              >
                + WCAG Map
              </button>
              <button
                onClick={() => downloadJSON(exportApcaContrastMapJSON(ramps), 'contrast-map-apca.json')}
                className="focus-visible-ring"
                style={{
                  padding: '6px 14px',
                  fontSize: 12,
                  background: 'var(--p-bg-subtle)',
                  border: '1px solid var(--p-border)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: 'var(--p-text-secondary)',
                }}
              >
                + APCA Map
              </button>
            </>
          )}
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
