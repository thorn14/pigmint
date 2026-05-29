# Agent usage guide

Agents (Claude Code, other AI coding assistants) are first-class authoring partners in pigmint. Every outcome-changing operation the UI can perform is also reachable by writing files the CLI reads. This document explains how to drive the full authoring workflow from text files.

---

## Workflow overview

```
Agent writes pigmint.yaml + tokens.yaml
        ↓
pigmint build  →  tokens.json + primitives.json
        ↓
Human opens authoring app, reviews/tunes curves and tokens
        ↓
Export pigmint.yaml  (curve data is now preserved)
        ↓
pigmint build  →  updated tokens.json
```

---

## 1. Bootstrap — minimum files

Two files drive everything.

### `pigmint.yaml` — project config

```yaml
engine:
  compliance: wcag21
  target: AA                          # AA or AAA
  modes:
    - light
    - dark
    - light-high-contrast
    - dark-high-contrast
  cvd:
    - deuteranopia
    - protanopia
    - tritanopia
  resolver:                           # optional; see "Advanced engine knobs"
    mode: stepped                     # "stepped" (default) | "continuous"

ramps:
  - name: brand
    source: "#2563eb"
  - name: neutral
    source: "#78716c"
  - name: danger
    source: "#ef4444"

output:
  dtcg: ./tokens.json
  primitives: ./primitives.json       # optional but useful for fromFile workflows

defaults:
  vocabulary: ./tokens.yaml
```

**Required keys:** `engine` (compliance, target, modes), `ramps` (≥1 entry with name + source or fromFile), `output` (dtcg or primitives).

#### Advanced engine knobs

These keys are optional and only relevant when you need to override default resolver behaviour or wire in additional vocabulary layers:

```yaml
engine:
  resolver:
    mode: continuous                       # "stepped" (default) | "continuous"
    fallbackSteps: 11                      # ≥ 2; used when mode: continuous
    materializeInterpolatedPrimitives: true # emit synthesized off-grid primitives in DTCG

defaults:
  vocabulary: ./tokens.yaml
  surfacePairs: ./surface-pairs.yaml       # optional: declare which surfaces pair under each mode

overlays:
  - ./overlays/states.yaml                 # additional vocabulary layers merged after defaults.vocabulary
  - ./overlays/brand-extensions.yaml

intents:                                   # per-token formal-intent overrides
  color.foreground.brand:
    preference: preferred-contrast
    constraints:
      targetContrast: 5.5

adapters:
  - name: tailwind
    output: ./dist/tailwind
    preset: generic
    formats: [oklch]
    alpha:                                 # opt-in per adapter; honoured only when adapter manifest allows it
      enabled: true
      referenceSurface: bgMain
```

`intents` keys are full DTCG paths (`color.<category>.<name>`) and each value is a partial `FormalIntent` (preference / consistency / threshold / surfaceContext / constraints). Use it sparingly — most behaviour belongs in `tokens.yaml`. The override is partial: omitted fields fall back to whatever the resolver derives from the portable token.

### `tokens.yaml` — semantic vocabulary

```yaml
surfaces:
  bgMain:
    ramp: neutral
    lightStep: 0       # step index in light mode
    darkStep: 10       # step index in dark mode
  bgElevated:
    ramp: neutral
    lightStep: 1
    darkStep: 9

foreground:
  fgMain:
    ramp: neutral
    surfaces: [bgMain, bgElevated]
    preference: highest-contrast
    level: AAA
  fgBrand:
    ramp: brand
    surfaces: [bgMain]
    preference: lowest-passing
    level: AA

nonText:
  borderMain:
    ramp: neutral
    surfaces: [bgMain]
    preference: lowest-passing
  actionPrimaryBg:
    ramp: brand
    surfaces: [bgMain]
    preference: lowest-passing

decorative:
  decorativeBrand:
    ramp: brand
    step: 5            # fixed step, no contrast resolution
```

---

## 2. Ramp authoring — curve fields

By default, `source: "#hex"` generates curves automatically using the built-in OKLCH preset. For more control, add inline curve fields to any ramp. **All arrays must have length equal to `stepCount` (default 11).**

```yaml
ramps:
  - name: brand
    source: "#2563eb"

    # Optional overrides — omit any field to keep the auto-derived default:

    stepCount: 11         # integer [2, 24], default 11
    naming: tailwind      # tailwind (50–950) or numeric (1–N)

    curves:
      lightness:          # L values in [0, 1], light-to-dark order
        - 0.98
        - 0.95
        - 0.88
        - 0.78
        - 0.68
        - 0.55
        - 0.44
        - 0.35
        - 0.28
        - 0.20
        - 0.12
      chroma:             # C values, same length
        - 0.03
        - 0.06
        - 0.10
        - 0.15
        - 0.18
        - 0.20
        - 0.18
        - 0.15
        - 0.12
        - 0.08
        - 0.04
      hue:                # H values in degrees, same length
        - 250
        - 252
        - 253
        - 253
        - 255
        - 255
        - 255
        - 255
        - 254
        - 253
        - 252
      smoothing: 0.5      # spline smoothing [0, 1], default 0

    hueShift:
      lightEnd: 5         # degrees to rotate at the light end
      darkEnd: -3         # degrees to rotate at the dark end

    chromaPeak: 0.20      # peak chroma (default: source color's chroma)
    chromaLow: 0.03       # chroma floor at the light end
    chromaHigh: 0.04      # chroma floor at the dark end
```

