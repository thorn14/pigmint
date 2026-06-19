import { Dialog } from '@base-ui/react/dialog';
import { useRef } from 'react';
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
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--p-bg)',
  borderTopLeftRadius: 12,
  borderTopRightRadius: 12,
  borderTop: '1px solid var(--p-border)',
  boxShadow: '0 -8px 32px rgba(0,0,0,0.25)',
  maxHeight: '75dvh',
  minHeight: 0,
  minWidth: 0,
  overflow: 'hidden',
};

const handleStyle: CSSProperties = {
  width: 40,
  height: 4,
  borderRadius: 2,
  background: 'var(--p-border)',
  margin: '8px auto 4px',
  flexShrink: 0,
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
            <div style={handleStyle} aria-hidden="true" />
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {children}
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
