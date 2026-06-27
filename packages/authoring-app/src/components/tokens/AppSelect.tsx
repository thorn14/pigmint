import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getRelativeLuminance } from '../../lib/colorMath';

export type AppSelectOption = {
  value: string;
  label: string;
  /** Hex like #RRGGBB. When present, a color dot is shown. */
  hex?: string;
  /** Alpha in [0,1] applied to the dot. */
  alpha?: number;
  /** Optional right-aligned secondary text (e.g. hex, step name). */
  trailing?: string;
  disabled?: boolean;
};

function pillContrast(hex: string) {
  const light = getRelativeLuminance(hex) > 0.5;
  return {
    fg: light ? '#000' : '#fff',
    pill: light ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)',
  };
}

function Dot({ hex, alpha, size = 14 }: { hex?: string; alpha?: number; size?: number }) {
  if (!hex) return <span style={{ width: size, height: size, flexShrink: 0 }} />;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const color = (alpha !== undefined && alpha < 1) ? `rgba(${r},${g},${b},${alpha})` : hex;
  return (
    <div style={{
      width: size, height: size, borderRadius: 3, flexShrink: 0,
      background: color, border: '1px solid rgba(0,0,0,0.18)',
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
    }} />
  );
}

type Props = {
  options: AppSelectOption[];
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** Override trigger style (e.g. compact density vs modal). */
  triggerStyle?: React.CSSProperties;
  variant?: 'default' | 'compact';
  disabled?: boolean;
  title?: string;
};

/**
 * Single-select dropdown with optional per-option color previews. Use in place
 * of native `<select>` whenever the UI benefits from a swatch column or wants
 * consistent styling — native options can't render arbitrary markup.
 *
 * If no option carries a hex the swatch column is dropped, so this doubles as
 * a generic styled select.
 */
export function AppSelect({ options, value, onChange, placeholder, triggerStyle, variant = 'default', disabled, title }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, maxHeight: 320 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const current = options.find((o) => o.value === value);
  const isCompact = variant === 'compact';
  const hasSwatches = options.some((o) => o.hex);

  function reposition() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const margin = 8;
    const desiredMax = 320;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const spaceBelow = vh - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    let top: number;
    let maxHeight: number;
    if (spaceBelow >= 160 || spaceBelow >= spaceAbove) {
      top = rect.bottom + 2;
      maxHeight = Math.min(desiredMax, Math.max(120, spaceBelow));
    } else {
      maxHeight = Math.min(desiredMax, Math.max(120, spaceAbove));
      top = rect.top - maxHeight - 2;
    }
    const left = Math.max(margin, Math.min(rect.left, vw - rect.width - margin));
    setPos({ top, left, width: rect.width, maxHeight });
  }

  useLayoutEffect(() => {
    if (open) reposition();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (
        !dropRef.current?.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onScroll() { reposition(); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const baseTrigger: React.CSSProperties = isCompact
    ? {
        display: 'flex', alignItems: 'center', gap: 5, width: '100%',
        padding: '3px 6px', fontSize: 12,
        background: 'var(--p-bg)', border: '1px solid var(--p-border)',
        borderRadius: 4, cursor: disabled ? 'not-allowed' : 'pointer',
        color: 'var(--p-text)', boxSizing: 'border-box',
        opacity: disabled ? 0.5 : 1,
        minWidth: 0,
      }
    : {
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        padding: '6px 8px', fontSize: 13,
        background: 'var(--p-bg)', border: '1px solid var(--p-border)',
        borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer',
        color: 'var(--p-text)', boxSizing: 'border-box',
        opacity: disabled ? 0.5 : 1,
        minWidth: 0,
      };

  const colorFill = !isCompact && current?.hex !== undefined;
  const fillStyle: React.CSSProperties | undefined = colorFill
    ? (() => {
        const { fg } = pillContrast(current!.hex!);
        return { background: current!.hex, color: fg };
      })()
    : undefined;

  return (
    <div style={{ position: 'relative', minWidth: 0 }}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        title={title}
        onClick={() => !disabled && setOpen((v) => !v)}
        style={{ ...baseTrigger, ...fillStyle, ...triggerStyle }}
      >
        {hasSwatches && !colorFill && (
          <Dot hex={current?.hex} alpha={current?.alpha} size={isCompact ? 12 : 16} />
        )}
        {colorFill ? (
          <span style={{
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: 6,
            padding: '2px 8px',
            borderRadius: 4,
            background: pillContrast(current!.hex!).pill,
            color: pillContrast(current!.hex!).fg,
            fontFamily: 'monospace',
            fontSize: 12,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
            flex: '0 1 auto',
            textAlign: 'left',
          }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{current!.label}</span>
            <span style={{ opacity: 0.75, paddingLeft: 8 }}>{current!.hex}</span>
          </span>
        ) : (
          <span style={{
            fontFamily: 'monospace',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
            flex: 1,
            textAlign: 'left',
            color: current ? 'var(--p-text)' : 'var(--p-text-secondary)',
          }}>
            {current?.label ?? placeholder ?? '—'}
          </span>
        )}
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="currentColor"
          aria-hidden="true"
          style={{ flexShrink: 0, opacity: 0.6, marginLeft: 'auto' }}
        >
          <path d="M0 0h10L5 6z" />
        </svg>
      </button>

      {open && createPortal(
        <div
          ref={dropRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            minWidth: pos.width,
            maxWidth: 'calc(100vw - 16px)',
            background: 'var(--p-bg)',
            border: '1px solid var(--p-border)',
            borderRadius: 6,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            zIndex: 300,
            maxHeight: pos.maxHeight,
            overflowY: 'auto',
          }}
        >
          {options.length === 0 && (
            <div style={{ padding: '8px 12px', color: 'var(--p-text-secondary)', fontSize: 12 }}>
              No options
            </div>
          )}
          {options.map((opt, i) => {
            const active = opt.value === value;
            const isDisabled = opt.disabled;
            const optFill = opt.hex !== undefined;
            const optContrast = optFill ? pillContrast(opt.hex!) : undefined;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={isDisabled}
                onClick={() => { if (!isDisabled) { onChange(opt.value); setOpen(false); } }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', width: '100%', textAlign: 'left',
                  background: optFill ? opt.hex : (active ? 'var(--p-surface)' : 'transparent'),
                  border: 'none',
                  borderBottom: i < options.length - 1 ? '1px solid var(--p-border)' : 'none',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  color: optContrast?.fg ?? 'var(--p-text)', fontSize: 12,
                  opacity: isDisabled ? 0.45 : 1,
                }}
              >
                {hasSwatches && !optFill && <Dot hex={opt.hex} alpha={opt.alpha} size={18} />}
                {optFill ? (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'baseline',
                    gap: 6,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: optContrast!.pill,
                    color: optContrast!.fg,
                    fontFamily: 'monospace',
                    fontSize: 12,
                    fontWeight: active ? 600 : 400,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                    flex: '0 1 auto',
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt.label}</span>
                    <span style={{ opacity: 0.75, paddingLeft: 8 }}>{opt.trailing ?? opt.hex}</span>
                  </span>
                ) : (
                  <>
                    <span style={{
                      fontFamily: 'monospace',
                      fontWeight: active ? 600 : 400,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      minWidth: 0, flex: 1,
                    }}>
                      {opt.label}
                    </span>
                    {opt.trailing && (
                      <span style={{
                        fontSize: 10, color: 'var(--p-text-secondary)',
                        fontFamily: 'monospace', marginLeft: 'auto', flexShrink: 0,
                      }}>
                        {opt.trailing}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}
