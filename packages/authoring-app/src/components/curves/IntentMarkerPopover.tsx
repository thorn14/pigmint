import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { OklchColor, ResolvedToken } from '@pigmint/core';

const MARGIN = 8;
const PANEL_MAX_W = 360;

function formatOklch(o: OklchColor): string {
  const h = ((o.h % 360) + 360) % 360;
  const a = o.alpha;
  if (a != null && a < 1) {
    return `oklch(${o.l.toFixed(4)} ${o.c.toFixed(4)} ${h.toFixed(2)} / ${a.toFixed(3)})`;
  }
  return `oklch(${o.l.toFixed(4)} ${o.c.toFixed(4)} ${h.toFixed(2)})`;
}

export type IntentMarkerDetail = {
  /** Stable key for the grouped stop */
  key: string;
  rect: DOMRect;
  hex: string;
  oklch: OklchColor;
  stepLabel: string | null;
  tokens: ResolvedToken[];
};

type IntentMarkerPopoverProps = {
  detail: IntentMarkerDetail | null;
  onClose: () => void;
  rampName: string;
};

/**
 * Portaled popover for gradient nodes: swatch, hex/OKLCH, and token paths. Uses
 * the same `data-theme` on documentElement as the rest of the app.
 */
export function IntentMarkerPopover({ detail, onClose, rampName }: IntentMarkerPopoverProps) {
  const [pos, setPos] = useState<{ top: number; left: number; maxH: number; maxW: number } | null>(null);
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);

  const updatePos = useCallback(() => {
    if (!detail) {
      setPos(null);
      return;
    }
    const r = detail.rect;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const maxW = Math.min(PANEL_MAX_W, vw - 2 * MARGIN);
    const maxH = Math.min(Math.floor(vh * 0.5), 420);
    let top = r.bottom + 6;
    if (top + maxH > vh - 8) {
      top = r.top - 6 - maxH;
    }
    if (top < 8) top = 8;
    const left = Math.max(MARGIN, Math.min(r.left, vw - MARGIN - maxW));
    setPos({ top, left, maxH, maxW });
  }, [detail]);

  useLayoutEffect(() => {
    updatePos();
  }, [updatePos, detail?.key]);

  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDoc = (e: MouseEvent) => {
      const el = e.target;
      if (!(el instanceof Node)) return;
      if (panelRef.current?.contains(el)) return;
      if (el instanceof Element && el.closest('[data-intent-marker-hit]')) return;
      onClose();
    };
    const onReposition = () => updatePos();
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDoc);
    window.addEventListener('scroll', onReposition, true);
    window.addEventListener('resize', onReposition);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDoc);
      window.removeEventListener('scroll', onReposition, true);
      window.removeEventListener('resize', onReposition);
    };
  }, [detail, onClose, updatePos]);

  if (!detail || !pos) return null;

  const portal =
    typeof document !== 'undefined' &&
    createPortal(
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-label={`${rampName} color stop details`}
        style={{
          position: 'fixed',
          zIndex: 20_000,
          top: pos.top,
          left: pos.left,
          width: pos.maxW,
          maxHeight: pos.maxH,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--p-bg)',
          color: 'var(--p-text)',
          border: '1px solid var(--p-border)',
          borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 12,
            padding: 12,
            borderBottom: '1px solid var(--p-border)',
            background: 'var(--p-bg-subtle)',
            flexShrink: 0,
            alignItems: 'flex-start',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 6,
              background: detail.hex,
              border: '1px solid var(--p-border)',
              flexShrink: 0,
            }}
            aria-hidden
          />
          <div style={{ minWidth: 0, fontSize: 11, lineHeight: 1.4, flex: 1, fontFamily: 'ui-monospace, monospace' }}>
            {detail.stepLabel && (
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--p-text)', marginBottom: 4 }}>{detail.stepLabel}</div>
            )}
            <div style={{ color: 'var(--p-text-secondary)', wordBreak: 'break-all' }}>HEX: {detail.hex}</div>
            <div style={{ color: 'var(--p-text-secondary)', wordBreak: 'break-all' }}>OKLCH: {formatOklch(detail.oklch)}</div>
          </div>
        </div>
        <div
          style={{
            padding: '8px 12px 12px',
            overflow: 'auto',
            minHeight: 0,
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--p-text-tertiary)',
              marginBottom: 6,
            }}
          >
            Tokens on this color ({detail.tokens.length})
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.5, color: 'var(--p-text)' }}>
            {detail.tokens.map((t) => (
              <li key={t.path} style={{ marginBottom: 2 }}>
                <code style={{ fontSize: 11, color: 'var(--p-text-secondary)' }}>{t.path}</code>
              </li>
            ))}
          </ul>
        </div>
      </div>,
      document.body,
    );

  return portal;
}
