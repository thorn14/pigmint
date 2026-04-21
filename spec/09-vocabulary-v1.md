---
name: Canonical semantic vocabulary v1
version: 0.1.0
status: draft
implements: ADR-005, ADR-013
resolves: OQ-1
artifactVersion: vocabulary@0.1
---

# Canonical semantic vocabulary v1

The semantic token set pigmint emits by default. Teams override via overlay maps (ADR-013); adapters map canonical names to framework-specific names. This is the "default layer" of ADR-013's composition, published as an inspectable versioned artifact.

Designed to cover the common surface area of Tailwind + shadcn and MUI targets without over-committing — enough to render a real app, small enough to evolve with author usage (ADR-020).

## Categories

Seven categories. Each token's fully qualified path is `color.<category>.<role>[.<variant>]`.

- **`action`** — interactive affordances (buttons, links, controls).
- **`feedback`** — status communication (danger, success, warning, info).
- **`surface`** — background colors (main, elevated, inverse).
- **`foreground`** — text and icon colors on surfaces.
- **`border`** — hairlines, dividers, outlines.
- **`focus`** — focus indicators.
- **`decorative`** — brand accents, skeleton loaders, illustrative fills.

## Token inventory

### Action

| Path | Usage | Default intent | States |
|------|-------|----------------|--------|
| `color.action.primary.background` | nonText | `{ threshold: AA-nonText, preference: lowest-passing, consistency: matched-across-ramps, surfaceContext: primary }` | base, hover, active, focus, disabled |
| `color.action.primary.text` | text | `{ threshold: AA-text, preference: highest-contrast, consistency: independent, surfaceContext: current }` | base, disabled |
| `color.action.primary.border` | nonText | `{ threshold: AA-nonText, preference: lowest-passing, consistency: matched-across-ramps, surfaceContext: primary }` | base, hover, focus |
| `color.action.secondary.background` | nonText | same as primary (different ramp via overlay) | base, hover, active, focus, disabled |
| `color.action.secondary.text` | text | same as primary.text | base, disabled |
| `color.action.secondary.border` | nonText | same as primary.border | base, hover, focus |
| `color.action.tertiary.background` | nonText | `{ threshold: AA-nonText, preference: lowest-passing, consistency: matched-across-ramps, surfaceContext: primary }` | base, hover, active, focus, disabled |
| `color.action.tertiary.text` | text | same as primary.text | base, disabled |

Tertiary is reserved for the "quietest" interactive level (ghost buttons, text-only links). Adapters may map primary → `--primary`, secondary → `--secondary`, tertiary → `--muted` or framework equivalents.

### Feedback

| Path | Usage | Default intent | States |
|------|-------|----------------|--------|
| `color.feedback.danger.background` | nonText | `{ threshold: AA-nonText, preference: matched-to-set, consistency: matched-across-ramps, surfaceContext: primary }` | base, hover, focus |
| `color.feedback.danger.text` | text | `{ threshold: AA-text, preference: matched-to-set, consistency: matched-across-ramps, surfaceContext: primary }` | base |
| `color.feedback.danger.border` | nonText | `{ threshold: AA-nonText, preference: matched-to-set, consistency: matched-across-ramps, surfaceContext: primary }` | base |
| `color.feedback.danger.icon` | nonText | same as danger.text | base |
| `color.feedback.success.*` | same as danger.* | same as danger (different ramp) | same as danger |
| `color.feedback.warning.*` | same as danger.* | same as danger (different ramp) | same as danger |
| `color.feedback.info.*` | same as danger.* | same as danger (different ramp) | same as danger |

Feedback states are matched-to-set so danger, success, warning, info all feel perceptually equivalent. This is where ADR-006's "set selection" optimization pays off.

### Surface

