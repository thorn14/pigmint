import { Dialog } from '@base-ui/react/dialog';
import type { CSSProperties, ReactNode } from 'react';

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  minHeight: '100dvh',
  zIndex: 50,
  background: 'rgba(0,0,0,0.5)',
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
  top: 0,
  right: 0,
  bottom: 0,
  width: 'min(480px, 100vw)',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--p-bg)',
  borderLeft: '1px solid var(--p-border)',
  boxShadow: '-8px 0 32px rgba(0,0,0,0.2)',
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
  return (
    <Dialog.Root open onOpenChange={onOpenChange} modal>
      <Dialog.Portal>
        <Dialog.Backdrop className="app-dialog-backdrop" style={backdropStyle} />
        <Dialog.Viewport style={viewportStyle}>
          <Dialog.Popup
            className="app-drawer-popup focus-visible-ring"
            style={popupStyle}
            initialFocus={true}
            finalFocus={true}
          >
            {children}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
