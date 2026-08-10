import { useState, useRef } from 'react';
import { Menu } from '@base-ui/react/menu';
import { usePaletteStore } from '../../store/paletteStore';
import { useIntentStore } from '../../store/intentStore';
import { AppStringSelect, AppToolbarSegmented } from '../base-ui';
import { ManagePalettesModal } from '../palette/ManagePalettesModal';
import { ColorWheelIcon } from '../icons/ColorWheelIcon';
import { useIsNarrow } from '../../hooks/useViewportWidth';
import type { GamutTarget } from '../../types/palette';

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
        leadingIcon={<ColorWheelIcon size={16} />}
        style={{
          width: 170,
          maxWidth: 210,
          flexShrink: 0,
          height: 30,
          padding: '0 8px',
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
  onPreview: () => void;
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  theme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  targetGamut: GamutTarget;
  onTargetGamutChange: (gamut: GamutTarget) => void;
}

const menuItemStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 12,
  cursor: 'pointer',
  outline: 'none',
};

const menuSeparatorStyle: React.CSSProperties = {
  margin: '4px 0',
  height: 1,
  background: 'var(--p-border)',
  border: 'none',
};

const groupLabelStyle: React.CSSProperties = {
  padding: '6px 12px 2px',
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--p-text-secondary)',
};

const hintStyle: React.CSSProperties = {
  margin: 0,
  padding: '2px 12px 6px',
  fontSize: 10,
  lineHeight: 1.4,
  color: 'var(--p-text-secondary)',
  maxWidth: 240,
};

const radioItemStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: 12,
  cursor: 'pointer',
  outline: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

