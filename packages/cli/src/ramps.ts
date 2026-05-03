import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  buildDefaultCurves,
  generateRamp,
  hexToOklch,
  getRelativeLuminance,
  maxSrgbChroma,
} from '@pigmint/core';
import type {
  ColorScale,
  DtcgColorValue,
  DtcgContainer,
  GeneratedRamp,
  GeneratedStep,
  ProjectConfig,
  RampConfig,
} from '@pigmint/core';

export function buildScaleFromConfig(ramp: RampConfig): ColorScale {
  if (!ramp.source) {
    throw new Error(
      `ramp "${ramp.name}" has no source hex; use fromFile to load pre-computed steps`,
    );
  }
  if (!ramp.source.startsWith('#')) {
    throw new Error(
      `ramp "${ramp.name}" source must be a hex literal (got "${ramp.source}")`,
    );
  }
  const sourceHex = ramp.source;
  const sourceOklch = hexToOklch(sourceHex);
  const stepCount = ramp.stepCount ?? 11;
  const defaults = buildDefaultCurves(sourceOklch, stepCount);
  const smoothing = ramp.curves?.smoothing ?? 0;
  const curves = ramp.curves
    ? {
        lightness: {
          values: ramp.curves.lightness ?? defaults.lightness.values,
          smoothing,
        },
        chroma: {
          values: ramp.curves.chroma ?? defaults.chroma.values,
          smoothing,
        },
        hue: {
          values: ramp.curves.hue ?? defaults.hue.values,
          smoothing,
        },
      }
    : defaults;

  return {
    id: ramp.name,
    name: ramp.name,
    sourceHex,
    sourceOklch,
    sourceAlpha: sourceOklch.alpha ?? 1,
    stepCount,
    naming: ramp.naming ? { preset: ramp.naming } : { preset: 'tailwind' },
    curves,
    hueShift: {
      lightEndAdjust: ramp.hueShift?.lightEnd ?? 0,
      darkEndAdjust: ramp.hueShift?.darkEnd ?? 0,
    },
    lightnessPreset: 'tailwind',
    chromaPeak: ramp.chromaPeak ?? sourceOklch.c,
    chromaLow: ramp.chromaLow,
    chromaHigh: ramp.chromaHigh,
  };
}

export function generateRampFromConfig(ramp: RampConfig): GeneratedRamp {
  return generateRamp(buildScaleFromConfig(ramp));
}

export async function loadRampFromPrimitives(
  rampName: string,
  filePath: string,
): Promise<GeneratedRamp> {
  let text: string;
  try {
    text = await readFile(resolve(filePath), 'utf8');
  } catch (err) {
    throw new Error(
      `fromFile: could not read "${filePath}": ${(err as Error).message}`,
    );
  }

  let container: DtcgContainer;
  try {
    container = JSON.parse(text) as DtcgContainer;
  } catch {
    throw new Error(`fromFile: "${filePath}" is not valid JSON`);
  }

  const primitives = container.primitive;
  if (!primitives || typeof primitives !== 'object') {
    throw new Error(
      `fromFile: "${filePath}" has no "primitive" section — run "pigmint build" with output.primitives first`,
    );
  }

  const rampData = (primitives as Record<string, unknown>)[rampName];
  if (!rampData || typeof rampData !== 'object') {
    throw new Error(
      `fromFile: ramp "${rampName}" not found in "${filePath}"`,
    );
  }

  const steps: GeneratedStep[] = [];
  for (const [key, val] of Object.entries(rampData as Record<string, unknown>)) {
    if (key === '$type') continue;
    if (!val || typeof val !== 'object') continue;
    const token = val as { $value?: DtcgColorValue };
    const dv = token.$value;
    if (!dv?.hex || !dv.components) continue;
    const [r = 0, g = 0, b = 0] = dv.components;
    const hex = dv.hex;
    const oklch = hexToOklch(hex);
    const isP3 = dv.colorSpace === 'display-p3';
    steps.push({
      name: key,
      hex,
      oklch,
      gamut: isP3 ? 'p3' : 'srgb',
      srgb: { r, g, b },
      relativeLuminance: getRelativeLuminance(hex),
      maxSrgbC: maxSrgbChroma(oklch.l, oklch.h ?? 0),
    });
  }

  if (steps.length === 0) {
    throw new Error(`fromFile: ramp "${rampName}" in "${filePath}" has no steps`);
  }

  return { scaleId: rampName, scaleName: rampName, steps };
}

export async function generateAllRamps(config: ProjectConfig): Promise<GeneratedRamp[]> {
  const results: GeneratedRamp[] = [];
  for (const ramp of config.ramps) {
    if (ramp.fromFile) {
      results.push(await loadRampFromPrimitives(ramp.name, ramp.fromFile));
    } else {
      results.push(generateRampFromConfig(ramp));
    }
  }
  return results;
}

export async function generateAllScales(config: ProjectConfig): Promise<ColorScale[]> {
  const scales: ColorScale[] = [];
  for (const ramp of config.ramps) {
    if (ramp.fromFile) {
      // No ColorScale for pre-computed ramps (they're already materialized)
      continue;
    }
    scales.push(buildScaleFromConfig(ramp));
  }
  return scales;
}
