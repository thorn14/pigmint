import type { GamutLevel, OklchColor } from './palette.js';

// ─── Formal intent (spec/05) ─────────────────────────────────────────

export type ContrastKind = 'wcag' | 'apca';
export type ComplianceTarget = 'AA' | 'AAA';
export type Usage = 'text' | 'nonText' | 'decorative';
export type Preference =
  | 'lowest-passing'
  | 'highest-contrast'
  | 'matched-to-set'
  | 'anchored'
  | 'midpoint'
  | 'median'
  | 'level-up'
  | 'preferred-contrast';
export type Consistency =
  | 'independent'
  | 'matched-across-ramps'
  | 'anchored-to-reference';
export type SurfaceContext = 'primary' | 'elevated' | 'inverse' | 'current';

export interface Threshold {
  kind: ContrastKind;
  level: ComplianceTarget;
  usage: Exclude<Usage, 'decorative'>;
}

export type GamutStrategy = 'chroma-reduce' | 'chroma-preserve' | 'reject';

export interface IntentConstraints {
  /** WCAG 2.1 ratio target when `preference: "anchored"` and `consistency: "independent"`. */
  anchor?: number | string;
  /** When `consistency: "anchored-to-reference"`, the ramp (scale name) whose first resolved member defines the target contrast. */
  referenceRamp?: string;
  minChroma?: number;
  avoidPositions?: number[];
  gamutStrategy?: GamutStrategy;
  /** Target contrast metric when `preference: "preferred-contrast"`. WCAG ratio (e.g. 5.5) or APCA |Lc| (e.g. 75). */
  targetContrast?: number;
}

export interface FormalIntent {
  threshold: Threshold;
  preference: Preference;
  consistency: Consistency;
  surfaceContext: SurfaceContext;
  constraints?: IntentConstraints;
}

// ─── Receipts & modes (spec/02, spec/03) ─────────────────────────────

export interface ReceiptSource {
  ramp: string;
  position: number;
  nearestPrimitive?: string;
  selectionNote?: string;
}

export interface ContrastReceipt {
  wcag21?: number;
  apca?: number;
  simulated?: { wcag21?: number; apca?: number };
  againstBaseline?: number;
}

export type ComplianceLevel =
  | 'AAA-text'
  | 'AAA-nonText'
  | 'AA-text'
  | 'AA-nonText'
  | 'apca-pass'
  | 'fail'
  | 'exempt';

export interface ComplianceReceipt {
  target?: ComplianceTarget;
  level: ComplianceLevel;
  thresholds?: { text?: number; nonText?: number };
  /**
   * When the engine used APCA: |Lc| achieved (for pass/resolve) vs the minimum |Lc| required
   * for this token. WCAG-style labels (AA/AAA) do not apply; use this for compliance display.
   */
  apcaLc?: { achieved: number; required: number };
}

/**
 * Contrast + compliance of a resolved token's color against ONE of the surfaces it is declared on.
 * A token's step is picked against its primary surface, but the same color can be displayed on
 * additional surfaces; this records the (recomputed) contrast/compliance for each.
 */
export interface SurfaceContrast {
  /** Surface ref this is measured against, e.g. "{color.surface.bgDangerEmphasis}". */
  surface: string;
  contrast: ContrastReceipt;
  compliance: ComplianceReceipt;
}

export interface GamutReceipt {
  inSrgb: boolean;
  inP3: boolean;
  clipped: boolean;
  strategy?: GamutStrategy;
  clippedFrom?: { oklch?: string };
}

export interface ResolvedValue {
  oklch: string;
  hex?: string;
  hsl?: string;
  p3?: string;
  rgba?: string;
  colorMix?: string;
}

export interface ModeEntry {
  value: ResolvedValue;
  source?: ReceiptSource;
  resolvedAgainst?: string | null;
  contrast?: ContrastReceipt | null;
  compliance?: ComplianceReceipt | null;
  gamut?: GamutReceipt;
  intent?: string;
  cvd?: Record<string, string>;
  provenance?: {
    vocabulary?: string;
    overlay?: string;
    resolvedAt?: string;
  };
  states?: Record<string, ModeEntry>;
}

// ─── Alpha modifier (spec/07, ADR-016) ───────────────────────────────

/**
 * Declares an alpha compositing modifier on a vocabulary token (ADR-016).
 *
 * Resolution paths:
 * - Path 1 (fixed alpha, resolve step): set `baseRamp` + fixed `value` + `intent`. The
 *   sub-resolver walks the ramp and picks the step whose composited result satisfies the intent.
 * - Path 2 (fixed step, resolve alpha): set `baseRef` + `value` range. Deferred — not yet
 *   implemented; a fixed `value` with `baseRef` degenerates to a no-op composite.
 * - Degenerate (both fixed): set `baseRef` + fixed `value` — just composites and emits.
 */