function MenuRadioGroup<V extends string>({
  label,
  value,
  onValueChange,
  options,
  hint,
}: {
  label: string;
  value: V;
  onValueChange: (v: V) => void;
  options: readonly { value: V; label: string }[];
  hint?: string;
}) {
  return (
    <Menu.Group>
      <Menu.GroupLabel style={groupLabelStyle}>{label}</Menu.GroupLabel>
      <Menu.RadioGroup value={value} onValueChange={(v) => onValueChange(v as V)}>
        {options.map((o) => (
          <Menu.RadioItem
            key={o.value}
            value={o.value}
            className="app-menu-item focus-visible-ring"
            style={radioItemStyle}
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
      {hint && (
        <p style={hintStyle}>{hint}</p>
      )}
    </Menu.Group>
  );
}

function OverflowMenu({
  theme,
  onThemeChange,
  targetGamut,
  onTargetGamutChange,
  onSave,
  onPreview,
  onImport,
  onExport,
  saveStatus,
}: {
  theme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
  targetGamut: GamutTarget;
  onTargetGamutChange: (gamut: GamutTarget) => void;
  onSave: () => void;
  onPreview: () => void;
  onImport: () => void;
  onExport: () => void;
  saveStatus: Props['saveStatus'];
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
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
    <Menu.Root modal={false}>
      <Menu.Trigger
        ref={triggerRef}
        className="focus-visible-ring"
        aria-label="View and save options"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 34,
          height: 30,
          background: 'var(--p-bg)',
          border: '1px solid var(--p-border)',
          borderRadius: 6,
          color: 'var(--p-text)',
          cursor: 'pointer',
          flexShrink: 0,
          boxSizing: 'border-box',
        }}
      >
        <svg width="16" height="4" viewBox="0 0 16 4" fill="currentColor" aria-hidden="true">
          <circle cx="2" cy="2" r="1.6" />
          <circle cx="8" cy="2" r="1.6" />
          <circle cx="14" cy="2" r="1.6" />
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
            aria-label="View and save options"
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
            <MenuRadioGroup
              label="Theme"
              value={theme}
              onValueChange={(v) => onThemeChange(v as AppTheme)}
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
            <Menu.Separator style={menuSeparatorStyle} />
            <MenuRadioGroup
              label="Resolver"
              value={resolverMode}
              onValueChange={(v) => setResolverMode(v === 'continuous' ? 'continuous' : 'stepped')}
              options={[
                { value: 'stepped', label: 'Stepped' },
                { value: 'continuous', label: 'Continuous' },
              ]}
            />
            <Menu.Separator style={menuSeparatorStyle} />
            <MenuRadioGroup
              label="Contrast"
              value={contrastMode}
              onValueChange={(v) => setEngineCompliance(v === 'apca' ? 'apca' : 'wcag21')}
              options={[
                { value: 'wcag', label: 'WCAG 2.1' },
                { value: 'apca', label: 'APCA' },
              ]}
            />
            <Menu.Separator style={menuSeparatorStyle} />
            <MenuRadioGroup
              label="Gamut"
              value={targetGamut}
              onValueChange={(v) => onTargetGamutChange(v === 'srgb' ? 'srgb' : 'p3')}
              options={[
                { value: 'p3', label: 'Display P3' },
                { value: 'srgb', label: 'sRGB only' },
              ]}
              hint={
                targetGamut === 'srgb'
                  ? 'Ramps are clamped to sRGB. No Display P3 steps are generated, shown, or exported.'
                  : 'Steps may reach into Display P3, alongside an sRGB hex fallback.'
              }
            />
            <Menu.Separator style={menuSeparatorStyle} />
            <Menu.Item
              className="app-menu-item focus-visible-ring"
              style={{
                ...menuItemStyle,
                color: saveStatus === 'error' ? 'var(--p-danger)' : saveStatus === 'saved' ? 'var(--p-success)' : 'var(--p-text)',
              }}
              disabled={saveStatus === 'saving'}
              label="Save"
              onClick={onSave}
            >
              {saveLabel}
            </Menu.Item>
            <Menu.Item className="app-menu-item focus-visible-ring" style={menuItemStyle} label="Preview" onClick={onPreview}>
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <span>Preview</span>
                <span style={{ fontSize: 11, color: 'var(--p-text-secondary)', fontFamily: 'monospace' }}>(p)</span>
              </span>
            </Menu.Item>
            <Menu.Item className="app-menu-item focus-visible-ring" style={menuItemStyle} label="Import" onClick={onImport}>
              Import
            </Menu.Item>
            <Menu.Item className="app-menu-item focus-visible-ring" style={menuItemStyle} label="Export" onClick={onExport}>
              Export
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function TopBar({ onExport, onImport, onSave, onPreview, mode, onModeChange, theme, onThemeChange, saveStatus, targetGamut, onTargetGamutChange }: Props) {
  const narrow = useIsNarrow();
  return (
    <header
      style={{
        height: 44,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 6px',
        margin: '4px 4px 0',
        background: 'var(--p-bg-glass)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid var(--p-border)',
        borderRadius: 10,
        flexShrink: 0,
        overflow: 'visible',
      }}
    >
      <PaletteSelector />

      <div style={{ flex: 1 }} />

      {narrow ? (
        <AppStringSelect
          aria-label="App mode"
          id="app-mode-select"
          name="app-mode-select"
          value={mode}
          onValueChange={(v) => onModeChange(v as AppMode)}
          size="compact"
          className="focus-visible-ring"
          style={{
            height: 30,
            padding: '0 12px',
            borderRadius: 6,
            color: 'var(--p-text)',
            fontSize: 12,
            fontFamily: 'inherit',
          }}
          options={[
            { value: 'primitives', label: 'Primitives' },
            { value: 'tokens', label: 'Tokens' },
          ]}
        />
      ) : (
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
      )}

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

      <OverflowMenu
        theme={theme}
        onThemeChange={onThemeChange}
        targetGamut={targetGamut}
        onTargetGamutChange={onTargetGamutChange}
        onSave={onSave}
        onPreview={onPreview}
        onImport={onImport}
        onExport={onExport}
        saveStatus={saveStatus}
      />
    </header>
  );
}
