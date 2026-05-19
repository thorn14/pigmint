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
    preference: lowest-passing        # lowest-passing | midpoint | median | level-up | highest-contrast | matched-to-set
    consistency: independent          # optional: independent | matched-across-ramps | anchored-to-reference
    # midpoint / median / level-up only pair with `independent` (or `anchored-to-reference`)
    level: AA                         # optional: AA | AAA (overrides engine target)
```

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

```yaml
alpha:
  <name>:
    base: neutral.900                 # fixed step reference (shorthand ramp.step)
    value: 0.15                       # alpha [0, 1]
    referenceSurface: bgMain          # surface to composite against (optional, defaults to bgMain/bgInverse)
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

1. Start the app: `cd packages/authoring-app && pnpm dev`
2. Click **Import → Import pigmint.yaml** and select your file
3. **Primitives mode** — adjust curves, hue shifts, chroma. Curve data is now written back to `pigmint.yaml` when you export.
4. **Surfaces mode** — verify every token resolves with the expected compliance level
5. **Combos mode** — check the contrast matrix for the full palette
6. **Export → Export pigmint.yaml** — saves your tuned curves back to the file
7. Re-run `pigmint build`

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

## Scaffold via CLI

Use `pigmint scaffold` to generate `pigmint.yaml` and `tokens.yaml` in one command rather than writing them from scratch. This is the recommended approach for agents.

### Flag-based (agent-friendly, no prompts)

```bash
pigmint scaffold \
  --brand "#2563eb" \
  --neutral "#6b7280" \
  --modes light dark \
  --compliance wcag21 --target AA \
  --out ./design-tokens
```

Additional options:

```bash
# With a framework adapter
pigmint scaffold \
  --brand "#2563eb" --neutral "#6b7280" \
  --modes light dark light-high-contrast \
  --adapter tailwind --preset shadcn \
  --out ./tokens

# With continuous resolver and CVD simulation
pigmint scaffold \
  --brand "#2563eb" --neutral "#6b7280" \
  --modes light dark \
  --resolver continuous \
  --cvd deuteranopia protanopia \
  --out ./tokens

# Three ramps: brand, neutral, accent
pigmint scaffold \
  --ramp blue "#2563eb" \
  --ramp slate "#64748b" \
  --ramp red "#dc2626" \
  --modes light dark
```

After scaffold, run `pigmint build` as usual. Overwrite existing files with `--force`.

### Machine-readable build output (`--json`)

Use `pigmint build --json` to capture structured build results rather than parsing human-readable text:

```bash
pigmint build --config ./tokens/pigmint.yaml --json
```

Success:
```json
{
  "success": true,
  "artifacts": {
    "primitives": "/abs/path/primitives.json",
    "dtcg": "/abs/path/tokens.json",
    "adapters": [{ "name": "tailwind", "files": ["/abs/path/tokens.css"] }]
  },
  "warnings": [],
  "stats": {
    "ramps": 2,
    "modes": ["light", "dark"],
    "tokenCount": 50,
    "failedTokens": 0
  }
}
```

Error:
```json
{ "success": false, "errors": ["path: message"] }
```

Exit code 0 on success, 1 on failure. Errors go to stdout (not stderr) in JSON mode, so agents can always parse stdout regardless of outcome.

**Agent workflow with JSON output:**

```bash
# 1. Scaffold
pigmint scaffold --brand "#2563eb" --neutral "#6b7280" --modes light dark --out ./tokens

# 2. Build and check
RESULT=$(pigmint build --config ./tokens/pigmint.yaml --json)
FAILED=$(echo "$RESULT" | jq -r '.stats.failedTokens')
if [ "$FAILED" -gt "0" ]; then
  # Edit pigmint.yaml or tokens.yaml to relax constraints, then rebuild
  echo "Failed tokens: $FAILED"
fi
```

### Claude Code skill

From within a project, use `/pigmint-palette` to scaffold a full palette interactively:

```
/pigmint-palette primary=#2563eb secondary=#7c3aed output=./design-tokens
```

The skill generates `pigmint.yaml` and `tokens.yaml`, runs `pigmint build`, and walks you through the human review step.
