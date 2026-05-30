import { useState, useRef } from 'react';
import { Menu } from '@base-ui/react/menu';
import { usePaletteStore } from '../../store/paletteStore';
import { useIntentStore } from '../../store/intentStore';
import { AppStringSelect, AppToolbarSegmented } from '../base-ui';
import { ManagePalettesModal } from '../palette/ManagePalettesModal';

const NEW_PALETTE_SENTINEL = '__new__';
const MANAGE_PALETTE_SENTINEL = '__manage__';

function PaletteSelector() {
  const savedPalettes = usePaletteStore((s) => s.savedPalettes);
  const activePaletteId = usePaletteStore((s) => s.activePaletteId);
  const switchPalette = usePaletteStore((s) => s.switchPalette);
  const createPalette = usePaletteStore((s) => s.createPalette);
  const [showManage, setShowManage] = useState(false);

  const options = [
    ...savedPalettes.map((p) => ({ value: p.id, label: p.name })),
    { value: NEW_PALETTE_SENTINEL, label: '+ New palette' },
    { value: MANAGE_PALETTE_SENTINEL, label: 'Manage palettes…' },
  ];

  function handleValueChange(value: string) {
    if (value === NEW_PALETTE_SENTINEL) {
      createPalette(`Palette ${savedPalettes.length + 1}`);
      return;
    }
    if (value === MANAGE_PALETTE_SENTINEL) {
      setShowManage(true);
      return;
    }
    switchPalette(value);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, minWidth: 0 }}>
      <AppStringSelect
        aria-label="Palette"
        id="palette-select"
        name="palette-select"
        value={activePaletteId ?? ''}
        onValueChange={handleValueChange}
        size="compact"
        className="focus-visible-ring"
        style={{
          width: 160,
          maxWidth: 200,
          flexShrink: 0,
          height: 30,
          padding: '0 12px',
          borderRadius: 6,
          color: 'var(--p-text)',
          fontSize: 12,
          fontFamily: 'inherit',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        options={options}
      />
      {showManage && <ManagePalettesModal onClose={() => setShowManage(false)} />}
    </div>
  );
}

type AppMode = 'primitives' | 'tokens';
type AppTheme = 'light' | 'dark';

interface Props {
  onExport: () => void;
  onImport: () => void;
  onSave: () => void;
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

const saveMenuItemStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 12,
  cursor: 'pointer',
  outline: 'none',
};

const viewMenuSeparatorStyle: React.CSSProperties = {
  margin: '4px 0',
  height: 1,
  background: 'var(--p-border)',
  border: 'none',
};

const viewMenuGroupLabelStyle: React.CSSProperties = {
  padding: '6px 12px 2px',
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--p-text-tertiary)',
};

const viewMenuRadioItemStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: 12,
  cursor: 'pointer',
  outline: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

function ViewMenuRadioGroup<V extends string>({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: V;
  onValueChange: (v: V) => void;
  options: readonly { value: V; label: string }[];
}) {
  return (
    <Menu.Group>
      <Menu.GroupLabel style={viewMenuGroupLabelStyle}>{label}</Menu.GroupLabel>
      <Menu.RadioGroup value={value} onValueChange={(v) => onValueChange(v as V)}>
        {options.map((o) => (
          <Menu.RadioItem
            key={o.value}
            value={o.value}
            className="app-menu-item focus-visible-ring"
            style={viewMenuRadioItemStyle}
          >
            <span
              aria-hidden="true"
              style={{
                width: 14,
                height: 14,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: 'var(--p-text)',
              }}
            >
              <Menu.RadioItemIndicator>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6.5 5 9l4.5-5.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Menu.RadioItemIndicator>
            </span>
            <span>{o.label}</span>
          </Menu.RadioItem>
        ))}
      </Menu.RadioGroup>
    </Menu.Group>
  );
}

interface ViewMenuProps {
  theme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
  srgbPreview: boolean;
  onToggleSrgbPreview: () => void;
}

