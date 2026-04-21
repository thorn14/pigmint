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
  anchor?: number | string;
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
  | 'fail'
  | 'exempt';

export interface ComplianceReceipt {
  target?: ComplianceTarget;
  level: ComplianceLevel;
  thresholds?: { text?: number; nonText?: number };
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

// ─── Vocabulary (spec/09) ────────────────────────────────────────────

export type TokenState = 'base' | 'hover' | 'active' | 'focus' | 'disabled';
export type StatesForm = 'step-shift' | 'alpha-overlay';

export interface VocabularyEntry {
  path: string;
  usage: Usage;
  primarySurface?: string;
  additionalSurfaces?: string[];
  defaultIntent?: FormalIntent;
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

export interface EngineConfig {
  compliance: 'wcag21' | 'apca';
  target: ComplianceTarget;
  modes: string[];
  cvd?: CvdProfile[];
}

export interface RampConfig {
  name: string;
  source: string;
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
  dtcg: string;
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
}
