import { useState, useEffect, useRef, useCallback } from 'react';
import { formatCss } from 'culori';
import { TopBar } from './components/layout/TopBar';
import { ScalesPanel } from './components/layout/ScalesPanel';
import { EditScalePanel } from './components/layout/EditScalePanel';
import { BottomBar, type Panel } from './components/layout/BottomBar';
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
import { generateRamp } from './lib/colorMath';
import { applyPreviewBgChrome, clearPreviewBgChrome } from './lib/previewBgChrome';
import { surfaceSchemeHex } from './components/tokens/pinValidation';
import type { ColorScale } from './types/palette';
import type { GeneratedRamp } from '@pigmint/core';

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

const OPEN_PANELS_KEY = 'pigmint:open-panels:v1';
const NARROW_QUERY = '(max-width: 767px)';

function isNarrowViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(NARROW_QUERY).matches;
}

function readOpenPanelsPref(): Set<Panel> {
  if (typeof window === 'undefined') return new Set();
  const narrow = isNarrowViewport();
  try {
    const raw = localStorage.getItem(OPEN_PANELS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { scales?: unknown; edit?: unknown };
      if (parsed && typeof parsed === 'object') {
        const next = new Set<Panel>();
        if (parsed.scales === true) next.add('scales');
        if (parsed.edit === true) next.add('edit');
        if (narrow && next.size > 1) {
          return next.has('edit') ? new Set<Panel>(['edit']) : new Set<Panel>(['scales']);
        }
        return next;
      }
    }
  } catch {
    /* corrupt storage — fall through to default */
  }
  // No stored pref: desktop defaults scales open; mobile stays closed.
  return narrow ? new Set() : new Set<Panel>(['scales']);
}

function persistOpenPanels(panels: Set<Panel>) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      OPEN_PANELS_KEY,
      JSON.stringify({ scales: panels.has('scales'), edit: panels.has('edit') }),
    );
  } catch {
    /* quota/privacy mode — silently drop */
  }
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

function CanvasEdgeBleed({ scale, leftWidth, rightWidth }: { scale: ColorScale; leftWidth: number; rightWidth: number }) {
  const ramp = useGeneratedRamp(scale);
  if (ramp.steps.length === 0) return null;
  const first = ramp.steps[0];
  const last = ramp.steps[ramp.steps.length - 1];
  const colorOf = (s: typeof first) =>
    s.oklch.alpha != null && s.oklch.alpha < 1
      ? (formatCss({ mode: 'oklch', ...s.oklch }) ?? s.hex)
      : s.hex;
  const firstColor = colorOf(first);
  const lastColor = colorOf(last);
  return (
    <>
      {leftWidth > 0 && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0, bottom: 0, left: 0,
            width: leftWidth,
            background: firstColor,
            zIndex: 0,
            pointerEvents: 'none',
            transition: 'width 0.16s ease-out',
          }}
        />
      )}
      {rightWidth > 0 && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0, bottom: 0, right: 0,
            width: rightWidth,
            background: lastColor,
            zIndex: 0,
            pointerEvents: 'none',
            transition: 'width 0.16s ease-out',
          }}
        />
      )}
    </>
  );
}

