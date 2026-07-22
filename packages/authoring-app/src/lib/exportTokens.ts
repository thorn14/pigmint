import type { GeneratedRamp, GeneratedStep, W3CTokenGroup, W3CTokenValue, W3CColorValue, RgbChannels } from '../types/palette';
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
 * Plain hex list for quick testing / paste-into-tools workflows.
 * One hex per line; blank line between scales. Multi-ramp exports prefix each
 * block with the scale name (a non-color label). Import's parseColorList skips
 * unparseable tokens, so re-pasting still works — names are ignored, hexes become steps.
 */
export function exportToHexList(ramps: GeneratedRamp[]): string {
  if (ramps.length === 0) return '';

  const usedKeys = new Set<string>();
  const blocks: string[] = [];
  const multi = ramps.length > 1;

  for (const ramp of ramps) {
    const base = canonicalScaleName(ramp.scaleName);
    const key = disambiguateKey(base, usedKeys);
    usedKeys.add(key);

    const hexes = ramp.steps.map((step) => step.hex.toLowerCase());
    blocks.push(multi ? [key, ...hexes].join('\n') : hexes.join('\n'));
  }

  return blocks.join('\n\n') + '\n';
}

export function exportColors(ramps: GeneratedRamp[], format: ColorExportFormat): string {
  return format === 'hex' ? exportToHexList(ramps) : exportToJSON(ramps);
}
