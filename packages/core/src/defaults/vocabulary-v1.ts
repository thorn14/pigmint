import type { VocabularyEntry, Vocabulary } from '../types/spec.js';

export const VOCABULARY_V1_VERSION = 'vocabulary@0.1';

// Spec/09 defaults — adopted directly. The resolver backs every
// preference × consistency pair (independent, matched-across-ramps,
// anchored-to-reference; lowest-passing, highest-contrast, matched-to-set,
// anchored). Grouping keys on {threshold, preference, consistency,
// surfaceContext, constraints} — tokens with literally identical intent
// resolve together. `matched-to-set` is implemented as a fixed-point
// iteration on the median contrast of the group (each member picks the
// step closest to the set's median; repeat until indices stabilize), so
// disparate-luminosity feedback ramps stay on their own ramps at their own
// positions instead of collapsing to extremes the way a sync'd-t variance
// scan would (`resolveMatchedToSet` in
// `packages/core/src/resolver/group-resolve.ts`).
//
// Single-member groups fall through to independent resolution via the
// `members.length === 1` guard, so e.g. `color.border.main` (mapped to
// `neutral` only) and `color.foreground.muted` resolve as
// `lowest-passing + independent` in practice — the matched-to-set
// declaration carries no extra cost.
//
// Decorative tokens are listed in spec/09 but skipped here: they need
// pass-through emission (alias a designer-chosen primitive) rather than
// resolver support; tracked for a follow-up pass.
//
// States stay ['base'] until spec/06 (states) gains resolver support —
// adapters currently synthesize hover/active/focus/disabled and receipts
// record `synthesized: true` per spec/09 prose.
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
    description: 'Document background. Resolves against the document baseline per spec/09.',
  },
  {
    path: 'color.surface.elevated',
    usage: 'nonText',
    primarySurface: 'color.surface.elevated',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'highest-contrast',
      consistency: 'independent',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Raised surface (cards, popovers). Surface roles are indexed by path in the driver, not contrast-picked.',
  },
  {
    path: 'color.surface.subtle',
    usage: 'nonText',
    primarySurface: 'color.surface.subtle',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'highest-contrast',
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
      preference: 'matched-to-set',
      consistency: 'matched-across-ramps',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Secondary text weight (spec/09). Matched-to-set across ramps; degenerates to `lowest-passing + independent` when only one ramp carries the token.',
  },
  {
    path: 'color.foreground.subtle',
    usage: 'text',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'text' },
      preference: 'lowest-passing',
      consistency: 'matched-across-ramps',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Tertiary annotation; lowest passing AA-text across ramps.',
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
  // Primary / secondary / tertiary backgrounds share one intent → grouped
  // resolution picks a synchronized t on each member's ramp so the three
  // button variants feel equivalently weighted.
  {
    path: 'color.action.primary.background',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'lowest-passing',
      consistency: 'matched-across-ramps',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Primary action (button) background on main surface.',
  },
  {
    path: 'color.action.primary.text',
    usage: 'text',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'text' },
      preference: 'highest-contrast',
      consistency: 'independent',
      surfaceContext: 'current',
    },
    states: ['base'],
    description: 'Text on the primary action background. `surfaceContext: current` degrades to primary in compile-time adapters.',
  },
  {
    path: 'color.action.primary.border',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'lowest-passing',
      consistency: 'matched-across-ramps',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Outline on primary-action chrome; matched with the background for visual continuity.',
  },
  {
    path: 'color.action.secondary.background',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'lowest-passing',
      consistency: 'matched-across-ramps',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Secondary action surface; bind a calmer ramp (e.g. slate) via the token ramp map.',
  },
  {
    path: 'color.action.secondary.text',
    usage: 'text',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'text' },
      preference: 'highest-contrast',
      consistency: 'independent',
      surfaceContext: 'current',
    },
    states: ['base'],
    description: 'Text on the secondary action background.',
  },
  {
    path: 'color.action.secondary.border',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'lowest-passing',
      consistency: 'matched-across-ramps',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Outline on secondary-action chrome.',
  },
  {
    path: 'color.action.tertiary.background',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'lowest-passing',
      consistency: 'matched-across-ramps',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Quietest interactive level (ghost buttons, text-only links). Typically binds to neutral.',
  },
  {
    path: 'color.action.tertiary.text',
    usage: 'text',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'text' },
      preference: 'highest-contrast',
      consistency: 'independent',
      surfaceContext: 'current',
    },
    states: ['base'],
    description: 'Text on the tertiary action background.',
  },

  // ── Feedback ──────────────────────────────────────────────────────────
  // Spec/09: matched-to-set + matched-across-ramps so danger / success /
  // warning / info feel perceptually equivalent. Backgrounds + icons share
  // one group (AA-nonText), text shares another (AA-text), borders share
  // a third (AA-nonText) — same threshold + preference + consistency =
  // same `intentGroupKey` → same group.
  {
    path: 'color.feedback.danger.background',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'matched-to-set',
      consistency: 'matched-across-ramps',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Error / destructive status fill.',
  },
  {
    path: 'color.feedback.danger.text',
    usage: 'text',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'text' },
      preference: 'matched-to-set',
      consistency: 'matched-across-ramps',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Error text and labels.',
  },
  {
    path: 'color.feedback.danger.border',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'matched-to-set',
      consistency: 'matched-across-ramps',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Error outline.',
  },
  {
    path: 'color.feedback.danger.icon',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'matched-to-set',
      consistency: 'matched-across-ramps',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Error glyph / icon fill. Shares intent with background so the family feels cohesive.',
  },
  {
    path: 'color.feedback.success.background',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'matched-to-set',
      consistency: 'matched-across-ramps',
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
      preference: 'matched-to-set',
      consistency: 'matched-across-ramps',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Success message text.',
  },
  {
    path: 'color.feedback.success.border',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'matched-to-set',
      consistency: 'matched-across-ramps',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Success outline / border accent.',
  },
  {
    path: 'color.feedback.success.icon',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'matched-to-set',
      consistency: 'matched-across-ramps',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Success glyph / icon fill.',
  },
  {
    path: 'color.feedback.warning.background',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'matched-to-set',
      consistency: 'matched-across-ramps',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Caution status fill.',
  },
  {
    path: 'color.feedback.warning.text',
    usage: 'text',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'text' },
      preference: 'matched-to-set',
      consistency: 'matched-across-ramps',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Warning copy.',
  },
  {
    path: 'color.feedback.warning.border',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'matched-to-set',
      consistency: 'matched-across-ramps',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Warning outline.',
  },
  {
    path: 'color.feedback.warning.icon',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'matched-to-set',
      consistency: 'matched-across-ramps',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Warning glyph / icon fill.',
  },
  {
    path: 'color.feedback.info.background',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'matched-to-set',
      consistency: 'matched-across-ramps',
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
      preference: 'matched-to-set',
      consistency: 'matched-across-ramps',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Info text.',
  },
  {
    path: 'color.feedback.info.border',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'matched-to-set',
      consistency: 'matched-across-ramps',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Info outline.',
  },
  {
    path: 'color.feedback.info.icon',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'matched-to-set',
      consistency: 'matched-across-ramps',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Info glyph / icon fill.',
  },

  // ── Border ─────────────────────────────────────────────────────────────
  {
    path: 'color.border.main',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'matched-to-set',
      consistency: 'matched-across-ramps',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Standard hairline (spec/09). Matched-to-set across ramps; degenerates to `lowest-passing + independent` when only one ramp carries the token.',
  },
  {
    path: 'color.border.subtle',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'lowest-passing',
      consistency: 'matched-across-ramps',
      surfaceContext: 'primary',
    },
    states: ['base'],
    description: 'Quiet divider that does not disappear on muted surfaces (ADR-006 canonical example).',
  },
  {
    path: 'color.border.prominent',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AA', usage: 'nonText' },
      preference: 'highest-contrast',
      consistency: 'matched-across-ramps',
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
      surfaceContext: 'current',
    },
    states: ['base'],
    description: 'Focus indicator ring. Needs the highest contrast available — focus is safety-critical.',
  },
  {
    path: 'color.focus.outline',
    usage: 'nonText',
    primarySurface: 'color.surface.main',
    defaultIntent: {
      threshold: { kind: 'wcag', level: 'AAA', usage: 'text' },
      preference: 'highest-contrast',
      consistency: 'independent',
      surfaceContext: 'current',
    },
    states: ['base'],
    description: 'Full outline for forced-colors / outline-offset patterns.',
  },
];

export const VOCABULARY_V1_DEFAULTS: Vocabulary = {
  version: VOCABULARY_V1_VERSION,
  tokens: VOCABULARY_V1_SLICE,
};
