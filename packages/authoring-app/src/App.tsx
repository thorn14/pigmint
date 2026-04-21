import { useState, useEffect } from 'react';
import { TopBar } from './components/layout/TopBar';
import { Sidebar } from './components/layout/Sidebar';
import { RightPanel } from './components/layout/RightPanel';
import { CurveOverlayEditor } from './components/curves/CurveOverlayEditor';
import { PalettePreview } from './components/preview/PalettePreview';
import { AccessibleCombos } from './components/accessibility/AccessibleCombos';
import { IntentEditor } from './components/intents/IntentEditor';
import { SurfacePairViewer } from './components/surfaces/SurfacePairViewer';
import { ExportModal } from './components/export/ExportModal';
import { ImportModal } from './components/export/ImportModal';
import { ExportPigmintYamlModal } from './components/export/ExportPigmintYamlModal';
import { ImportPigmintYamlModal } from './components/export/ImportPigmintYamlModal';
import { StepListModal } from './components/steps/StepListModal';
import { BulkCreatePanel } from './components/setup/BulkCreatePanel';
import { usePaletteStore, selectActiveScale } from './store/paletteStore';
import { useGeneratedRamp } from './hooks/useGeneratedRamp';
import type { ColorScale } from './types/palette';

type AppMode = 'edit' | 'preview' | 'combos' | 'intents' | 'surfaces';
type AppTheme = 'dark' | 'light';

function EditPanel({ scale }: { scale: ColorScale }) {
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
      />
      <RightPanel key={scale.id} scale={scale} activeStep={activeStep} />
    </div>
  );
}

export default function App() {
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showExportPigmint, setShowExportPigmint] = useState(false);
  const [showImportPigmint, setShowImportPigmint] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [showLightness, setShowLightness] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [mode, setMode] = useState<AppMode>('edit');
  const [theme, setTheme] = useState<AppTheme>('dark');
  const scale = usePaletteStore(selectActiveScale);
  const scales = usePaletteStore((s) => s.scales);
  const srgbPreview = usePaletteStore((s) => s.srgbPreview);
  const toggleSrgbPreview = usePaletteStore((s) => s.toggleSrgbPreview);
  const undo = usePaletteStore((s) => s.undo);
  const redo = usePaletteStore((s) => s.redo);

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
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || isEditableTarget(e.target)) return;

      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  function handleSave() {
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
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }

  return (
    <div
      data-theme={theme}
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
        onSave={handleSave}
        onEditSteps={() => setShowSteps(true)}
        onEditLightness={() => setShowLightness(true)}
        mode={mode}
        onModeChange={setMode}
        theme={theme}
        onThemeChange={setTheme}
        saveStatus={saveStatus}
        srgbPreview={srgbPreview}
        onToggleSrgbPreview={toggleSrgbPreview}
      />

      <main id="main-content" style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {mode === 'edit' && scales.length > 0 && <Sidebar />}

        {mode === 'edit' && (scale ? <EditPanel scale={scale} /> : <BulkCreatePanel />)}
        {mode === 'preview' && (
          <PalettePreview
            onEditScale={(scaleId) => {
              usePaletteStore.getState().setActiveScale(scaleId);
              setMode('edit');
            }}
          />
        )}
        {mode === 'combos' && <AccessibleCombos />}
        {mode === 'intents' && <IntentEditor />}
        {mode === 'surfaces' && <SurfacePairViewer />}
      </main>

      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
      {showExportPigmint && <ExportPigmintYamlModal onClose={() => setShowExportPigmint(false)} />}
      {showImportPigmint && <ImportPigmintYamlModal onClose={() => setShowImportPigmint(false)} />}
      {showSteps && scale && <StepListModal scale={scale} mode="names" applyToAll onClose={() => setShowSteps(false)} />}
      {showLightness && scale && <StepListModal scale={scale} mode="lightness" onClose={() => setShowLightness(false)} />}
    </div>
  );
}
