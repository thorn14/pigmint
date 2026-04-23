import {
  buildDefaultCurves,
  generateRamp,
  hexToOklch,
} from '@pigmint/core';
import type {
  ColorScale,
  GeneratedRamp,
  ProjectConfig,
  RampConfig,
} from '@pigmint/core';

export function buildScaleFromConfig(ramp: RampConfig): ColorScale {
  if (!ramp.source.startsWith('#')) {
    throw new Error(
      `ramp "${ramp.name}" source must be a hex literal in this slice (got "${ramp.source}")`,
    );
  }
  const sourceHex = ramp.source;
  const sourceOklch = hexToOklch(sourceHex);
  const curves = buildDefaultCurves(sourceOklch, 11);
  return {
    id: ramp.name,
    name: ramp.name,
    sourceHex,
    sourceOklch,
    sourceAlpha: sourceOklch.alpha ?? 1,
    stepCount: 11,
    naming: { preset: 'tailwind' },
    curves,
    hueShift: { lightEndAdjust: 0, darkEndAdjust: 0 },
    lightnessPreset: 'tailwind',
    chromaPeak: sourceOklch.c,
  };
}

export function generateRampFromConfig(ramp: RampConfig): GeneratedRamp {
  return generateRamp(buildScaleFromConfig(ramp));
}

export function generateAllRamps(config: ProjectConfig): GeneratedRamp[] {
  return config.ramps.map(generateRampFromConfig);
}

export function generateAllScales(config: ProjectConfig): ColorScale[] {
  return config.ramps.map(buildScaleFromConfig);
}
