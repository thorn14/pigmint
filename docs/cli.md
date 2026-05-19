# Pigmint CLI Reference

Pigmint is a command-line tool that generates accessible, framework-portable design tokens from brand colors.

## Installation

```bash
npm install -g pigmint
# or run without installing:
npx pigmint <command>
```

## Commands

- [`pigmint scaffold`](#pigmint-scaffold) — Create a starter `pigmint.yaml` and `tokens.yaml`
- [`pigmint build`](#pigmint-build) — Generate tokens from a project config

---

## `pigmint scaffold`

Creates a `pigmint.yaml` project config and a `tokens.yaml` semantic vocabulary from scratch. Run without flags for an interactive wizard, or pass flags for scripted / agent use.

### Interactive wizard

```bash
pigmint scaffold
```

Asks step-by-step:
1. How many color ramps?
2. For each ramp: a name and a hex color
3. Display modes (light / dark / high-contrast variants)
4. Compliance standard and target
5. Framework adapters (Tailwind, MUI)
6. CVD simulation profiles
7. Output directory

### Flag-based (scriptable)

```bash
pigmint scaffold [options]
```

At least one ramp flag is required.

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--brand <hex...>` | hex | — | Brand color(s). Can pass multiple values. |
| `--neutral <hex...>` | hex | — | Neutral/gray color(s). |
| `--accent <hex...>` | hex | — | Additional accent color(s). |
| `--ramp <name> <hex>` | name + hex | — | Named ramp (alternative to `--brand` / `--neutral`). Repeatable. |
| `--modes <mode...>` | strings | `light dark` | Display modes. Valid values: `light`, `dark`, `light-high-contrast`, `dark-high-contrast`. |
| `--compliance` | `wcag21` \| `apca` | `wcag21` | Contrast standard. |
| `--target` | `AA` \| `AAA` | `AA` | Compliance target (wcag21 only). |
| `--resolver` | `stepped` \| `continuous` | `stepped` | Token resolution mode. |
| `--fallback-steps <n>` | integer | 150 | Continuous resolver density (requires `--resolver continuous`). |
| `--adapter <name>` | `tailwind` \| `mui` | — | Framework adapter. Repeatable. |
| `--preset <name>` | string | — | Adapter preset. Follows `--adapter`. |
| `--cvd <profile...>` | strings | — | CVD simulation profiles: `deuteranopia`, `protanopia`, `tritanopia`, `achromatopsia`. |
| `--out <dir>` | path | `.` | Output directory. |
| `--force` | flag | false | Overwrite existing files without prompting. |

### Output

Writes two files to `--out`:

- `pigmint.yaml` — engine config, ramp definitions, output paths, adapter settings
- `tokens.yaml` — semantic vocabulary (surfaces, foreground, nonText tokens)

The vocabulary is pre-wired with standard token roles (surfaces, foreground text, action backgrounds, borders, feedback states, focus indicators) using the V1 vocabulary schema. Ramps are assigned by name heuristics:
- A ramp named `neutral`, `gray`, `slate`, `stone`, `zinc`, etc. is used for surfaces, foreground, and borders.
- Other ramps (brand, accent) are used for interactive and feedback tokens.

### Examples

**Single brand color with Tailwind + shadcn:**
```bash
pigmint scaffold \
  --brand "#2563eb" \
  --neutral "#6b7280" \
  --modes light dark \
  --adapter tailwind --preset shadcn
```

**Two brand colors with dark mode and CVD simulation:**
```bash
pigmint scaffold \
  --brand "#2563eb" \
  --neutral "#6b7280" \
  --accent "#dc2626" \
  --modes light dark \
  --cvd deuteranopia protanopia \
  --out ./my-palette
```

**High-contrast modes with continuous resolver:**
```bash
pigmint scaffold \
  --brand "#1e40af" \
  --neutral "#374151" \
  --modes light dark light-high-contrast dark-high-contrast \
  --resolver continuous \
  --adapter tailwind --preset generic
```

**Named ramps for full control:**
```bash
pigmint scaffold \
  --ramp blue "#2563eb" \
  --ramp slate "#64748b" \
  --ramp red "#dc2626" \
  --modes light dark \
  --out ./tokens
```

---

## `pigmint build`

Reads `pigmint.yaml`, resolves all semantic tokens against contrast targets, and writes output files.

```bash
pigmint build [options]
```

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `-c`, `--config <path>` | path | `./pigmint.yaml` | Path to project config. |
| `--json` | flag | false | Emit a machine-readable JSON summary to stdout instead of human-readable output. Errors are also emitted as JSON. |

### Human-readable output (default)

On success, prints one line per emitted artifact to stdout:

```
emitted primitives → ./primitives.json (2 ramps)
emitted tokens → ./tokens.json (2 mode(s), 50 token-mode resolutions)
emitted tailwind → ./dist/tailwind/tokens.css
```

Warnings go to stderr:
```
tailwind warning: token color.action.primary.background clipped to sRGB
```

### JSON output (`--json`)

On success:
```json
{
  "success": true,
  "artifacts": {
    "primitives": "/abs/path/to/primitives.json",
    "dtcg": "/abs/path/to/tokens.json",
    "adapters": [
      { "name": "tailwind", "files": ["/abs/path/to/tokens.css"] }
    ]
  },
  "warnings": ["tailwind: token clipped to sRGB"],
  "stats": {
    "ramps": 2,
    "modes": ["light", "dark"],
    "tokenCount": 50,
    "failedTokens": 0
  }
}
```

On error:
```json
{
  "success": false,
  "errors": ["pigmint.yaml:12 — unknown compliance value 'wcagXX'"]
}
```

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Config error, vocabulary error, or build failure |
| 2 | Unexpected fatal error |

In `--json` mode, errors are always written to **stdout** (not stderr) as `{ "success": false }` and exit 1.

### Output modes (configured in `pigmint.yaml`)

**Primitives only** (no vocabulary required):
```yaml
output:
  primitives: ./primitives.json
```

**Full build** (vocabulary required):
```yaml
defaults:
  vocabulary: ./tokens.yaml
output:
  primitives: ./primitives.json  # optional
  dtcg: ./tokens.json
```

---

## Examples: Common Recipes

### Scaffold → build → check

```bash
# Create config
pigmint scaffold --brand "#2563eb" --neutral "#6b7280" --out ./palette

# Build
pigmint build --config ./palette/pigmint.yaml

# Check for accessibility failures
pigmint build --config ./palette/pigmint.yaml --json | jq .stats.failedTokens
```

### Agent / script usage

```bash
# Scaffold with flags (no interactive prompts)
pigmint scaffold \
  --brand "#2563eb" \
  --neutral "#6b7280" \
  --modes light dark \
  --out ./output

# Build and capture machine-readable result
RESULT=$(pigmint build --config ./output/pigmint.yaml --json)
SUCCESS=$(echo "$RESULT" | jq -r .success)
FAILED=$(echo "$RESULT" | jq -r .stats.failedTokens)

if [ "$SUCCESS" != "true" ] || [ "$FAILED" -gt "0" ]; then
  echo "Build failed or has accessibility issues"
  echo "$RESULT" | jq .
  exit 1
fi
```

### CI integration

```yaml
# GitHub Actions example
- name: Build design tokens
  run: |
    RESULT=$(pigmint build --json)
    if [ "$(echo $RESULT | jq -r .stats.failedTokens)" -gt "0" ]; then
      echo "Accessibility failures detected"
      echo $RESULT | jq .
      exit 1
    fi
```
