import type { GeneratedRamp, GeneratedStep, W3CTokenGroup, W3CTokenValue, W3CColorValue, RgbChannels } from '../types/palette';
import { toHex8 } from '@pigmint/core';
import { canonicalScaleName, disambiguateKey } from './scaleNaming';

function roundChannel(v: number): number {
  // DTCG spec requires components in [0, 1]. Floating-point conversion can
  // produce values a hair over (e.g. 1.0000001) at the gamut boundary — clamp.
  const clamped = Math.max(0, Math.min(1, v));
  return parseFloat(clamped.toFixed(6));
}

function componentsFromRgb(rgb: RgbChannels): number[] {
  return [roundChannel(rgb.r), roundChannel(rgb.g), roundChannel(rgb.b)];
}

function buildColorValue(step: GeneratedStep): W3CColorValue {
  // Branch on the gamut of the ideal (pre-sRGB-clamp) color.
  // - 'p3'  → emit display-p3 components that match what the app renders;
  //           `hex` stays as the sRGB-clamped fallback for hex-only consumers.
  // - 'srgb' (and defensive 'out') → emit sRGB components derived from the
  //           same clamped color that produced `hex`, so components and hex agree.
  const isP3 = step.gamut === 'p3' && step.p3;
  const value: W3CColorValue = isP3
    ? {
        colorSpace: 'display-p3',
        components: componentsFromRgb(step.p3!),
        hex: step.hex,
      }
    : {
        colorSpace: 'srgb',
        components: componentsFromRgb(step.srgb),
        hex: step.hex,
      };
  const alpha = step.oklch.alpha ?? 1;
  if (alpha < 1) value.alpha = parseFloat(alpha.toFixed(4));
  return value;
}

function round6(v: number): number {
  return parseFloat(v.toFixed(6));
}

function buildOklchExtension(step: GeneratedStep): { l: number; c: number; h: number; alpha?: number } {
  const { l, c, h, alpha } = step.oklch;
  const out: { l: number; c: number; h: number; alpha?: number } = {
    l: round6(l),
    c: round6(c),
    h: round6(h),
  };
  if (alpha !== undefined && alpha < 1) out.alpha = parseFloat(alpha.toFixed(4));
  return out;
}

export type ColorExportFormat = 'dtcg' | 'hex';

export function exportToW3CTokens(ramps: GeneratedRamp[]): W3CTokenGroup {
  const root: W3CTokenGroup = {};
  // Track emitted group keys so scales with duplicate *canonical* names don't
  // silently overwrite each other. Canonical = trim(); whitespace-only →
  // "Color" (same as the store + conflict UI). Suffix later ramps with
  // " 2", " 3", … so every scale makes it into the export.
  const usedKeys = new Set<string>();

  for (const ramp of ramps) {
    const group: Record<string, unknown> = { $type: 'color' };

    for (const step of ramp.steps) {
      const token: W3CTokenValue = {
        $value: buildColorValue(step),
        $extensions: { oklch: buildOklchExtension(step) },
      };
      group[step.name] = token;
    }

    const base = canonicalScaleName(ramp.scaleName);
    const key = disambiguateKey(base, usedKeys);
    usedKeys.add(key);
    root[key] = group as W3CTokenGroup;
  }

  return root;
}

export function exportToJSON(ramps: GeneratedRamp[]): string {
  return JSON.stringify(exportToW3CTokens(ramps), null, 2);
}

/**
 * Hex for the simple export: 8-digit `#rrggbbaa` when the step has
 * transparency, otherwise the opaque 6-digit `step.hex`.
 * (`formatHex` / ramp generation always drop alpha from `step.hex`.)
 */
function stepExportHex(step: GeneratedStep): string {
  const hex = step.hex.toLowerCase();
  const alpha = step.oklch.alpha ?? 1;
  if (alpha >= 1) return hex;
  return toHex8(hex, alpha).toLowerCase();
}

/**
 * Simple JSON map of scale name → hex codes for testing / paste-into-tools.
 * Pretty-printed; duplicate scale names are disambiguated like DTCG export.
 * Transparent steps use 8-digit hex (`#rrggbbaa`).
 */
export function exportToHexList(ramps: GeneratedRamp[]): string {
  const usedKeys = new Set<string>();
  const out: Record<string, string[]> = {};

  for (const ramp of ramps) {
    const base = canonicalScaleName(ramp.scaleName);
    const key = disambiguateKey(base, usedKeys);
    usedKeys.add(key);
    out[key] = ramp.steps.map(stepExportHex);
  }

  return JSON.stringify(out, null, 2);
}

export function exportColors(ramps: GeneratedRamp[], format: ColorExportFormat): string {
  return format === 'hex' ? exportToHexList(ramps) : exportToJSON(ramps);
}
