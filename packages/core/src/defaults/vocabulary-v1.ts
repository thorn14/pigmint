import type { VocabularyEntry, Vocabulary } from '../types/spec.js';

export const VOCABULARY_V1_VERSION = 'vocabulary@0.1';

// Default slice shipped with pigmint. Scope constrained to what the resolver
// currently supports: `consistency: 'independent'`, `preference` ∈
// {'lowest-passing','highest-contrast'}, base state only, surfaces limited to
// the four canonical roles (main/elevated/subtle/inverse). Spec/09 defines a
// larger vocabulary — additional categories land as resolver features ship.
export const VOCABULARY_V1_SLICE: VocabularyEntry[] = [
  // ── Surface ────────────────────────────────────────────────────────────
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
    path: 'color.surface.elevated',
    usage: 'nonText',
    primarySurface: 'color.surface.elevated',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'lowest-passing',
      consistency: 'independent',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Raised surface (cards, popovers) above main.',
  },
  {
    path: 'color.surface.subtle',
    usage: 'nonText',
    primarySurface: 'color.surface.subtle',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'lowest-passing',
      consistency: 'independent',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Recessed surface (muted panels) between main and elevated.',
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

  // ── Foreground ─────────────────────────────────────────────────────────
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
    path: 'color.foreground.muted',
    usage: 'text',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'text' },
      preference: 'lowest-passing',
      consistency: 'independent',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Secondary text weight; passes AA-text by the slimmest margin.',
  },
  {
    path: 'color.foreground.subtle',
    usage: 'text',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'lowest-passing',
      consistency: 'independent',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Tertiary annotation; passes AA-nonText only. Use for icons or large decorative type.',
  },
  {
    path: 'color.foreground.inverse',
    usage: 'text',
    primarySurface: 'color.surface.inverse',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AAA', usage: 'text' },
      preference: 'highest-contrast',
      consistency: 'independent',
      surfaceContext: 'inverse',
    },
    states: ['base'],
    description: 'Text on inverted surfaces.',
  },

  // ── Action ─────────────────────────────────────────────────────────────
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
  {
    path: 'color.action.primary.text',
    usage: 'text',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'text' },
      preference: 'highest-contrast',
      consistency: 'independent',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description:
      'Text on the primary action background. `surfaceContext: current` degrades to primary in compile-time adapters.',
  },
  {
    path: 'color.action.secondary.background',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'lowest-passing',
      consistency: 'independent',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Secondary action surface on main; bind a calmer ramp (e.g. slate) via the token ramp map.',
  },
  {
    path: 'color.action.secondary.text',
    usage: 'text',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'text' },
      preference: 'highest-contrast',
      consistency: 'independent',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Text on the secondary action background against main surface.',
  },

  // ── Feedback ──────────────────────────────────────────────────────────
  {
    path: 'color.feedback.danger.background',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'lowest-passing',
      consistency: 'independent',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Error / destructive status fill on main (inline alerts, form errors).',
  },
  {
    path: 'color.feedback.danger.text',
    usage: 'text',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'text' },
      preference: 'highest-contrast',
      consistency: 'independent',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Error text and labels on main surface (slice resolves against main like primary.text).',
  },
  {
    path: 'color.feedback.danger.border',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'highest-contrast',
      consistency: 'independent',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Error outline / separator derived from the danger ramp.',
  },
  {
    path: 'color.feedback.success.background',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'lowest-passing',
      consistency: 'independent',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Positive status fill (saved, verified).',
  },
  {
    path: 'color.feedback.success.text',
    usage: 'text',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'text' },
      preference: 'highest-contrast',
      consistency: 'independent',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Success message text on main surface.',
  },
  {
    path: 'color.feedback.success.border',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'highest-contrast',
      consistency: 'independent',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Success outline / border accent.',
  },
  {
    path: 'color.feedback.warning.background',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'lowest-passing',
      consistency: 'independent',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Caution / attention status fill.',
  },
  {
    path: 'color.feedback.warning.text',
    usage: 'text',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'text' },
      preference: 'highest-contrast',
      consistency: 'independent',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Warning copy on main surface.',
  },
  {
    path: 'color.feedback.info.background',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'lowest-passing',
      consistency: 'independent',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Informational callout fill.',
  },
  {
    path: 'color.feedback.info.text',
    usage: 'text',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'text' },
      preference: 'highest-contrast',
      consistency: 'independent',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Info text on main surface.',
  },

  // ── Border ─────────────────────────────────────────────────────────────
  {
    path: 'color.border.main',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'lowest-passing',
      consistency: 'independent',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Standard hairline against main surface.',
  },
  {
    path: 'color.border.subtle',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'lowest-passing',
      consistency: 'independent',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Quiet divider; same threshold as main until matched-to-set lands.',
  },
  {
    path: 'color.border.prominent',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'highest-contrast',
      consistency: 'independent',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Stronger outline (focusable chrome, high-visibility hairlines).',
  },

  // ── Focus ──────────────────────────────────────────────────────────────
  {
    path: 'color.focus.ring',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'highest-contrast',
      consistency: 'independent',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Focus indicator ring.',
  },
  {
    path: 'color.focus.outline',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'highest-contrast',
      consistency: 'independent',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Full outline for forced-colors / outline-offset patterns.',
  },
];

export const VOCABULARY_V1_DEFAULTS: Vocabulary = {
  version: VOCABULARY_V1_VERSION,
  tokens: VOCABULARY_V1_SLICE,
};
