import type { ComplianceTarget } from '@pigmint/core';

export type Severity = 'error' | 'warning' | 'info';

export type AuditProfile = 'wcag-srgb' | 'apca-srgb' | 'wcag-p3';

export type SuggestionChannel =
  | 'intent-refinement'
  | 'ramp-suggestion'
  | 'spec-gap';

export type SuggestionConfidence = 'high' | 'medium' | 'low';

export interface SuggestionChange {
  field: string;
  op: 'add' | 'remove' | 'replace';
  value?: unknown;
}

export interface Suggestion {
  id: string;
  channel: SuggestionChannel;
  target: string;
  rationale: string;
  change: SuggestionChange;
  confidence?: SuggestionConfidence;
}

export interface ViolationLocation {
  file?: string;
  line?: number;
  selector?: string;
}

export interface Violation {
  severity: Severity;
  type: string;
  token: string;
  mode?: string;
  location?: ViolationLocation;
  observed?: Record<string, unknown>;
  expected?: Record<string, unknown>;
  actual?: Record<string, unknown>;
  suggestion?: Suggestion;
}

export interface UndeclaredSurfacePair {
  token: string;
  observedSurface: string;
  count: number;
}

export interface AuditRun {
  id: string;
  timestamp: string;
  engineVersion?: string;
  auditVersion?: string;
  dtcgSource: string;
  builtSource: string;
  profile: AuditProfile;
}

export interface AuditSummary {
  violations: { error: number; warning: number; info: number };
  tokensAudited: number;
  tokensUsed: number;
  surfacePairsObserved: number;
  coverage: { tokenUsage: number };
}

export interface AuditReport {
  $schema?: string;
  artifactVersion: 'audit-report@0.1';
  run: AuditRun;
  summary: AuditSummary;
  violations: Violation[];
  suggestions: Suggestion[];
  observations: { undeclaredSurfacePairs: UndeclaredSurfacePair[] };
}

export interface AuditInputs {
  dtcgSource: string;
  target: ComplianceTarget;
  profile?: AuditProfile;
  engineVersion?: string;
  auditVersion?: string;
  now?: Date;
}
