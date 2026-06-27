import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { GeneratedRamp, PortableSurfaceToken } from '@pigmint/core';
import { surfaceHex } from './tokenOptions';
import { getRelativeLuminance } from '../../lib/colorMath';

function pillContrast(hex: string) {
  const light = getRelativeLuminance(hex) > 0.5;
  return {
    fg: light ? '#000' : '#fff',
    pill: light ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)',
  };
}

function Dot({ hex, size = 14 }: { hex?: string; size?: number }) {
  if (!hex) return <span style={{ width: size, height: size, flexShrink: 0 }} />;
  return (
    <div style={{
      width: size, height: size, borderRadius: 3, flexShrink: 0,
      background: hex, border: '1px solid rgba(0,0,0,0.18)',
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
    }} />
  );
}

type Props = {
  surfaceNames: string[];
  surfaces: Record<string, PortableSurfaceToken>;
  rampMap: Map<string, GeneratedRamp>;
  value: string[];
  onChange: (next: string[]) => void;
  variant?: 'default' | 'compact';
  /** Minimum number of selections that must remain. Defaults to 1 (UI mirrors YAML rule). */
  requireMin?: number;
  placeholder?: string;
  title?: string;
};

/**
 * Multi-select for the `surfaces` array on semantic + alpha tokens. The first
 * selection is the primary contrast surface; the rest are additional surfaces
 * the resolver must also satisfy. Mirrors AppSelect's portal-dropdown style so
 * inline rows and modals look consistent.
 */
export function MultiSurfaceSelect({
  surfaceNames, surfaces, rampMap, value, onChange,
  variant = 'default', requireMin = 1, placeholder, title,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0, maxHeight: 320 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const isCompact = variant === 'compact';
  const selected = value.filter((v) => surfaceNames.includes(v));
  const primaryHex = selected[0] ? surfaceHex(surfaces[selected[0]], rampMap) : undefined;

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

  function toggle(name: string) {
    if (selected.includes(name)) {
      if (selected.length <= requireMin) return;
      onChange(selected.filter((s) => s !== name));
    } else {
      onChange([...selected, name]);
    }
  }

  const triggerLabel = selected.length === 0
    ? (placeholder ?? 'select surfaces…')
    : selected.length === 1
      ? selected[0]!
      : `${selected[0]} +${selected.length - 1}`;

  const baseTrigger: React.CSSProperties = isCompact
    ? {
        display: 'flex', alignItems: 'center', gap: 5, width: '100%',
        padding: '3px 6px', fontSize: 12,
        background: 'var(--p-bg)', border: '1px solid var(--p-border)',
        borderRadius: 4, cursor: 'pointer',
        color: 'var(--p-text)', boxSizing: 'border-box',
        minWidth: 0,
      }
    : {
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        padding: '6px 8px', fontSize: 13,
        background: 'var(--p-bg)', border: '1px solid var(--p-border)',
        borderRadius: 6, cursor: 'pointer',
        color: 'var(--p-text)', boxSizing: 'border-box',
        minWidth: 0,
      };

  const colorFill = !isCompact && primaryHex !== undefined;
  const fill = colorFill ? pillContrast(primaryHex!) : undefined;
  const fillStyle: React.CSSProperties | undefined = fill
    ? { background: primaryHex, color: fill.fg }
    : undefined;

  return (
    <div style={{ position: 'relative', minWidth: 0 }}>
      <button
        ref={btnRef}
        type="button"
        title={title ?? (selected.length > 1 ? selected.join(', ') : undefined)}
        onClick={() => setOpen((v) => !v)}
        style={{ ...baseTrigger, ...fillStyle }}
      >
        {!colorFill && <Dot hex={primaryHex} size={isCompact ? 12 : 16} />}
        {colorFill ? (
          <span style={{
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: 6,
            padding: '2px 8px',
            borderRadius: 4,
            background: fill!.pill,
            color: fill!.fg,
            fontFamily: 'monospace',
            fontSize: 12,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
            flex: '0 1 auto',
            textAlign: 'left',
          }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{triggerLabel}</span>
            <span style={{ opacity: 0.75, paddingLeft: 8 }}>{primaryHex}</span>
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
            color: selected.length > 0 ? 'var(--p-text)' : 'var(--p-text-secondary)',
          }}>
            {triggerLabel}
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
          {surfaceNames.length === 0 && (
            <div style={{ padding: '8px 12px', color: 'var(--p-text-secondary)', fontSize: 12 }}>
              No surfaces
            </div>
          )}
          {surfaceNames.map((name, i) => {
            const checked = selected.includes(name);
            const order = checked ? selected.indexOf(name) + 1 : 0;
            const isLastRequired = checked && selected.length <= requireMin;
            const hex = surfaceHex(surfaces[name], rampMap);
            const optFill = hex !== undefined;
            const optContrast = optFill ? pillContrast(hex!) : undefined;
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggle(name)}
                disabled={isLastRequired}
                title={isLastRequired ? 'At least one surface is required' : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', width: '100%', textAlign: 'left',
                  background: optFill ? hex : (checked ? 'var(--p-surface)' : 'transparent'),
                  border: 'none',
                  borderBottom: i < surfaceNames.length - 1 ? '1px solid var(--p-border)' : 'none',
                  cursor: isLastRequired ? 'not-allowed' : 'pointer',
                  color: optContrast?.fg ?? 'var(--p-text)', fontSize: 12,
                  opacity: isLastRequired ? 0.7 : 1,
                }}
              >
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 16, height: 16, flexShrink: 0,
                  border: '1px solid ' + (checked ? 'var(--p-accent, #6366f1)' : (optContrast ? optContrast.fg : 'var(--p-border)')),
                  borderRadius: 3,
                  background: checked ? 'var(--p-accent, #6366f1)' : 'transparent',
                  color: '#fff', fontSize: 9, fontWeight: 700,
                }}>
                  {checked ? (order === 1 ? '★' : order) : ''}
                </span>
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
                    fontWeight: checked ? 600 : 400,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    minWidth: 0,
                    flex: '0 1 auto',
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                    <span style={{ opacity: 0.75, paddingLeft: 8 }}>{hex}</span>
                  </span>
                ) : (
                  <span style={{
                    fontFamily: 'monospace',
                    fontWeight: checked ? 600 : 400,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    minWidth: 0, flex: 1,
                  }}>
                    {name}
                  </span>
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
