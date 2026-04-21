---
name: DTCG container
version: 0.1.0
status: draft
implements: ADR-009, ADR-018
---

# DTCG container

Pigmint emits a single DTCG (Design Tokens Community Group) JSON file as its primary, always-emitted artifact. Adapters produce additional outputs in target-specific formats, but the DTCG file is the ground-truth product of Layer 1 and must remain consumable by any DTCG-aware tool (Style Dictionary, Tokens Studio, custom pipelines) without pigmint knowledge.

## Outer shape

```jsonc
{
  "$schema": "https://design-tokens.github.io/community-group/format/",
  "$description": "Pigmint-generated tokens.",
  "$extensions": {
    "com.pigmint": {
      "specVersion": "0.1.0",
      "vocabularyVersion": "vocabulary@0.1",
      "surfacePairsVersion": "surface-pairs@0.1",
      "generatedAt": "2026-04-18T12:00:00Z",
      "engine": { "version": "0.0.0" }
    }
  },
  "color": { /* primitives and semantic tokens — see namespaces below */ }
}
```

Pigmint-specific metadata lives under `$extensions["com.pigmint"]` (reverse-DNS per DTCG convention). Every pigmint extension key throughout the file uses the same namespace.

## Namespaces

Two sibling subtrees under `color`. Both are always emitted.

### Primitives — `color.primitive.*`

Raw ramp values, addressable by name. A sparse, stable grid sampled from the ramp's continuous curve (ADR-012). Example:

```jsonc
"color": {
  "primitive": {
    "red": {
      "$type": "color",
      "50":  { "$value": { "colorSpace": "srgb", "components": [0.99, 0.95, 0.95], "hex": "#fef2f2" } },
      "100": { "$value": { /* ... */ } },
      "500": { "$value": { /* ... */ } },
      "600": { "$value": { /* ... */ } },
      "900": { "$value": { /* ... */ } }
    }
  }
}
```

The token-level `$value` shape mirrors palette-pal's W3C DTCG export (see [08-gamut-and-formats](./08-gamut-and-formats.md) for sRGB vs P3 branching and the full multi-representation expansion under `$extensions.modes`).

Primitives are the escape hatch: teams that need a specific ramp step by designer judgment reference `{color.primitive.red.700}` directly.

### Semantic tokens — `color.<category>.<role>.*`

Resolved tokens with receipts. Reference primitives by DTCG alias:

```jsonc
"color": {
  "action": {
    "primary": {
      "$type": "color",
      "$value": "{color.primitive.blue.600}",
      "$extensions": {
        "com.pigmint": {
          "usage": "nonText",
          "intent": { /* formal intent — see 05-intent-language */ },
          "primarySurface": "color.surface.main",
          "modes": { /* — see 02-modes */ }
        }
      }
    }
  }
}
```

The canonical category layout (action, feedback, surface, foreground, border, focus, decorative) is defined in [09-vocabulary-v1](./09-vocabulary-v1.md).

## Aliasing rules

1. **Semantic tokens always alias primitives.** Never inline a hex value on a semantic token's top-level `$value`. Inlining breaks the dependency graph the audit tool relies on (ADR-009).
2. **Alias targets must exist in the same emission.** Cross-file aliasing is a Step 2+ adapter concern; Layer 1 self-contains.
3. **Mode-specific values live under `$extensions.modes.*` and are resolved, not aliased.** The alias on the top-level `$value` is the default-mode representation for tools that don't understand pigmint's mode extension. Per-mode entries carry their own resolved primitive reference inside their receipt.
4. **Decorative and alpha tokens can alias primitives that have no contrast receipt** (see [04-usage-categories](./04-usage-categories.md) and [07-alpha-modifier](./07-alpha-modifier.md)).

## Top-level `$value` on semantic tokens

Semantic tokens set top-level `$value` to the alias matching their "default mode" — typically `light`. This is a pragmatic concession for tools that read DTCG without understanding `$extensions.modes`. The canonical per-mode resolution lives under `$extensions.modes.*`; the top-level `$value` is a convenience projection, not the source of truth.

Which mode is "default" is declared in the pigmint extension block at file root (`"defaultMode": "light"`), overridable in project config ([12-config](./12-config.md)). Adapters may ignore the top-level `$value` and read modes directly.

## Standalone DTCG as primary product

Per ADR-018, the DTCG output is always emitted; adapter outputs are additive. A team running pigmint with no adapters declared gets a valid DTCG file they can feed into Style Dictionary, Tokens Studio, or any other DTCG consumer. Nothing in this spec permits an operating mode where DTCG is skipped in favor of an adapter output.

## Non-obvious constraints

- **Order.** Primitives are emitted before semantics so aliasing reads forward-only in linear scan order. Not a DTCG requirement; a pigmint convenience.
- **`$type`.** Always `color`. Pigmint does not emit non-color token types; those are out of scope.
- **`$description`.** Used at the file root for human-readable context only. Per-token descriptions are optional and, when present, come from the vocabulary definition (see [09-vocabulary-v1](./09-vocabulary-v1.md)), not generated.
- **Overlay reconstitution.** When a team's project config layers overlays on defaults (ADR-013), the emitted file represents the *merged* result. The receipts carry which artifact version contributed each token so audit tooling can diff against published defaults.

## Schema

Machine-checkable stub: [`schema/dtcg-container.schema.json`](./schema/dtcg-container.schema.json). The stub covers top-level structure and required fields; individual value shapes resolve in [02-modes](./02-modes.md), [03-receipts](./03-receipts.md), and [08-gamut-and-formats](./08-gamut-and-formats.md).
