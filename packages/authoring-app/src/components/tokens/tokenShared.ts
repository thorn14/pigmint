import type { PortableSemanticToken, PortableAlphaToken, PortableVocabulary } from '@pigmint/core';

export type Pref = PortableSemanticToken['preference'];
export type Cons = NonNullable<PortableSemanticToken['consistency']>;
export type AlphaPref = NonNullable<PortableAlphaToken['preference']>;

// TODO: `matched-to-set` is retired from the authoring UI only — the engine still
// supports `matched-to-set` / `matched-across-ramps` (core Preference/Consistency
// types, group-resolve.ts, intent-validate.ts, defaults/vocabulary-v1.ts, examples,
// tests). A full engine-level removal is deferred future work.
export const PREFS: readonly Pref[] = [
  'lowest-passing',
  'midpoint',
  'median',
  'level-up',
  'highest-contrast',
  'pin-to-step',
  'preferred-contrast',
];

export const ALPHA_PREFS: readonly AlphaPref[] = [
  'lowest-passing',
  'highest-contrast',
  'preferred-contrast',
];

/**
 * Consistency is derived from preference — the UI never lets users pick it
 * directly. Keeps the row from drifting into states the engine would reject.
 *   matched-to-set ⇒ matched-across-ramps
 *   anything else  ⇒ independent
 */
export function derivedConsistency(pref: Pref): Cons {
  return pref === 'matched-to-set' ? 'matched-across-ramps' : 'independent';
}

/**
 * Sensible bounds for the preferred-contrast input — wide enough not to be
 * the limiting factor on any real ramp/surface combination.
 */
export function contrastBounds(compliance: 'wcag21' | 'apca'): { min: number; max: number; step: number } {
  return compliance === 'apca'
    ? { min: 0, max: 108, step: 1 }
    : { min: 1, max: 21, step: 0.1 };
}

export type TokenKind = 'surface' | 'foreground' | 'nonText' | 'decorative' | 'alpha';

export function findTokenKind(vocab: PortableVocabulary | null, path: string): TokenKind | null {
  if (!vocab) return null;
  if (path in vocab.surfaces) return 'surface';
  if (path in vocab.foreground) return 'foreground';
  if (path in vocab.nonText) return 'nonText';
  if (path in (vocab.decorative ?? {})) return 'decorative';
  if (path in (vocab.alpha ?? {})) return 'alpha';
  return null;
}