function ViewMenu({ theme, onThemeChange, srgbPreview, onToggleSrgbPreview }: ViewMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const engineCompliance = useIntentStore((s) => s.engineCompliance);
  const setEngineCompliance = useIntentStore((s) => s.setEngineCompliance);
  const contrastMode = engineCompliance === 'apca' ? 'apca' : 'wcag';
  const engineResolver = useIntentStore((s) => s.engineResolver);
  const setResolverMode = useIntentStore((s) => s.setResolverMode);
  const resolverMode = engineResolver.mode === 'continuous' ? 'continuous' : 'stepped';
  const gamutValue = srgbPreview ? 'srgb' : 'p3';

  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        ref={triggerRef}
        className="focus-visible-ring"
        aria-label="View options"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 12px',
          height: 30,
          background: 'var(--p-bg)',
          border: '1px solid var(--p-border)',
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--p-text)',
          cursor: 'pointer',
          flexShrink: 0,
          boxSizing: 'border-box',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        View
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M2 3h6L5 7z" fill="currentColor" />
        </svg>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          side="bottom"
          align="end"
          sideOffset={4}
          anchor={triggerRef}
          className="app-menu-positioner"
          style={{ zIndex: 60_000 }}
        >
          <Menu.Popup
            className="focus-visible-ring app-menu-popup"
            aria-label="View options"
            style={{
              minWidth: 220,
              background: 'var(--p-bg)',
              border: '1px solid var(--p-border)',
              borderRadius: 6,
              padding: '4px 0',
              boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
              color: 'var(--p-text)',
            }}
          >
            <ViewMenuRadioGroup
              label="Theme"
              value={theme}
              onValueChange={(v) => onThemeChange(v as AppTheme)}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
            <Menu.Separator style={viewMenuSeparatorStyle} />
            <ViewMenuRadioGroup
              label="Resolver"
              value={resolverMode}
              onValueChange={(v) => setResolverMode(v === 'continuous' ? 'continuous' : 'stepped')}
              options={[
                { value: 'stepped', label: 'Stepped' },
                { value: 'continuous', label: 'Continuous' },
              ]}
            />
            <Menu.Separator style={viewMenuSeparatorStyle} />
            <ViewMenuRadioGroup
              label="Contrast"
              value={contrastMode}
              onValueChange={(v) => setEngineCompliance(v === 'apca' ? 'apca' : 'wcag21')}
              options={[
                { value: 'wcag', label: 'WCAG 2.1' },
                { value: 'apca', label: 'APCA' },
              ]}
            />
            <Menu.Separator style={viewMenuSeparatorStyle} />
            <ViewMenuRadioGroup
              label="Gamut"
              value={gamutValue}
              onValueChange={(v) => {
                const wantSrgb = v === 'srgb';
                if (wantSrgb !== srgbPreview) onToggleSrgbPreview();
              }}
              options={[
                { value: 'p3', label: 'Display P3' },
                { value: 'srgb', label: 'sRGB' },
              ]}
            />
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function TopBar({ onExport, onImport, onSave, mode, onModeChange, theme, onThemeChange, saveStatus, srgbPreview, onToggleSrgbPreview }: Props) {
  const saveSplitRef = useRef<HTMLDivElement>(null);

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

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      <AppToolbarSegmented
        aria-label="App mode"
        value={mode}
        onValueChange={onModeChange}
        size="comfortable"
        options={([
          { value: 'primitives', label: 'Primitives' },
          { value: 'tokens', label: 'Tokens' },
        ] as const).map((m) => ({ value: m.value, label: m.label }))}
      />

      {divider}

      <ViewMenu
        theme={theme}
        onThemeChange={onThemeChange}
        srgbPreview={srgbPreview}
        onToggleSrgbPreview={onToggleSrgbPreview}
      />

      {/* Right: Save split + Base UI menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <Menu.Root modal={false}>
          <div
            ref={saveSplitRef}
            style={{
              display: 'inline-flex',
              alignItems: 'stretch',
              position: 'relative',
              border: '1px solid var(--p-border)',
              borderRadius: 6,
              overflow: 'visible',
              background: 'var(--p-bg)',
              fontSize: 12,
              height: 30,
              boxSizing: 'border-box',
            }}
          >
            <button
              type="button"
              onClick={onSave}
              disabled={saveStatus === 'saving'}
              className="focus-visible-ring"
              style={{
                padding: '0 14px',
                fontWeight: 500,
                background: 'var(--p-bg)',
                border: 'none',
                borderRadius: '5px 0 0 5px',
                display: 'inline-flex',
                alignItems: 'center',
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
                padding: '0 10px',
                borderLeft: '1px solid var(--p-border)',
                background: 'var(--p-bg)',
                color: 'var(--p-text)',
                borderTop: 'none',
                borderRight: 'none',
                borderBottom: 'none',
                borderRadius: '0 5px 5px 0',
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
                <Menu.Separator style={viewMenuSeparatorStyle} />
                <Menu.Item className="app-menu-item focus-visible-ring" style={saveMenuItemStyle} label="Import" onClick={onImport}>
                  Import
                </Menu.Item>
                <Menu.Item className="app-menu-item focus-visible-ring" style={saveMenuItemStyle} label="Export" onClick={onExport}>
                  Export
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
  </header>
);
}
