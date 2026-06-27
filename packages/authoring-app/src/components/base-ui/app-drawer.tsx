import { Dialog } from '@base-ui/react/dialog';
import { useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';

// No dim: the drawer overlays its own popup but the page behind stays fully
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
  right: 4,
  bottom: 4,
  width: 'min(480px, calc(100vw - 8px))',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--p-bg)',
  border: '1px solid var(--p-border-strong)',
  borderRadius: 10,
  boxShadow: '0 8px 32px rgba(0,0,0,0.32)',
  overflow: 'hidden',
  minHeight: 0,
  minWidth: 0,
};

type Props = {
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
};

/**
 * Right-anchored, full-height drawer shell using Base UI Dialog. Slides in via
 * the `.app-drawer-popup` data-state CSS in index.css. Parent typically mounts
 * this only while open and uses `onOpenChange(false)` to close (Escape, backdrop).
 */
export function AppDrawer({ children, onOpenChange }: Props) {
  const popupRef = useRef<HTMLDivElement>(null);
  return (
    <Dialog.Root open onOpenChange={onOpenChange} modal>
      <Dialog.Portal>
        <Dialog.Backdrop className="app-dialog-backdrop" style={backdropStyle} />
        <Dialog.Viewport style={viewportStyle}>
          <Dialog.Popup
            ref={popupRef}
            tabIndex={-1}
            className="app-drawer-popup focus-visible-ring"
            style={popupStyle}
            initialFocus={popupRef}
            finalFocus={true}
          >
            {children}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
