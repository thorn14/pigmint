import { useState, useEffect, useRef } from 'react';
import { usePaletteStore, selectActiveScale } from '../../store/paletteStore';
import { useIntentStore } from '../../store/intentStore';
import { LIGHTNESS_PRESET_OPTIONS, type LightnessPreset } from '../../constants/stepPresets';
import type { StepNamingPreset } from '../../types/palette';

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
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      <input
        aria-label="Palette name"
        value={nameValue}
        onChange={(e) => setNameValue(e.target.value)}
        onBlur={commitRename}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { commitRename(); (e.target as HTMLInputElement).blur(); }
          if (e.key === 'Escape') { setNameValue(currentPaletteName); (e.target as HTMLInputElement).blur(); }
        }}
        className="focus-visible-ring"
        style={{
          padding: '3px 6px',
          fontSize: 12,
          fontWeight: 500,
          background: 'var(--p-bg)',
          border: '1px solid var(--p-border)',
          borderRadius: 5,
          color: 'var(--p-text)',
          outline: 'none',
          width: 110,
        }}
      />
      {savedPalettes.length > 1 && (
        <select
          aria-label="Switch palette"
          value={activePaletteId ?? ''}
          onChange={(e) => switchPalette(e.target.value)}
          className="focus-visible-ring"
          style={{
            padding: '3px 4px',
            fontSize: 11,
            background: 'var(--p-bg)',
            border: '1px solid var(--p-border)',
            borderRadius: 5,
            color: 'var(--p-text-secondary)',
            cursor: 'pointer',
            outline: 'none',
            maxWidth: 90,
          }}
        >
          {savedPalettes.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
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
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path d="M2 3h8M5 3V2h2v1M4.5 3v6.5h3V3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

type AppMode = 'edit' | 'preview' | 'combos' | 'intents' | 'surfaces' | 'audit';
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

const compactSelectStyle: React.CSSProperties = {
  padding: '3px 6px',
  fontSize: 12,
  background: 'var(--p-bg)',
  border: '1px solid var(--p-border)',
  borderRadius: 5,
  color: 'var(--p-text)',
  cursor: 'pointer',
  outline: 'none',
  minWidth: 110,
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


export function TopBar({ onExport, onImport, onExportPigmint, onImportPigmint, onSave, onEditSteps, onEditLightness, mode, onModeChange, theme, onThemeChange, saveStatus, srgbPreview, onToggleSrgbPreview }: Props) {
  const updateStepNamingAll = usePaletteStore((s) => s.updateStepNamingAll);
  const applyLightnessPreset = usePaletteStore((s) => s.applyLightnessPreset);
  const scale = usePaletteStore(selectActiveScale);
  const engineCompliance = useIntentStore((s) => s.engineCompliance);
  const setEngineCompliance = useIntentStore((s) => s.setEngineCompliance);
  const contrastMode = engineCompliance === 'apca' ? 'apca' : 'wcag';
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const contrastButtonsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const modeButtonsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const gamutButtonsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const menuButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const saveLabel =
    saveStatus === 'saving' ? 'Saving…' :
    saveStatus === 'saved' ? 'Saved' :
    saveStatus === 'error' ? 'Save failed' :
    'Save';

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  useEffect(() => {
    if (menuOpen) {
      menuButtonRefs.current[0]?.focus();
    }
  }, [menuOpen]);

  function handleRadioGroupKeyDown<T>(
    event: React.KeyboardEvent,
    values: readonly T[],
    current: T,
    onChange: (value: T) => void,
    refs: React.MutableRefObject<Array<HTMLButtonElement | null>>,
  ) {
    const currentIndex = values.indexOf(current);
    if (currentIndex === -1) return;

    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % values.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + values.length) % values.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = values.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    onChange(values[nextIndex]);
    refs.current[nextIndex]?.focus();
  }

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const items = menuButtonRefs.current.filter((item): item is HTMLButtonElement => Boolean(item));
    const activeIndex = items.findIndex((item) => item === document.activeElement);

    if (event.key === 'Escape') {
      event.preventDefault();
      setMenuOpen(false);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[(activeIndex + 1 + items.length) % items.length]?.focus();
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const previousIndex = activeIndex === -1 ? items.length : activeIndex;
      items[(previousIndex - 1 + items.length) % items.length]?.focus();
    }
  }

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
          <select
            id="steps-preset"
            name="steps-preset"
            value={scale.naming.preset}
            onChange={(e) => {
              const v = e.target.value as StepNamingPreset;
              updateStepNamingAll({ preset: v });
              if (v === 'custom') onEditSteps();
            }}
            style={compactSelectStyle}
            className="focus-visible-ring"
          >
            <option value="tailwind">Tailwind</option>
            <option value="numeric">Numeric</option>
            <option value="custom">Custom…</option>
          </select>
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
          <select
            id="lightness-preset"
            name="lightness-preset"
            value={scale.lightnessPreset}
            onChange={(e) => {
              const v = e.target.value as LightnessPreset;
              if (v === 'custom') {
                applyLightnessPreset(scale.id, 'custom');
                onEditLightness();
              } else {
                applyLightnessPreset(scale.id, v);
              }
            }}
            style={compactSelectStyle}
            className="focus-visible-ring"
          >
            {LIGHTNESS_PRESET_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          {scale.lightnessPreset === 'custom' && (
            <button onClick={onEditLightness} style={linkBtnStyle} className="focus-visible-ring">edit</button>
          )}
        </div>
      )}

      {/* WCAG / APCA toggle */}
      <div
        role="radiogroup"
        aria-label="Contrast mode"
        onKeyDown={(event) => handleRadioGroupKeyDown(
          event,
          ['wcag', 'apca'] as const,
          contrastMode,
          (m) => setEngineCompliance(m === 'apca' ? 'apca' : 'wcag21'),
          contrastButtonsRef,
        )}
        style={{
          display: 'flex',
          border: '1px solid var(--p-border)',
          borderRadius: 6,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {(['wcag', 'apca'] as const).map((m, i) => (
          <button
            key={m}
            role="radio"
            aria-checked={contrastMode === m}
            onClick={() => setEngineCompliance(m === 'apca' ? 'apca' : 'wcag21')}
            ref={(node) => { contrastButtonsRef.current[i] = node; }}
            tabIndex={contrastMode === m ? 0 : -1}
            className="focus-visible-ring"
            style={{
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: contrastMode === m ? 'var(--p-bg-inset)' : 'var(--p-bg)',
              color: contrastMode === m ? 'var(--p-text)' : 'var(--p-text-secondary)',
              border: 'none',
              borderLeft: i > 0 ? '1px solid var(--p-border)' : 'none',
              cursor: 'pointer',
            }}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Edit / Preview / Visualize / Combos toggle */}
      <div
        role="radiogroup"
        aria-label="App mode"
        onKeyDown={(event) => handleRadioGroupKeyDown(event, ['edit', 'preview', 'combos', 'intents', 'surfaces', 'audit'] as const, mode, onModeChange, modeButtonsRef)}
        style={{
          display: 'flex',
          border: '1px solid var(--p-border)',
          borderRadius: 6,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {(['edit', 'preview', 'combos', 'intents', 'surfaces', 'audit'] as const).map((m, i) => (
          <button
            key={m}
            role="radio"
            aria-checked={mode === m}
            onClick={() => onModeChange(m)}
            ref={(node) => { modeButtonsRef.current[i] = node; }}
            tabIndex={mode === m ? 0 : -1}
            className="focus-visible-ring"
            style={{
              padding: '4px 14px',
              fontSize: 12,
              fontWeight: 500,
              background: mode === m ? 'var(--p-bg-inset)' : 'var(--p-bg)',
              color: mode === m ? 'var(--p-text)' : 'var(--p-text-secondary)',
              border: 'none',
              borderLeft: i > 0 ? '1px solid var(--p-border)' : 'none',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {m}
          </button>
        ))}
      </div>

      {divider}

      <div
        role="radiogroup"
        aria-label="Gamut preview"
        onKeyDown={(event) =>
          handleRadioGroupKeyDown(
            event,
            [false, true] as const,
            srgbPreview,
            (nextValue) => {
              if (nextValue !== srgbPreview) onToggleSrgbPreview();
            },
            gamutButtonsRef,
          )}
        style={{
          display: 'flex',
          border: '1px solid var(--p-border)',
          borderRadius: 6,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {([false, true] as const).map((isSrgb, i) => {
          const active = srgbPreview === isSrgb;
          return (
            <button
              key={isSrgb ? 'srgb' : 'p3'}
              role="radio"
              aria-checked={active}
              aria-label={isSrgb ? 'sRGB preview mode' : 'Display P3 preview mode'}
              ref={(node) => { gamutButtonsRef.current[i] = node; }}
              tabIndex={active ? 0 : -1}
              onClick={() => { if (!active) onToggleSrgbPreview(); }}
              className="focus-visible-ring"
              style={{
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                background: active ? 'var(--p-bg-inset)' : 'var(--p-bg)',
                color: active ? 'var(--p-text)' : 'var(--p-text-secondary)',
                border: 'none',
                borderLeft: i > 0 ? '1px solid var(--p-border)' : 'none',
                cursor: 'pointer',
              }}
              title={isSrgb
                ? 'Preview how colors appear on sRGB displays'
                : 'Show wide-gamut Display P3 colors on supported displays'}
            >
              {isSrgb ? 'sRGB' : 'P3'}
            </button>
          );
        })}
      </div>

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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M20 15.36A9 9 0 0 1 8.64 4 9 9 0 1 0 20 15.36Z" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
            <path d="M12 3v2.25M12 18.75V21M3 12h2.25M18.75 12H21M5.64 5.64l1.6 1.6M16.76 16.76l1.6 1.6M18.36 5.64l-1.6 1.6M7.24 16.76l-1.6 1.6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {/* Right: Save + theme + Export */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div
          ref={menuRef}
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
          <button
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="More save/export options"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="focus-visible-ring"
            style={{
              padding: '4px 10px',
              borderLeft: '1px solid var(--p-border)',
              background: 'var(--p-bg)',
              borderTop: 'none',
              borderRight: 'none',
              borderBottom: 'none',
              cursor: 'pointer',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
              <path d="M2 3h6L5 7z" fill="var(--p-text)" />
            </svg>
          </button>
          {menuOpen && (
            <div
              role="menu"
              aria-label="Save and export options"
              onKeyDown={handleMenuKeyDown}
              style={{
                position: 'absolute',
                top: '110%',
                right: 0,
                background: 'var(--p-bg)',
                border: '1px solid var(--p-border)',
                borderRadius: 6,
                padding: '4px 0',
                boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
                zIndex: 5,
                minWidth: 140,
              }}
            >
              <button
                ref={(node) => { menuButtonRefs.current[0] = node; }}
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onSave();
                }}
                disabled={saveStatus === 'saving'}
                className="focus-visible-ring"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  cursor: saveStatus === 'saving' ? 'default' : 'pointer',
                }}
              >
                Save
              </button>
              <button
                ref={(node) => { menuButtonRefs.current[1] = node; }}
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onImport();
                }}
                className="focus-visible-ring"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Import
              </button>
              <button
                ref={(node) => { menuButtonRefs.current[2] = node; }}
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onExport();
                }}
                className="focus-visible-ring"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Export
              </button>
              <div style={{ height: 1, background: 'var(--p-border)', margin: '4px 0' }} />
              <button
                ref={(node) => { menuButtonRefs.current[3] = node; }}
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onImportPigmint();
                }}
                className="focus-visible-ring"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Import pigmint.yaml
              </button>
              <button
                ref={(node) => { menuButtonRefs.current[4] = node; }}
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onExportPigmint();
                }}
                className="focus-visible-ring"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Export pigmint.yaml
              </button>
          </div>
        )}
      </div>
    </div>
  </header>
);
}
