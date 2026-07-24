import { getRelativeLuminance } from './colorMath';

/** CSS custom properties overridden when a surface is pinned as preview chrome. */
export const PREVIEW_BG_CHROME_VARS = [
  '--p-bg',
  '--p-bg-glass',
  '--p-text',
  '--p-surface',
  '--p-border',
  '--p-border-strong',
  '--p-text-secondary',
] as const;

function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace('#', '').trim();
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    return `rgba(128, 128, 128, ${alpha})`;
  }
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Drive authoring-app chrome (`--p-*`) from a pinned surface hex so Light/Dark
 * theme previews the authored background instead of pure white/black.
 * Text/overlay tokens flip from luminance so chrome stays readable.
 */
export function applyPreviewBgChrome(bgHex: string, root: CSSStyleDeclaration = document.documentElement.style): void {
  const light = getRelativeLuminance(bgHex) > 0.5;
  root.setProperty('--p-bg', bgHex);
  root.setProperty('--p-bg-glass', hexToRgba(bgHex, 0.75));
  if (light) {
    root.setProperty('--p-text', '#000000');
    root.setProperty('--p-surface', 'rgba(0, 0, 0, 0.05)');
    root.setProperty('--p-border', 'rgba(0, 0, 0, 0.08)');
    root.setProperty('--p-border-strong', 'rgba(0, 0, 0, 0.16)');
    root.setProperty('--p-text-secondary', 'rgba(0, 0, 0, 0.6)');
  } else {
    root.setProperty('--p-text', '#ffffff');
    root.setProperty('--p-surface', 'rgba(255, 255, 255, 0.08)');
    root.setProperty('--p-border', 'rgba(255, 255, 255, 0.08)');
    root.setProperty('--p-border-strong', 'rgba(255, 255, 255, 0.45)');
    root.setProperty('--p-text-secondary', 'rgba(255, 255, 255, 0.6)');
  }
}

/** Remove inline chrome overrides so theme CSS (`:root` / `[data-theme]`) applies again. */
export function clearPreviewBgChrome(root: CSSStyleDeclaration = document.documentElement.style): void {
  for (const v of PREVIEW_BG_CHROME_VARS) {
    root.removeProperty(v);
  }
}
