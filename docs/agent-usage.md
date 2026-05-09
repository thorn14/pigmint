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
        ↓
pigmint audit  →  audit.json
        ↓
Agent reads audit.json, refines tokens.yaml, repeats
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

audit:
  report: ./audit.json
  profile: wcag-srgb
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

The build exits non-zero on hard failures (missing ramps, resolver errors). Contrast misses are warnings, not errors — they appear in the audit report.

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

## 6. Audit

```bash
pigmint audit
pigmint audit --config ./pigmint.yaml

# Reads:  tokens.json (from output.dtcg)
# Writes: audit.json  (from audit.report)
# Exits non-zero if any error-severity violations found
```

### Reading `audit.json`

The report is `audit-report@0.1` format:

```json
{
  "artifactVersion": "audit-report@0.1",
  "violations": [
    {
      "tokenPath": "color.foreground.subtle",
      "mode": "light",
      "severity": "warning",
      "type": "intent-refinement",
      "actual": 3.2,
      "suggestions": [
        {
          "channel": "intent-refinement",
          "change": { "field": "defaultIntent.preference", "to": "highest-contrast" }
        }
      ]
    }
  ]
}
```

### Acting on suggestions

For `intent-refinement` suggestions, add an override to `pigmint.yaml`:

```yaml
intents:
  color.foreground.subtle:
    preference: highest-contrast
```

Then rebuild. The intent override takes precedence over `tokens.yaml` defaults.

---

## 7. Examples

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

### Full — brand + feedback palette with audit wired

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

audit:
  report: ./audit.json
  profile: wcag-srgb
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
