---
name: Surface pairs
version: 0.1.0
status: draft
implements: ADR-006, ADR-013
artifactVersion: surface-pairs@0.1
---

# Surface pairs

A **surface** is a background color context. Every non-decorative token resolves *against* a surface; the receipt records which surface via a reference, not inlined data (ADR-009). A **surface pair** is the relationship `(surface, tokens resolved against that surface)` — the unit of the Layer 3 surface-pair viewer.

This file defines the default surface taxonomy, how tokens declare their primary surface, and how the resolver interprets surface context.

## Default surfaces

The vocabulary ([09-vocabulary-v1](./09-vocabulary-v1.md)) declares four surfaces:

| Path | Role | Typical value (light) | Typical value (dark) |
|------|------|-----------------------|----------------------|
| `color.surface.main` | Document background | `#ffffff` | `#0a0a0a` |
| `color.surface.subtle` | Mildly recessed areas (sidebars, muted sections) | near-white with slight neutral tint | near-black lifted slightly |
| `color.surface.elevated` | Floating elements (cards, popovers, dialogs) | `#ffffff` with shadow, sometimes slightly warmer | lifted a step from `main` |
| `color.surface.inverse` | Inverted context (dark brand block in a light page) | `#0a0a0a` | `#ffffff` |

Values above are typical; actual values come from the resolver acting on the team's configured neutral ramp.

Teams can override via overlays to add surfaces (`color.surface.success`, `color.surface.brand`) or remove them.

## Surface pair declarations

Surfaces are paired with tokens through two fields on each non-decorative semantic token:

1. **`primarySurface`** (required) — a reference to the surface token. Describes the designer's intent for where this token typically appears.

   ```jsonc
   "color.action.primary.background": {
     "$extensions": {
       "com.pigmint": { "primarySurface": "color.surface.main", /* ... */ }
     }
   }
   ```

2. **`intent.surfaceContext`** (per [05-intent-language](./05-intent-language.md)) — how the resolver interprets surface at resolution time:

   - `"primary"` — resolve against `primarySurface`.
   - `"elevated"` — resolve against the elevated variant of `primarySurface`.
   - `"inverse"` — resolve against the inverse of `primarySurface`.
   - `"current"` — resolve at render time (runtime adapters); falls back to `primary` at compile time.

## Elevated variants

Each surface declares its own elevated variant in the default surface-pairs artifact:

```yaml
# surface-pairs@0.1 (illustrative)
surfaces:
  - path: color.surface.main
    elevated: color.surface.elevated
    inverse: color.surface.inverse
  - path: color.surface.subtle
    elevated: color.surface.main      # subtle's "elevated" is main
    inverse: color.surface.inverse
  - path: color.surface.elevated
    elevated: color.surface.elevated  # already elevated
    inverse: color.surface.inverse
  - path: color.surface.inverse
    elevated: color.surface.inverse
    inverse: color.surface.main
```

The resolver consults this artifact when an intent's `surfaceContext` is `"elevated"` or `"inverse"`. Overlays can retarget these relationships.

## Multi-surface tokens

Some tokens are authored once and resolved against multiple surfaces. For example, `color.foreground.main` must be legible on every surface a team actually uses. In that case:

```jsonc
"color.foreground.main": {
  "$extensions": {
    "com.pigmint": {
      "primarySurface": "color.surface.main",
      "additionalSurfaces": ["color.surface.elevated", "color.surface.subtle"],
      "intent": { /* ... */ }
    }
  }
}
```

The resolver runs intent resolution once per declared surface. Receipts under `$extensions.com.pigmint.modes.<mode>.surfaces.<surface>` carry per-surface values. Adapters choose which surface-variant to emit based on their semantics (Tailwind may emit CSS vars for all; MUI typically emits one and documents the assumption).

For tokens that genuinely only appear on one surface (e.g., `color.action.primary.background` sits on `surface.main`), `additionalSurfaces` is omitted.

## Surface receipts

Surface tokens themselves carry receipts. Their `resolvedAgainst` is `null` (surfaces are not resolved against other surfaces); instead, their receipt captures the contrast against the **document baseline** — defined per project config as the highest-contrast neutral in the relevant mode (usually pure white in light, pure dark in dark).

```jsonc
"color.surface.main": {
  "$extensions": {
    "com.pigmint": {
      "modes": {
        "light": {
          "value": { "oklch": "oklch(1 0 0)", "hex": "#ffffff" },
          "resolvedAgainst": null,
          "contrast": { "againstBaseline": 21.0 },
          "baselineReference": { "hex": "#ffffff" }
        }
      }
    }
  }
}
```

This keeps the receipts-are-ground-truth invariant intact without pretending a surface is "resolved against" something it isn't.

## Surface pairs and the audit tool

The audit tool ([11-audit-report](./11-audit-report.md)) reconstructs actual usage by inspecting built HTML/CSS:

- For every rendered color pair (foreground-on-background), it looks up the token and its declared `primarySurface`.
- If the actual background is `primarySurface`, the audit checks the receipt's reported contrast.
- If the actual background is *not* `primarySurface` (the token is used in a surface context the resolver didn't know about), the audit recomputes contrast against the observed surface and reports a `surface-context-mismatch` violation, with a suggested intent refinement (ADR-010 channel 1).

Accumulated surface-context-mismatch reports are the feedback that drives adding `additionalSurfaces` to the offending token, or splitting it into multiple tokens.

## Schema

Surface-pair artifact schema is part of the overlay-map family. No dedicated schema file; the adapter manifest ([12-config](./12-config.md)) references `surfaces` as a required capability.
