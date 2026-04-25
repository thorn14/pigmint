export interface PaletteBinding {
  tokenPath: string;
  palettePaths: string[];
}

export const MUI_V6_PALETTE_BINDINGS: PaletteBinding[] = [
  { tokenPath: 'surface.main', palettePaths: ['background.default'] },
  { tokenPath: 'surface.elevated', palettePaths: ['background.paper'] },
  { tokenPath: 'foreground.main', palettePaths: ['text.primary'] },
  { tokenPath: 'foreground.muted', palettePaths: ['text.secondary'] },
  { tokenPath: 'action.primary.background', palettePaths: ['primary.main'] },
  { tokenPath: 'action.primary.text', palettePaths: ['primary.contrastText'] },
  { tokenPath: 'action.secondary.background', palettePaths: ['secondary.main'] },
  { tokenPath: 'action.secondary.text', palettePaths: ['secondary.contrastText'] },
  { tokenPath: 'border.main', palettePaths: ['divider'] },
  { tokenPath: 'feedback.danger.background', palettePaths: ['error.main'] },
  { tokenPath: 'feedback.warning.background', palettePaths: ['warning.main'] },
  { tokenPath: 'feedback.info.background', palettePaths: ['info.main'] },
  { tokenPath: 'feedback.success.background', palettePaths: ['success.main'] },
];

export function bindingsByTokenPath(): Map<string, PaletteBinding> {
  return new Map(MUI_V6_PALETTE_BINDINGS.map((b) => [b.tokenPath, b]));
}
