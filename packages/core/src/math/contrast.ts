import { parse, wcagContrast, wcagLuminance } from 'culori';
import { APCAcontrast, sRGBtoY } from 'apca-w3';
import { toRgb } from './gamut.js';
import type { ContrastResult, WCAGLevel } from '../types/palette.js';

export function getRelativeLuminance(hex: string): number {
  const parsed = parse(hex);
  if (!parsed) return 0;
  return wcagLuminance(parsed) ?? 0;
}

export function getWcagContrast(hexA: string, hexB: string): ContrastResult {
  const ratio = wcagContrast(hexA, hexB);
  let level: WCAGLevel;
  if (ratio >= 7) level = 'AAA';
  else if (ratio >= 4.5) level = 'AA';
  else if (ratio >= 3) level = 'AA-large';
  else level = 'fail';
  return { ratio, level };
}

export function getApcaContrast(hexFg: string, hexBg: string): number {
  const fg = toRgb(parse(hexFg));
  const bg = toRgb(parse(hexBg));
  if (!fg || !bg) return 0;
  const fgY = sRGBtoY([(fg.r ?? 0) * 255, (fg.g ?? 0) * 255, (fg.b ?? 0) * 255]);
  const bgY = sRGBtoY([(bg.r ?? 0) * 255, (bg.g ?? 0) * 255, (bg.b ?? 0) * 255]);
  return APCAcontrast(fgY, bgY) as number;
}
