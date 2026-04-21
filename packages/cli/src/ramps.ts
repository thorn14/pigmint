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

export function generateRampFromConfig(ramp: RampConfig): GeneratedRamp {
  if (!ramp.source.startsWith('#')) {
    throw new Error(
      `ramp "${ramp.name}" source must be a hex literal in this slice (got "${ramp.source}")`,
    );
  }
  const sourceHex = ramp.source;
  const sourceOklch = hexToOklch(sourceHex);
  const curves = buildDefaultCurves(sourceOklch, 11);
  const scale: ColorScale = {
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
  return generateRamp(scale);
}

export function generateAllRamps(config: ProjectConfig): GeneratedRamp[] {
  return config.ramps.map(generateRampFromConfig);
}
