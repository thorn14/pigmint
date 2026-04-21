---
name: Usage categories
version: 0.1.0
status: draft
implements: ADR-006, ADR-011
---

# Usage categories

Every semantic token declares a `usage` category. The category determines which resolver path runs and what compliance thresholds apply. Without categories, decorative tokens get over-constrained (forced to pass text-contrast thresholds they don't need) and functional tokens get under-constrained (the resolver doesn't know whether WCAG 1.4.3 text thresholds or 1.4.11 non-text thresholds apply).

Three categories are defined.

## `text`

Tokens that color text rendered on a surface. Subject to WCAG 2.1 SC 1.4.3 (contrast of 4.5:1 for normal text, 3:1 for large text at AA; 7:1 / 4.5:1 at AAA) or the APCA equivalent per project config.

- **Resolver path.** Full contrast-target resolver ([05-intent-language](./05-intent-language.md)) with text thresholds.
- **Required fields.** `primarySurface`, `intent`.
- **Receipt.** Always carries `contrast` and `compliance`.
- **Typical tokens.** `color.foreground.main`, `color.foreground.muted`, `color.feedback.danger.text`, `color.action.primary.text`.

## `nonText`

Tokens that color non-text UI elements — borders, icons, focus rings, progress indicators. Subject to WCAG 2.1 SC 1.4.11 (3:1 at AA; AAA has no explicit non-text threshold — pigmint treats 4.5:1 as the effective AAA target for non-text).

- **Resolver path.** Full contrast-target resolver with non-text thresholds.
- **Required fields.** `primarySurface`, `intent`.
- **Receipt.** Always carries `contrast` and `compliance`.
- **Typical tokens.** `color.border.main`, `color.focus.ring`, `color.action.primary.background`, `color.feedback.success.icon`.

## `decorative`

Tokens that serve visual purposes not subject to contrast requirements — brand accents as backgrounds behind unrelated content, skeleton loaders, gradients, illustration fills. WCAG 1.4.3 exempts decorative content from text-contrast requirements; APCA similarly exempts purely presentational color.

- **Resolver path.** **Pass-through.** The resolver does not run intent resolution; it takes the ramp position the designer named and emits the value directly. No surface is required.
- **Required fields.** A primitive reference (`$value` aliasing a specific `color.primitive.*.step`).
- **Receipt.** `contrast` and `resolvedAgainst` are `null`. `source` still records ramp + position + nearestPrimitive. `compliance.level` is `"exempt"`.
- **Typical tokens.** `color.decorative.accent.*`, `color.decorative.skeleton.*`, brand-identity fills.

**Why decorative is in the default vocabulary.** Per ADR-011, the default vocabulary ships decorative tokens as a first-class category (`color.decorative.*`). If we didn't, teams would reinvent decorative tokens locally as semantic tokens with `usage: "text"` or `"nonText"` — which forces the resolver to pick contrast-passing values for roles that don't need them, defeating the purpose.

## Resolver branching rule

Concretely, the Layer 1 resolver branches once per token:

```
for token in semantic tokens:
    if token.usage == "decorative":
        emit pass_through(token)          # source, value, gamut; no contrast/compliance
    else:
        emit full_resolve(token)          # + intent, surface, contrast, compliance
```

Primitives are outside this loop — they have no usage category (they are not semantic).

## Mixed-usage tokens — **DECISION NEEDED (ADR-011)**

Some tokens get used both ways in practice: a brand accent appears as a decorative fill in hero sections and as colored text in a navbar. How should the system handle this?

**Option A — Split at design time (preferred lean).** The vocabulary requires separate tokens for distinct uses: `color.accent.text` (`usage: "text"`) and `color.accent.decorative` (`usage: "decorative"`). Design-time discipline, clean receipts, audit-verifiable.

**Option B — Tag-and-audit at runtime.** One token carries a primary `usage` tag; the audit tool flags individual placements where the actual use contradicts the declared category.

This ADR is not resolved in Step 0. The spec assumes **Option A** for the default vocabulary in [09-vocabulary-v1](./09-vocabulary-v1.md) (where accent-type tokens are deliberately split). Teams that prefer Option B can override via their overlay maps when this decision is ratified.

Impact if Option B is later chosen:
- Receipt gains a `usage.declared` vs `usage.observed` field pair.
- Audit tool gains a `usage-mismatch` violation type.
- Default vocabulary shrinks (fewer split tokens).

## Interaction with intent

`usage` is not an intent. It is the categorical gate on whether intent applies at all. Within `text` and `nonText`, the intent language ([05-intent-language](./05-intent-language.md)) describes *how* to select inside the appropriate contrast band.

## Failure modes

- **Decorative token with a surface declared.** Resolver warning: surface is ignored. Vocabulary should drop it.
- **Text/nonText token with no surface.** Resolver error. Every contrast-resolved token needs a `primarySurface`.
- **Decorative token aliasing a semantic token.** Resolver error. Decorative tokens alias primitives only. Chaining semantic → semantic is a recipe for surprise when one of them retargets.
- **Text token passing only at `AA-nonText`.** Receipt records `level: "AA-nonText"`, `compliance.target: "AA"`; audit tool flags as `contrast-under-target` because the target was AA-text. The value is emitted, but the audit will not silently accept it.

## Schema

No standalone schema file for usage categories; the `usage` field is a required property of both `vocabulary-token.schema.json` and the per-token pigmint extension. Enumeration: `["text", "nonText", "decorative"]`.