export interface AlphaModifier {
  /** Ramp name — path 1: fixed alpha, the sub-resolver picks the step. */
  baseRamp?: string;
  /**
   * Step reference as `{color.primitive.<ramp>.<step>}` — path 2 or degenerate fixed case.
   * When `value` is a fixed number this becomes a simple composite with no step search.
   */
  baseRef?: string;
  /** Alpha [0,1] for path 1 or degenerate; [min, max] range for path 2. */
  value: number | [number, number];
  /**
   * Surface path to composite against. Defaults to `color.surface.main` (light scheme) or
   * `color.surface.inverse` (dark scheme) when omitted (ADR-016 decision 2026-04-23).
   */
  referenceSurface?: string;
  /** Formal intent applied to the composited result. Required for non-decorative path-1 tokens. */
  intent?: FormalIntent;
}

/** Receipt fields added to alpha-carrying tokens (spec/07). */
export interface AlphaReceipt {
  alphaValue: number;
  referenceSurface: string;
  composited: { hex: string; against: string };
}

// ─── Vocabulary (spec/09) ────────────────────────────────────────────

export type TokenState = 'base' | 'hover' | 'active' | 'focus' | 'disabled';
export type StatesForm = 'step-shift' | 'alpha-overlay';

export interface VocabularyEntry {
  path: string;
  usage: Usage;
  primarySurface?: string;
  additionalSurfaces?: string[];
  defaultIntent?: FormalIntent;
  /** Alpha modifier — present on alpha-carrying tokens (ADR-016, spec/07). */
  alpha?: AlphaModifier;
  states?: TokenState[];
  statesForm?: StatesForm;
  description?: string;
  removed?: boolean;
  /**
   * Marks an otherwise-resolvable token (foreground/nonText/alpha) as decorative — the
   * resolver picks a step normally but the compliance receipt is forced to `'exempt'`.
   * Distinct from `usage: 'decorative'` (which carries no surface/preference and just
   * emits a fixed step).
   */
  decorative?: boolean;
}

export interface Vocabulary {
  version: string;
  tokens: VocabularyEntry[];
}

// ─── Project config (spec/12) ────────────────────────────────────────

export type CvdProfile =
  | 'deuteranopia'
  | 'protanopia'
  | 'tritanopia'
  | 'achromatopsia';

export type ResolverMode = 'stepped' | 'continuous';

export interface ResolverConfig {
  mode: ResolverMode;
  fallbackSteps?: number;
  /** When `mode` is `continuous` (default true), synthesize DTCG primitives for off-grid picks (F1). */
  materializeInterpolatedPrimitives?: boolean;
}

export interface EngineConfig {
  compliance: 'wcag21' | 'apca';
  target: ComplianceTarget;
  modes: string[];
  cvd?: CvdProfile[];
  resolver?: ResolverConfig;
}

/** Inline curve override for a ramp in `pigmint.yaml`. All arrays must have length === stepCount. */
export interface RampCurveInline {
  /** Per-step L values in [0, 1]. */
  lightness?: number[];
  /** Per-step C (chroma) values. */
  chroma?: number[];
  /** Per-step H (hue) values in degrees. */
  hue?: number[];
  /** Spline smoothing in [0, 1]; default 0. */
  smoothing?: number;
}

export interface RampConfig {
  name: string;
  /** Hex literal — CLI derives default curves. Mutually exclusive with `fromFile`. */
  source?: string;
  /** Path to a primitives.json — load pre-computed steps. Mutually exclusive with `source`. */
  fromFile?: string;
  curve?: string;
  /** Number of steps to generate. Default 11. Range [2, 24]. */
  stepCount?: number;
  /** Step naming preset. Default 'tailwind'. */
  naming?: 'tailwind' | 'numeric';
  /** Inline L/C/H curve override. When present, arrays must have length === stepCount. */
  curves?: RampCurveInline;
  /** Hue rotation applied at the light and dark ends of the ramp. */
  hueShift?: { lightEnd?: number; darkEnd?: number };
  /** Peak chroma. Defaults to source color's chroma. */
  chromaPeak?: number;
  /** Chroma floor (light end). Overrides buildDefaultCurves chroma shape when set. */
  chromaLow?: number;
  /** Chroma floor (dark end). Overrides buildDefaultCurves chroma shape when set. */
  chromaHigh?: number;
}

export interface AdapterConfig {
  name: string;
  output: string;
  preset?: string;
  formats?: string[];
  alpha?: {
    enabled?: boolean;
    referenceSurface?: string;
  };
}

