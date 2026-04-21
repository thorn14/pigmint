---
name: Alpha modifier
version: 0.1.0
status: draft
implements: ADR-016
---

# Alpha modifier

Alpha transparency in pigmint is expressed as a **modifier on individual tokens**, not as a parallel primitive system. Alpha-carrying tokens declare a reference surface and an alpha value; the resolver performs compositing-aware resolution that accounts for the composited result when evaluating contrast.

Alpha support is **opt-in**. The default vocabulary ([09-vocabulary-v1](./09-vocabulary-v1.md)) ships without alpha tokens. Teams add them via overlay maps when they need overlays, scrims, or alpha-overlay states.

Parallel alpha ramps (Radix-style `redA1`..`redA12`) are **not a build target** (OQ-9, revised under ADR-020). The alpha-as-modifier approach covers the remaining use cases.

## Shape

```jsonc
"color.overlay.scrim": {
  "$type": "color",
  "$value": "{color.primitive.slate.900}",
  "$extensions": {
    "com.pigmint": {
      "usage": "decorative",
      "alpha": {
        "base": "{color.primitive.slate.900}",
        "value": 0.4,
        "referenceSurface": "color.surface.main"
      },
      "modes": {
        "light": {
          "value": {
            "hex": "#0f172a66",
            "rgba": "rgba(15, 23, 42, 0.4)",
            "colorMix": "color-mix(in oklch, var(--slate-900) 40%, transparent)"
          },
          "receipts": {
            "composited": { "hex": "#7d838b", "against": "color.surface.main" },
            "contrast": { "wcag21": 3.1, "apca": 45.2 },
            "compliance": { "level": "AA-nonText" }
          }
        }
      }
    }
  }
}
```

The extra `alpha` block declares the modifier; per-mode receipts add a `composited` field showing the effective rendered color after compositing base against reference surface.

## Resolution paths (three sub-cases)

The resolver picks one of three paths based on which fields are declared in `alpha`.

### 1. Fixed alpha, resolve step

The designer declares alpha; the resolver picks a ramp position whose composited result satisfies the token's compliance needs.

```jsonc
"alpha": {
  "base": { "ramp": "red" },          // ramp named, no step
  "value": 0.4,
  "referenceSurface": "color.surface.main",
  "intent": { /* formal intent; applied to the composited result */ }
}
```

Resolver:
1. Walk candidate positions in `red`.
2. For each, composite position_color over `color.surface.main` at alpha=0.4.
3. Compute contrast of the composited result against whatever the intent requires.
4. Pick the position that satisfies the intent per its preference policy.

This is the default case.

### 2. Fixed step, resolve alpha

The designer declares the ramp position; the resolver picks an alpha value that satisfies compliance. Less common but useful for scrims over content (where the designer knows the hue weight but not the transparency needed).

```jsonc
"alpha": {
  "base": "{color.primitive.slate.900}",
  "value": { "range": [0.2, 0.8] },
  "referenceSurface": "color.surface.main",
  "intent": { /* formal intent */ }
}
```

### 3. Both free, constrained optimization

Both position and alpha are variables. The resolver picks both. **Deferred — not before alpha-module v2.** Listed for completeness; the spec does not commit to semantics yet.

## Receipt additions for alpha

Alpha-token receipts (see [03-receipts](./03-receipts.md)) gain:

- `composited` — the effective rendered color after compositing. Hex + `against` reference.
- `alphaResolved` — the alpha value used, whether declared or chosen by the resolver.
- `intent` — the intent applied to the composited result (alpha tokens run their intent against the composited color, not the base).

`resolvedAgainst` on alpha-token receipts points at the contrast target (typically the text or content that sits *on top of* the composited alpha layer), **not** the reference surface. The reference surface is a separate field captured under `alpha.referenceSurface`.

## Reference surface — **DECISION NEEDED (ADR-016)**

Does pigmint require alpha tokens to declare a `referenceSurface` explicitly, or does it default to something (e.g., `color.surface.main`)?

**Options:**

- **Explicit required (leaning).** Every alpha token must declare its reference. Forces designers to state their assumption; audit tool has ground truth to verify against. Ergonomic cost: no sensible defaults for quick authoring.
- **Default with override.** Alpha tokens default to `color.surface.main` in light mode and `color.surface.inverse` in dark mode. Ergonomic win; hidden assumption that teams may get wrong.
- **Explicit when receipt-required, default when decorative.** Hybrid: decorative alpha tokens (scrims, decorative fills) default; text/nonText alpha tokens require explicit. Adds complexity.

This decision is not resolved in Step 0. The spec and the schema mark `referenceSurface` as required for the first pass; the default-with-override path can relax the constraint later without breaking existing tokens that declared it.

## Output representations

Adapters receive multiple representations per alpha token:

- `hex` — 8-digit hex with alpha (e.g., `#0f172a66`), for adapters that only support flat hex.
- `rgba` — CSS `rgba(r, g, b, a)` string.
- `colorMix` — CSS `color-mix(in oklch, <base> <pct>%, transparent)` for runtime-compositing-capable adapters.
- `precomposed` — the solid hex of the composited result against the reference surface (for adapters that must flatten to a solid color, like some MUI theme paths).

An adapter's manifest ([12-config](./12-config.md)) declares which alpha output form(s) it supports. The resolver warns if a project asks for alpha on an adapter that only supports pre-composed output when the actual rendering context varies (the pre-composed solid only matches where the component lands on the reference surface).

## Interaction with states

Step-shift states ([06-states](./06-states.md)) and alpha-overlay states are handled by different code paths. An alpha-overlay state is a state whose form is `"alpha-overlay"`; under the hood it is a specialization of this alpha modifier with a fixed `value` and `overlayBase` per Material Design conventions.

- State overlays use the *base token's own color* as the overlay base (typical Material pattern: hover = base color at 8% over base color).
- Compositing-aware resolution still applies: the resolver checks that the composited overlay result is perceptually distinct from the base color.

## Audit interactions

- **Placement verification.** The audit tool flags alpha tokens placed on surfaces other than their declared `referenceSurface`. The composited result against the actual surface may differ from the receipt.
- **Runtime vs precomposed mismatch.** If an adapter consumes `precomposed` but the build HTML uses the alpha token in a context the adapter did not anticipate, the audit reports `alpha-context-drift`.

## Schema

The alpha-token shape is captured in an extension to `receipt.schema.json`. No standalone alpha schema file.
