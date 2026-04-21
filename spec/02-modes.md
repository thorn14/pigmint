---
name: Mode matrix
version: 0.1.0
status: draft
implements: ADR-003, ADR-004
---

# Mode matrix

Every semantic token emits one resolved entry per supported mode under `$extensions["com.pigmint"].modes.*`. Modes are first-class siblings; the DTCG output is mode-agnostic (ADR-003). Each mode entry is explicitly resolved with its own receipt (ADR-004) — modes are not treated as composable transforms at emission time.

## Supported modes

A mode is a combination of three orthogonal facets, but the full cross-product is emitted as flat keys:

- **Scheme** — `light`, `dark`
- **Contrast** — `normal`, `high-contrast`
- **CVD (color vision deficiency)** — `none`, `deuteranopia`, `protanopia`, `tritanopia`, `achromatopsia`

The flat key is `{scheme}[-high-contrast][-{cvd}]`. Examples:

```
light
light-high-contrast
light-deuteranopia
light-high-contrast-deuteranopia
dark
dark-high-contrast
dark-protanopia
dark-high-contrast-tritanopia
```

Project config (see [12-config](./12-config.md)) declares which modes the engine emits. The default shipped profile is `[light, dark, light-high-contrast, dark-high-contrast]`; CVD variants are opt-in.

## Per-mode entry shape

```jsonc
"modes": {
  "light": {
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
      "apca": 68.4
    },
    "compliance": {
      "level": "AA-nonText",
      "target": "AA"
    },
    "gamut": {
      "inSrgb": true,
      "inP3": true,
      "clipped": false
    }
  },
  "dark": { /* independently resolved */ },
  "light-high-contrast": { /* independently resolved */ },
  "dark-high-contrast": { /* independently resolved */ }
}
```

Full receipt field semantics live in [03-receipts](./03-receipts.md). Output format representations (`oklch`, `hex`, `hsl`, `p3`) are defined in [08-gamut-and-formats](./08-gamut-and-formats.md).

## Full-matrix emission (ADR-004)

Each mode entry is resolved independently. The axes (scheme × contrast × CVD) are *not* composed as transforms at emission time. Reasons:

1. **Different base surface per mode.** Dark-mode high-contrast's primary surface is not `darken(light-mode primary surface)`; it is an independently declared surface whose contrast bands differ. An intent like "subtle border" picks a different ramp position in each.
2. **Receipts must be honest.** The receipt says "this value hits 4.62:1 on `color.surface.main` in `light` mode." That is a verified fact of the resolved pair, not a derivation. If modes were transforms, receipts would be computed at adapter time, which breaks receipts-as-ground-truth.
3. **CVD simulation interacts with surface choice.** A deuteranopia-safe danger/success pair may require different ramp steps than the normal-vision pair, and those choices must be made against the mode's own surface, not transformed.

Consequence: file size grows combinatorially with modes. For `~40 tokens × 4 modes`, that's 160 resolved entries. Acceptable per ADR-004; file sizes remain well under typical tooling thresholds.

## CVD resolution

When a CVD variant is emitted, the resolver:

1. Simulates each ramp's appearance under the CVD type (Machado et al. matrices, same approach palette-pal uses).
2. Recomputes the contrast matrix against the mode's surface.
3. Re-runs intent resolution against the simulated matrix.
4. Emits the *original* OKLCH/hex/etc. values (the display color, not the simulated color), but records simulated contrast values in the receipt under `contrast.simulated`.

This means a deuteranopia-mode token's `value.hex` is the hex a deuteranopic viewer would see on screen (same as normal vision — the pixels don't change), but the contrast receipt reflects the contrast that viewer actually perceives. Audits check the simulated contrast, not the nominal contrast.

## Default-mode projection

Per [01-dtcg-container](./01-dtcg-container.md), semantic tokens set a top-level `$value` matching their default-mode resolution (typically `light`). This is a convenience for DTCG consumers that do not read pigmint's mode extension.

When a token does not have a resolution for the default mode (rare — e.g., a dark-mode-only token), its top-level `$value` falls back to the lexicographically first mode for which it has a resolution, and the pigmint extension records `"defaultMode.fallback": true`.

## Missing-mode policy

The project config declares a mode coverage list. The resolver treats that list as a contract:

- Every semantic token must resolve in every declared mode, or emission fails with a per-token error listing the unsatisfied modes.
- Primitives are mode-agnostic — they have one `$value` and do not branch under `modes`.
- The audit tool (ADR-010, see [11-audit-report](./11-audit-report.md)) emits a `missing-mode` violation if a consumed token lacks an entry for a mode the audited build actually uses.

## Schema

Machine-checkable stub: [`schema/mode-entry.schema.json`](./schema/mode-entry.schema.json).
