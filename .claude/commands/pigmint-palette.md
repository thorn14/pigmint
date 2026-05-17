# /pigmint-palette

Scaffold a complete pigmint color palette from brand hex colors.

## What this command does

1. Collects brand hex colors (from the user's message or by asking)
2. Generates `pigmint.yaml` and `tokens.yaml` in the target directory
3. Runs `pigmint build` and surfaces errors
4. Instructs the user to open the authoring app for visual review

## Instructions

When the user invokes `/pigmint-palette`, follow these steps:

### Step 1 — Gather inputs

Extract from the user's message:
- **Brand hex colors** — at minimum one primary color. Neutral is optional (you'll derive one if missing).
- **Output directory** — default to the current working directory if not specified.
- **Project name** — used for the `pigmint.yaml` output path label.

If brand colors are not provided in the message, ask:
> What's your primary brand color (hex)? Any additional accent or feedback colors?

### Step 2 — Derive ramp set

Build a ramp set from the provided colors. Standard set for a typical design system:

| Ramp name | Source | Notes |
|-----------|--------|-------|
| `brand` | primary hex | Main brand color |
| `neutral` | desaturated version of primary, or `#78716c` if primary is very saturated | Used for surfaces and text |
| `danger` | `#ef4444` unless user provided one | Feedback — error/destructive |
| `success` | `#22c55e` unless user provided one | Feedback — success/positive |
| `warning` | `#f59e0b` unless user provided one | Feedback — warning |
| `info` | `#3b82f6` unless user provided one | Feedback — informational |

Adjust: if the user provides a secondary accent, add it as `accent`. Omit feedback ramps the user says they don't need.

### Step 3 — Write `pigmint.yaml`

Write to `{outputDir}/pigmint.yaml`:

```yaml
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

ramps:
  - name: brand
    source: "{PRIMARY_HEX}"
  - name: neutral
    source: "{NEUTRAL_HEX}"
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

Replace `{PRIMARY_HEX}` and `{NEUTRAL_HEX}` with actual values. Omit ramps the user doesn't need.

### Step 4 — Write `tokens.yaml`

Write to `{outputDir}/tokens.yaml` using the standard PortableVocabulary shape. Map feedback tokens to the correct ramps:

```yaml
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
    level: AA
  fgSubtle:
    ramp: neutral
    surfaces: [bgMain]
    preference: lowest-passing
    level: AA
  fgInverse:
    ramp: neutral
    surfaces: [bgInverse]
    preference: highest-contrast
    level: AA
  fgBrand:
    ramp: brand
    surfaces: [bgMain, bgElevated]
    preference: lowest-passing
    level: AA

nonText:
  borderMain:
    ramp: neutral
    surfaces: [bgMain]
    preference: lowest-passing
  borderSubtle:
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
    step: 5
```

Adjust ramp names in `tokens.yaml` to match the ramps declared in `pigmint.yaml`.

### Step 5 — Run `pigmint build`

```bash
cd {outputDir} && pigmint build
```

If the build fails, show the error and suggest fixes:
- Missing ramp → check ramp name matches between `pigmint.yaml` and `tokens.yaml`
- Step out of range → reduce `step` value in `tokens.yaml`
- No vocabulary found → confirm `defaults.vocabulary` path is correct

If the build succeeds, report the output files created.

### Step 6 — Human review instructions

Tell the user:

> **Next step: visual review in the authoring app**
>
> 1. `cd packages/authoring-app && pnpm dev` (or however you start the app)
> 2. Click **Import** → **Import pigmint.yaml** → select `{outputDir}/pigmint.yaml`
> 3. Review ramps in **Primitives** mode — tune curves, hue shifts, and chroma if needed
> 4. Review semantic tokens in **Surfaces** mode — confirm contrast levels look right
> 5. When satisfied, click **Export** → **Export pigmint.yaml** to save your changes back
> 6. Re-run `pigmint build` to regenerate tokens with your tuned curves

Curve data (lightness, chroma, hue arrays, hue shifts) is now preserved in the exported `pigmint.yaml`, so your UI edits survive the round-trip.