| Path | Usage | Default intent | States |
|------|-------|----------------|--------|
| `color.surface.main` | nonText | `{ threshold: AA-nonText, preference: highest-contrast, consistency: independent, surfaceContext: primary }` | base |
| `color.surface.elevated` | nonText | same as main (selects one step toward the non-neutral end) | base |
| `color.surface.inverse` | nonText | same as main (selects the ramp's opposite-end lightness) | base |
| `color.surface.subtle` | nonText | same as main (between main and elevated) | base |

Surfaces drive the "resolve against" field of other tokens. They themselves resolve against the document baseline (white in light mode; declared neutral dark in dark mode). The `primarySurface` for a surface token is self-referential — recorded in receipts as `"resolvedAgainst": null` with the numeric contrast computed against the document baseline.

### Foreground

| Path | Usage | Default intent | States |
|------|-------|----------------|--------|
| `color.foreground.main` | text | `{ threshold: AAA-text, preference: highest-contrast, consistency: independent, surfaceContext: primary }` | base |
| `color.foreground.muted` | text | `{ threshold: AA-text, preference: matched-to-set, consistency: matched-across-ramps, surfaceContext: primary }` | base |
| `color.foreground.subtle` | text | `{ threshold: AA-text, preference: lowest-passing, consistency: matched-across-ramps, surfaceContext: primary }` | base |
| `color.foreground.inverse` | text | `{ threshold: AAA-text, preference: highest-contrast, consistency: independent, surfaceContext: inverse }` | base |

Main, muted, subtle are the three typical text weights. Inverse is for text on inverted surfaces (dark text on a light brand color, typically).

### Border

| Path | Usage | Default intent | States |
|------|-------|----------------|--------|
| `color.border.main` | nonText | `{ threshold: AA-nonText, preference: matched-to-set, consistency: matched-across-ramps, surfaceContext: primary }` | base |
| `color.border.subtle` | nonText | `{ threshold: AA-nonText, preference: lowest-passing, consistency: matched-across-ramps, surfaceContext: primary }` | base |
| `color.border.prominent` | nonText | `{ threshold: AA-nonText, preference: highest-contrast, consistency: matched-across-ramps, surfaceContext: primary }` | base |

Canonical example from the plan ("subtle borders that don't disappear on muted surfaces") is this token with `consistency: matched-across-ramps`. Teams that want Radix-style 12-step semantics can override via overlay.

### Focus

| Path | Usage | Default intent | States |
|------|-------|----------------|--------|
| `color.focus.ring` | nonText | `{ threshold: AA-nonText, preference: highest-contrast, consistency: independent, surfaceContext: current }` | base |
| `color.focus.outline` | nonText | `{ threshold: AAA-text, preference: highest-contrast, consistency: independent, surfaceContext: current }` | base |

`surfaceContext: current` means the focus token resolves against whatever surface it renders on — in compile-time adapters this degrades to `primary`, in runtime-aware adapters it picks per-context. Focus needs the highest contrast available because focus indicators are safety-critical.

### Decorative

| Path | Usage | Default intent | States |
|------|-------|----------------|--------|
| `color.decorative.accent.subtle` | decorative | — (pass-through; references a specific primitive) | base |
| `color.decorative.accent.bold` | decorative | — | base |
| `color.decorative.skeleton.base` | decorative | — | base |
| `color.decorative.skeleton.highlight` | decorative | — | base |

Decorative tokens skip the resolver; their `$value` aliases a specific primitive picked by the designer. Receipts carry `source` only; `contrast` and `compliance` are `null` / `"exempt"` per [04-usage-categories](./04-usage-categories.md).

Shipping decorative as a first-class category prevents teams from reinventing it locally as `color.accent.*` with `usage: "text"` (which over-constrains the resolver) or as `usage: "nonText"` (which still over-constrains).

## Required states by token

Not every token needs a full state set. The vocabulary declares per-token `states` requirements; resolvers emit only requested states. Adapters that expect more states (e.g., MUI wants hover/active on `foreground.main`) synthesize them from `base` with no contrast guarantees, and receipts record `"synthesized": true` so audits can flag the missing provenance.

## Overlay customization

Teams override the vocabulary by providing an overlay map in project config (ADR-013, [12-config](./12-config.md)):

```yaml
overlays:
  - path: ./overlays/product.yaml
```

An overlay can:

- **Add tokens.** New paths under `color.*` merge into the vocabulary.
- **Change ramp binding.** Retarget `color.action.primary.*` to a different ramp without changing intents.
- **Change intents.** Refine the default intent on a specific token.
- **Remove tokens.** Mark a token `"$extensions.com.pigmint.removed": true` — resolver skips it, adapters do not emit it.
- **Bump artifact version.** Declare `extends: vocabulary@0.1` in the overlay to pin compatibility.

Overlay files are versioned in the team's repo. Pigmint ships overlay diff tooling so migrating between vocabulary versions is a diff-and-review workflow.

## Adapter naming mappings

Adapters do not ship in Step 0. When they ship, they translate canonical paths to framework-specific names. Examples for reference:

- **Tailwind + shadcn** — `color.action.primary.background` → `--primary`; `color.foreground.main` → `--foreground`.
- **MUI** — `color.action.primary.background` → `palette.primary.main`; state shifts map to `palette.primary.hover` (v6+) or are computed in component overrides (v5).

The preset mapping for shadcn is defined by the Tailwind adapter; the MUI mapping by the MUI adapter. Neither concern of this spec.

## Versioning

This artifact is `vocabulary@0.1`. A minor bump (`0.2`) may add tokens. A major bump (`1.0`) may rename or remove tokens. Overlays pin to major versions.

## Schema

Machine-checkable stub: [`schema/vocabulary-token.schema.json`](./schema/vocabulary-token.schema.json). Each entry in the vocabulary conforms to this schema; the overall vocabulary is a keyed map of `{path: entry}`.
