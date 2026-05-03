# pigmint

An opinionated color engine that takes a brand's color intent and produces framework-portable design tokens with accessibility receipts baked in.

Given a set of source hex colors and a vocabulary file describing semantic intent, pigmint:
- Derives OKLCH ramps for each color
- Resolves every semantic token against WCAG 2.1 or APCA contrast targets, per mode
- Emits a DTCG-format `tokens.json` plus optional adapter-specific output (Tailwind CSS vars, MUI theme)
- Produces a machine-readable audit report of contrast violations

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
  audit   Audit the emitted tokens file for contract violations

Options:
  -c, --config <path>   Path to pigmint.yaml (default: ./pigmint.yaml)
```

**build** reads `pigmint.yaml`, resolves all tokens across every mode, and writes output files. It prints a summary of what it emitted and surfaces any suggestions from a prior audit run.

**audit** reads the previously-built `tokens.json` (path from `output.dtcg`) and writes a structured `pigmint-audit.json` report. Exits non-zero if there are error-level violations.

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

The app has five tabs:

- **Primitives** — inspect and tune L/C/H curves for each ramp. Edits here are written back to `pigmint.yaml` on export.
- **Preview** — visualise all ramp steps across every mode and CVD simulation.
- **Combos** — full contrast matrix showing every foreground/background pair.
- **Tokens** — author and edit semantic tokens (surfaces, foreground, non-text, decorative, alpha) and see live resolution.
- **Audit** — load a `pigmint-audit.json` report, inspect violations, and apply suggestions directly in the UI.

To import an existing config: **Import → Import pigmint.yaml**. After tuning, use **Export → Export pigmint.yaml** to persist curve data, then re-run `pigmint build`.

## Agents & AI assistants

See **[`docs/agent-usage.md`](./docs/agent-usage.md)** for the complete agent authoring guide. It covers:

- Bootstrapping `pigmint.yaml` and `tokens.yaml` from scratch
- Full ramp curve field reference (lightness, chroma, hue, smoothing, hue shifts)
- Vocabulary authoring (surfaces, foreground, non-text, decorative, alpha tokens)
- The build → human-review → audit → refine loop
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
  primitives: ./primitives.json    # optional — inspect raw ramp steps
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

# Optional audit config
audit:
  report: ./pigmint-audit.json
  profile: wcag-srgb              # "wcag-srgb" | "apca-srgb"
```

### Output modes

| Config | Requires | Effect |
|---|---|---|
| `output.primitives` only | ramps | Writes raw ramp steps; no vocabulary needed |
| `output.dtcg` | `defaults.vocabulary` | Resolves all tokens across modes and writes DTCG file |
| Both | `defaults.vocabulary` | Writes both; primitives file is used as reference |

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
- `highest-contrast` — pick the ramp step with the most contrast against the declared surfaces
- `lowest-passing` — pick the least-prominent step that still passes the compliance target
- `matched-to-set` — match contrast level to another token in the set

## Adapters

Adapters transform the resolved DTCG container into framework-specific output.

| Adapter | `name` | Output |
|---|---|---|
| Tailwind | `tailwind` | CSS custom-property file and/or Tailwind v4 theme |
| MUI | `mui` | MUI v6 theme object + optional runtime validator |

Adapter config goes under `adapters:` in `pigmint.yaml`. Each adapter manifest (`adapter.yaml` in the package) declares what modes, formats, and categories it supports; the engine validates your project config against the manifest at build time.

## Examples

| Path | What it shows |
|---|---|
| `examples/basic/` | Minimal two-ramp build (light mode, primitives + DTCG) |
| `examples/local-design-system/` | Multi-ramp full vocabulary, light + dark |
| `examples/portable-demo/` | Portable DTCG output without adapters |

Each example has its own `pigmint.yaml` and `tokens.yaml`. Run `pigmint build` (or `node <path-to-cli>/dist/bin.js build`) from the example directory.

## Workspace packages

| Package | Purpose |
|---|---|
| `packages/cli` | CLI entry point (`pigmint build`, `pigmint audit`) |
| `packages/core` | Resolver, OKLCH ramp math, DTCG emitter |
| `packages/audit` | Contrast audit engine and report schema |
| `packages/adapter-tailwind` | Tailwind CSS adapter |
| `packages/adapter-mui` | MUI v6 adapter |
| `packages/authoring-app` | Visual authoring UI (Vite + React) |
| `packages/sticker-sheet-tailwind` | Sticker-sheet preview component |
