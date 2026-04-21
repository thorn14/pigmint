export interface PaletteBinding {
  tokenPath: string;
  palettePaths: string[];
}

export const MUI_V6_PALETTE_BINDINGS: PaletteBinding[] = [
  { tokenPath: 'color.surface.main', palettePaths: ['background.default'] },
  { tokenPath: 'color.surface.elevated', palettePaths: ['background.paper'] },
  { tokenPath: 'color.foreground.main', palettePaths: ['text.primary'] },
  { tokenPath: 'color.foreground.muted', palettePaths: ['text.secondary'] },
  { tokenPath: 'color.action.primary.background', palettePaths: ['primary.main'] },
  { tokenPath: 'color.action.primary.text', palettePaths: ['primary.contrastText'] },
  { tokenPath: 'color.action.secondary.background', palettePaths: ['secondary.main'] },
  { tokenPath: 'color.action.secondary.text', palettePaths: ['secondary.contrastText'] },
  { tokenPath: 'color.border.main', palettePaths: ['divider'] },
  { tokenPath: 'color.feedback.danger.background', palettePaths: ['error.main'] },
  { tokenPath: 'color.feedback.warning.background', palettePaths: ['warning.main'] },
  { tokenPath: 'color.feedback.info.background', palettePaths: ['info.main'] },
  { tokenPath: 'color.feedback.success.background', palettePaths: ['success.main'] },
];

export function bindingsByTokenPath(): Map<string, PaletteBinding> {
  return new Map(MUI_V6_PALETTE_BINDINGS.map((b) => [b.tokenPath, b]));
}