**Tips for agents:**
- Start with `source` only and let the engine derive defaults. Run `pigmint build`, inspect `primitives.json`, then refine.
- The most impactful change is `curves.lightness` — this controls how light or dark each step is.
- `chromaPeak` scales all chroma values. Lower it to desaturate the whole ramp.
- `hueShift.lightEnd` shifts hue warmer/cooler at the light end (e.g., blue → slightly purple at step 50).

### Pre-computed ramps

If you have existing hex values (from Figma, a style guide, etc.), skip curve math entirely:

```yaml
ramps:
  - name: brand
    fromFile: ./brand-primitives.json   # path to a pigmint primitives.json
```

Generate `brand-primitives.json` with `output.primitives: ./brand-primitives.json` in a first build run.

---

## 3. Vocabulary authoring — `tokens.yaml` reference

### Surfaces

Surfaces are background color contexts. Every other token resolves **against** a surface.

```yaml
surfaces:
  <name>:
    ramp: <ramp-name>
    step: <index>              # same step for all modes
    lightStep: <index>         # OR use lightStep/darkStep for mode-specific
    darkStep: <index>
```

### Foreground tokens (text)

```yaml
foreground:
  <name>:
    ramp: <ramp-name>
    surfaces: [<surface-name>, ...]   # surfaces this token must pass against
    preference: lowest-passing        # see "Preference values" below
    consistency: independent          # optional: independent | matched-across-ramps | anchored-to-reference
    level: AA                         # optional: AA | AAA (overrides engine target)
    decorative: false                 # optional: when true, resolver still picks a step but compliance is exempt
    targetContrast: 5.5               # required only when preference: preferred-contrast
    interactions:                     # optional: per-state step offsets
      hover:  { offset: -1 }
      active: { offset: -2 }
```

**Preference values:**

| Value | Picks |
|---|---|
| `lowest-passing` | least-prominent step that still passes the compliance target |
| `midpoint` | index midway between lowest-passing and highest-contrast — good for the "main" slot of a Light/Main/Dark triplet |
| `median` | passing step at the median contrast ratio |
| `level-up` | lowest step that passes ONE tier above the configured target (AA → AAA) |
| `highest-contrast` | most-prominent passing step against the declared surfaces |
| `preferred-contrast` | lowest step whose contrast meets `targetContrast` (WCAG ratio or APCA \|Lc\|) |
| `matched-to-set` | match contrast level to another token in the set (requires `consistency: matched-across-ramps`) |

`midpoint`, `median`, `level-up`, and `preferred-contrast` are per-ramp picks — they only pair with `consistency: independent` (or `anchored-to-reference`). The validator rejects combining them with `matched-across-ramps`.

`decorative: true` lets the resolver still pick a step from `preference` but skips the compliance enforcement and stamps the receipt as exempt. Useful for muted decoration that should track a ramp without owing a contrast guarantee.

`interactions` declares per-state step offsets (relative to the resolved base step) for `hover`, `active`, `focus`, `disabled`. Adapters that understand interaction states (e.g. MUI) consume these.

### Non-text tokens (borders, backgrounds, icons)

Same shape as foreground but under `nonText:`. Contrast threshold is 3:1 (AA-nonText) instead of 4.5:1.

### Decorative tokens (no contrast check)

```yaml
decorative:
  <name>:
    ramp: <ramp-name>
    step: <index>       # fixed step, exempt from contrast resolution
```

### Alpha tokens

Two shapes are supported (spec/07, ADR-016).

**Degenerate — fixed step composited at alpha.** No contrast check; always exempt.

```yaml
alpha:
  scrim:
    base: neutral.900                 # fixed step reference (shorthand ramp.step or full DTCG ref)
    value: 0.15                       # alpha [0, 1]
    referenceSurface: bgMain          # surface to composite against; defaults to bgMain/bgInverse per mode
```

**Path 1 — resolver walks the ramp.** Picks the step whose composited result satisfies the intent against the contrast surface.

```yaml
alpha:
  focusRing:
    baseRamp: brand                   # search this ramp; mutually exclusive with `base`
    value: 0.35
    referenceSurface: bgMain          # what we composite the alpha against
    surfaces: [bgMain]                # contrast surfaces for the compliance check
    preference: lowest-passing        # lowest-passing | highest-contrast | preferred-contrast
    usage: nonText                    # "text" | "nonText"; defaults to nonText
    level: AA                         # optional; defaults to engine target
    targetContrast: 3.0               # required when preference: preferred-contrast
    decorative: false                 # optional; same semantics as semantic tokens
```

---

## 4. Building

