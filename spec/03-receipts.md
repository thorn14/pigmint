---
name: Receipts
version: 0.1.0
status: draft
implements: ADR-009, ADR-012, ADR-015
resolves: OQ-3
---

# Receipts

A **receipt** is the metadata that makes a resolved token's accessibility claims verifiable. Every mode entry under `$extensions["com.pigmint"].modes.*` carries a receipt. Receipts are the mechanism by which pigmint keeps its core promise: *the DTCG file is ground truth, because every value comes with a record of how it was produced and what it hits against what.*

Receipts are addressed at two audiences: audit tooling (machine-reads every field) and humans (reads the receipt when a value looks wrong).

## Fields

```jsonc
{
  "value": {
    "oklch": "oklch(0.62 0.18 258)",
    "hex": "#3b82f6",
    "hsl": "217 91% 60%",
    "p3": "color(display-p3 0.23 0.51 0.96)"
  },
  "source": {
    "ramp": "blue",
    "position": 0.573,
    "nearestPrimitive": "color.primitive.blue.600"
  },
  "resolvedAgainst": "color.surface.main",
  "contrast": {
    "wcag21": 4.62,
    "apca": 68.4,
    "simulated": { "wcag21": 4.51, "apca": 66.9 }
  },
  "compliance": {
    "target": "AA",
    "level": "AA-nonText",
    "thresholds": { "text": 4.5, "nonText": 3.0 }
  },
  "gamut": {
    "inSrgb": true,
    "inP3": true,
    "clipped": false
  },
  "intent": "ref:token.$extensions.com.pigmint.intent",
  "cvd": { "none": "<self>", "deuteranopia": "ref:modes['light-deuteranopia']" },
  "provenance": {
    "vocabulary": "vocabulary@0.1",
    "overlay": "./overlays/product-muted.yaml@HEAD",
    "resolvedAt": "2026-04-18T12:00:00Z"
  }
}
```

### `value`

Multiple representations of the resolved color. OKLCH is source of truth (ADR-015). `hex`, `hsl`, `p3` are derived. Adapters pick which to consume. Details in [08-gamut-and-formats](./08-gamut-and-formats.md).

### `source`

Where in the ramp this value came from. Per ADR-012, ramps are continuous curves; `position` is the scalar `t ∈ [0, 1]` along the curve, and `nearestPrimitive` names the closest addressable primitive (for humans debugging "why this value?"). For primitives that themselves are emitted, `position` lands exactly on the primitive's grid position.

```jsonc
"source": { "ramp": "red", "position": 0.573, "nearestPrimitive": "color.primitive.red.600" }
```

### `resolvedAgainst`

A DTCG-style reference to the surface token this value was resolved against. **A reference, not inlined data** (ADR-009). The audit tool resolves the reference to look up the surface's mode-specific value when checking contrast.

```
"resolvedAgainst": "color.surface.main"
```

For tokens with no surface context (decorative tokens per [04-usage-categories](./04-usage-categories.md), or primitives), this field is `null`.

### `contrast`

Numeric contrast values between `value` and `resolvedAgainst`'s value in the same mode.

- `wcag21` — WCAG 2.1 relative-luminance ratio (1.0 to 21.0). Symmetric.
- `apca` — APCA `Lc` value. Polarity-sensitive (sign indicates dark-on-light vs light-on-dark).
- `simulated` — Present only under CVD modes. Contrast as perceived by the simulated viewer. See [02-modes](./02-modes.md).

For tokens without surface context, `contrast` is `null`.

### `compliance`

```jsonc
"compliance": {
  "target": "AA",          // the team-declared target from project config
  "level": "AA-nonText",   // which level this specific pairing satisfied
  "thresholds": { "text": 4.5, "nonText": 3.0 }  // resolved numeric thresholds
}
```

`level` is the most demanding threshold this pair *passes*. Possible values (WCAG 2.1): `AAA-text`, `AAA-nonText`, `AA-text`, `AA-nonText`, `fail`. APCA variants use APCA-specific labels when APCA is the active compliance engine per project config.

### `gamut`

Whether the resolved OKLCH value fits in sRGB and P3, and whether a gamut clip was applied when rendering to `hex` or `p3`.

```jsonc
"gamut": { "inSrgb": true, "inP3": true, "clipped": false }
```

When `clipped: true`, the receipt carries a sibling `gamut.clippedFrom` with the original OKLCH before clipping, so audits can reason about the perceptual distance introduced by clipping.

> **DECISION NEEDED (ADR-015).** Gamut-clipping strategy when OKLCH falls outside sRGB. Options: clip-to-nearest-sRGB (chroma reduction, hue preserved); clip-with-chroma-preservation (may shift lightness); reject (resolver retries). Not resolved in this pass. Engine default is TBD; per-token override via intent policy is supported. Receipts capture the strategy used via a `gamut.strategy` field once resolved.

### `intent`

A reference (or inline copy) of the formal intent that produced this selection. See [05-intent-language](./05-intent-language.md). Keeping this in the receipt means audits can re-run the intent against a different ramp or surface and compare outcomes.

### `cvd`

Cross-references to the CVD variants of this token. `"none"` points at self; the other CVD types reference the relevant mode key. Audit tooling uses this to verify CVD variants resolved consistently.

### `provenance`

Which artifact version produced this token, whether an overlay was involved, and when the resolver ran. Audits that span time compare provenance blocks to detect drift.

## What receipts do NOT include

- **Original ramp hex inputs.** Those are the ramp curve's source; receipts reference the curve, not its seeds.
- **Alternative candidates considered.** The resolver may consider many candidate positions before picking one. The receipt records the *chosen* position, not the search. Alternatives surface in [11-audit-report](./11-audit-report.md) when audits suggest refinements.
- **Per-adapter representations.** Adapter-specific output (Tailwind CSS var names, MUI palette paths) is not part of the receipt. Adapters emit their own sidecar receipts if their format can't carry `$extensions`.

## Alpha-token receipts

Alpha tokens ([07-alpha-modifier](./07-alpha-modifier.md)) have specialized receipts that add `composited`: the effective rendered color after compositing the base at the declared alpha against the declared reference surface. Contrast math runs on the composited result.

## Schema

Machine-checkable stub: [`schema/receipt.schema.json`](./schema/receipt.schema.json).
