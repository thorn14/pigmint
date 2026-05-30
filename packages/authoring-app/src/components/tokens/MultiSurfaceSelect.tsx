import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { GeneratedRamp, PortableSurfaceToken } from '@pigmint/core';
import { surfaceHex } from './tokenOptions';

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
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const isCompact = variant === 'compact';
  const selected = value.filter((v) => surfaceNames.includes(v));
  const primaryHex = selected[0] ? surfaceHex(surfaces[selected[0]], rampMap) : undefined;

  function reposition() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 2, left: rect.left, width: rect.width });
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

  return (
    <div style={{ position: 'relative', minWidth: 0 }}>
      <button
        ref={btnRef}
        type="button"
        title={title ?? (selected.length > 1 ? selected.join(', ') : undefined)}
        onClick={() => setOpen((v) => !v)}
        style={baseTrigger}
      >
        <Dot hex={primaryHex} size={isCompact ? 12 : 16} />
        <span style={{
          fontFamily: 'monospace',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
          flex: 1,
          textAlign: 'left',
          color: selected.length > 0 ? 'var(--p-text)' : 'var(--p-text-tertiary)',
        }}>
          {triggerLabel}
        </span>
        <span style={{ opacity: 0.4, fontSize: 9, flexShrink: 0 }}>▾</span>
      </button>

      {open && createPortal(
        <div
          ref={dropRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            minWidth: pos.width,
            background: 'var(--p-bg)',
            border: '1px solid var(--p-border)',
            borderRadius: 6,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            zIndex: 300,
            maxHeight: 320,
            overflowY: 'auto',
          }}
        >
          {surfaceNames.length === 0 && (
            <div style={{ padding: '8px 12px', color: 'var(--p-text-tertiary)', fontSize: 12 }}>
              No surfaces
            </div>
          )}
          {surfaceNames.length > 0 && (
            <div style={{
              padding: '6px 10px',
              fontSize: 10,
              color: 'var(--p-text-tertiary)',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.05em',
              borderBottom: '1px solid var(--p-border)',
            }}>
              First selected = primary contrast surface
            </div>
          )}
          {surfaceNames.map((name, i) => {
            const checked = selected.includes(name);
            const order = checked ? selected.indexOf(name) + 1 : 0;
            const isLastRequired = checked && selected.length <= requireMin;
            const hex = surfaceHex(surfaces[name], rampMap);
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
                  background: checked ? 'var(--p-surface)' : 'transparent',
                  border: 'none',
                  borderBottom: i < surfaceNames.length - 1 ? '1px solid var(--p-border)' : 'none',
                  cursor: isLastRequired ? 'not-allowed' : 'pointer',
                  color: 'var(--p-text)', fontSize: 12,
                  opacity: isLastRequired ? 0.7 : 1,
                }}
              >
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 16, height: 16, flexShrink: 0,
                  border: '1px solid ' + (checked ? 'var(--p-accent, #6366f1)' : 'var(--p-border)'),
                  borderRadius: 3,
                  background: checked ? 'var(--p-accent, #6366f1)' : 'transparent',
                  color: '#fff', fontSize: 9, fontWeight: 700,
                }}>
                  {checked ? (order === 1 ? '★' : order) : ''}
                </span>
                <Dot hex={hex} size={18} />
                <span style={{
                  fontFamily: 'monospace',
                  fontWeight: checked ? 600 : 400,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  minWidth: 0, flex: 1,
                }}>
                  {name}
                </span>
                {hex && (
                  <span style={{
                    fontSize: 10, color: 'var(--p-text-secondary)',
                    fontFamily: 'monospace', marginLeft: 'auto', flexShrink: 0,
                  }}>
                    {hex}
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
