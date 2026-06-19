# pigmint

An opinionated color engine that takes a brand's color intent and produces framework-portable design tokens with accessibility receipts baked in.

Given a set of source hex colors and a vocabulary file describing semantic intent, pigmint:
- Derives OKLCH ramps for each color
- Resolves every semantic token against WCAG 2.1 or APCA contrast targets, per mode
- Emits a DTCG-format `tokens.json` plus optional adapter-specific output (Tailwind CSS vars, MUI theme)

## Requirements

- Node.js >= 20
- pnpm 9

## Setup

```sh
pnpm install
pnpm --filter @pigmint/cli build   # build the CLI
```

## CLI

```
pigmint <command> [options]

Commands:
  build   Generate output files described in pigmint.yaml

Options:
  -c, --config <path>   Path to pigmint.yaml (default: ./pigmint.yaml)
```

**build** reads `pigmint.yaml`, resolves all tokens across every mode, and writes output files. It prints a summary of what it emitted.

### Quick start

```sh
cd examples/basic
node ../../packages/cli/dist/bin.js build
# emitted primitives → ./primitives.json (2 ramps)
# emitted tokens → ./tokens.json (1 mode(s), 18 token-mode resolutions)
```

## Authoring app

A visual editor for ramps, intent, and `pigmint.yaml` round-trip.

```sh
pnpm start       # launches authoring app at http://localhost:5173
```

The app has two top-level modes, selected from the toolbar:

- **Primitives** — scale list (left drawer) + curve overlay editor + step inspector (right drawer). Tune L/C/H curves, hue shifts, and chroma peak/floor for every ramp. Edits round-trip into `pigmint.yaml` on export.
- **Tokens** — two sub-views in the panel toolbar:
  - **Preview** — surfaces, foreground, non-text, decorative, and alpha tokens grouped by surface anchor, with inline editing via per-token cards and an Add modal for new tokens. Resolved across every mode (and CVD simulation, if enabled).
  - **Discover** — full contrast matrix showing every foreground/background pair. Filter by WCAG 2.1 or APCA threshold; click any pair to promote it into a semantic token.

The **View** menu in the top bar exposes app-wide toggles:

| Group | Options |
|---|---|
| Theme | Light · Dark |
| Resolver | Stepped · Continuous (matches `engine.resolver.mode`) |
| Contrast | WCAG 2.1 · APCA (matches `engine.compliance`) |
| Gamut | Display P3 · sRGB |

To import an existing config: **Import → Import pigmint.yaml** (or **Import tokens.yaml** for the vocabulary alone). After tuning, use **Export → Export pigmint.yaml** to persist curve data, then re-run `pigmint build`.

## Contributing

See **[`docs/contributing.md`](./docs/contributing.md)** for the contributor guide. It covers adding a new adapter and the portability conventions that keep every package self-contained.

## Agents & AI assistants

See **[`docs/agent-usage.md`](./docs/agent-usage.md)** for the complete agent authoring guide. It covers:

- Bootstrapping `pigmint.yaml` and `tokens.yaml` from scratch
- Full ramp curve field reference (lightness, chroma, hue, smoothing, hue shifts)
- Vocabulary authoring (surfaces, foreground, non-text, decorative, alpha tokens)
- End-to-end examples (minimal and full brand palette)

### Claude Code skill

If you have Claude Code installed, use the `/pigmint-palette` skill to scaffold a full palette interactively:

```
/pigmint-palette primary=#2563eb secondary=#7c3aed output=./design-tokens
```

The skill generates `pigmint.yaml` and `tokens.yaml`, runs `pigmint build`, and walks you through the human review step.

## `pigmint.yaml` — project config

Place at the root of your design-token repo (or pass `-c` to point elsewhere).

```yaml
engine:
  compliance: wcag21        # "wcag21" | "apca"
  target: AA                # "AA" | "AAA" (wcag21) or numeric Lc (apca)
  modes:
    - light
    - dark
    # - light-high-contrast
    # - dark-high-contrast
  cvd: []                   # [] | ["deuteranopia", "protanopia", "tritanopia", "achromatopsia"]

defaults:
  vocabulary: ./tokens.yaml # path to your semantic intent file

ramps:
  - name: blue
    source: "#2563eb"       # derive curves from a brand hex
  - name: neutral
    source: "#78716c"
  # - name: stone
  #   fromFile: ./primitives.json   # or load pre-computed steps

output:
  primitives: ./primitives.json    # optional — inspect raw ramp steps (DTCG colorSpace/components + $extensions.oklch source)
  dtcg: ./tokens.json              # full resolved token output

# Optional adapter emission
adapters:
  - name: tailwind
    output: ./dist/tailwind
    preset: generic                # "generic" | "shadcn"
    formats: [oklch]
  - name: mui
    output: ./dist/mui-theme
    formats: [hex]
```

### Output modes

| Config | Requires | Effect |
|---|---|---|
| `output.primitives` only | ramps | Writes raw ramp steps; no vocabulary needed |
| `output.dtcg` | `defaults.vocabulary` | Resolves all tokens across modes and writes DTCG file |
| Both | `defaults.vocabulary` | Writes both; primitives file is used as reference |

### Engine resolver

`engine.resolver` controls how off-grid contrast targets are satisfied. Defaults are fine for most projects; override only when you want continuous-spline behaviour.

```yaml
engine:
  # …
  resolver:
    mode: stepped                          # "stepped" (default) | "continuous"
    fallbackSteps: 11                      # ≥ 2; only used when `mode: continuous`
    materializeInterpolatedPrimitives: true # synthesize DTCG primitives for off-grid picks
```

