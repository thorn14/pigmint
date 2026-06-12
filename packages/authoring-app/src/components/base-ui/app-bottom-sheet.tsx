import { Drawer } from 'vaul';
import type { CSSProperties, ReactNode } from 'react';

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  background: 'rgba(0,0,0,0.5)',
};

const contentStyle: CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 50,
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--p-bg)',
  borderTopLeftRadius: 12,
  borderTopRightRadius: 12,
  borderTop: '1px solid var(--p-border)',
  boxShadow: '0 -8px 32px rgba(0,0,0,0.25)',
  outline: 'none',
  maxHeight: '75dvh',
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
 * Bottom-anchored sheet built on vaul. Mounted only while open by the parent,
 * mirroring AppDrawer's pattern. Use ResponsivePanel to swap between this and
 * AppDrawer based on viewport width.
 */
export function AppBottomSheet({ children, onOpenChange }: Props) {
  return (
    <Drawer.Root open onOpenChange={onOpenChange} handleOnly modal={false}>
      <Drawer.Portal>
        <Drawer.Overlay style={overlayStyle} />
        <Drawer.Content
          style={contentStyle}
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Drawer.Handle style={handleStyle} />
          <Drawer.Title style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 }}>
            Panel
          </Drawer.Title>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
