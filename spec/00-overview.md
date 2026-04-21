---
name: Pigmint spec overview
version: 0.1.0
status: draft
implements: ADR-011
---

# Pigmint spec — overview

Pigmint's engine contract, broken into focused documents that compose into a single versioned spec. Each file declares which ADR(s) from [`../plan.md`](../plan.md) it implements and carries its own semantic version.

This is **Step 0** per the build sequence. No implementation code exists yet; these files define what the Step 1 resolver will read, emit, and guarantee.

## Reading order

Read in ascending number order. Earlier documents establish vocabulary the later ones rely on.

1. **[01-dtcg-container](./01-dtcg-container.md)** — Outer DTCG shape, the `$extensions` extension strategy, primitive vs semantic namespaces, aliasing rules.
2. **[02-modes](./02-modes.md)** — `$extensions.modes.*` shape; light/dark/high-contrast/CVD as first-class siblings; full-matrix emission.
3. **[03-receipts](./03-receipts.md)** — What every resolved token records so the output is ground truth.
4. **[04-usage-categories](./04-usage-categories.md)** — `text` / `nonText` / `decorative` and how the resolver branches on them.
5. **[05-intent-language](./05-intent-language.md)** — The formal intent schema the contrast-target resolver executes.
6. **[06-states](./06-states.md)** — Hover / active / focus / disabled expression.
7. **[07-alpha-modifier](./07-alpha-modifier.md)** — Alpha as a token modifier with compositing-aware resolution.
8. **[08-gamut-and-formats](./08-gamut-and-formats.md)** — Output representations (OKLCH, hex, HSL, P3) and gamut metadata.
9. **[09-vocabulary-v1](./09-vocabulary-v1.md)** — The canonical semantic vocabulary shipped by the engine (OQ-1).
10. **[10-surface-pairs](./10-surface-pairs.md)** — Named surfaces, primary vs elevated, surface references in receipts.
11. **[11-audit-report](./11-audit-report.md)** — Audit feedback report schema and feedback channels.
12. **[12-config](./12-config.md)** — Adapter manifest + project config shapes.

JSON Schema stubs live under [`./schema/`](./schema/).

## Versioning policy

- **Spec document versions.** Each `.md` file carries a `version` field in its frontmatter. Patch bumps for editorial; minor bumps for additive clarifications; major bumps for any contract change.
- **Artifact versions.** Three artifacts get their own version tracks independent of the spec files they live in:
  - `vocabulary@0.1` — default canonical vocabulary (09-vocabulary-v1).
  - `surface-pairs@0.1` — default surface pair set (10-surface-pairs).
  - `audit-report@0.1` — audit report schema (11-audit-report).
  Default artifacts are published as inspectable, versioned files (ADR-013). Teams override via overlay maps; the overlay format is pinned to an artifact version.
- **Spec bundle version.** The overall spec version (this file) bumps when the composition changes: files added/removed, reading order changed, or any artifact version in the bundle bumps majorly.

## Unresolved decisions (punted)

Per user direction, three ADR-embedded `DECISION NEEDED` items are intentionally unresolved in this pass. Each is called out inline in the relevant spec file with options and a default lean; none of them block Step 1 resolver work against the default scenarios.

- **Mixed-usage tokens** (ADR-011) — see [04-usage-categories](./04-usage-categories.md).
- **Gamut-clipping strategy** (ADR-015) — see [08-gamut-and-formats](./08-gamut-and-formats.md).
- **Alpha reference-surface policy** (ADR-016) — see [07-alpha-modifier](./07-alpha-modifier.md).

## What this spec does not cover

- Implementation language, package shape, build tooling. Those are Step 1 concerns, not spec concerns.
- Authoring UI (Layer 3 phase 1) or the sticker sheet (phase 4).
- Natural-language intent translation (ADR-014 places that in the agent, not the engine).
- Cross-project audit aggregation (ADR-020 / closed OQ-5).

## Relationship to palette-pal

The engine's ramp math, contrast matrices, and OKLCH/hex conversions will be extracted in Step 1 from [`palette-pal`](https://github.com/davidthorn/palette-pal) (`src/lib/colorMath.ts`, `src/lib/exportContrastMap.ts`, `src/lib/exportTokens.ts`). The spec references those capabilities (continuous OKLCH curves, P3-first gamut clamp, WCAG + APCA matrices) but does not depend on the palette-pal repo at spec time.

## ADR coverage matrix

Every ADR in `plan.md` should appear in at least one spec file's front-matter `implements` field. Completeness is part of the Step 0 verification sweep.

| ADR | Spec file(s) |
|-----|--------------|
| ADR-001 | — (scoping ADR, no spec surface) |
| ADR-002 | — (layer architecture, informs all) |
| ADR-003 | 02-modes |
| ADR-004 | 02-modes |
| ADR-005 | 09-vocabulary-v1 |
| ADR-006 | 04-usage-categories, 05-intent-language, 10-surface-pairs |
| ADR-007 | 12-config |
| ADR-008 | 12-config |
| ADR-009 | 01-dtcg-container, 03-receipts |
| ADR-010 | 11-audit-report |
| ADR-011 | 00-overview, 04-usage-categories, 06-states |
| ADR-012 | 03-receipts, 08-gamut-and-formats |
| ADR-013 | 09-vocabulary-v1, 10-surface-pairs |
| ADR-014 | 05-intent-language |
| ADR-015 | 03-receipts, 08-gamut-and-formats |
| ADR-016 | 06-states, 07-alpha-modifier |
| ADR-017 | 12-config |
| ADR-018 | 01-dtcg-container, 12-config |
| ADR-019 | — (UI/CLI parity principle, informs Layer 3; no direct spec surface) |
| ADR-020 | 11-audit-report, 12-config |