- `stepped` snaps every token to a real ramp step (matches Tailwind/Figma scales).
- `continuous` lets the resolver synthesize an off-grid OKLCH triplet when no step is a perfect fit. With `materializeInterpolatedPrimitives: true` (default), the off-grid picks are emitted as additional primitives in the DTCG output, named `c0` through `c1000` (the unpadded quanta of the position along the ramp), so downstream adapters can reference them by name.

The View → Resolver toggle in the authoring app is bound to this field.

## `tokens.yaml` — vocabulary / intent file

Declares the semantic tokens and their contrast intent. The engine resolves each token to the best-matching ramp step that satisfies the declared constraint.

```yaml
surfaces:
  surface.main:
    ramp: neutral
    lightStep: 0       # ramp step to use in light mode (0 = lightest)
    darkStep: 10       # ramp step to use in dark mode  (10 = darkest)
  surface.elevated:
    ramp: neutral
    lightStep: 1
    darkStep: 9

foreground:
  foreground.main:
    ramp: neutral
    surfaces: [surface.main]
    preference: highest-contrast
    level: AAA
  foreground.muted:
    ramp: neutral
    surfaces: [surface.main]
    preference: matched-to-set
    consistency: matched-across-ramps
  foreground.subtle:
    ramp: neutral
    surfaces: [surface.main]
    preference: lowest-passing

nonText:
  action.primary.background:
    ramp: blue
    surfaces: [surface.main]
    preference: lowest-passing
  border.main:
    ramp: neutral
    surfaces: [surface.main]
    preference: lowest-passing
  focus.ring:
    ramp: blue
    surfaces: [surface.main]
    preference: highest-contrast
```

**preference values:**
- `lowest-passing` — least-prominent step that still passes the compliance target
- `midpoint` — index midway between `lowest-passing` and `highest-contrast` (good for the "main" slot of a Light/Main/Dark triplet)
- `median` — passing step at the median contrast ratio (biases toward whichever side of the ramp has more passing steps)
- `level-up` — lowest step that passes ONE compliance tier above the configured target (AA → AAA). When HC mode is already active the bar coincides with `lowest-passing`; the receipt records this.
- `highest-contrast` — most contrast against the declared surfaces
- `preferred-contrast` — lowest step whose contrast against the surfaces meets a numeric target (`targetContrast: <WCAG ratio or APCA |Lc|>` is required on the token)
- `matched-to-set` — match contrast level to another token in the set (requires `consistency: matched-across-ramps`)

`midpoint`, `median`, `level-up`, and `preferred-contrast` are per-ramp pick strategies — they only pair with `consistency: independent` (or `anchored-to-reference`). Pairing any of them with `matched-across-ramps` is rejected by the validator; the authoring app disables the option in the dropdown.

Any semantic token may set `decorative: true`. The resolver still picks a step using `preference`, but the compliance check is skipped and the receipt is marked exempt — handy for muted decorations that should track a ramp but don't owe a contrast guarantee.

## Adapters

Adapters transform the resolved DTCG container into framework-specific output.

| Adapter | `name` | Modes | Formats | Presets | Output |
|---|---|---|---|---|---|
| Tailwind | `tailwind` | light · dark · light-high-contrast · dark-high-contrast | `oklch` · `hex` | `generic` · `shadcn` | `tokens.css` — CSS custom properties with mode-specific selectors (`:root`, `.dark`, `.light-high-contrast`, `[data-mode]`). Inline comments record the source ramp step and contrast result. Supports `decorative` tokens. |
| MUI | `mui` | light · dark | `hex` (default) · `oklch` | `mui-v6` | `theme.ts` — MUI v6 theme via `extendTheme()` with `colorSchemes` — plus a `receipts.json` sidecar mapping DTCG paths to MUI palette paths. Ships a runtime validator at `@pigmint/adapter-mui/runtime`. |

Adapter config goes under `adapters:` in `pigmint.yaml`. Each adapter ships an `adapter.yaml` (and a runtime-source-of-truth `manifest.ts`) declaring which modes, formats, categories, and presets it supports; the engine validates your project config against the manifest at build time and warns on unsupported modes or missing bindings.

Per-adapter `alpha` opts a tokens.yaml-defined alpha set into the adapter output:

```yaml
adapters:
  - name: tailwind
    output: ./dist/tailwind
    preset: generic
    formats: [oklch]
    alpha:
      enabled: true
      referenceSurface: bgMain   # surface to composite alpha tokens against
```

## Examples

| Path | What it shows |
|---|---|
| `examples/basic/` | Minimal two-ramp build (light mode, primitives + DTCG) |
| `examples/portable-demo/` | Portable DTCG output without adapters |
| `examples/portfolio-dark/` | Portfolio palette with dark mode |

Each example has its own `pigmint.yaml` and `tokens.yaml`. Run `pigmint build` (or `node <path-to-cli>/dist/bin.js build`) from the example directory.

New directories under `examples/` are gitignored by default — drop your own scratch palettes there without dirtying the working tree. Add an explicit `!examples/<name>/` to `.gitignore` if you want one tracked.

## Workspace packages

| Package | Purpose |
|---|---|
| `packages/cli` | CLI entry point (`pigmint build`) |
| `packages/core` | Resolver, OKLCH ramp math, DTCG emitter |
| `packages/adapter-tailwind` | Tailwind CSS adapter |
| `packages/adapter-mui` | MUI v6 adapter |
| `packages/authoring-app` | Visual authoring UI (Vite + React) |