export interface OutputConfig {
  /** Semantic tokens DTCG file. Optional when `primitives` is set. */
  dtcg?: string;
  /** Primitives-only DTCG file (ramp steps). */
  primitives?: string;
  receiptsSidecar?: boolean;
}

export type IntentOverride = Partial<FormalIntent>;

export interface ProjectConfig {
  engine: EngineConfig;
  defaults?: { vocabulary?: string; surfacePairs?: string };
  overlays?: string[];
  ramps: RampConfig[];
  adapters?: AdapterConfig[];
  output: OutputConfig;
  intents?: Record<string, IntentOverride>;
}

// ─── Portable vocabulary (client-defined, loaded from tokens.yaml) ────

/**
 * A ramp step reference: a numeric index, or a step name (e.g. "950", "white",
 * "c627"). Name-based refs are stable across ramp re-ordering — prefer them.
 */
export type StepRef = number | string;

export interface PortableSurfaceToken {
  ramp: string;
  step?: StepRef;
  lightStep?: StepRef;
  darkStep?: StepRef;
}

export interface PortableSemanticToken {
  ramp: string;
  surfaces: string[];
  preference:
    | 'lowest-passing'
    | 'highest-contrast'
    | 'matched-to-set'
    | 'midpoint'
    | 'median'
    | 'level-up'
    | 'preferred-contrast'
    | 'pin-to-step';
  consistency?: 'independent' | 'matched-across-ramps' | 'anchored-to-reference';
  level?: 'AA' | 'AAA';
  interactions?: Partial<Record<string, { offset: number }>>;
  /** Skip a11y compliance enforcement; resolver still picks a step from `preference`. */
  decorative?: boolean;
  /** Target contrast metric when `preference === 'preferred-contrast'`. */
  targetContrast?: number;
  /** Light-mode ramp step when `preference === 'pin-to-step'`: index or step name. */
  lightStep?: StepRef;
  /** Dark-mode ramp step when `preference === 'pin-to-step'`: index or step name. */
  darkStep?: StepRef;
}

export interface PortableDecorativeToken {
  ramp: string;
  step: number;
}

/**
 * Alpha token entry in `tokens.yaml` (spec/07, ADR-016).
 *
 * Two shapes:
 * - **Degenerate** (`base` + fixed `value`): specific step composited at the declared alpha.
 *   No contrast check — always decorative / exempt.
 * - **Path 1** (`baseRamp` + fixed `value` + `surfaces` + `preference`): resolver walks the ramp
 *   and picks the step whose composited result satisfies the intent against the contrast surface.
 */
export interface PortableAlphaToken {
  /**
   * Fixed step reference. Either full DTCG form `{color.primitive.<ramp>.<step>}` or
   * shorthand `<ramp>.<step>` (e.g. `slate.900`). Mutually exclusive with `baseRamp`.
   */
  base?: string;
  /** Ramp to search — path 1. Requires `surfaces` and `preference`. Mutually exclusive with `base`. */
  baseRamp?: string;
  /** Alpha [0,1]. */
  value: number;
  /** Surface name from the `surfaces` section to composite against. Defaults per scheme when omitted. */
  referenceSurface?: string;
  /** For path 1: surface name(s) to contrast against (compliance check). */
  surfaces?: string[];
  /** For path 1: step-picking strategy. */
  preference?: 'lowest-passing' | 'highest-contrast' | 'preferred-contrast';
  /** For path 1: usage category. Defaults to `'nonText'`. */
  usage?: 'text' | 'nonText';
  /** Compliance level. Defaults to the engine's `target`. */
  level?: 'AA' | 'AAA';
  /** Skip a11y compliance enforcement; resolver still picks a step from `preference`. */
  decorative?: boolean;
  /** Target contrast metric when `preference === 'preferred-contrast'`. */
  targetContrast?: number;
}

export interface PortableVocabulary {
  surfaces: Record<string, PortableSurfaceToken>;
  foreground: Record<string, PortableSemanticToken>;
  nonText: Record<string, PortableSemanticToken>;
  decorative?: Record<string, PortableDecorativeToken>;
  alpha?: Record<string, PortableAlphaToken>;
}

// ─── Internal resolver types ─────────────────────────────────────────

export interface ResolvedToken {
  path: string;
  mode: string;
  oklch: OklchColor;
  hex: string;
  gamut: GamutLevel;
  source: ReceiptSource;
  resolvedAgainst: string | null;
  contrast: ContrastReceipt | null;
  compliance: ComplianceReceipt | null;
  intent: FormalIntent;
  /** Present when this token carries an alpha modifier (ADR-016, spec/07). */
  alpha?: AlphaReceipt;
  /** Contrast + compliance of this token's color against each surface it is declared on. */
  contrastBySurface?: SurfaceContrast[];
}
