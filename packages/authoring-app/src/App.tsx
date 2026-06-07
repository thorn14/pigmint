import { useState, useEffect, useRef, useCallback } from 'react';
import { TopBar } from './components/layout/TopBar';
import { ScalesPanel } from './components/layout/ScalesPanel';
import { EditScalePanel } from './components/layout/EditScalePanel';
import { BottomBar, type ActivePanel } from './components/layout/BottomBar';
import { AppBottomSheet } from './components/base-ui';
import { useIsNarrow } from './hooks/useViewportWidth';
import { CurveOverlayEditor } from './components/curves/CurveOverlayEditor';
import { TokensPanel } from './components/tokens/TokensPanel';

import { ExportModal } from './components/export/ExportModal';
import { ImportModal } from './components/export/ImportModal';
import { StepListModal } from './components/steps/StepListModal';
import { BulkCreatePanel } from './components/setup/BulkCreatePanel';
import { PalettePreviewModal } from './components/preview/PalettePreviewModal';
import { usePaletteStore, selectActiveScale } from './store/paletteStore';
import { useIntentStore } from './store/intentStore';
import { initVocabStore, useVocabStore } from './store/vocabStore';
import { useGeneratedRamp } from './hooks/useGeneratedRamp';
import type { ColorScale } from './types/palette';

type AppMode = 'primitives' | 'tokens';
type AppTheme = 'dark' | 'light';

const APP_MODES = new Set<AppMode>(['primitives', 'tokens']);

function readModeFromSearch(search: string): AppMode | null {
  const raw = new URLSearchParams(search).get('mode');
  if (raw && APP_MODES.has(raw as AppMode)) return raw as AppMode;
  return null;
}

function readThemeFromSearch(search: string): AppTheme | null {
  const raw = new URLSearchParams(search).get('theme');
  return raw === 'dark' || raw === 'light' ? raw : null;
}

function authoringFingerprint(): string {
  const ps = usePaletteStore.getState();
  const palettePart = {
    version: 2,
    activePaletteId: ps.activePaletteId,
    palettes: ps.savedPalettes,
  };
  const is = useIntentStore.getState();
  const intentPart = {
    engineTarget: is.engineTarget,
    engineCompliance: is.engineCompliance,
    engineModes: is.engineModes,
    engineCvd: is.engineCvd,
    engineResolver: is.engineResolver,
    overrides: is.overrides,
  };
  return JSON.stringify({ palettePart, intentPart });
}

function CanvasPanel({
  scale,
  activeStepIndex,
  onStepClick,
  bottomReserve,
}: {
  scale: ColorScale;
  activeStepIndex: number | null;
  onStepClick: (idx: number) => void;
  bottomReserve: number;
}) {
  const ramp = useGeneratedRamp(scale);

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <CurveOverlayEditor
        scale={scale}
        ramp={ramp}
        activeStepIndex={activeStepIndex}
        onStepClick={onStepClick}
        bottomReserve={bottomReserve}
      />
    </div>
  );
}

function ActiveStepInspector({
  scale,
  activeStepIndex,
  children,
}: {
  scale: ColorScale;
  activeStepIndex: number | null;
  children: (step: import('./types/palette').GeneratedStep | null) => React.ReactNode;
}) {
  const ramp = useGeneratedRamp(scale);
  const step = activeStepIndex !== null ? (ramp.steps[activeStepIndex] ?? null) : null;
  return <>{children(step)}</>;
}

