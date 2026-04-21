---
name: Intent language
version: 0.1.0
status: draft
implements: ADR-006, ADR-014
resolves: OQ-2
---

# Intent language

The **formal intent** is the query the contrast-target resolver (ADR-006) executes to pick a ramp position for a semantic token. Formal intents are pure-function input — deterministic, reproducible, inspectable.

Pigmint's engine contract **only accepts formal intents**. Natural-language descriptions ("subtle borders that don't disappear on muted surfaces") belong to the agent layer per ADR-014 and are translated to formal intents before the resolver sees them. The engine makes no guarantees about natural language; it guarantees determinism given formal input.

## Shape

```jsonc
{
  "threshold": { "kind": "wcag", "level": "AA", "usage": "nonText" },
  "preference": "matched-to-set",
  "consistency": "matched-across-ramps",
  "surfaceContext": "primary",
  "constraints": { }
}
```

Every field is required. Omitting any means the resolver rejects the intent with a clear error.

### `threshold`

The compliance target this intent must satisfy.

```jsonc
"threshold": { "kind": "wcag" | "apca", "level": "AA" | "AAA", "usage": "text" | "nonText" }
```

- `kind` — compliance engine. WCAG 2.1 ratio-based, or APCA Lc-based. Per-intent override of the project config's global compliance choice.
- `level` — `AA` or `AAA`. Pigmint does not emit `A` — below-AA is not a compliance target.
- `usage` — must align with the token's declared `usage` category ([04-usage-categories](./04-usage-categories.md)). Decorative tokens bypass the resolver and have no intent.

The resolver translates `threshold` into a concrete numeric cutoff:

| kind | level | usage | WCAG 2.1 ratio | APCA Lc (abs) |
|------|-------|-------|----------------|---------------|
| wcag | AA | text | 4.5:1 | — |
| wcag | AA | nonText | 3.0:1 | — |
| wcag | AAA | text | 7.0:1 | — |
| wcag | AAA | nonText | 4.5:1 (pigmint convention) | — |
| apca | AA | text | — | 60 |
| apca | AA | nonText | — | 45 |
| apca | AAA | text | — | 75 |
| apca | AAA | nonText | — | 60 (pigmint convention) |

> The APCA thresholds here match the Lc conventions palette-pal already uses (`exportContrastMap.ts`). APCA's official bronze/silver/gold tiers are adjacent but not identical; pigmint's AA/AAA labels are pragmatic mappings.

### `preference`

Among candidate ramp positions that meet the threshold, which does the resolver prefer?

- `"lowest-passing"` — the smallest-contrast candidate that clears the threshold. Minimizes visual weight. Typical for subtle borders, dividers.
- `"highest-contrast"` — the candidate with the maximum contrast. Typical for emphatic text (`color.foreground.main`), focus rings.
- `"matched-to-set"` — the candidate whose contrast is closest to the median of this intent's peers across all ramps (see `consistency`). Typical for colored text on colored surfaces where all feedback tokens should feel equivalently weighted.
- `"anchored"` — the candidate whose contrast is closest to a declared anchor value. Declared via `constraints.anchor` (a numeric contrast value or a reference to another token's resolved contrast).

### `consistency`

How to reconcile this intent across multiple ramps.

- `"independent"` — each ramp resolves on its own. Consistency between ramps is coincidental.
- `"matched-across-ramps"` — the resolver runs the intent against every ramp used by tokens sharing this intent, then picks positions that minimize contrast variance across the set. This is where the resolver is doing real N-dimensional optimization (ADR-006).
- `"anchored-to-reference"` — choose the contrast hit by a named reference ramp (e.g., `blue`), then pick positions in other ramps that best match that contrast.

`consistency` and `preference` combine: `preference: "matched-to-set"` implicitly requires `consistency: "matched-across-ramps"` (enforcement: the resolver errors on the invalid pairing `preference: "matched-to-set"` with `consistency: "independent"`).

### `surfaceContext`

Which surface the token resolves against, expressed abstractly so the same intent can be reused across surface pairings.

- `"primary"` — the token's declared `primarySurface` ([10-surface-pairs](./10-surface-pairs.md)).
- `"elevated"` — the elevated variant of the primary surface, if declared.
- `"inverse"` — the inverse surface (dark in light mode, light in dark mode).
- `"current"` — resolved against whatever surface the token is actually placed on at render time. Meaningful only for adapters that can emit runtime-aware resolution (e.g., CSS `color-mix` with computed values); compile-time adapters treat `"current"` as `"primary"`.

### `constraints`

Extension point for preference-specific and adapter-specific refinements.

```jsonc
"constraints": {
  "anchor": 4.8,                       // for preference: "anchored"
  "minChroma": 0.08,                   // never pick a position with chroma below this
  "avoidPositions": [0.05, 0.95],      // skip extreme ends of the ramp
  "gamutStrategy": "chroma-preserve"   // override the default gamut clip (see 08-gamut-and-formats)
}
```

`constraints` is open-ended. Unknown keys are ignored by the resolver but preserved in the receipt so audit tooling can surface them.

## Preference × consistency interaction matrix

Not every combination is valid. The resolver rejects invalid pairings at intent parse time.

| preference \ consistency | independent | matched-across-ramps | anchored-to-reference |
|--------------------------|-------------|----------------------|-----------------------|
| lowest-passing           | ✓           | ✓                    | ✓                     |
| highest-contrast         | ✓           | ✓                    | ✓                     |
| matched-to-set           | ✗           | ✓                    | ✗                     |
| anchored                 | ✓           | ✗                    | ✓                     |

Rationale:

- `matched-to-set` requires seeing the whole set; `independent` is contradictory.
- `anchored` declares a specific anchor; `matched-across-ramps` is ambiguous next to it.
- `anchored-to-reference` is a flavor of anchoring; combining with `anchored` means the anchor comes from a declared reference.

## Unsatisfiable intents

If no position in a ramp satisfies `threshold`, the resolver fails with a structured error:

```jsonc
{
  "error": "unsatisfiable-intent",
  "token": "color.feedback.danger.text",
  "ramp": "red",
  "intent": { /* the formal intent */ },
  "surface": "color.surface.elevated",
  "bestCandidate": { "position": 0.92, "contrast": 4.1 },
  "threshold": 4.5,
  "suggestions": ["extend ramp lightness range", "lower threshold to AA-nonText", "change surfaceContext"]
}
```

Adapters and CLI surface this error; agents react by either revising the formal intent (ADR-014) or escalating to the human.

## Relationship to natural language (ADR-014)

The CLI accepts two input modes. The engine only sees the formal mode.

1. **Formal mode.** YAML/JSON conforming to [`schema/intent.schema.json`](./schema/intent.schema.json). Direct resolver input.
2. **Agent-mediated mode.** Natural-language sentence + context (existing ramps, vocabulary, brand notes) in. Agent produces formal intent JSON out. CLI pipes formal intent to the resolver.

The engine does not import any agent-side code. It does not interpret language. It receives formal intents and returns resolved tokens with receipts — nothing more.

## Schema

Machine-checkable stub: [`schema/intent.schema.json`](./schema/intent.schema.json).
