import type { ReactNode } from 'react';
import { useIsNarrow } from '../../hooks/useViewportWidth';
import { AppDrawer } from './app-drawer';
import { AppBottomSheet } from './app-bottom-sheet';

type Props = {
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
};

/**
 * Renders the bottom sheet (vaul) on narrow viewports and the right-side
 * drawer (Base UI) on wider ones. Parent mounts this only while open.
 */
export function ResponsivePanel({ children, onOpenChange }: Props) {
  const narrow = useIsNarrow();
  if (narrow) return <AppBottomSheet onOpenChange={onOpenChange}>{children}</AppBottomSheet>;
  return <AppDrawer onOpenChange={onOpenChange}>{children}</AppDrawer>;
}
