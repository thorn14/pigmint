import type { GamutLevel, OklchColor } from './palette.js';

// ─── Formal intent (spec/05) ─────────────────────────────────────────

export type ContrastKind = 'wcag' | 'apca';
export type ComplianceTarget = 'AA' | 'AAA';
export type Usage = 'text' | 'nonText' | 'decorative';
export type Preference =
  | 'lowest-passing'
  | 'highest-contrast'
  | 'matched-to-set'
  | 'anchored';
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

export interface RampConfig {
  name: string;
  /** Hex literal — CLI derives default curves. Mutually exclusive with `fromFile`. */
  source?: string;
  /** Path to a primitives.json — load pre-computed steps. Mutually exclusive with `source`. */
  fromFile?: string;
  curve?: string;
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

export interface AuditConfig {
  input?: string;
  report?: string;
  profile?: 'wcag-srgb' | 'apca-srgb' | 'wcag-p3';
}

export type IntentOverride = Partial<FormalIntent>;

export interface ProjectConfig {
  engine: EngineConfig;
  defaults?: { vocabulary?: string; surfacePairs?: string };
  overlays?: string[];
  ramps: RampConfig[];
  adapters?: AdapterConfig[];
  output: OutputConfig;
  audit?: AuditConfig;
  intents?: Record<string, IntentOverride>;
}

// ─── Portable vocabulary (client-defined, loaded from tokens.yaml) ────

export interface PortableSurfaceToken {
  ramp: string;
  step?: number;
  lightStep?: number;
  darkStep?: number;
}

export interface PortableSemanticToken {
  ramp: string;
  surfaces: string[];
  preference: 'lowest-passing' | 'highest-contrast' | 'matched-to-set';
  consistency?: 'independent' | 'matched-across-ramps' | 'anchored-to-reference';
  level?: 'AA' | 'AAA';
  interactions?: Partial<Record<string, { offset: number }>>;
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
  preference?: 'lowest-passing' | 'highest-contrast';
  /** For path 1: usage category. Defaults to `'nonText'`. */
  usage?: 'text' | 'nonText';
  /** Compliance level. Defaults to the engine's `target`. */
  level?: 'AA' | 'AAA';
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
}
