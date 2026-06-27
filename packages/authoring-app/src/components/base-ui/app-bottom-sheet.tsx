import { Dialog } from '@base-ui/react/dialog';
import { useRef } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';

/** Drag distance (px) past which releasing the handle dismisses the sheet. */
const DISMISS_THRESHOLD = 100;

// No dim: the sheet covers the bottom of the page but leaves the rest fully
// visible so live edits land in view. Click-outside-to-close still works.
const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  minHeight: '100dvh',
  zIndex: 50,
  background: 'transparent',
  touchAction: 'none',
};

const viewportStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  pointerEvents: 'none' as const,
  overscrollBehavior: 'contain',
};

const popupStyle: CSSProperties = {
  pointerEvents: 'auto' as const,
  position: 'fixed',
  top: 4,
  left: 4,
  right: 4,
  bottom: 4,
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--p-bg)',
  borderRadius: 10,
  border: '1px solid var(--p-border-strong)',
  boxShadow: '0 -8px 32px rgba(0,0,0,0.32)',
  minHeight: 0,
  minWidth: 0,
  overflow: 'hidden',
};

const handleGrabStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '10px 0 6px',
  flexShrink: 0,
  cursor: 'grab',
  touchAction: 'none',
};

const handleStyle: CSSProperties = {
  width: 40,
  height: 4,
  borderRadius: 2,
  background: 'var(--p-border)',
};

type Props = {
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
};

/**
 * Bottom-anchored sheet using Base UI Dialog. Mounted only while open by the
 * parent — mirrors AppDrawer's pattern. Slides up via the `.app-bottom-sheet-popup`
 * data-state CSS in index.css. No drag-to-dismiss; close via backdrop tap, Escape,
 * or an explicit close button.
 */
export function AppBottomSheet({ children, onOpenChange }: Props) {
  const popupRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragDelta = useRef(0);

  // Drag the sheet by its handle and release past the threshold to dismiss. We
  // drive the transform inline (transition off) while dragging so it tracks the
  // finger, then hand back to the CSS open/closed transition on release.
  function setOffset(y: number, animate: boolean) {
    const el = popupRef.current;
    if (!el) return;
    el.style.transition = animate ? '' : 'none';
    el.style.transform = y <= 0 ? '' : `translateY(${y}px)`;
  }

  function onHandleDown(e: ReactPointerEvent<HTMLDivElement>) {
    dragStartY.current = e.clientY;
    dragDelta.current = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onHandleMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (dragStartY.current === null) return;
    const delta = Math.max(0, e.clientY - dragStartY.current);
    dragDelta.current = delta;
    setOffset(delta, false);
  }

  function onHandleUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (dragStartY.current === null) return;
    const dismissed = dragDelta.current > DISMISS_THRESHOLD;
    dragStartY.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    // Either way restore CSS control; on dismiss the closed data-state animates out.
    setOffset(0, true);
    if (dismissed) onOpenChange(false);
  }

  return (
    <Dialog.Root open onOpenChange={onOpenChange} modal>
      <Dialog.Portal>
        <Dialog.Backdrop className="app-dialog-backdrop" style={backdropStyle} />
        <Dialog.Viewport style={viewportStyle}>
          <Dialog.Popup
            ref={popupRef}
            tabIndex={-1}
            className="app-bottom-sheet-popup focus-visible-ring"
            style={popupStyle}
            initialFocus={popupRef}
            finalFocus={true}
          >
            <div
              style={handleGrabStyle}
              onPointerDown={onHandleDown}
              onPointerMove={onHandleMove}
              onPointerUp={onHandleUp}
              onPointerCancel={onHandleUp}
              role="button"
              tabIndex={-1}
              aria-label="Drag down to dismiss"
            >
              <div style={handleStyle} aria-hidden="true" />
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {children}
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
