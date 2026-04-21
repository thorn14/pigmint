import { parse, oklch, formatHex, clampChroma } from 'culori';
import type { OklchColor } from '../types/palette.js';

function clampAlpha(value?: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 1;
  return Math.max(0, Math.min(1, value));
}

export function hexToOklch(hex: string): OklchColor {
  const normalized = hex.startsWith('#') ? hex : `#${hex}`;
  const parsed = parse(normalized);
  if (!parsed) throw new Error(`Invalid hex color: ${hex}`);
  const color = oklch(parsed);
  if (!color) throw new Error(`Cannot convert to OKLCH: ${hex}`);
  const alpha = clampAlpha(parsed.alpha ?? (parsed as { opacity?: number }).opacity);
  return {
    l: color.l ?? 0,
    c: color.c ?? 0,
    h: color.h ?? 0,
    alpha,
  };
}

export function tryParseHex(hex: string): OklchColor | null {
  try {
    return hexToOklch(hex);
  } catch {
    return null;
  }
}

export function oklchToHex(color: OklchColor): string {
  const culoriColor = {
    mode: 'oklch' as const,
    l: color.l,
    c: color.c,
    h: color.h,
    alpha: clampAlpha(color.alpha),
  };
  return formatHex(culoriColor) ?? '#000000';
}

export function sourceWithChromaToHex(l: number, chromaPeak: number, h: number): string {
  const clamped = clampChroma(
    { mode: 'oklch' as const, l, c: chromaPeak, h, alpha: 1 },
    'oklch',
  );
  return formatHex(clamped) ?? '#000000';
}

export { clampAlpha };
