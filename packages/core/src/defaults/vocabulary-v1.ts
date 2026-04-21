import type { VocabularyEntry, Vocabulary } from '../types/spec.js';

export const VOCABULARY_V1_VERSION = 'vocabulary@0.1';

export const VOCABULARY_V1_SLICE: VocabularyEntry[] = [
  {
    path: 'color.surface.main',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'highest-contrast',
      consistency: 'independent',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Document background.',
  },
  {
    path: 'color.surface.inverse',
    usage: 'nonText',
    primarySurface: 'color.surface.inverse',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'highest-contrast',
      consistency: 'independent',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Inverted document surface.',
  },
  {
    path: 'color.foreground.main',
    usage: 'text',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AAA', usage: 'text' },
      preference: 'highest-contrast',
      consistency: 'independent',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Primary text on main surface.',
  },
  {
    path: 'color.action.primary.background',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'lowest-passing',
      consistency: 'independent',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description:
      'Primary action (button) background on main surface. Spec/09 default is matched-across-ramps; slice uses independent until that policy lands.',
  },
];

export const VOCABULARY_V1_DEFAULTS: Vocabulary = {
  version: VOCABULARY_V1_VERSION,
  tokens: VOCABULARY_V1_SLICE,
};