export default function App() {
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [showLightness, setShowLightness] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [mode, setMode] = useState<AppMode>(() =>
    typeof window !== 'undefined' ? readModeFromSearch(window.location.search) ?? 'primitives' : 'primitives',
  );
  const [theme, setTheme] = useState<AppTheme>(() =>
    typeof window !== 'undefined' ? readThemeFromSearch(window.location.search) ?? 'dark' : 'dark',
  );
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const lastSavedFingerprint = useRef<string | null>(null);
  const activePaletteId = usePaletteStore((s) => s.activePaletteId);
  const scale = usePaletteStore(selectActiveScale);
  const scales = usePaletteStore((s) => s.scales);
  const srgbPreview = usePaletteStore((s) => s.srgbPreview);
  const toggleSrgbPreview = usePaletteStore((s) => s.toggleSrgbPreview);

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      if (target instanceof HTMLTextAreaElement) return true;
      if (target instanceof HTMLInputElement) {
        if (target.readOnly || target.disabled) return false;
        const editableInputTypes = new Set([
          '',
          'text',
          'search',
          'url',
          'tel',
          'email',
          'password',
          'number',
        ]);
        return editableInputTypes.has(target.type.toLowerCase());
      }
      return false;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (mod) {
        if (key === 'z' && !e.shiftKey) {
          e.preventDefault();
          usePaletteStore.getState().undo();
        } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
          e.preventDefault();
          usePaletteStore.getState().redo();
        }
        return;
      }

      if (e.altKey || e.shiftKey) return;
      if (key === 'p') {
        e.preventDefault();
        setShowPreview((v) => !v);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const is = useIntentStore.getState();
    initVocabStore({ compliance: is.engineCompliance, target: is.engineTarget, modes: is.engineModes });
  }, []);

  useEffect(() => {
    const is = useIntentStore.getState();
    const ec = { compliance: is.engineCompliance, target: is.engineTarget, modes: is.engineModes };
    const ps = usePaletteStore.getState();
    const activePalette = ps.savedPalettes.find((p) => p.id === activePaletteId);
    useVocabStore.getState().loadFromVocab(activePalette?.vocab ?? null, ec);
  }, [activePaletteId]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    useIntentStore.getState().setAppTheme(theme);
  }, [theme]);

  useEffect(() => {
    const url = new URL(window.location.href);
    let changed = false;
    if (url.searchParams.get('mode') !== mode) {
      url.searchParams.set('mode', mode);
      changed = true;
    }
    if (url.searchParams.get('theme') !== theme) {
      url.searchParams.set('theme', theme);
      changed = true;
    }
    if (changed) window.history.replaceState({}, '', url);
  }, [mode, theme]);

  useEffect(() => {
    lastSavedFingerprint.current = authoringFingerprint();
  }, []);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (lastSavedFingerprint.current === null) return;
      if (authoringFingerprint() !== lastSavedFingerprint.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const handleSave = useCallback(() => {
    setSaveStatus('saving');
    try {
      usePaletteStore.getState().flushCurrentPalette();
      const state = usePaletteStore.getState();
      const payload = {
        version: 2,
        activePaletteId: state.activePaletteId,
        palettes: state.savedPalettes,
      };
      localStorage.setItem('pigmint:color-tokens', JSON.stringify(payload));
      lastSavedFingerprint.current = authoringFingerprint();
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }, []);

  const narrow = useIsNarrow();
  const showBottomBar = mode === 'primitives' && scales.length > 0;
  const showInlinePanel = !narrow && activePanel !== null && mode === 'primitives' && Boolean(scale);

  function renderPanelBody() {
    if (activePanel === 'scales') {
      return (
        <ScalesPanel
          onEditSteps={() => setShowSteps(true)}
          onEditLightness={() => setShowLightness(true)}
          onClose={() => setActivePanel(null)}
        />
      );
    }
    if (activePanel === 'edit' && scale) {
      return (
        <ActiveStepInspector scale={scale} activeStepIndex={activeStepIndex}>
          {(step) => <EditScalePanel activeStep={step} onClose={() => setActivePanel(null)} />}
        </ActiveStepInspector>
      );
    }
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--p-bg)',
        color: 'var(--p-text)',
      }}
    >
      <TopBar
        onExport={() => setShowExport(true)}
        onImport={() => setShowImport(true)}
        onSave={handleSave}
        onPreview={() => setShowPreview(true)}
        mode={mode}
        onModeChange={setMode}
        theme={theme}
        onThemeChange={setTheme}
        saveStatus={saveStatus}
        srgbPreview={srgbPreview}
        onToggleSrgbPreview={toggleSrgbPreview}
      />

      <main
        id="main-content"
        style={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <h1
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            clipPath: 'inset(50%)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          Pigmint color authoring
        </h1>

        {mode === 'primitives' && (scale ? (
          <CanvasPanel
            scale={scale}
            activeStepIndex={activeStepIndex}
            onStepClick={(i) => setActiveStepIndex((prev) => (prev === i ? null : i))}
            bottomReserve={showBottomBar ? 44 : 0}
          />
        ) : (
          <BulkCreatePanel />
        ))}
        {mode === 'tokens' && <TokensPanel />}

        {showInlinePanel && (
          <aside
            style={{
              width: 360,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              minHeight: 0,
              background: 'var(--p-bg)',
              borderLeft: '1px solid var(--p-border)',
            }}
            aria-label={activePanel === 'scales' ? 'Scales' : 'Edit scale'}
          >
            {renderPanelBody()}
          </aside>
        )}
      </main>

      {showBottomBar && <BottomBar activePanel={activePanel} onSelectPanel={setActivePanel} />}

      {narrow && activePanel !== null && mode === 'primitives' && (
        <AppBottomSheet onOpenChange={(open) => { if (!open) setActivePanel(null); }}>
          {renderPanelBody()}
        </AppBottomSheet>
      )}

      {showPreview && (
        <PalettePreviewModal
          onClose={() => setShowPreview(false)}
          onEditScale={(scaleId) => {
            usePaletteStore.getState().setActiveScale(scaleId);
            setShowPreview(false);
          }}
        />
      )}
      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
      {showSteps && scale && <StepListModal scale={scale} mode="names" applyToAll onClose={() => setShowSteps(false)} />}
      {showLightness && scale && <StepListModal scale={scale} mode="lightness" onClose={() => setShowLightness(false)} />}
    </div>
  );
}
