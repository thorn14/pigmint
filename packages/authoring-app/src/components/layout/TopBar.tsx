import { useState, useEffect, useRef } from 'react';
import { Menu } from '@base-ui/react/menu';
import { usePaletteStore, selectActiveScale } from '../../store/paletteStore';
import { useIntentStore } from '../../store/intentStore';
import { LIGHTNESS_PRESET_OPTIONS, type LightnessPreset } from '../../constants/stepPresets';
import type { StepNamingPreset } from '../../types/palette';
import { AppStringSelect, AppToolbarSegmented } from '../base-ui';

function PaletteSelector() {
  const savedPalettes = usePaletteStore((s) => s.savedPalettes);
  const activePaletteId = usePaletteStore((s) => s.activePaletteId);
  const currentPaletteName = usePaletteStore((s) => s.currentPaletteName);
  const switchPalette = usePaletteStore((s) => s.switchPalette);
  const createPalette = usePaletteStore((s) => s.createPalette);
  const deletePalette = usePaletteStore((s) => s.deletePalette);
  const renamePalette = usePaletteStore((s) => s.renamePalette);

  const [nameValue, setNameValue] = useState(currentPaletteName);
  useEffect(() => { setNameValue(currentPaletteName); }, [currentPaletteName]);

  function commitRename() {
    const trimmed = nameValue.trim();
    if (activePaletteId && trimmed) {
      renamePalette(activePaletteId, trimmed);
    } else {
      setNameValue(currentPaletteName);
    }
  }

  function handleCreatePalette() {
    const name = `Palette ${savedPalettes.length + 1}`;
    createPalette(name);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, minWidth: 0 }}>
      <input
        aria-label="Palette name"
        name="palette-name"
        value={nameValue}
        onChange={(e) => setNameValue(e.target.value)}
        onBlur={commitRename}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { commitRename(); (e.target as HTMLInputElement).blur(); }
          if (e.key === 'Escape') { setNameValue(currentPaletteName); (e.target as HTMLInputElement).blur(); }
        }}
        className="focus-visible-ring"
        style={{
          width: 110,
          minWidth: 0,
          flexShrink: 1,
          padding: '3px 6px',
          fontSize: 12,
          fontWeight: 500,
          background: 'var(--p-bg)',
          border: '1px solid var(--p-border)',
          borderRadius: 5,
          color: 'var(--p-text)',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      {savedPalettes.length > 1 && (
        <AppStringSelect
          aria-label="Switch palette"
          id="switch-palette"
          name="switch-palette"
          value={activePaletteId ?? ''}
          onValueChange={switchPalette}
          size="compact"
          className="focus-visible-ring"
          style={{ width: 120, flexShrink: 0 }}
          options={savedPalettes.map((p) => ({ value: p.id, label: p.name }))}
        />
      )}
      <button
        onClick={handleCreatePalette}
        title="New palette"
        aria-label="New palette"
        className="focus-visible-ring"
        style={{
          width: 24,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--p-bg)',
          border: '1px solid var(--p-border)',
          borderRadius: 5,
          cursor: 'pointer',
          color: 'var(--p-text-secondary)',
          fontSize: 16,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        +
      </button>
      {savedPalettes.length > 1 && activePaletteId && (
        <button
          onClick={() => deletePalette(activePaletteId)}
          title="Delete palette"
          aria-label="Delete current palette"
          className="focus-visible-ring"
          style={{
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--p-bg)',
            border: '1px solid var(--p-border)',
            borderRadius: 5,
            cursor: 'pointer',
            color: 'var(--p-text-tertiary)',
            flexShrink: 0,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 3h8M5 3V2h2v1M4.5 3v6.5h3V3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

type AppMode = 'primitives' | 'preview' | 'combos' | 'tokens' | 'audit';
type AppTheme = 'light' | 'dark';

interface Props {
  onExport: () => void;
  onImport: () => void;
  onExportPigmint: () => void;
  onImportPigmint: () => void;
  onSave: () => void;
  onEditSteps: () => void;
  onEditLightness: () => void;
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  theme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  srgbPreview: boolean;
  onToggleSrgbPreview: () => void;
}

const divider = (
  <div style={{ width: 1, height: 20, background: 'var(--p-border)', flexShrink: 0 }} />
);

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--p-text-tertiary)',
  whiteSpace: 'nowrap',
};

const linkBtnStyle: React.CSSProperties = {
  padding: 0,
  fontSize: 12,
  background: 'none',
  border: 'none',
  color: 'var(--p-text-secondary)',
  cursor: 'pointer',
  textDecoration: 'underline',
  textUnderlineOffset: 2,
};


const saveMenuItemStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 12,
  cursor: 'pointer',
  outline: 'none',
};

export function TopBar({ onExport, onImport, onExportPigmint, onImportPigmint, onSave, onEditSteps, onEditLightness, mode, onModeChange, theme, onThemeChange, saveStatus, srgbPreview, onToggleSrgbPreview }: Props) {
  const saveSplitRef = useRef<HTMLDivElement>(null);
  const updateStepNamingAll = usePaletteStore((s) => s.updateStepNamingAll);
  const applyLightnessPreset = usePaletteStore((s) => s.applyLightnessPreset);
  const scale = usePaletteStore(selectActiveScale);
  const engineCompliance = useIntentStore((s) => s.engineCompliance);
  const setEngineCompliance = useIntentStore((s) => s.setEngineCompliance);
  const contrastMode = engineCompliance === 'apca' ? 'apca' : 'wcag';
  const engineResolver = useIntentStore((s) => s.engineResolver);
  const setResolverMode = useIntentStore((s) => s.setResolverMode);
  const resolverMode = engineResolver.mode === 'continuous' ? 'continuous' : 'stepped';

  const saveLabel =
    saveStatus === 'saving' ? 'Saving…' :
    saveStatus === 'saved' ? 'Saved' :
    saveStatus === 'error' ? 'Save failed' :
    'Save';

  return (
    <header
      style={{
        height: 44,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 16px',
        background: 'var(--p-bg)',
        borderBottom: '1px solid var(--p-border)',
        flexShrink: 0,
        overflow: 'visible',
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <svg width="18" height="18" viewBox="0 0 32 32" aria-hidden="true">
          <rect width="32" height="32" rx="6" fill="#0d1117" />
          <defs>
            <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f472b6" />
              <stop offset="33%" stopColor="#a78bfa" />
              <stop offset="66%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>
          <text x="7" y="26" fontFamily="Georgia, serif" fontWeight="bold" fontSize="28" fill="url(#logo-g)">p</text>
        </svg>
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--p-text)' }}>pigmint</span>
      </div>

      {divider}

      {/* Palette selector */}
      <PaletteSelector />

      {divider}

      {/* Steps — applies to all scales */}
      {scale && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <label htmlFor="steps-preset" style={labelStyle}>Steps</label>
          <AppStringSelect
            id="steps-preset"
            name="steps-preset"
            value={scale.naming.preset}
            onValueChange={(v) => {
              const preset = v as StepNamingPreset;
              updateStepNamingAll({ preset });
              if (preset === 'custom') onEditSteps();
            }}
            className="focus-visible-ring"
            options={[
              { value: 'tailwind', label: 'Tailwind' },
              { value: 'numeric', label: 'Numeric' },
              { value: 'custom', label: 'Custom…' },
            ]}
          />
          {scale.naming.preset === 'custom' && (
            <button onClick={onEditSteps} style={linkBtnStyle} className="focus-visible-ring">edit</button>
          )}
        </div>
      )}

      {divider}

      {/* Lightness — applies to active scale */}
      {scale && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <label htmlFor="lightness-preset" style={labelStyle}>Lightness</label>
          <AppStringSelect
            id="lightness-preset"
            name="lightness-preset"
            value={scale.lightnessPreset}
            onValueChange={(v) => {
              const preset = v as LightnessPreset;
              if (preset === 'custom') {
                applyLightnessPreset(scale.id, 'custom');
                onEditLightness();
              } else {
                applyLightnessPreset(scale.id, preset);
              }
            }}
            className="focus-visible-ring"
            options={LIGHTNESS_PRESET_OPTIONS.map((p) => ({ value: p.value, label: p.label }))}
          />
          {scale.lightnessPreset === 'custom' && (
            <button onClick={onEditLightness} style={linkBtnStyle} className="focus-visible-ring">edit</button>
          )}
        </div>
      )}

      <AppToolbarSegmented
        aria-label="Contrast mode"
        value={contrastMode}
        onValueChange={(m) => setEngineCompliance(m === 'apca' ? 'apca' : 'wcag21')}
        options={[
          { value: 'wcag' as const, label: 'wcag' },
          { value: 'apca' as const, label: 'apca' },
        ]}
      />

      <AppToolbarSegmented
        aria-label="Resolver mode"
        value={resolverMode}
        onValueChange={(m) => setResolverMode(m === 'continuous' ? 'continuous' : 'stepped')}
        options={[
          { value: 'stepped' as const, label: 'stepped' },
          { value: 'continuous' as const, label: 'continuous' },
        ]}
      />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      <AppToolbarSegmented
        aria-label="App mode"
        value={mode}
        onValueChange={onModeChange}
        size="comfortable"
        options={([
          { value: 'primitives', label: 'Primitives' },
          { value: 'preview', label: 'Preview' },
          { value: 'combos', label: 'Combos' },
          { value: 'tokens', label: 'Tokens' },
{ value: 'audit', label: 'Audit' },
        ] as const).map((m) => ({ value: m.value, label: m.label }))}
      />

      {divider}

      <AppToolbarSegmented
        aria-label="Gamut preview"
        value={srgbPreview ? 'srgb' : 'p3'}
        onValueChange={(v) => {
          const wantSrgb = v === 'srgb';
          if (wantSrgb !== srgbPreview) onToggleSrgbPreview();
        }}
        options={[
          { value: 'srgb' as const, label: 'sRGB', 'aria-label': 'sRGB preview mode', title: 'Preview how colors appear on sRGB displays' },
          { value: 'p3' as const, label: 'P3', 'aria-label': 'Display P3 preview mode', title: 'Show wide-gamut Display P3 colors on supported displays' },
        ]}
      />

      <button
        onClick={() => onThemeChange(theme === 'light' ? 'dark' : 'light')}
        title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        className="focus-visible-ring"
        style={{
          width: 30,
          height: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--p-bg)',
          border: '1px solid var(--p-border)',
          borderRadius: 6,
          cursor: 'pointer',
          color: 'var(--p-text-secondary)',
          fontSize: 14,
        }}
      >
        {theme === 'light' ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M20 15.36A9 9 0 0 1 8.64 4 9 9 0 1 0 20 15.36Z" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
            <path d="M12 3v2.25M12 18.75V21M3 12h2.25M18.75 12H21M5.64 5.64l1.6 1.6M16.76 16.76l1.6 1.6M18.36 5.64l-1.6 1.6M7.24 16.76l-1.6 1.6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {/* Right: Save split + Base UI menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <Menu.Root modal={false}>
          <div
            ref={saveSplitRef}
            style={{
              display: 'inline-flex',
              position: 'relative',
              border: '1px solid var(--p-border)',
              borderRadius: 6,
              overflow: 'visible',
              background: 'var(--p-bg)',
              fontSize: 12,
            }}
          >
            <button
              type="button"
              onClick={onSave}
              disabled={saveStatus === 'saving'}
              className="focus-visible-ring"
              style={{
                padding: '4px 14px',
                fontWeight: 500,
                background: 'var(--p-bg)',
                border: 'none',
                color:
                  saveStatus === 'error'
                    ? 'var(--p-danger)'
                    : saveStatus === 'saved'
                      ? 'var(--p-success)'
                      : 'var(--p-text)',
                cursor: saveStatus === 'saving' ? 'default' : 'pointer',
              }}
            >
              {saveLabel}
            </button>
            <span
              aria-live="polite"
              aria-atomic="true"
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
              {saveStatus === 'saving'
                ? 'Saving…'
                : saveStatus === 'saved'
                  ? 'Saved'
                  : saveStatus === 'error'
                    ? 'Save failed'
                    : ''}
            </span>
            <Menu.Trigger
              type="button"
              aria-label="More save and export options"
              className="focus-visible-ring"
              style={{
                padding: '4px 10px',
                borderLeft: '1px solid var(--p-border)',
                background: 'var(--p-bg)',
                borderTop: 'none',
                borderRight: 'none',
                borderBottom: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M2 3h6L5 7z" fill="var(--p-text)" />
              </svg>
            </Menu.Trigger>
          </div>
          <Menu.Portal>
            <Menu.Positioner
              side="bottom"
              align="end"
              sideOffset={4}
              anchor={saveSplitRef}
              className="app-menu-positioner"
              style={{ zIndex: 60_000 }}
            >
              <Menu.Popup
                className="focus-visible-ring app-menu-popup"
                aria-label="Save and export options"
                style={{
                  minWidth: 180,
                  background: 'var(--p-bg)',
                  border: '1px solid var(--p-border)',
                  borderRadius: 6,
                  padding: '4px 0',
                  boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
                  color: 'var(--p-text)',
                }}
              >
                <Menu.Item
                  className="app-menu-item focus-visible-ring"
                  style={saveMenuItemStyle}
                  disabled={saveStatus === 'saving'}
                  label="Save"
                  onClick={onSave}
                >
                  Save
                </Menu.Item>
                <Menu.Item className="app-menu-item focus-visible-ring" style={saveMenuItemStyle} label="Import" onClick={onImport}>
                  Import
                </Menu.Item>
                <Menu.Item className="app-menu-item focus-visible-ring" style={saveMenuItemStyle} label="Export" onClick={onExport}>
                  Export
                </Menu.Item>
                <Menu.Separator
                  style={{
                    margin: '4px 0',
                    height: 1,
                    background: 'var(--p-border)',
                    border: 'none',
                  }}
                />
                <Menu.Item
                  className="app-menu-item focus-visible-ring"
                  style={saveMenuItemStyle}
                  label="Import pigmint yaml"
                  onClick={onImportPigmint}
                >
                  Import pigmint.yaml
                </Menu.Item>
                <Menu.Item
                  className="app-menu-item focus-visible-ring"
                  style={saveMenuItemStyle}
                  label="Export pigmint yaml"
                  onClick={onExportPigmint}
                >
                  Export pigmint.yaml
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
  </header>
);
}