```bash
# Run from the directory containing pigmint.yaml, or pass --config
pigmint build
pigmint build --config ./path/to/pigmint.yaml

# Outputs:
#   tokens.json       — DTCG token file with receipts (the main artifact)
#   primitives.json   — raw ramp steps (if output.primitives is set)
#   Any adapter outputs declared in adapters:
```

The build exits non-zero on hard failures (missing ramps, resolver errors). Contrast misses are recorded as warnings on each token's receipt.

---

## 5. Human review loop

After the initial build, open the authoring app for visual refinement:

1. Start the app: `pnpm start` (or `cd packages/authoring-app && pnpm dev`) and open http://localhost:5173.
2. Click **Import → Import pigmint.yaml** (or **Import tokens.yaml**) and select your file.
3. **Primitives mode** — adjust curves, hue shifts, chroma in the curve overlay editor. Curve data is written back to `pigmint.yaml` on export.
4. Switch to **Tokens mode**, then use the panel toolbar:
   - **Edit** — tune surfaces, foreground, nonText, decorative, and alpha tokens; verify every entry resolves with the expected compliance level.
   - **Preview** — view resolved tokens across every mode (and CVD filter, if enabled).
   - **Create** — scan the contrast matrix for the full palette; click any passing pair to promote it into a semantic token.
5. Use the **View** menu to flip between WCAG 2.1 / APCA, stepped / continuous resolver, and Display P3 / sRGB gamut while reviewing.
6. **Export → Export pigmint.yaml** — saves your tuned curves and intent back to the file.
7. Re-run `pigmint build`.

**Round-trip guarantee:** curve values (L/C/H arrays, hue shifts, chromaPeak) written by the UI are preserved in the exported `pigmint.yaml` and readable by the CLI. Agents can pick up where the human left off.

---

## 6. Examples

### Minimal — 2 ramps, default curves

```yaml
# pigmint.yaml
engine:
  compliance: wcag21
  target: AA
  modes: [light, dark]

ramps:
  - name: blue
    source: "#2563eb"
  - name: neutral
    source: "#78716c"

output:
  dtcg: ./tokens.json

defaults:
  vocabulary: ./tokens.yaml
```

```yaml
# tokens.yaml
surfaces:
  bgMain:
    ramp: neutral
    lightStep: 0
    darkStep: 10

foreground:
  fgMain:
    ramp: neutral
    surfaces: [bgMain]
    preference: highest-contrast

nonText:
  actionPrimaryBg:
    ramp: blue
    surfaces: [bgMain]
    preference: lowest-passing
```

### Full — brand + feedback palette

```yaml
# pigmint.yaml
engine:
  compliance: wcag21
  target: AA
  modes:
    - light
    - dark
    - light-high-contrast
    - dark-high-contrast
  cvd:
    - deuteranopia
    - protanopia
    - tritanopia

ramps:
  - name: brand
    source: "#7c3aed"
  - name: neutral
    source: "#6b7280"
  - name: danger
    source: "#ef4444"
  - name: success
    source: "#22c55e"
  - name: warning
    source: "#f59e0b"
  - name: info
    source: "#3b82f6"

output:
  dtcg: ./tokens.json
  primitives: ./primitives.json

defaults:
  vocabulary: ./tokens.yaml
```

```yaml
# tokens.yaml
surfaces:
  bgMain:
    ramp: neutral
    lightStep: 0
    darkStep: 10
  bgElevated:
    ramp: neutral
    lightStep: 1
    darkStep: 9
  bgSubtle:
    ramp: neutral
    lightStep: 2
    darkStep: 8
  bgInverse:
    ramp: neutral
    lightStep: 10
    darkStep: 0

foreground:
  fgMain:
    ramp: neutral
    surfaces: [bgMain, bgElevated, bgSubtle]
    preference: highest-contrast
    level: AAA
  fgMuted:
    ramp: neutral
    surfaces: [bgMain]
    preference: lowest-passing
  fgBrand:
    ramp: brand
    surfaces: [bgMain]
    preference: lowest-passing

nonText:
  borderMain:
    ramp: neutral
    surfaces: [bgMain]
    preference: lowest-passing
  actionPrimaryBg:
    ramp: brand
    surfaces: [bgMain]
    preference: lowest-passing
  dangerBg:
    ramp: danger
    surfaces: [bgMain]
    preference: lowest-passing
  successBg:
    ramp: success
    surfaces: [bgMain]
    preference: lowest-passing
  warningBg:
    ramp: warning
    surfaces: [bgMain]
    preference: lowest-passing
  infoBg:
    ramp: info
    surfaces: [bgMain]
    preference: lowest-passing

decorative:
  decorativeBrand:
    ramp: brand
    step: 4
```

---

## Claude Code skill

From within a project, use `/pigmint-palette` to scaffold a full palette interactively:

```
/pigmint-palette primary=#2563eb secondary=#7c3aed output=./design-tokens
```

The skill generates `pigmint.yaml` and `tokens.yaml`, runs `pigmint build`, and walks you through the human review step.
