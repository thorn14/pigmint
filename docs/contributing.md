# Contributing — adding packages

This guide covers the most common addition to the monorepo: a new **adapter**. It also captures the portability conventions that keep every package self-contained.

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
  cli/                CLI binary (build command) + adapter registry
  adapter-<name>/     One package per target framework
  authoring-app/      Visual editor for ramps and token intent
```

The workspace root `package.json` exposes convenience scripts:

| Script | What it runs |
|---|---|
| `pnpm start` | authoring app (port 5173) |

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

> **Keep `adapter.yaml` and `src/manifest.ts` in sync.** `manifest.ts` is the runtime source-of-truth that `emit` imports; `adapter.yaml` is read by the CLI for project-config validation. Drift between the two means the CLI accepts (or rejects) configs that the runtime would disagree with. The Tailwind adapter has historically drifted on `supportedModes` — when you edit one file, update the other in the same commit.

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
| `adapterConfig` | `{ output: string; preset?: string; formats?: string[]; alpha?: { enabled?: boolean; referenceSurface?: string } }` | From the adapter's block in `pigmint.yaml`. |
| `projectConfig` | `ProjectConfig` | Engine modes, ramps, compliance target. |

#### Sidecar files

`AdapterResult.files` may contain more than one entry. The MUI adapter, for example, emits a `theme.ts` plus a `receipts.json` sidecar that maps DTCG paths to MUI palette paths so downstream consumers can audit the binding without re-running the resolver. See `packages/adapter-mui/src/emit.ts` for the pattern.

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

## Portability conventions

These rules keep every package runnable in isolation and reviewable without setup steps.

**`"type": "module"` everywhere.** All packages use ESM. Import paths in source use `.js` extensions (TypeScript resolves them to `.ts` at compile time).

**`workspace:*` for all internal deps.** Never use relative paths across package boundaries. `workspace:*` resolves to the local package and is replaced with exact versions on publish.

**`"private": true` on every package.** Nothing in this repo is published to npm. The field prevents accidental publish.

**Build before depending.** The CLI depends on adapters, which depend on core. The dependency order is: `core` → `adapters` → `cli`. If you add a new library package, build it explicitly before packages that depend on it.

**No side effects in library packages.** Packages under `adapter-*` and `core` must have no top-level side effects. This keeps them tree-shakeable and safe to import in tests without additional setup.