function CanvasPanel({
  scale,
  activeStepIndex,
  onStepClick,
  bottomReserve,
  topInset = 0,
}: {
  scale: ColorScale;
  activeStepIndex: number | null;
  onStepClick: (idx: number) => void;
  bottomReserve: number;
  topInset?: number;
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
        topInset={topInset}
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
  const [openPanels, setOpenPanels] = useState<Set<Panel>>(() => readOpenPanelsPref());
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    persistOpenPanels(openPanels);
  }, [openPanels]);
  const lastSavedFingerprint = useRef<string | null>(null);
  const activePaletteId = usePaletteStore((s) => s.activePaletteId);
  const scale = usePaletteStore(selectActiveScale);
  const scales = usePaletteStore((s) => s.scales);
  const srgbPreview = usePaletteStore((s) => s.srgbPreview);
  const toggleSrgbPreview = usePaletteStore((s) => s.toggleSrgbPreview);
  const previewBgSurface = useIntentStore((s) => s.previewBgSurface);
  const vocabRaw = useVocabStore((s) => s.raw);

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

  // Optionally pin app chrome to a single surface token (lightStep/darkStep) so
  // Theme light/dark previews tokens against the authored background.
  useEffect(() => {
    const surfaceName = previewBgSurface;
    const surface = surfaceName ? vocabRaw?.surfaces[surfaceName] : undefined;
    if (!surfaceName || !surface) {
      clearPreviewBgChrome();
      return;
    }

    const rampMap = new Map<string, GeneratedRamp>();
    for (const scale of scales) {
      try {
        rampMap.set(scale.name, generateRamp(scale));
      } catch {
        /* skip broken scale */
      }
    }
    const scheme = theme === 'dark' ? 'dark' : 'light';
    const hex = surfaceSchemeHex(surface, rampMap, scheme);
    if (!hex) {
      clearPreviewBgChrome();
      return;
    }
    applyPreviewBgChrome(hex);
    return () => clearPreviewBgChrome();
  }, [previewBgSurface, vocabRaw, scales, theme]);

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

  const togglePanel = useCallback((panel: Panel) => {
    setOpenPanels((prev) => {
      const next = new Set(prev);
      if (next.has(panel)) {
        next.delete(panel);
      } else {
        next.add(panel);
      }
      return next;
    });
  }, []);

  const closePanel = useCallback((panel: Panel) => {
    setOpenPanels((prev) => {
      if (!prev.has(panel)) return prev;
      const next = new Set(prev);
      next.delete(panel);
      return next;
    });
  }, []);

  // On narrow viewports, collapse to a single open panel — prefer 'edit' if both are open.
  useEffect(() => {
    if (!narrow) return;
    setOpenPanels((prev) => {
      if (prev.size <= 1) return prev;
      const next = new Set<Panel>();
      if (prev.has('edit')) next.add('edit');
      else if (prev.has('scales')) next.add('scales');
      return next;
    });
  }, [narrow]);

  const scalesVisibleDesktop = !narrow && openPanels.has('scales') && mode === 'primitives';
  const editVisibleDesktop = !narrow && openPanels.has('edit') && mode === 'primitives' && Boolean(scale);

  const PANEL_W = 280;
  const PANEL_MARGIN = 4;
  // Both drawers push the canvas so the ramp steps stay reachable next to the open panel.
  const canvasLeftInset = scalesVisibleDesktop ? PANEL_W + 2 * PANEL_MARGIN : 0;
  const canvasRightInset = editVisibleDesktop ? PANEL_W + 2 * PANEL_MARGIN : 0;

  const scalesBody = (
    <ScalesPanel
      onEditSteps={() => setShowSteps(true)}
      onEditLightness={() => setShowLightness(true)}
      onClose={() => closePanel('scales')}
      dismissOnSelect={narrow}
    />
  );

  const editBody = scale ? (
    <ActiveStepInspector scale={scale} activeStepIndex={activeStepIndex}>
      {(step) => <EditScalePanel activeStep={step} onClose={() => closePanel('edit')} />}
    </ActiveStepInspector>
  ) : null;

  // Which single panel to render in the bottom sheet on narrow.
  const narrowPanel: Panel | null = openPanels.has('edit') && scale
    ? 'edit'
    : openPanels.has('scales')
      ? 'scales'
      : null;

  const canvasAsBg = mode === 'primitives' && !!scale;

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        background: 'var(--p-bg)',
        color: 'var(--p-text)',
      }}
    >
      {/* Canvas as background layer in primitives mode — shrinks from the right when desktop panels are open so they don't occlude. */}
      {canvasAsBg && scale && (
        <CanvasEdgeBleed scale={scale} leftWidth={canvasLeftInset} rightWidth={canvasRightInset} />
      )}
      {canvasAsBg && scale && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: canvasLeftInset,
            bottom: 0,
            right: canvasRightInset,
            zIndex: 0,
            display: 'flex',
            transition: 'left 0.16s ease-out, right 0.16s ease-out',
          }}
        >
          <CanvasPanel
            scale={scale}
            activeStepIndex={activeStepIndex}
            onStepClick={(i) => setActiveStepIndex((prev) => (prev === i ? null : i))}
            bottomReserve={showBottomBar ? 44 : 0}
            topInset={48}
          />
        </div>
      )}

      <div style={{ position: 'relative', zIndex: 10, flexShrink: 0 }}>
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
      </div>

      <main
        id="main-content"
        style={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          position: 'relative',
          zIndex: 5,
          pointerEvents: canvasAsBg ? 'none' : 'auto',
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

        {mode === 'primitives' && !scale && <BulkCreatePanel />}
        {mode === 'tokens' && <TokensPanel />}

        {scalesVisibleDesktop && (
          <aside
            style={{
              position: 'absolute',
              top: PANEL_MARGIN,
              left: PANEL_MARGIN,
              bottom: PANEL_MARGIN,
              width: PANEL_W,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              background: 'var(--p-bg)',
              border: '1px solid var(--p-border)',
              borderRadius: 6,
              boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
              overflow: 'hidden',
              pointerEvents: 'auto',
            }}
            aria-label="Scales"
          >
            {scalesBody}
          </aside>
        )}
        {editVisibleDesktop && (
          <aside
            style={{
              position: 'absolute',
              top: PANEL_MARGIN,
              right: PANEL_MARGIN,
              bottom: PANEL_MARGIN,
              width: PANEL_W,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              background: 'var(--p-bg)',
              border: '1px solid var(--p-border)',
              borderRadius: 6,
              boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
              overflow: 'hidden',
              pointerEvents: 'auto',
            }}
            aria-label="Edit scale"
          >
            {editBody}
          </aside>
        )}
      </main>

      {showBottomBar && (
        <BottomBar
          openPanels={openPanels}
          onTogglePanel={togglePanel}
          leftInset={canvasLeftInset}
        />
      )}

      {narrow && narrowPanel !== null && mode === 'primitives' && (
        <AppBottomSheet onOpenChange={(open) => { if (!open) closePanel(narrowPanel); }}>
          {narrowPanel === 'scales' ? scalesBody : editBody}
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
