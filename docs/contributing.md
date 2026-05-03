# Contributing — adding packages

This guide covers the two common additions to the monorepo: a new **adapter** and a new **sticker sheet**. It also captures the portability conventions that keep every package self-contained.

---

## Prerequisites

- Node.js ≥ 20
- pnpm 9 (`corepack enable` if you don't have it)

```sh
pnpm install          # install all workspace deps
pnpm --filter @pigmint/cli build   # build the CLI before running generate:tokens anywhere
```

---

## Workspace layout

```
packages/
  core/               Resolver engine, DTCG emitter, adapter contract
  cli/                CLI binary (build, audit commands) + adapter registry
  audit/              Framework-agnostic audit tool
  adapter-<name>/     One package per target framework
  sticker-sheet-<name>/  Verification app for a given adapter
  authoring-app/      Visual editor for ramps and token intent
```

The workspace root `package.json` exposes convenience scripts:

| Script | What it runs |
|---|---|
| `pnpm start` | authoring app (port 5173) |
| `pnpm sticker:tailwind` | Tailwind sticker sheet (port 5174) |
| `pnpm sticker:mui` | MUI sticker sheet (port 5175) |

When you add a new sticker sheet, add a matching `sticker:<name>` entry there.

---

## Adding a new adapter

An adapter is a package that consumes a resolved DTCG container and emits framework-specific output files. The entire contract lives in `@pigmint/core`.

### 1. Scaffold the package

```
packages/adapter-<name>/
  adapter.yaml          Machine-readable adapter manifest
  src/
    manifest.ts         TypeScript mirror of adapter.yaml
    emit.ts             The Adapter implementation
    index.ts            Public exports
  tests/
    emit.test.ts        Unit tests
  tsconfig.json
  tsconfig.build.json
  package.json
```

### 2. `package.json`

```json
{
  "name": "@pigmint/adapter-<name>",
  "version": "0.0.0",
  "private": true,
  "license": "MIT",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./adapter.yaml": "./adapter.yaml"
  },
  "files": ["dist", "src", "adapter.yaml"],
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@pigmint/core": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.0.0"
  }
}
```

If your adapter has a runtime validator, add a second export:

```json
"./runtime": {
  "types": "./dist/runtime/index.d.ts",
  "import": "./dist/runtime/index.js"
}
```

### 3. `adapter.yaml`

Declares the constraints the adapter enforces. The CLI validates the project config against this before invoking `emit`.

```yaml
name: <name>
version: 0.0.0
enforcementMode: compile-time   # or "runtime"
supportedModes:
  - light
  - dark
requiredRamps:
  minCount: 1
  neutralRequired: true
requiredPrimitives:
  positions: ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"]
  minCount: 8
outputFormats: [oklch, hex]
alpha:
  supported: false
  modes: []
presets:
  - generic             # at least one preset required
supportedCategories:
  - action
  - feedback
  - surface
  - foreground
  - border
  - focus
runtimeValidator: null  # or "@pigmint/adapter-<name>/runtime"
```

`enforcementMode`:
- `compile-time` — the adapter emits static files (CSS vars, config objects). Violations surface at build.
- `runtime` — the adapter also ships a validator that can be called in tests or app startup to detect theme drift.

### 4. `src/manifest.ts`

A TypeScript mirror so the emit function can import it without reading YAML at runtime.

```ts
import type { AdapterManifest } from '@pigmint/core';

export const manifest: AdapterManifest = {
  name: '<name>',
  version: '0.0.0',
  enforcementMode: 'compile-time',
  supportedModes: ['light', 'dark'],
  requiredRamps: { minCount: 1, neutralRequired: true },
  requiredPrimitives: {
    positions: ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'],
    minCount: 8,
  },
  outputFormats: ['oklch', 'hex'],
  alpha: { supported: false, modes: [] },
  presets: ['generic'],
  supportedCategories: ['action', 'feedback', 'surface', 'foreground', 'border', 'focus'],
  runtimeValidator: null,
};
```

### 5. `src/emit.ts`

Implement the `Adapter` contract. The only required export is the `Adapter` object; the named emit function is conventional.

```ts
import {
  validateAdapterAgainstConfig,
  type Adapter,
  type AdapterInvocation,
  type AdapterResult,
} from '@pigmint/core';
import { manifest } from './manifest.js';

export function myEmit(invocation: AdapterInvocation): AdapterResult {
  const warnings = validateAdapterAgainstConfig(
    manifest,
    invocation.adapterConfig,
    invocation.projectConfig,
  );

  // invocation.container — the resolved DTCG token tree
  // invocation.adapterConfig — fields from this adapter's entry in pigmint.yaml
  // invocation.projectConfig — the full project config (engine modes, ramps, etc.)

  const outputDir = invocation.adapterConfig.output.replace(/\/+$/, '');

  return {
    files: [
      { path: `${outputDir}/output.ext`, content: '...' },
    ],
    warnings,
  };
}

export const myAdapter: Adapter = {
  manifest,
  emit: myEmit,
};
```

Key fields on `AdapterInvocation`:

| Field | Type | Notes |
|---|---|---|
| `container` | `DtcgContainer` | Resolved token tree. Walk it to find semantic tokens. |
| `adapterConfig` | `{ output: string; preset?: string; formats?: string[] }` | From the adapter's block in `pigmint.yaml`. |
| `projectConfig` | `ProjectConfig` | Engine modes, ramps, compliance target. |

### 6. `src/index.ts`

```ts
export { manifest } from './manifest.js';
export { myAdapter, myEmit } from './emit.js';
```

### 7. TypeScript config

**`tsconfig.json`** (for editor + typecheck):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "types": ["node"]
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

**`tsconfig.build.json`** (for emit):
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "noEmit": false,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["tests/**/*", "**/*.test.ts"]
}
```

### 8. Register in the CLI

The CLI resolves adapters by name from a central registry. Two edits required:

**`packages/cli/src/adapters.ts`** — add the import and registry entry:

```ts
import { myAdapter } from '@pigmint/adapter-<name>';

