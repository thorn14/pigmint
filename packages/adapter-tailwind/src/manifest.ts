import type { AdapterManifest } from '@pigmint/core';

export const manifest: AdapterManifest = {
  name: 'tailwind',
  version: '0.0.0',
  enforcementMode: 'compile-time',
  supportedModes: ['light', 'dark', 'light-high-contrast', 'dark-high-contrast'],
  requiredRamps: { minCount: 1, neutralRequired: true },
  requiredPrimitives: {
    positions: ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'],
    minCount: 8,
  },
  outputFormats: ['oklch', 'hex'],
  alpha: { supported: false, modes: [] },
  presets: ['generic', 'shadcn'],
  supportedCategories: [
    'action',
    'feedback',
    'surface',
    'foreground',
    'border',
    'focus',
    'decorative',
  ],
  runtimeValidator: null,
};
