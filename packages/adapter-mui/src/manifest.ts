import type { AdapterManifest } from '@pigmint/core';

export const manifest: AdapterManifest = {
  name: 'mui',
  version: '0.0.0',
  enforcementMode: 'runtime',
  supportedModes: ['light', 'dark'],
  requiredRamps: { minCount: 1, neutralRequired: true },
  requiredPrimitives: {
    positions: ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'],
    minCount: 8,
  },
  outputFormats: ['hex', 'oklch'],
  alpha: { supported: false, modes: [] },
  presets: ['mui-v6'],
  supportedCategories: ['action', 'feedback', 'surface', 'foreground', 'border', 'focus'],
  runtimeValidator: '@pigmint/adapter-mui/runtime',
};
