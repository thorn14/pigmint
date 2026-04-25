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
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  overscrollBehavior: 'contain',
  pointerEvents: 'none' as const,
};

type Props = {
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
};

/**
 * Centered modal shell using Base UI Dialog. Parent typically mounts this only
 * while `open` and uses `onOpenChange(false)` to close (Escape, backdrop, etc.).
 */
export function AppDialog({ children, onOpenChange }: Props) {
  return (
    <Dialog.Root open onOpenChange={onOpenChange} modal>
      <Dialog.Portal>
        <Dialog.Backdrop className="app-dialog-backdrop" style={backdropStyle} />
        <Dialog.Viewport style={viewportStyle}>
          <Dialog.Popup
            className="focus-visible-ring"
            style={{
              pointerEvents: 'auto' as const,
              maxWidth: '100%',
              maxHeight: '100%',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              minWidth: 0,
            }}
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
