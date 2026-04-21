---
name: Audit report
version: 0.1.0
status: draft
implements: ADR-010, ADR-020
artifactVersion: audit-report@0.1
---

# Audit report

The audit tool (Step 3) takes a DTCG file plus built HTML/CSS/JS and produces a structured JSON report. The report is both human-readable (for a designer reviewing a build) and machine-readable (for Layer 1 to consume as feedback per ADR-010).

This spec defines the report's shape and the feedback channels it feeds.

Per ADR-020, the audit tool is project-local only — cross-project aggregation is closed (OQ-5). The report schema still supports per-project re-ingestion by Layer 1.

## Outer shape

```jsonc
{
  "$schema": "https://pigmint.dev/schema/audit-report-0.1.json",
  "artifactVersion": "audit-report@0.1",
  "run": {
    "id": "2026-04-18T12-00-00-abc123",
    "timestamp": "2026-04-18T12:00:00Z",
    "engineVersion": "0.0.0",
    "auditVersion": "0.0.0",
    "dtcgSource": "./dist/tokens.json",
    "builtSource": "./dist/site/**",
    "profile": "wcag-srgb"
  },
  "summary": {
    "violations": { "error": 3, "warning": 12, "info": 4 },
    "tokensAudited": 47,
    "tokensUsed": 31,
    "surfacePairsObserved": 14,
    "coverage": { "tokenUsage": 0.66 }
  },
  "violations": [ /* — see violation types below */ ],
  "suggestions": [ /* — feedback for Layer 1 */ ],
  "observations": {
    "undeclaredSurfacePairs": [ /* — observed pairings the resolver didn't know about */ ]
  }
}
```

## Violation types

Violations carry severity (`error` | `warning` | `info`), a type, a reference to the offending token and location in the built output, and context-specific data.

```jsonc
{
  "severity": "error",
  "type": "contrast-failure",
  "token": "color.feedback.danger.text",
  "location": {
    "file": "dist/site/alerts.html",
    "line": 42,
    "selector": "div.alert-danger > p"
  },
  "observed": {
    "foreground": { "hex": "#cc2222", "source": "color.feedback.danger.text" },
    "background": { "hex": "#fff5f5", "source": "color.feedback.danger.background" }
  },
  "expected": {
    "ratio": 4.5,
    "kind": "wcag",
    "level": "AA-text"
  },
  "actual": { "ratio": 3.8 },
  "suggestion": { /* — optional; see suggestions section */ }
}
```

Defined types for v0.1:

| Type | Meaning |
|------|---------|
| `unknown-token` | Build output references a token the DTCG file does not emit. |
| `missing-mode` | Consumed token lacks a resolution for a mode the build actually uses (e.g., site supports dark mode but a token has no `dark` entry). |
| `contrast-failure` | Observed foreground/background pair fails the required contrast threshold. |
| `contrast-under-target` | Pair passes some level but not the project's declared target (e.g., passes AA-nonText but target was AA-text). |
| `receipt-mismatch` | Rendered value does not match the DTCG receipt's declared value (unexpected override, caching bug, stale build). |
| `surface-context-mismatch` | Token resolved against surface A but observed in use against surface B. |
| `alpha-context-drift` | Alpha token's declared `referenceSurface` differs from its observed render context. |
| `usage-mismatch` | (Only if ADR-011 Option B is adopted.) Token declared `usage: "decorative"` observed in text role, or vice versa. |
| `orphan-token` | Token emitted in DTCG but never consumed in the build — informational, not a failure. |

Audit may extend the type list across future schema versions; consumers must tolerate unknown types (warn-and-continue, never fail on unknown).

## Suggestions

Per ADR-010, audits emit suggestions the resolver can re-ingest. A suggestion is a structured note on how the source of truth could change to prevent the violation:

```jsonc
{
  "id": "sug-2026-04-18-001",
  "channel": "intent-refinement",
  "target": "color.feedback.danger.text",
  "rationale": "Observed in use against color.surface.subtle (not declared as primary or additional surface); contrast fails there.",
  "change": {
    "field": "additionalSurfaces",
    "op": "add",
    "value": ["color.surface.subtle"]
  },
  "confidence": "high"
}
```

Three channels (ADR-010):

1. **`intent-refinement`** — suggest adding a surface to `additionalSurfaces`, refining an intent, or changing `surfaceContext`.
2. **`ramp-suggestion`** — suggest extending a ramp's lightness range, adjusting chroma, or adding curve resolution when a ramp can't satisfy its intents.
3. **`spec-gap`** — the default vocabulary is missing a concept the team had to invent locally. Per ADR-020, this channel still reports per-project but is not aggregated across projects.

## Feedback loop into Layer 1

Layer 1 reads audit reports on its next run. The resolver treats each high-confidence suggestion as an optional input:

- By default, suggestions are surfaced (in CLI output, in Layer 3's audit integrator view) but not auto-applied.
- Teams accept/reject via the Layer 3 audit integrator (Phase 5) or by editing the source files directly (ADR-019 file-level access).
- Accepted changes become commits to the team's overlay files or intent specs.

The resolver never silently rewrites vocabulary or intents based on audit input. Feedback is suggestion-based, human-ratified.

## Profiles

The `run.profile` field declares how the audit evaluated contrast:

- `wcag-srgb` — WCAG 2.1, sRGB-only (default).
- `apca-srgb` — APCA, sRGB.
- `wcag-p3` — WCAG 2.1 on P3-displayed values (experimental; OQ-8).

Profile gates which violation types can even apply (e.g., `wcag-p3` reports different cutoffs than `wcag-srgb`).

## Observation: undeclaredSurfacePairs

When the audit observes a surface pairing that no token declared as primary or additional, it records it under `observations.undeclaredSurfacePairs`. These aren't violations on their own — they're data. Accumulation of undeclared pairs is the signal that informs suggestions.

## Schema

Machine-checkable stub: [`schema/audit-report.schema.json`](./schema/audit-report.schema.json).
