import type { Consistency, Preference, SurfaceContext } from '@pigmint/core';

/**
 * String copy for intent help popovers. Resolver behavior: packages/core `resolve.ts` / `driver.ts`.
 */
export const intentHelp = {
  pageTitle:
    'Configure how the engine picks colors from ramps (defaults per token) and which modes and simulation profiles are exported. Overrides are stored in the browser until you copy them into pigmint.yaml.',
  /** Caption under the engine controls (no popover). */
  engineStripCaption:
    'Engine target, modes, resolver, and CVD apply to every token. The table below only overrides preference, consistency, and surface per path. Selected modes are included in pigmint build; CVD profiles are stored in the project for preview and export. Continuous resolver densifies each ramp to at least the fallback step count before searching for a color.',
  colToken:
    'Canonical path for this design token in the Pigmint vocabulary. The spec line (when present) is the short human description for what the color is for.',
  colPreference:
    'Tells the resolver which ramp step to keep when more than one step would satisfy the same contrast target against the reference surface for this token.',
  colConsistency:
    'Controls whether this token is resolved in isolation on its ramp, or kept aligned with other ramps. The public engine today only runs the independent path.',
  colSurface:
    'Which surface token in the current mode to measure contrast against when this token is not a surface (foreground, border, action, etc.).',

  engineCompliance:
    'Contrast is evaluated with WCAG 2.1 relative luminance. APCA is not available in the authoring app build yet; see plan (OQ-12) for the roadmap.',
  engineTarget:
    'Selects the AA or AAA level carried on each token’s contrast threshold, together with the vocabulary’s text vs. non-text usage, so the resolver knows which minimum ratio to enforce when choosing a step.',
  engineModes:
    'Each selected mode is fully resolved in `pigmint build` and written to the project config. You must always keep at least one mode on.',
  modeLight: 'Light appearance: uses the light scheme and its light baseline (e.g. white) when resolving surface ramps and non-surface tokens.',
  modeDark: 'Dark appearance: uses the dark scheme and its near-black baseline; surface ramps and contrast checks use the dark set.',
  modeLightHc:
    'High-contrast light: same scheme as light, but the engine uses “high-contrast” threshold elevation (stricter effective floors) where applicable.',
  modeDarkHc:
    'High-contrast dark: same scheme as dark, with stricter effective contrast requirements where the engine supports elevation.',

  engineResolver:
    'Choose how the engine searches a color scale: on discrete step names only, or on a much denser interpolation of the same curve (continuous).',
  engineResolverFallback:
    'When the resolver is continuous, this is the minimum number of steps used when densifying each scale before searching. The implementation uses the larger of this and the default ramp size.',
  resolverStepped:
    'Search only the named stops on the ramp (e.g. 11 per scale in the default setup). Best when you want tokens to line up to stable step names for design system handoff.',
  resolverContinuous:
    'Resample the same hue/lightness/chroma curve to a large number of steps, then run the same contrast filter. Produces “between step” colors when the discrete grid is too coarse; costs more work at build time.',
  levelAA:
    'Text and non-text targets follow WCAG 2.1 table A (4.5:1 text, 3:1 large text / non-text where the vocabulary says non-text). High-contrast modes can bump effective floors when the engine applies elevation.',
  levelAAA:
    'Stricter text and non-text targets (e.g. 7:1 for body text) when the token is authored as text usage; the engine picks thresholds from the intent plus vocabulary usage.',

  engineCvd:
    'Optional color-vision profiles listed in the project for audit, preview, and export. The WCAG 2.1 search path in the current slice is still sRGB-based; CVD is for simulating and reporting alongside your pipeline.',

  cvdDeuteranopia: 'Red–green confusion with reduced green (M) cone sensitivity; common in “green weak” vision.',
  cvdProtanopia: 'Red–green confusion with reduced red (L) cone sensitivity; can shift how red and green are distinguished.',
  cvdTritanopia: 'Blue–yellow confusion; less common, affects short (S) wavelength separation.',
  cvdAchromatopsia: 'Little or no color (cone) vision; useful for a luminance-only read of your palette.',

  preference: {
    'lowest-passing':
      'Among all ramp steps that meet (or beat) the required contrast, pick the step with the lowest still-passing ratio. Use when you want the subtlest on-brand color that still meets the bar.',
    'highest-contrast':
      'Among steps that pass, pick the step with the highest contrast. Use when you want maximum separation from the background (strong states, error text, etc.).',
    'matched-to-set':
      'Intended to align with a set of other tokens (e.g. matched chroma across roles). Not implemented in the core resolver in this engine slice; selecting it will error at resolution time until the feature lands.',
    anchored:
      'Intended to lock to a named position or anchor. Not implemented in the core resolver in this engine slice; selecting it will error until the feature lands.',
  } as const satisfies Record<Preference, string>,

  consistency: {
    independent:
      'The resolver picks a step for this token using only that token’s intent and its ramp. This is the only supported mode in the public resolver today.',
    'matched-across-ramps':
      'Future: keep related tokens on harmonized steps across scales. Not implemented in the core slice; will error if selected.',
    'anchored-to-reference':
      'Future: tie the choice to a reference ramp position. Not implemented in the core slice; will error if selected.',
  } as const satisfies Record<Consistency, string>,

  surface: {
    primary:
      'Contrast is measured against the primary surface the vocabulary assigns for this token (see primarySurface on the entry, usually the main app surface in that mode).',
    elevated:
      'Use the elevated surface (e.g. a card on top of the main canvas) as the background for the contrast check.',
    inverse:
      'Use color.surface.inverse for the mode (the “opposite” surface role from your scheme) as the contrast background.',
    current:
      'In the current engine, follows the same reference as primary for the token’s vocabulary binding.',
  } as const satisfies Record<SurfaceContext, string>,
} as const;
