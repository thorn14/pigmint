---
name: Configuration
version: 0.1.0
status: draft
implements: ADR-007, ADR-008, ADR-017, ADR-018, ADR-020
---

# Configuration

Two config surfaces with distinct lifecycles:

- **Adapter manifest** (`adapter.yaml`) — shipped with each adapter package. Authored by the adapter maintainer. Declares capabilities.
- **Project config** (`pigmint.yaml`) — at project root. Authored by the team. Declares what the team wants.

The engine validates project config against each declared adapter's manifest at build time. A team asking for alpha from an adapter that doesn't support it is an error. A team asking for a mode no adapter supports is an error.

Format is **YAML** for both (comment-friendly, matches tooling conventions, clean on diffs).

## Adapter manifest (`adapter.yaml`)

Shipped at the root of each adapter package (e.g., `packages/adapter-tailwind/adapter.yaml`). Describes what the adapter can and cannot do.

```yaml
name: tailwind
version: 0.0.0
enforcementMode: compile-time
# Supported modes — the subset of the mode matrix this adapter handles.
supportedModes:
  - light
  - dark
  - light-high-contrast
  - dark-high-contrast
  - cvd-deuteranopia
  - cvd-protanopia
# Ramp properties required by the adapter's emission format.
requiredRamps:
  minCount: 4            # needs at least N ramps from the engine
  neutralRequired: true  # needs a neutral ramp for surfaces/borders
# Primitive grid positions the adapter expects to find.
requiredPrimitives:
  positions: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
  minCount: 8            # if team uses a sparser grid, fewer is OK down to minCount
# Output formats the adapter can produce from.
outputFormats: [hsl, hex, oklch]
# Alpha support (see 07-alpha-modifier).
alpha:
  supported: true
  modes: [rgba, colorMix]
  default: colorMix
# Preset naming schemes the adapter ships with.
presets:
  - shadcn
  - generic
# Semantic vocabulary categories this adapter can map to framework-specific names.
supportedCategories: [action, feedback, surface, foreground, border, focus, decorative]
# Runtime validator — present iff enforcementMode is runtime.
runtimeValidator: null
```

An `adapter-mui` manifest is similar but sets `enforcementMode: runtime` and declares its runtime validator (per ADR-020, required, not optional).

```yaml
name: mui
version: 0.0.0
enforcementMode: runtime
muiVersionTarget: v6   # OQ-11 — resolved per project
runtimeValidator:
  shape: react-hook    # or "babel-plugin"
  package: "@pigmint/adapter-mui/runtime"
  required: true
supportedModes: [light, dark, light-high-contrast, dark-high-contrast]
requiredRamps: { minCount: 4, neutralRequired: true }
outputFormats: [hex, oklch]
alpha:
  supported: true
  modes: [precomposed, rgba]
  default: rgba
```

Manifests are shipped and versioned alongside the adapter. Breaking changes to the manifest schema force adapter major bumps.

## Project config (`pigmint.yaml`)

Lives at the project root. Declares compliance policy, overlays, modes, and which adapters to emit.

```yaml
engine:
  compliance: wcag21
  target: AA
  modes:
    - light
    - dark
    - light-high-contrast
    - dark-high-contrast
  cvd: []                    # empty = no CVD modes emitted

defaults:
  vocabulary: '@pigmint/defaults/vocabulary@0.1'
  surfacePairs: '@pigmint/defaults/surface-pairs@0.1'

overlays:
  - ./overlays/org-standard.yaml
  - ./overlays/product-muted.yaml

ramps:
  # Either inline ramp definitions (source hex + curve) or reference files.
  - name: blue
    source: '#3b82f6'
    curve: '@pigmint/defaults/curve-tailwind'
  - name: red
    source: '#ef4444'
    curve: '@pigmint/defaults/curve-tailwind'
  - name: neutral
    source: '#737373'
    curve: '@pigmint/defaults/curve-neutral'

# Optional — see ADR-018. Omit for DTCG-only output.
adapters:
  - name: tailwind
    output: ./dist/tailwind
    preset: shadcn
    formats: [hsl]
    alpha:
      enabled: false
  - name: mui
    output: ./dist/mui-theme
    formats: [hex]
    alpha:
      enabled: true
      referenceSurface: color.surface.main

output:
  dtcg: ./dist/tokens.json
  receiptsSidecar: true       # emit adapter-specific sidecar receipts where needed

audit:
  input: ./dist/site/**/*.html
  report: ./dist/audit-report.json
  profile: wcag-srgb
```

### Required fields

- `engine.compliance`, `engine.target`, `engine.modes`.
- At least one entry in `ramps`.
- `output.dtcg` path.

### Optional fields

- `adapters` — per ADR-018, completely optional. Omitting yields DTCG-only output.
- `overlays` — zero or more overlay maps composed in declared order (ADR-013).
- `defaults.vocabulary` — defaults to `@pigmint/defaults/vocabulary@LATEST` if omitted.
- `audit` — only consulted when the `pigmint audit` CLI command runs.

## Manifest-validates-config rule

Before emission, the engine:

1. Loads each adapter manifest named in project config.
2. Checks `engine.modes ⊆ adapter.supportedModes`. If not, error.
3. Checks team's ramp set satisfies `adapter.requiredRamps`. If not, error.
4. Checks requested `alpha.enabled` against `adapter.alpha.supported`. If mismatch, error.
5. Checks requested `formats` against `adapter.outputFormats`. If mismatch, error.

Errors are structured, pointing at the conflict:

```
ERROR: pigmint.yaml requests alpha for adapter "mui", but adapter-mui/adapter.yaml
       declares alpha.supported: false. Options:
         - Remove alpha.enabled from the mui adapter entry.
         - Switch to an adapter that supports alpha (e.g., tailwind).
         - Upgrade adapter-mui to a version that supports alpha (if available).
```

## Forward-direction validation only (ADR-008)

Adapters refuse to emit if project config + engine output don't satisfy their manifest. They **never** push requirements backward into ramp generation. A project targeting an adapter that needs 12 primitives fails emission when it has 8; the fix is to widen the primitive grid in project config, not to retrofit the resolver.

## Enforcement modes (ADR-007)

Two modes in Step 0-5 scope per ADR-020:

1. **Compile-time** (Tailwind adapter) — static CSS var output. Lintable against built HTML if desired.
2. **Runtime** (MUI adapter) — emits theme + a runtime validator package the team imports in development builds.

The `enforcementMode` field on the manifest is authoritative; projects cannot override it. A team wanting runtime behavior on a compile-time adapter is not supported.

## Versioning

- `pigmint.yaml` carries no version field; its schema version tracks the engine release.
- `adapter.yaml` carries a `version` field matching the adapter package version.
- Both are validated against the schemas in `spec/schema/`.

## Schemas

- [`schema/adapter-manifest.schema.json`](./schema/adapter-manifest.schema.json)
- [`schema/project-config.schema.json`](./schema/project-config.schema.json)
