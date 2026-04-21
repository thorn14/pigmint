---
name: States
version: 0.1.0
status: draft
implements: ADR-011, ADR-016
---

# States

Interactive tokens carry variants for their interaction states: `hover`, `active`, `focus`, `disabled`. Pigmint supports two expression forms for states, chosen per-token or per-vocabulary:

1. **Step-shift.** Each state resolves to a different ramp position; the receipt and the mode matrix treat each state as its own resolved value.
2. **Alpha-overlay.** The state is a fixed-opacity overlay of a color on top of the base. A specialization of the alpha modifier ([07-alpha-modifier](./07-alpha-modifier.md)); no separate mechanism.

Shadcn-style adapters tend to emit step-shifted state values; MUI / Material Design 3 adapters tend to emit alpha-overlay state values. The spec supports both so neither adapter has to fight its framework.

## Token shape with states

```jsonc
"color.action.primary": {
  "$type": "color",
  "$value": "{color.primitive.blue.600}",
  "$extensions": {
    "com.pigmint": {
      "usage": "nonText",
      "primarySurface": "color.surface.main",
      "intent": { /* base intent */ },
      "states": {
        "base":     { "form": "step-shift", "intent": { /* base intent */ } },
        "hover":    { "form": "step-shift", "intent": { /* hover intent */ } },
        "active":   { "form": "step-shift", "intent": { /* active intent */ } },
        "focus":    { "form": "alpha-overlay", "alpha": 0.12, "overlayBase": "{color.primitive.blue.600}" },
        "disabled": { "form": "step-shift", "intent": { /* disabled intent */ } }
      },
      "modes": { /* resolved per mode × state */ }
    }
  }
}
```

Each state entry declares its form and its resolution method.

## Form 1: step-shift

The state's intent is a full formal intent ([05-intent-language](./05-intent-language.md)). The resolver runs it independently per mode, and the result is a different ramp position from the base.

Typical shifts:

- **hover** — one step darker for buttons on light surfaces (or lighter on dark); intent preference usually `highest-contrast`.
- **active** — two steps darker, same direction as hover.
- **focus** — rarely step-shifted; focus is typically a ring, not a color change.
- **disabled** — intent threshold reduced to `AA-nonText`, often with `constraints.minChroma: 0` to permit neutral positions; visually muted.

Per-mode receipts exist per state, under `modes.<mode>.states.<state>`:

```jsonc
"modes": {
  "light": {
    "states": {
      "base":   { /* receipt */ },
      "hover":  { /* receipt */ },
      "active": { /* receipt */ }
    }
  }
}
```

## Form 2: alpha-overlay

The state is rendered by compositing an `overlayBase` color at an `alpha` value on top of the base. Details in [07-alpha-modifier](./07-alpha-modifier.md); this file only covers the state-specific conventions.

```jsonc
"focus": {
  "form": "alpha-overlay",
  "alpha": 0.12,
  "overlayBase": "{color.primitive.blue.600}",
  "referenceSurface": "color.surface.main"
}
```

Material Design 3 conventions (the common case pigmint follows by default):

| state | alpha | overlay base |
|-------|-------|--------------|
| hover | 0.08 | the token's own base color |
| active | 0.12 | the token's own base color |
| focus | 0.12 | the token's own base color |
| disabled | 0.38 | `#000` on light surfaces, `#fff` on dark (applied to the base) |

These are defaults, overridable via overlay maps (ADR-013). The default vocabulary ([09-vocabulary-v1](./09-vocabulary-v1.md)) picks one form per token consistent with the canonical adapter's typical pattern; teams retarget by authoring their own overlay map.

## Mixed-form tokens

A single token may use step-shift for `hover`/`active` and alpha-overlay for `focus`. The spec does not require internal consistency across states of one token. The resolver handles each state entry by its declared form.

## Mode interactions

- **High-contrast modes** often force step-shift state resolution even when the default form is alpha-overlay, because alpha overlays wash out at high contrast. Adapters may request that the resolver emit step-shifted resolution for high-contrast modes specifically; the form field on the state entry can be a plain string (applies to all modes) or a per-mode map.

  ```jsonc
  "hover": {
    "form": {
      "default": "alpha-overlay",
      "light-high-contrast": "step-shift",
      "dark-high-contrast": "step-shift"
    },
    "alpha": 0.08,
    "intent": { /* used only in modes where form is step-shift */ }
  }
  ```

- **CVD modes** use the same form as the base mode; only the resolved values differ.

## Absent states

A token that has no interactive states (e.g., `color.foreground.muted` — pure text) omits the `states` block entirely. The resolver treats absent states as "no interactive variants required"; adapters that need a complete state map (some MUI components) synthesize neutral defaults from the base.

## Schema

No dedicated schema file. The `states` object is part of the per-token pigmint extension and is covered by the per-token portion of `receipt.schema.json` and indirectly by `intent.schema.json`.
