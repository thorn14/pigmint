import { useState, useEffect, useRef, useCallback } from 'react';
import { TopBar } from './components/layout/TopBar';
import { Sidebar } from './components/layout/Sidebar';
import { RightPanel } from './components/layout/RightPanel';
import { CurveOverlayEditor } from './components/curves/CurveOverlayEditor';
import { TokensPanel } from './components/tokens/TokensPanel';

import { ExportModal } from './components/export/ExportModal';
import { ImportModal } from './components/export/ImportModal';
import { ExportPigmintYamlModal } from './components/export/ExportPigmintYamlModal';
import { ImportPigmintYamlModal } from './components/export/ImportPigmintYamlModal';
import { StepListModal } from './components/steps/StepListModal';
import { BulkCreatePanel } from './components/setup/BulkCreatePanel';
import { PalettePreviewModal } from './components/preview/PalettePreviewModal';
import { ImportTokensYamlModal } from './components/tokens/ImportTokensYamlModal';
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

function EditPanel({
  scale,
  panelsCollapsed,
  onTogglePanels,
  onShowPreview,
}: {
  scale: ColorScale;
  panelsCollapsed: boolean;
  onTogglePanels: () => void;
  onShowPreview: () => void;
}) {
  const ramp = useGeneratedRamp(scale);
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const activeStep = activeStepIndex !== null ? (ramp.steps[activeStepIndex] ?? null) : null;

  function handleStepClick(i: number) {
    setActiveStepIndex((prev) => (prev === i ? null : i));
  }

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <CurveOverlayEditor
        scale={scale}
        ramp={ramp}
        activeStepIndex={activeStepIndex}
        onStepClick={handleStepClick}
        panelsCollapsed={panelsCollapsed}
        onTogglePanels={onTogglePanels}
        onShowPreview={onShowPreview}
      />
      {!panelsCollapsed && (
        <RightPanel key={scale.id} scale={scale} activeStep={activeStep} />
      )}
    </div>
  );
}

export default function App() {
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showExportPigmint, setShowExportPigmint] = useState(false);
  const [showImportPigmint, setShowImportPigmint] = useState(false);
  const [showImportTokens, setShowImportTokens] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [showLightness, setShowLightness] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [mode, setMode] = useState<AppMode>(() =>
    typeof window !== 'undefined' ? readModeFromSearch(window.location.search) ?? 'primitives' : 'primitives',
  );
  const [theme, setTheme] = useState<AppTheme>(() =>
    typeof window !== 'undefined' ? readThemeFromSearch(window.location.search) ?? 'dark' : 'dark',
  );
  const [panelsCollapsed, setPanelsCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('pigmint:panels-collapsed') === '1';
  });
  const [showPreview, setShowPreview] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('pigmint:panels-collapsed', panelsCollapsed ? '1' : '0');
  }, [panelsCollapsed]);
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
        } else if (key === '/') {
          e.preventDefault();
          setPanelsCollapsed((v) => !v);
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

  const handleExportTokens = useCallback(() => {
    const yaml = useVocabStore.getState().exportYaml();
    if (!yaml) return;
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tokens.yaml';
    a.click();
    URL.revokeObjectURL(url);
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
        onExportPigmint={() => setShowExportPigmint(true)}
        onImportPigmint={() => setShowImportPigmint(true)}
        onExportTokens={handleExportTokens}
        onImportTokens={() => setShowImportTokens(true)}
        onSave={handleSave}
        mode={mode}
        onModeChange={setMode}
        theme={theme}
        onThemeChange={setTheme}
        saveStatus={saveStatus}
        srgbPreview={srgbPreview}
        onToggleSrgbPreview={toggleSrgbPreview}
      />

      <main id="main-content" style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
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
        {mode === 'primitives' && scales.length > 0 && !panelsCollapsed && (
          <Sidebar
            onEditSteps={() => setShowSteps(true)}
            onEditLightness={() => setShowLightness(true)}
          />
        )}

        {mode === 'primitives' && (scale ? (
          <EditPanel
            scale={scale}
            panelsCollapsed={panelsCollapsed}
            onTogglePanels={() => setPanelsCollapsed((v) => !v)}
            onShowPreview={() => setShowPreview(true)}
          />
        ) : (
          <BulkCreatePanel />
        ))}
        {mode === 'tokens' && <TokensPanel />}
      </main>

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
      {showExportPigmint && <ExportPigmintYamlModal onClose={() => setShowExportPigmint(false)} />}
      {showImportPigmint && <ImportPigmintYamlModal onClose={() => setShowImportPigmint(false)} />}
      {showImportTokens && <ImportTokensYamlModal onClose={() => setShowImportTokens(false)} />}
      {showSteps && scale && <StepListModal scale={scale} mode="names" applyToAll onClose={() => setShowSteps(false)} />}
      {showLightness && scale && <StepListModal scale={scale} mode="lightness" onClose={() => setShowLightness(false)} />}
    </div>
  );
}