export const ADAPTER_REGISTRY: Record<string, Adapter> = {
  // existing entries…
  '<name>': myAdapter,
};
```

**`packages/cli/package.json`** — add the workspace dependency:

```json
"dependencies": {
  "@pigmint/adapter-<name>": "workspace:*"
}
```

Then run `pnpm install` and `pnpm --filter @pigmint/cli build`.

### 9. Write tests

Follow the pattern in `packages/adapter-mui/tests/emit.test.ts`. Build a minimal resolved container using `@pigmint/core` helpers (`generateRamp`, `resolveAll`, `emitDtcg`) and assert on the emitted file content. Tests run with `pnpm --filter @pigmint/adapter-<name> test`.

---

## Adding a new sticker sheet

A sticker sheet is a Vite + React app that:
1. Runs `pigmint build` (via the CLI) against a local `fixtures/pigmint.yaml` before starting.
2. Imports the generated output and renders real framework components under every mode.
3. Provides a visual surface for catching regressions across modes and CVD simulations.

### 1. Scaffold the package

```
packages/sticker-sheet-<name>/
  fixtures/
    pigmint.yaml        Project config for this sticker sheet
    tokens.yaml         Semantic vocabulary
  src/
    App.tsx
    components/
      StickerPanel.tsx
    cvd.tsx             Copy from sticker-sheet-tailwind (no changes needed)
    generated/          Populated by "generate:tokens" — commit these files
      tokens.json
      audit.json
      <adapter-specific output>
    index.css
    main.tsx
  index.html
  package.json
  tsconfig.json
  tsconfig.build.json
  vite.config.ts
```

### 2. `package.json`

```json
{
  "name": "@pigmint/sticker-sheet-<name>",
  "version": "0.0.0",
  "private": true,
  "license": "MIT",
  "type": "module",
  "scripts": {
    "generate:tokens": "cd fixtures && node ../../cli/dist/bin.js build",
    "audit": "cd fixtures && node ../../cli/dist/bin.js audit",
    "predev": "pnpm run generate:tokens",
    "prebuild": "pnpm run generate:tokens",
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run --passWithNoTests"
  }
}
```

The `predev` / `prebuild` hooks ensure generated files are always fresh before the dev server or production build starts.

### 3. `fixtures/pigmint.yaml`

Match the adapter's supported modes and use its preset. Point output paths up to `../src/generated`:

```yaml
engine:
  compliance: wcag21
  target: AA
  modes:
    - light
    - dark
  cvd:
    - deuteranopia
    - protanopia
    - tritanopia
ramps:
  - name: neutral
    source: "#888888"
  - name: blue
    source: "#3366cc"
  # … additional ramps as needed
adapters:
  - name: <adapter-name>
    output: ../src/generated
    preset: <preset-name>
    formats:
      - hex
output:
  dtcg: ../src/generated/tokens.json
audit:
  report: ../src/generated/audit.json
  profile: wcag-srgb
defaults:
  vocabulary: ./tokens.yaml
```

Only include modes that the target adapter declares in `supportedModes`. Mismatches surface as warnings at build time.

### 4. `fixtures/tokens.yaml`

Include every token path that the adapter binds. Check the adapter's palette-map or preset file to find the full list. Tokens with no binding are silently skipped; bindings with no matching token generate a missing-binding warning.

### 5. Commit generated files

Run `generate:tokens` once and commit the output:

```sh
pnpm --filter @pigmint/sticker-sheet-<name> run generate:tokens
```

Committing `src/generated/` means reviewers can open the sticker sheet without running the CLI first and lets CI catch unexpected token drift via diff.

### 6. Register in root `package.json`

```json
"scripts": {
  "sticker:<name>": "pnpm --filter @pigmint/sticker-sheet-<name> dev"
}
```

Assign the next available port in `vite.config.ts` (5173 is authoring, 5174 is tailwind, 5175 is mui).

---

## Portability conventions

These rules keep every package runnable in isolation and reviewable without setup steps.

**`"type": "module"` everywhere.** All packages use ESM. Import paths in source use `.js` extensions (TypeScript resolves them to `.ts` at compile time).

**`workspace:*` for all internal deps.** Never use relative paths across package boundaries. `workspace:*` resolves to the local package and is replaced with exact versions on publish.

**`"private": true` on every package.** Nothing in this repo is published to npm. The field prevents accidental publish.

**Build before depending.** The CLI and adapters must be built before sticker sheets can run `generate:tokens`. The dependency order is: `core` → `audit` → `adapters` → `cli` → sticker sheets. If you add a new library package, build it explicitly before packages that depend on it.

**No side effects in library packages.** Packages under `adapter-*` and `core` must have no top-level side effects. This keeps them tree-shakeable and safe to import in tests without additional setup.

**Self-contained sticker sheets.** A sticker sheet must work after `pnpm install` + `pnpm run generate:tokens` with no other steps. Don't pull in state from outside `packages/sticker-sheet-<name>/`. The `fixtures/` directory is the only input the CLI reads.

**Generated files are source-controlled.** `src/generated/` is committed. This is intentional: it gives reviewers a diff of what changed in emitted output when tokens or adapter logic changes, without requiring them to run the CLI.
