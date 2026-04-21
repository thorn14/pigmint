---
name: Gamut and output formats
version: 0.1.0
status: draft
implements: ADR-012, ADR-015
---

# Gamut and output formats

The resolver operates in OKLCH — source of truth (ADR-015). Every emitted value is serialized into multiple representations so adapters can pick whichever their target framework expects, without per-adapter conversion code.

## Emitted representations

Every resolved value's `value` block ([03-receipts](./03-receipts.md)) contains up to four representations:

| Key       | Format                              | Source                                | Gamut       |
|-----------|-------------------------------------|---------------------------------------|-------------|
| `oklch`   | CSS `oklch(L C h)` string           | native                                | unclamped   |
| `hex`     | sRGB hex (`#rrggbb`)                | gamut-clip to sRGB, then convert      | sRGB        |
| `hsl`     | CSS `H S% L%` string (sRGB)         | gamut-clip to sRGB, then convert      | sRGB        |
| `p3`      | CSS `color(display-p3 r g b)` string | gamut-clip to P3, then convert       | P3 (opt-in) |

Adapters declare which representations they want in their manifest; the resolver only emits what is requested plus `oklch` (always emitted as the truth value).

Rationale: palette-pal already emits sRGB and P3 variants per token; pigmint extends that pattern with HSL (needed by shadcn) and explicit OKLCH truth.

## P3 scope (OQ-8)

Pigmint emits P3 representations when an adapter requests them. Full end-to-end P3 (audit calculations in P3 space, sticker sheet rendering on P3 displays) is out of Step 0-5 scope per OQ-8. Current commitment is **capability day-one, full pipeline deferred**.

- Engine emits P3 values and flags gamut in receipts.
- Audit tooling treats sRGB as default compliance target.
- Adapters opt into P3 consumption when they are ready.

## Gamut metadata

Every per-mode receipt contains a `gamut` block:

```jsonc
"gamut": {
  "inSrgb": true,
  "inP3": true,
  "clipped": false
}
```

When a value falls outside a gamut:

```jsonc
"gamut": {
  "inSrgb": false,
  "inP3": true,
  "clipped": true,
  "strategy": "chroma-preserve",
  "clippedFrom": { "oklch": "oklch(0.62 0.30 258)" }
}
```

`clippedFrom` carries the original OKLCH before the clip was applied, so audits can reason about perceptual distance introduced by clipping.

## Gamut-clipping strategy — **DECISION NEEDED (ADR-015)**

When an OKLCH value falls outside sRGB gamut (common for vivid ramps), the engine must pick a clipping strategy. Three candidates:

- **`chroma-reduce`** — lower chroma while keeping L and h constant. Classic approach; predictable; may look desaturated for high-chroma brand colors.
- **`chroma-preserve`** — preserve chroma by shifting lightness to the nearest in-gamut point along the hue. Keeps saturation punch; may perceptibly shift the perceived lightness, which destabilizes contrast math.
- **`reject`** — treat out-of-gamut as an unsatisfiable candidate; force the resolver to try a different step. Purest but may leave intents unsatisfiable on narrow ramps.

**This decision is not resolved in Step 0.** The engine default for Step 1 is TBD. Per-token override is supported via `intent.constraints.gamutStrategy`. The receipt always records which strategy was used under `gamut.strategy`.

Palette-pal today uses a P3-first clamp (`clampChroma` on sRGB fallback), which is closest to `chroma-reduce`. That is a reasonable day-one default if the decision stays unresolved — it keeps behavior continuous with palette-pal's existing math.

## Continuous curves vs primitive grid (ADR-012)

Ramps are continuous OKLCH curves. The primitive grid (e.g., `50, 100, 200, ..., 950`) is a sparse, named sampling of the curve for human addressing. The resolver samples densely (40+ positions) internally and selects optimal positions per intent.

Per-token `source.position` is the scalar `t ∈ [0, 1]` along the curve; `source.nearestPrimitive` names the closest grid position. See [03-receipts](./03-receipts.md).

## Format conversion notes

- **OKLCH ↔ sRGB hex.** Via culori's `formatHex` after clamping (palette-pal's pattern).
- **OKLCH ↔ HSL.** sRGB roundtrip: OKLCH → sRGB → HSL. The shadcn convention uses space-separated HSL without the `hsl()` wrapper (`"217 91% 60%"`), which is what the Tailwind adapter will emit.
- **OKLCH ↔ P3.** Direct conversion via culori's `p3` converter. No sRGB roundtrip. When a color is sRGB-in-gamut, the P3 representation is still emitted with the same perceptual coordinates; P3's extra gamut matters only when sRGB clips.

## Auditing gamut

The audit tool ([11-audit-report](./11-audit-report.md)) does not itself compute gamut; it reads the `gamut` block from receipts. Violations surface when:

- An adapter consumed a `p3` value but the build output was shipped to users on sRGB-only displays (detected via opt-in `--profile=srgb` audit flag).
- A clipped color's `contrast` value was computed on the *pre-clip* OKLCH and does not match the recomputed contrast on the post-clip hex (resolver bug; receipt bug).

## Schema

Gamut and format fields live inside `receipt.schema.json`. No standalone schema file.
