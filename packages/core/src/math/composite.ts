import { parse } from 'culori';
import { toRgb } from './gamut.js';

function srgbToLinear(v: number): number {
  const abs = Math.abs(v);
  if (abs <= 0.04045) return v / 12.92;
  return Math.sign(v) * Math.pow((abs + 0.055) / 1.055, 2.4);
}

function linearToSrgb(v: number): number {
  const abs = Math.abs(v);
  if (abs <= 0.0031308) return v * 12.92;
  return Math.sign(v) * (1.055 * Math.pow(abs, 1 / 2.4) - 0.055);
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function toHexByte(v: number): string {
  return Math.round(clamp01(v) * 255).toString(16).padStart(2, '0');
}

/**
 * Standard Porter-Duff "source over" alpha compositing in linear sRGB.
 * Returns the opaque sRGB hex of the composited result.
 */
export function alphaCompositeHex(fgHex: string, alpha: number, bgHex: string): string {
  const fg = toRgb(parse(fgHex));
  const bg = toRgb(parse(bgHex));
  if (!fg || !bg) return bgHex;

  const a = clamp01(alpha);
  const r = linearToSrgb(a * srgbToLinear(fg.r ?? 0) + (1 - a) * srgbToLinear(bg.r ?? 0));
  const g = linearToSrgb(a * srgbToLinear(fg.g ?? 0) + (1 - a) * srgbToLinear(bg.g ?? 0));
  const b = linearToSrgb(a * srgbToLinear(fg.b ?? 0) + (1 - a) * srgbToLinear(bg.b ?? 0));

  return '#' + toHexByte(r) + toHexByte(g) + toHexByte(b);
}

/**
 * Returns `rgba(r, g, b, alpha)` for direct CSS use.
 */
export function toRgbaString(hex: string, alpha: number): string {
  const rgb = toRgb(parse(hex));
  if (!rgb) return `rgba(0, 0, 0, ${alpha})`;
  const r = Math.round((rgb.r ?? 0) * 255);
  const g = Math.round((rgb.g ?? 0) * 255);
  const b = Math.round((rgb.b ?? 0) * 255);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Returns 8-digit hex with alpha channel appended, e.g. `#0f172a66`.
 */
export function toHex8(hex: string, alpha: number): string {
  const base = (hex.startsWith('#') ? hex.slice(1) : hex).padStart(6, '0');
  const a = Math.round(clamp01(alpha) * 255).toString(16).padStart(2, '0');
  return '#' + base + a;
}
