import { useMemo } from 'react';
import { Popover } from '@base-ui/react/popover';
import type { OklchColor, ResolvedToken } from '@pigmint/core';

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
  /** Lets parent cancel a delayed close when the pointer moves from the marker into the portaled popover. */
  onPopoverPointerEnter?: () => void;
  onPopoverPointerLeave?: () => void;
};

/**
 * Popover for gradient nodes: swatch, hex/OKLCH, and token paths (Base UI + virtual anchor from hit rect).
 */
export function IntentMarkerPopover({
  detail,
  onClose,
  rampName,
  onPopoverPointerEnter,
  onPopoverPointerLeave,
}: IntentMarkerPopoverProps) {
  const virtualAnchor = useMemo(() => {
    if (!detail) return null;
    const { rect } = detail;
    return {
      getBoundingClientRect: () => rect,
      getClientRects: () => [rect] as unknown as DOMRectList,
    };
  }, [detail]);

  if (!detail || !virtualAnchor) return null;

  return (
    <Popover.Root
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      modal={false}
    >
      <Popover.Portal>
        <Popover.Positioner
          anchor={virtualAnchor}
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={8}
          style={{ zIndex: 20_000, maxWidth: PANEL_MAX_W, width: 'max-content' as const }}
        >
          <Popover.Popup
            data-intent-marker-popover=""
            className="focus-visible-ring"
            onPointerEnter={() => onPopoverPointerEnter?.()}
            onPointerLeave={() => onPopoverPointerLeave?.()}
            style={{
              width: PANEL_MAX_W,
              maxWidth: PANEL_MAX_W,
              maxHeight: 'min(50vh, 420px)',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--p-bg)',
              color: 'var(--p-text)',
              border: '1px solid var(--p-border)',
              borderRadius: 8,
              boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)',
              overflow: 'hidden',
            }}
            aria-label={`${rampName} color stop details`}
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
                aria-hidden="true"
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
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
