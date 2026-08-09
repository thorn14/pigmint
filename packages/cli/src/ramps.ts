import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  buildDefaultCurves,
  buildGeneratedStep,
  generateRamp,
  hexToOklch,
} from '@pigmint/core';
import type {
  ColorScale,
  DtcgColorValue,
  DtcgContainer,
  GamutTarget,
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

export function generateRampFromConfig(
  ramp: RampConfig,
  gamut: GamutTarget = 'p3',
): GeneratedRamp {
  return generateRamp(buildScaleFromConfig(ramp), { gamut });
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

  // Accept either a pigmint container with a "primitive" section, or a flat
  // file whose top-level keys are the ramp names themselves.
  const hasPrimitiveSection =
    container.primitive != null && typeof container.primitive === 'object';
  const primitives = hasPrimitiveSection
    ? (container.primitive as Record<string, unknown>)
    : (container as unknown as Record<string, unknown>);

  const rampData = primitives[rampName];
  if (!rampData || typeof rampData !== 'object') {
    throw new Error(
      `fromFile: ramp "${rampName}" not found in "${filePath}"`,
    );
  }

  const steps: GeneratedStep[] = [];
  for (const [key, val] of Object.entries(rampData as Record<string, unknown>)) {
    if (key === '$type') continue;
    if (!val || typeof val !== 'object') continue;
    const token = val as {
      $value?: DtcgColorValue;
      $extensions?: { oklch?: { l: number; c: number; h: number; alpha?: number } };
    };
    const dv = token.$value;
    if (!dv?.hex || !dv.components) continue;
    // `hex` is only the sRGB fallback, so a wide-gamut step's real chroma lives
    // in the oklch extension; reading chroma back off the clamped hex would
    // silently narrow the ramp. The gamut stays at the default P3 ceiling so
    // that chroma survives, and each step's actual level is then derived from
    // the color rather than taken from the file's `colorSpace` declaration —
    // a step that fits in sRGB still comes back as sRGB either way.
    const oklch = token.$extensions?.oklch ?? hexToOklch(dv.hex);
    steps.push(
      buildGeneratedStep({
        name: key,
        l: oklch.l,
        c: oklch.c,
        h: oklch.h ?? 0,
        alpha: oklch.alpha ?? dv.alpha,
        fallbackHex: dv.hex,
      }),
    );
  }

  if (steps.length === 0) {
    throw new Error(`fromFile: ramp "${rampName}" in "${filePath}" has no steps`);
  }

  return { scaleId: rampName, scaleName: rampName, steps };
}

export async function generateAllRamps(config: ProjectConfig): Promise<GeneratedRamp[]> {
  const gamut: GamutTarget = config.engine.gamut ?? 'p3';
  const results: GeneratedRamp[] = [];
  for (const ramp of config.ramps) {
    if (ramp.fromFile) {
      results.push(await loadRampFromPrimitives(ramp.name, ramp.fromFile));
    } else {
      results.push(generateRampFromConfig(ramp, gamut));
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
