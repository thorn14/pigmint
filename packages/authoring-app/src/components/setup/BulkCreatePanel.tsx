import { useMemo, useRef, useState } from 'react';
import { usePaletteStore } from '../../store/paletteStore';
import { hexToOklch, oklchToHex } from '../../lib/colorMath';
import { LIGHTNESS_PRESET_OPTIONS, type LightnessPreset } from '../../constants/stepPresets';
import type { StepNamingPreset } from '../../types/palette';

function hueToName(h: number): string {
  const hue = ((h % 360) + 360) % 360;
  if (hue < 15 || hue >= 345) return 'Red';
  if (hue < 45) return 'Orange';
  if (hue < 65) return 'Amber';
  if (hue < 80) return 'Yellow';
  if (hue < 110) return 'Lime';
  if (hue < 150) return 'Green';
  if (hue < 190) return 'Teal';
  if (hue < 225) return 'Cyan';
  if (hue < 255) return 'Blue';
  if (hue < 280) return 'Indigo';
  if (hue < 315) return 'Violet';
  if (hue < 345) return 'Rose';
  return 'Red';
}

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--p-text-secondary)',
  marginBottom: 0,
};

const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: 'var(--p-text-secondary)',
  marginBottom: 4,
};

const inputBase: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  fontSize: 13,
  background: 'var(--p-bg-subtle)',
  border: '1px solid var(--p-border)',
  borderRadius: 6,
  color: 'var(--p-text)',
  boxSizing: 'border-box',
};

const stepBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 16,
  fontWeight: 500,
  background: 'var(--p-bg-subtle)',
  border: '1px solid var(--p-border)',
  borderRadius: 6,
  color: 'var(--p-text)',
  cursor: 'pointer',
  lineHeight: 1,
};

