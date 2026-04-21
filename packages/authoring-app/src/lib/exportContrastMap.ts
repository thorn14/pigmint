import { wcagLuminance, parse, converter } from 'culori';
import { APCAcontrast, sRGBtoY } from 'apca-w3';
import type { GeneratedRamp, ContrastMapColorRef } from '../types/palette';

const toRgb = converter('rgb');

interface ColorEntry { ramp: string; step: string; hex: string }

interface WcagMatrixExport {
  version: string;
  generated: string;
  type: 'wcag';
  colors: ColorEntry[];
  matrix: (number | null)[][];
  thresholds: { 'aa-large': number; aa: number; aaa: number };
}

interface ApcaMatrixExport {
  version: string;
  generated: string;
  type: 'apca';
  colors: ColorEntry[];
  matrix: (number | null)[][];
  thresholds: { lc45: number; lc60: number; lc75: number };
}

function buildSteps(ramps: GeneratedRamp[]): ColorEntry[] {
  return ramps.flatMap((r) =>
    r.steps.map((s) => ({ ramp: r.scaleName, step: s.name, hex: s.hex }))
  );
}

function precomputeApcaY(steps: ContrastMapColorRef[]): number[] {
  return steps.map((s) => {
    const rgb = toRgb(parse(s.hex));
    if (!rgb) return 0;
    return sRGBtoY([(rgb.r ?? 0) * 255, (rgb.g ?? 0) * 255, (rgb.b ?? 0) * 255]);
  });
}

function precomputeWcagLuminance(steps: ColorEntry[]): number[] {
  return steps.map((s) => {
    const c = parse(s.hex);
    return c ? (wcagLuminance(c) ?? 0) : 0;
  });
}

function wcagRatio(lum1: number, lum2: number): number {
  const l1 = Math.max(lum1, lum2);
  const l2 = Math.min(lum1, lum2);
  return (l1 + 0.05) / (l2 + 0.05);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildWcagContrastMatrix(ramps: GeneratedRamp[]): WcagMatrixExport {
  const colors = buildSteps(ramps);
  const n = colors.length;
  const luminances = precomputeWcagLuminance(colors);
  const matrix: (number | null)[][] = Array.from({ length: n }, () => new Array(n).fill(null));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j || colors[i].hex === colors[j].hex) continue;
      const ratio = wcagRatio(luminances[i], luminances[j]);
      if (ratio >= 3) matrix[i][j] = round2(ratio);
    }
  }

  return {
    version: '1.0',
    generated: new Date().toISOString(),
    type: 'wcag',
    colors,
    matrix,
    thresholds: { 'aa-large': 3, aa: 4.5, aaa: 7 },
  };
}

export function buildApcaContrastMatrix(ramps: GeneratedRamp[]): ApcaMatrixExport {
  const colors = buildSteps(ramps);
  const n = colors.length;
  const yValues = precomputeApcaY(colors);
  const matrix: (number | null)[][] = Array.from({ length: n }, () => new Array(n).fill(null));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j || colors[i].hex === colors[j].hex) continue;
      const lc = APCAcontrast(yValues[i], yValues[j]) as number;
      if (Math.abs(lc) >= 45) matrix[i][j] = round2(lc);
    }
  }

  return {
    version: '1.0',
    generated: new Date().toISOString(),
    type: 'apca',
    colors,
    matrix,
    thresholds: { lc45: 45, lc60: 60, lc75: 75 },
  };
}

export function exportWcagContrastMapJSON(ramps: GeneratedRamp[]): string {
  return JSON.stringify(buildWcagContrastMatrix(ramps), null, 2);
}

export function exportApcaContrastMapJSON(ramps: GeneratedRamp[]): string {
  return JSON.stringify(buildApcaContrastMatrix(ramps), null, 2);
}