export function BulkCreatePanel() {
  const bulkCreateScales = usePaletteStore((s) => s.bulkCreateScales);

  const [baseHex, setBaseHex] = useState('#6366f1');
  const [hexDraft, setHexDraft] = useState('#6366f1');
  const hexFocused = useRef(false);

  const HEX_RE = /^#[0-9a-fA-F]{6}$/;

  function commitHex() {
    hexFocused.current = false;
    if (HEX_RE.test(hexDraft)) setBaseHex(hexDraft);
    else setHexDraft(baseHex);
  }

  const [count, setCount] = useState(6);
  const [namingPreset, setNamingPreset] = useState<StepNamingPreset>('tailwind');
  const [lightnessPreset, setLightnessPreset] = useState<LightnessPreset>('tailwind');

  // degreesSep is always derived from count
  const degreesSep = 360 / count;

  // When the user types into the degrees field, we derive count from it
  function handleDegreesChange(raw: string) {
    const d = parseFloat(raw);
    if (!isFinite(d) || d <= 0) return;
    setCount(Math.max(1, Math.min(24, Math.round(360 / d))));
  }

  function adjustCount(delta: number) {
    setCount((c) => Math.max(1, Math.min(24, c + delta)));
  }

  const scaleColors = useMemo(() => {
    try {
      const base = hexToOklch(baseHex);
      return Array.from({ length: count }, (_, i) => {
        const hue = ((base.h + i * degreesSep) % 360 + 360) % 360;
        return { hex: oklchToHex({ ...base, h: hue }), name: hueToName(hue) };
      });
    } catch {
      return [];
    }
  }, [baseHex, count, degreesSep]);

  function handleCreate() {
    if (!scaleColors.length) return;
    bulkCreateScales(
      scaleColors.map(({ hex, name }) => ({ sourceHex: hex, name })),
      namingPreset,
      lightnessPreset,
    );
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        overflow: 'auto',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 540,
          background: 'var(--p-bg)',
          border: '1px solid var(--p-border)',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--p-border)' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--p-text)' }}>
            Create your palette
          </h2>
          <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--p-text-secondary)', lineHeight: 1.5 }}>
            Pick a base color and spread hues evenly around the wheel.
          </p>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Base color */}
          <div>
            <p style={sectionLabel}>Base color</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <input
                type="color"
                value={baseHex}
                onChange={(e) => {
                  setBaseHex(e.target.value);
                  if (!hexFocused.current) setHexDraft(e.target.value);
                }}
                aria-label="Base color picker"
                style={{
                  width: 36,
                  height: 36,
                  padding: 0,
                  border: '1px solid var(--p-border)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: 'none',
                  flexShrink: 0,
                }}
              />
              <input
                name="base-hex"
                type="text"
                value={hexDraft}
                onFocus={() => { hexFocused.current = true; }}
                onChange={(e) => setHexDraft(e.target.value)}
                onBlur={commitHex}
                onKeyDown={(e) => { if (e.key === 'Enter') commitHex(); }}
                style={{ ...inputBase, fontFamily: 'monospace', flex: 1 }}
                className="focus-visible-ring"
                aria-label="Base color hex value"
              />
            </div>
          </div>

          {/* Two-column: hue spread + steps */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Hue spread */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={sectionLabel}>Hue spread</p>
              <div>
                <label htmlFor="bulk-scale-count" style={fieldLabel}>Scales</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button style={stepBtn} onClick={() => adjustCount(-1)} className="focus-visible-ring" aria-label="Decrease scale count">−</button>
                  <input
                    id="bulk-scale-count"
                    name="scale-count"
                    type="number"
                    min={1}
                    max={24}
                    value={count}
                    onChange={(e) => setCount(Math.max(1, Math.min(24, parseInt(e.target.value) || 1)))}
                    style={{ ...inputBase, width: 52, textAlign: 'center', flex: 'none' }}
                    className="focus-visible-ring"
                  />
                  <button style={stepBtn} onClick={() => adjustCount(1)} className="focus-visible-ring" aria-label="Increase scale count">+</button>
                </div>
              </div>
              <div>
                <label htmlFor="bulk-degrees-between" style={fieldLabel}>Degrees between</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    id="bulk-degrees-between"
                    name="degrees-between"
                    type="number"
                    min={1}
                    max={360}
                    step={0.1}
                    value={parseFloat(degreesSep.toFixed(1))}
                    onChange={(e) => handleDegreesChange(e.target.value)}
                    style={{ ...inputBase, width: 72, fontFamily: 'monospace', flex: 'none' }}
                    className="focus-visible-ring"
                  />
                  <span style={{ fontSize: 12, color: 'var(--p-text-secondary)' }}>°</span>
                </div>
              </div>
            </div>

            {/* Steps config */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={sectionLabel}>Steps</p>
              <div>
                <label htmlFor="bulk-step-naming" style={fieldLabel}>Naming</label>
                <select
                  id="bulk-step-naming"
                  name="bulk-step-naming"
                  value={namingPreset}
                  onChange={(e) => setNamingPreset(e.target.value as StepNamingPreset)}
                  style={{ ...inputBase, cursor: 'pointer' }}
                  className="focus-visible-ring"
                >
                  <option value="tailwind">Tailwind (50–950)</option>
                  <option value="numeric">Numeric (1–11)</option>
                </select>
              </div>
              <div>
                <label htmlFor="bulk-lightness-preset" style={fieldLabel}>Lightness curve</label>
                <select
                  id="bulk-lightness-preset"
                  name="bulk-lightness-preset"
                  value={lightnessPreset}
                  onChange={(e) => setLightnessPreset(e.target.value as LightnessPreset)}
                  style={{ ...inputBase, cursor: 'pointer' }}
                  className="focus-visible-ring"
                >
                  {LIGHTNESS_PRESET_OPTIONS.filter((p) => p.value !== 'custom').map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Preview */}
          {scaleColors.length > 0 && (
            <div>
              <p style={{ ...sectionLabel, marginBottom: 8 }}>
                {count} scale{count !== 1 ? 's' : ''} preview
              </p>
              <div style={{ display: 'flex', gap: 3 }}>
                {scaleColors.map(({ hex, name }, i) => (
                  <div key={i} style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        height: 44,
                        borderRadius: 5,
                        backgroundColor: hex,
                        border: '1px solid rgba(0,0,0,0.07)',
                      }}
                    />
                    {count <= 12 && (
                      <p
                        style={{
                          margin: '4px 0 0',
                          fontSize: 10,
                          color: 'var(--p-text-secondary)',
                          textAlign: 'center',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {name}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer / create button */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--p-border)' }}>
          <button
            onClick={handleCreate}
            disabled={scaleColors.length === 0}
            className="focus-visible-ring"
            style={{
              width: '100%',
              padding: '10px',
              fontSize: 14,
              fontWeight: 600,
              background: scaleColors.length ? 'var(--p-accent)' : 'var(--p-bg-subtle)',
              border: 'none',
              borderRadius: 8,
              color: scaleColors.length ? '#fff' : 'var(--p-text-tertiary)',
              cursor: scaleColors.length ? 'pointer' : 'default',
            }}
          >
            Create {count} scale{count !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
