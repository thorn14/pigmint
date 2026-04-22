# Color engine architecture

A wiki-style working document for an opinionated color engine that produces framework-portable design tokens with compile-time or runtime accessibility enforcement. Built on extracted math from palette-pal and lessons from gamut-all.

This document is organized as a set of linked architectural decisions (ADRs), system layers, build sequence, and open questions. It’s meant to persist across conversations so future work can reference specific decisions rather than re-litigating them.

-----

## Project summary

A single engine that takes a brand’s color intent and produces framework-portable design tokens with accessibility receipts baked in. Authoring happens in a palette tool (ramp editing, contrast matrix, intent policy). Verification happens in a sticker sheet (real components under every mode × contrast × CVD combination). Teams consume tokens through per-framework adapters (Tailwind with shadcn preset, MUI) that declare their enforcement capabilities honestly. Audit output feeds back into the system, closing the loop.

Not a CLI wrapper around two tools. A three-layer system: resolver, adapter framework, validation tooling, with a feedback loop from audits back into layer 1. Scoped per ADR-020 as a local-only, personal-use tool.

-----

## Key concepts glossary

Terms used throughout this document. Defined here so references stay consistent.

**Primitive.** A raw ramp value. `color.primitive.red.600 = #dc2626`. The underlying palette.

**Token.** A semantic resolution that references a primitive. `color.danger.text.$value = {color.primitive.red.700}`. What teams actually consume.

**Ramp.** A perceptually-ordered set of steps within a single hue family. Emitted as primitives. Input to the resolver.

**Surface.** A background color context. Every non-background token resolves *against* a surface. Primary surfaces are declared per-token; tokens may have values for multiple surface contexts.

**Surface pair.** The relationship (surface, tokens resolved against that surface). The unit of the sticker sheet. Receipts carry surface references, not surface data.

**Intent.** A semantic description of how a token should be selected from its ramp given a surface. “Subtle border” and “prominent danger text” are intents. Intents are queries against the contrast matrix.

**Receipt.** Metadata inside `$extensions` on each token recording how it was resolved: source ramp and step, surface resolved against (as a reference), contrast ratio, compliance level, CVD variants.

**Mode.** A combination of (light/dark, contrast level, CVD type). Every token emits a value per mode under `$extensions.modes.*`. See ADR-003.

**Contrast-target resolver.** The subsystem inside layer 1 that picks ramp steps per-intent per-surface by querying the contrast matrix. See ADR-006. The hard part.

**Adapter.** A plugin that consumes layer 1’s DTCG output and produces framework-specific token files (shadcn CSS vars, MUI theme objects, Radix scale mapping). Declares its enforcement mode.

**Enforcement mode.** An adapter’s declared capability: compile-time (static output, lintable), runtime (ships dev-mode validator), or advisory (ships offline audit). See ADR-007.

**Usage category.** A classification on each token indicating compliance obligations: `text` (subject to WCAG text thresholds), `nonText` (subject to WCAG non-text thresholds), or `decorative` (exempt from contrast requirements). Drives whether the resolver applies contrast intent resolution or a degenerate pass-through. See ADR-006, ADR-011.

**Formal intent.** A query the resolver can execute directly: threshold, preference, consistency policy, surface context. Pure function input. See ADR-006.

**Natural-language intent.** Human-written description of a design outcome (“subtle borders on colored surfaces”). Translated to formal intents by an agent at the CLI boundary. Not consumed by the resolver directly. See ADR-014.

-----

## Architectural decision records

### ADR-001: Not a CLI wrapper

**Status.** Accepted.

**Context.** The original framing was “add a CLI around palette-pal and gamut-all so an agent can use them.”

**Decision.** Reject the CLI-wrapper framing. Build a three-layer system: resolver, adapter framework, validation tooling.

**Reasoning.**

1. Palette-pal’s value is the ramp-editing UX. A CLI around sliders doesn’t help an agent. The extractable piece is the math (ramp generation, contrast matrix, DTCG export), not the app.
1. Gamut-all’s runtime is bound to its own conventions (`data-theme`, `data-stack`, surface classes). Those don’t work with MUI, which means “any web app” is false for gamut-all as-is.
1. Framework pluralism (shadcn, MUI, Radix) forces adapter pluralism; a single CLI can’t serve all three without becoming lowest-common-denominator.

**Consequences.** Scope is larger than originally framed, roughly 3x. Must be named explicitly as a framework project, not a wrapper project.

-----

### ADR-002: Three layers with decreasing strictness

**Status.** Accepted.

**Context.** Reconciling “single opinionated engine” with “works with MUI and Tailwind and Radix.”

**Decision.** Three layers:

- **Layer 1: Resolver.** Fully engine-owned. Takes ramps + intents + policy, emits DTCG with receipts. Target-agnostic.
- **Layer 2: Adapters.** Per-target, opinionated per framework. Each declares enforcement mode and translates layer 1 output to framework-specific format.
- **Layer 3: Validation and preview.** Audit tool (framework-agnostic), authoring surface (palette-pal shape), verification surface (sticker sheet), per-adapter runtime validators.

**Reasoning.** Gamut-all’s compile-time guarantees work because it controls the whole contract. Stripping the runtime means accessibility invariants need to live in the token file itself (as receipts), which is what makes them portable. Layer 1 stays strict about *what* must be true; layer 2 adapters negotiate *when and how* it becomes true.

**Consequences.** Naming vocabulary (`color.danger.text`) lives in layer 1 and gets mapped per-adapter. Each adapter has real code surface area, MUI adapter is 3-5x larger than shadcn adapter.

**Related.** ADR-007 (enforcement modes), ADR-008 (adapter validation direction).

-----

### ADR-003: Mode-agnostic DTCG output

**Status.** Accepted.

**Context.** Should the DTCG output default to light or dark, with the other as override?

**Decision.** Neither. All modes (light, dark, high-contrast-light, high-contrast-dark, and all CVD variants) are first-class siblings under `$extensions.modes.*`. No spec-level default.

**Reasoning.** Any default bakes an opinion the spec doesn’t need. Dark-first brand systems and OS-level dark preference flows would have to invert a light-default. Mode-agnostic emission means adapters pick which mode is the “root” state based on the target framework’s conventions, not the spec’s.

**Consequences.** Output file gets larger (40 tokens × 12 modes ≈ 480 value entries). Resolver runs intent resolution once per mode. Acceptable trade for portability. Adapter docs must state which mode each adapter treats as root.

**Related.** ADR-004 (full matrix emission).

-----

### ADR-004: Emit the full mode matrix, not orthogonal axes

**Status.** Accepted.

**Context.** Dark × high-contrast × deuteranopia could be expressed as three orthogonal transforms (cheap) or as one explicitly-resolved mode entry (expensive but honest).

**Decision.** Emit each mode combination as its own resolved entry with its own receipts. Do not treat modes as composable transforms at emission time.

**Reasoning.** The axes aren’t actually orthogonal. Dark-mode high-contrast deuteranopia isn’t “dark + contrast transform + CVD transform”; each combination resolves against a different base surface and produces a different optimal step selection. Emitting the explicit matrix keeps receipts honest, if the receipt says this value hits 7.2:1 on this surface, that’s verified, not computed at adapter time.

**Consequences.** File size grows combinatorially with modes. Accept it. If this ever becomes a practical problem (it won’t for reasonable token counts), revisit by adding a “compute on demand” escape hatch, but this breaks receipts-as-ground-truth, so avoid.

**Related.** ADR-003 (mode-agnostic), ADR-009 (receipts carry references, not derivations).

-----

### ADR-005: Canonical semantic vocabulary in layer 1, framework names in adapters

**Status.** Accepted.

**Context.** Shadcn uses `--primary`, MUI uses `palette.primary.main`, Radix uses numbered steps with implicit roles. Who owns the naming?

**Decision.** Layer 1 emits a canonical semantic vocabulary (`color.action.primary`, `color.danger.text`, etc.). Adapters map canonical names to framework-specific names.

**Reasoning.** If the engine tries to speak all three vocabularies at once, the schema pleases none. Opinion lives in structure and invariants (ramps → intents → tokens with receipts), not in naming. Naming is adapter concern.

**Consequences.** The canonical vocabulary needs to be designed carefully and documented as a contract. Breaking changes to the vocabulary break every adapter. See Open Question OQ-1.

**Related.** ADR-011 (spec composition as its own step).

-----

### ADR-006: The contrast-target resolver is a named first-class subsystem

**Status.** Accepted.

**Context.** “Intent policy” started as a soft layer 1 input. Working through perceptual issues (picking “step 7 for every ramp” is wrong because hues have different perceived weight at the same lightness) revealed this is the valuable, hard part of the system.

**Decision.** Promote the contrast-target resolver to a named first-class component of layer 1 with its own spec, test suite, and documentation.

**Reasoning.** Most token systems do one of: scale-aligned (“borders always use step 4”), ramp-per-token (same problem authored per-token), or perceptual-uniform (Radix’s approach, only works with hand-tuned ramps). A fourth approach, role-defined contrast-resolved, is what’s needed: the role is “subtle border” which expands to “lowest non-text contrast step that passes 3:1 against the resolved surface, preferring perceptual consistency across the set.” This means:

- Ramps don’t need to be OKLCH-uniform. Brand ramps often deviate from uniform curves to feel right. The constraint is “cover the contrast range with sufficient resolution,” not “be perceptually uniform.”
- Selection is per-ramp-per-surface-per-intent, not per-ramp-per-step. Red’s “subtle border” might pick step 6; blue’s might pick step 7; both are correct.
- Intents are composable queries over the matrix, not lookup keys. `pick(threshold, preference, consistency)` is the function signature.
- Elevated surfaces change the answer. The intent language must reference “current surface in context,” not a specific surface.
- **The resolver branches on usage category before applying contrast math.** Tokens with `usage: "decorative"` skip contrast resolution entirely and use a pass-through (take the ramp position the designer named, no optimization). Tokens with `usage: "text"` or `usage: "nonText"` go through the full resolver with the appropriate thresholds. This prevents decorative tokens from being over-constrained and prevents functional tokens from being under-constrained.

This is the piece that doesn’t exist in any tool we’re building on. It’s probably half the total engineering value of the system.

**Consequences.** Needs its own spec, test suite, visualization tooling. Deserves its own subsection in docs. Set selection (picking “subtle borders” across the whole set consistently) is an N-dimensional optimization problem and worth prototyping early to understand.

**Related.** ADR-002 (layer 1 strictness), OQ-2 (intent policy schema).

-----

### ADR-007: Three enforcement modes declared by adapters

**Status.** Accepted.

**Context.** MUI can’t be compile-time verified the way shadcn can. Pretending otherwise misleads teams.

**Decision.** Each adapter declares one of three enforcement modes:

1. **Compile-time.** Output is static (CSS vars, config files). Violations catchable by linting build output.
1. **Runtime.** Framework does its own color work; adapter ships a dev-mode validator (babel plugin, React runtime hook, or similar).
1. **Advisory.** Neither; adapter ships an offline audit tool run against built HTML.

The engine’s opinion stays constant: receipts are ground truth. What varies is when and how the check happens.

**Reasoning.** “Single opinionated engine, many targets” is only honest if we’re strict about *what* must be true while adapters negotiate *when and how*. Lying about MUI’s compile-time-verifiability undermines the whole accessibility story.

**Consequences.** Adapter docs must state enforcement mode prominently. MUI adapter is the only target requiring a runtime validator, and per ADR-020 that validator is a required component of the MUI adapter (not an optional add-on). Building the adapter without the validator produces a degraded product for the target use case.

**Related.** ADR-002 (layer structure), Build step 4.

-----

### ADR-008: Adapter validation is forward-direction only

**Status.** Accepted.

**Context.** Radix needs 12 steps with specific semantic roles. Should that push backward into layer 1’s ramp generation?

**Decision.** No. Adapters validate layer 1 input and refuse to emit if requirements aren’t met (“your ramp has 9 steps, I need 12”). They never push requirements backward into ramp generation.

**Reasoning.** Coupling ramp math to a specific target defeats portability. Forward-direction validation is safe and catches real mismatches at adapter boundary. Layer 1 generates at a canonical resolution (likely 12 steps to maximize headroom); adapters project down.

**Consequences.** The canonical ramp resolution is a decision worth making carefully, too few steps and adapters can’t cover their targets, too many and the resolver has more bands to manage than any adapter needs.

**Related.** ADR-002, ADR-005.

-----

### ADR-009: Primitives and tokens are both emitted, with DTCG aliasing

**Status.** Accepted.

**Context.** Some teams need a specific ramp step as an escape hatch (designer judgment call, brand exception). Some teams want only semantic tokens.

**Decision.** DTCG output includes both namespaces:

- `color.primitive.{ramp}.{step}` for raw ramp values.
- `color.{semantic-path}` for semantic tokens.

Semantic tokens reference primitives via DTCG aliasing (`{color.primitive.red.700}`) rather than inlining hex values.

**Reasoning.** Aliasing preserves the dependency graph: change a primitive, and the audit tool knows which tokens are affected. Inlining hex values loses that graph. Exposing primitives separately gives teams an escape hatch without collapsing the semantic layer. Most token systems conflate these or pick one, that’s a known pain point for teams wanting to rebrand without rewriting every semantic token.

**Consequences.** Receipts must reference both the primitive path (for dependency tracking) and the resolved hex value (for human inspection and audit ground truth). Adapters decide whether to emit primitives, tokens, or both to their target framework.

-----

### ADR-010: Audit feedback loop as first-class subsystem

**Status.** Accepted.

**Context.** Without a feedback loop, the engine is open-loop: emit tokens, hope teams catch violations. Audit output was originally framed as downstream-only reporting.

**Decision.** Audit tool emits structured JSON reports matching a schema. Those reports feed back into layer 1 as structured input for future resolver runs. Three feedback channels:

1. **Audit → intent refinement.** If audit finds a token failing in a real-world surface context the resolver didn’t know about (e.g., placed on `bg-danger-muted` when primary surface was `bg-main`), the report includes a suggested intent refinement. Next resolver run can treat that surface pair as a first-class constraint.
1. **Audit → ramp suggestion.** If audit finds a ramp can’t satisfy a set of intents (too few distinct steps in the needed contrast range), the suggestion surfaces in the authoring tool to nudge ramp curves.
1. **Audit → spec gap detection.** Recurring violation patterns across teams surface gaps in the canonical vocabulary (e.g., many teams inventing `borderSubtleOnElevated` locally because it’s missing).

**Reasoning.** Closes the loop. Turns the system from fire-and-forget into iterative. The value compounds: each audit run improves the resolver’s inputs for the next run.

**Consequences.** Audit report schema is a first-class artifact, must be versioned alongside DTCG output schema. The authoring tool needs UI to consume audit feedback (visual indicators on ramps/intents that have outstanding suggestions). Feedback at the spec-gap level requires aggregating across deployments; implies a mechanism for teams to opt into sharing anonymized reports, which is its own product decision.

**Related.** Layer 3 build step, OQ-5 (feedback aggregation).

-----

### ADR-011: The spec composition is its own build step, before layer 1 implementation

**Status.** Accepted.

**Context.** DTCG alone doesn’t cover states (hover/active), usage context (text vs non-text vs decorative), or compliance metadata. MD3 has state-layer taxonomy. Leonardo formalizes surface-pair resolution. No single existing spec covers the full shape.

**Decision.** Spec composition is its own step, scheduled before layer 1 implementation. Deliverable is a written spec that:

- Uses DTCG as the outer container.
- Defines the canonical semantic vocabulary (ADR-005).
- Defines the `$extensions.modes.*` shape (ADR-003, ADR-004).
- Defines state expression (hover/active/focus). States can be expressed as either ramp-step shifts (new values per state) or as alpha overlays on the base color. The alpha-overlay case is a specialization of the alpha modifier system (ADR-016) with predefined opacity conventions, not a separate mechanism. Shadcn-style adapters tend to emit step-shifted state values; MUI/MD3-style adapters tend to emit alpha-overlay state values; the spec supports both.
- Defines the receipt schema (ADR-009).
- Defines the audit report schema (ADR-010).
- Defines the intent language for the contrast-target resolver (ADR-006).
- **Defines usage categories (`text`, `nonText`, `decorative`) with precise semantics for each.** Decorative tokens are exempt from contrast thresholds per WCAG 1.4.3 and APCA’s equivalent; the spec must make this explicit so resolver and audit tooling treat them correctly. The default vocabulary (ADR-013) must include decorative tokens as a first-class category (e.g., `color.decorative.accent.*`) so teams don’t reinvent them locally and accidentally skip audits.
- **DECISION NEEDED:** How to handle tokens used both decoratively and functionally (e.g., a brand accent used as text in some places and decorative fill in others). Option A: require split into two tokens at design time (`accent.text` and `accent.decorative`); design-time discipline. Option B: tag token with most-constrained usage and let audit flag individual uses; runtime discipline. Earlier conversation leaned Option A as cleaner, but needs explicit ratification.

**Reasoning.** Everything downstream references this spec. Getting it wrong means adapter work and resolver work both churn. Roughly 1-2 weeks of focused design work. Publishable as its own artifact (“accessible DTCG extension for stateful tokens”) independent of the engine.

**Consequences.** Build sequence starts with spec, not code.

**Related.** All other ADRs reference the spec.

-----

### ADR-012: Ramps as continuous curves with dual sampling

**Status.** Accepted. Supersedes OQ-6.

**Context.** Earlier versions of this architecture assumed ramps had a configured step count (10, 12, etc.). Experimentation with denser sampling (40+ steps) showed that intent resolution across the full set becomes meaningfully easier when the resolver has more candidate steps within the target contrast band.

**Decision.** Ramps are defined as continuous curves (L/C/H as functions of `t ∈ [0, 1]`), not as discrete step lists. Sampling happens at two levels:

1. **Primitive grid.** A canonical, named, human-addressable set of positions along the curve (e.g., 12 positions named `50, 100, 200, ..., 950`). These are the primitives emitted in DTCG output (ADR-009) and the positions humans reference in escape-hatch usage.
1. **Resolver working set.** Dense internal sampling (40+ positions, or continuous) used by the contrast-target resolver to pick optimal positions per intent. Not addressable by name; selections surface through tokens and receipts.

Adapters specify the primitive grid density and positions they need (Radix: 12-position grid with specific semantic mapping; MUI: named positions like `light/main/dark/contrastText`; shadcn: sparser grid). The resolver provides primitives at those positions.

**Reasoning.** At fixed low step counts, intent resolution is constrained discrete optimization with limited viable solutions. At continuous sampling, it’s a real optimization problem with near-unique answers; “matched subtle borders across all ramps” gets achievable with much smaller contrast variance. It also cleanly separates the two audiences for sampled values: humans want named addressable primitives (sparse, stable, legible), the resolver wants precision (dense, internal, optimized).

Keeping primitives as a first-class concept alongside continuous sampling preserves teams’ existing mental models (Tailwind/Radix users expect named steps) while unlocking the precision the contrast-target resolver needs.

**Consequences.**

- Ramp definition input changes from `[hex, hex, hex, ...]` to curve parameters plus primitive grid declaration.
- Palette authoring UX needs a **dual view**: the gradient (continuous curve with contrast band overlays) and the primitive grid (sampled positions). These are linked views over the same function, and they expose the continuity decision to designers in a legible way. See Layer 3 phase 1 expansion below.
- Receipts carry both the sampled position (precision) and the nearest primitive name (legibility): `source: { ramp: "red", position: 0.347, nearestPrimitive: "red.600" }`.
- Minimum ramp validity is expressed as curve properties (must cover at least Nx contrast range against neutral), not step count.
- Maximum primitives is an ergonomic constraint (how many named positions humans want to address), not a technical one.
- Debugging per-token “why this value?” gets harder in the abstract but is addressed by the dual view UX: hovering a resolved token shows its position on the gradient with the intent that selected it.

**Related.** Refines ADR-006 (contrast-target resolver gets denser candidate space), ADR-008 (adapter validation becomes “does the curve cover what I need” plus “does the grid match”), ADR-009 (primitives remain emitted, now as sparse slice over continuous ramp). Authoring UX implications in Layer 3 phase 1.

-----

### ADR-013: Defaults and overrides compose at resolver input; adapters remain neutral

**Status.** Accepted.

**Context.** The engine needs to present value out of the box (nascent teams benefit immediately) while remaining customizable for mature systems with their own opinions. The question is *where* customization lives: inside the engine as configuration, inside adapters as per-target overrides, or as separate composable artifacts.

**Decision.** The engine ships default surface pairs, semantic vocabulary, and intent policies as inspectable artifacts (versioned files, not implicit behavior). Teams override by supplying their own overlay maps as separate inputs to the resolver. Composition happens at resolver input time via deep merge with user values winning. Adapters consume the merged resolver output and do not participate in override logic.

Resolver input shape:

```
resolver({
  ramps,
  intents,
  surfacePairs: [defaultSurfacePairs, ...userOverlays],
  semanticVocabulary: [defaultVocabulary, ...userOverlays],
  policy: [defaultPolicy, ...userOverlays]
})
```

Multiple overlay maps can be stacked (e.g., org-level overrides, product-line overrides, project-level overrides). The resolver merges the stack in declared order.

**Reasoning.**

Putting overrides inside the adapter would force per-adapter override logic and cause behavior to diverge between shadcn, MUI, and Radix adapter outputs. Adapter neutrality keeps override semantics consistent across every target.

Treating default artifacts as published, versioned, inspectable files (rather than implicit engine behavior) makes them diffable. Teams can see what they’re getting, partially override, and compare their overlays against new default versions during migration. This matches how Tailwind ships its default config as a real file teams can eject, rather than hiding defaults in the engine.

Composable overlay maps match how design systems actually scale in organizations. A central team publishes org-level opinions; product teams extend them; specific apps add their own. Each layer is its own artifact, version-controlled in the appropriate repository. The resolver does the stitching.

**Consequences.**

- Default files (surface pairs, semantic vocabulary, intent policy) are published as versioned artifacts alongside the engine, not buried in code.
- Override artifacts are first-class files teams author and maintain. Diffable, version-controlled, reviewable in PRs.
- Migration between engine default versions becomes a diff-and-review workflow over overlay artifacts, not an engine upgrade surprise.
- Adapter code gets simpler (neutral consumer of merged output) at the cost of the resolver needing robust merge semantics (deep merge, conflict resolution rules, clear precedence).
- Refines ADR-010’s “audit → spec gap detection” channel: when audits surface patterns many teams have added via overlays, that’s evidence for the default spec to absorb them in a future version. Aggregation is still human-curated (telemetry caveats from OQ-5 still apply).

**Related.** Refines ADR-005 (canonical vocabulary now has a default layer plus override layers), ADR-009 (surface pairs become composable artifacts), ADR-010 (feedback loop has a concrete landing spot in default-spec version updates).

-----

### ADR-014: CLI as designer-agent pairing surface; natural-language layer lives in the agent, not the engine

**Status.** Accepted.

**Context.** The intent language (ADR-006) is powerful but formal: `threshold`, `preference`, `consistency`, `surfaceContext`. Authoring a full token system in formal intents by hand is tedious and error-prone. Designers think in outcomes (“subtle borders that don’t disappear on muted surfaces”), not in query parameters. The question is whether natural-language intent belongs inside the engine or outside it.

**Decision.** The engine’s contract stays formal. The CLI is the surface where designers and agents pair: designers supply natural-language outcomes; agents translate to formal intent specs; the CLI passes formal specs to the resolver; the resolver returns tokens with receipts; the designer evaluates and refines. The natural-language layer lives in the agent, not in the engine.

The CLI accepts two input modes:

1. **Formal mode.** A structured intent spec (YAML/JSON). Direct input to the resolver. Deterministic, reproducible.
1. **Agent-mediated mode.** Natural-language input plus context (existing ramps, existing intents, brand notes). The CLI documents its schema well enough that an agent can reliably translate. The agent emits formal intent specs; those feed back into formal mode.

**Reasoning.** Coupling natural-language understanding to the resolver would make resolution non-deterministic, version the engine against specific agent capabilities, and blur the line between formal intent and aesthetic judgment. Keeping the engine formal means the resolver remains a pure function of its inputs, which is necessary for receipts to be ground truth (ADR-004, ADR-009).

Agent-in-the-loop authoring matches how real design work happens: sketch broadly, refine selectively. An agent can scaffold a full token system from a brief in seconds; the designer then refines the 10% that feel wrong. This is dramatically faster than hand-authoring and more legible than pure automation, because every formal intent emitted by the agent is inspectable and editable.

This also clarifies what the CLI is. It’s not just a build tool for agents to invoke; it’s the authoring contract that pairs human judgment with agent scaffolding. The CLI is a product surface.

**Consequences.**

- The CLI’s input schema is documented as a first-class artifact, intended to be consumed by agents. Changes to the schema are breaking changes agents must handle.
- The CLI exposes both modes (formal spec in, agent-mediated translation) as explicit commands.
- Natural-language translation is not the engine’s responsibility. Quality of translation depends on the agent; the engine guarantees deterministic resolution given formal input, nothing more.
- Error reporting from the resolver must be legible enough that an agent can react (“intent X was unsatisfiable against ramp Y because no step reached threshold Z”) and either revise the formal spec or surface the problem to the designer.
- Partly answers OQ-2: intent policy schema splits into formal queries (engine concern) and natural-language sugar (agent concern).
- Agent capability extends beyond intent translation. Per ADR-019, agents are full authoring participants with parity to UI authoring at the state-change level, reaching every outcome-changing operation either through named CLI commands or through direct file manipulation.

**Related.** ADR-006 (formal intent language), ADR-013 (default spec as composable artifact; agent can emit overlays rather than rewriting defaults), ADR-019 (broader agent-as-author parity commitment).

-----

### ADR-015: Output format plurality with OKLCH as the source of truth

**Status.** Accepted.

**Context.** Different adapters want different color formats for real reasons. Shadcn uses HSL triplets for alpha compositing. Radix is moving toward P3-capable OKLCH. MUI accepts any CSS color string. Modern CSS is moving toward OKLCH and wide-gamut; legacy support still needs sRGB hex. A single output format can’t serve all adapters.

**Decision.** The resolver operates in OKLCH (matching palette-pal’s internal representation). The DTCG output emits multiple representations per token: OKLCH (source of truth), hex in sRGB, HSL in sRGB, and optionally `color(display-p3 ...)` for wide-gamut-capable targets. Receipts flag when a color is out-of-gamut for a target format (e.g., “OKLCH value is outside sRGB; hex representation clipped to nearest valid sRGB color”).

Example emitted token:

```
"color.action.primary": {
  "$extensions": {
    "modes": {
      "light": {
        "values": {
          "oklch": "oklch(0.62 0.18 258)",
          "hex": "#3b82f6",
          "hsl": "217 91% 60%",
          "p3": "color(display-p3 0.23 0.51 0.96)"
        },
        "gamut": {
          "inSrgb": true,
          "inP3": true,
          "clipped": false
        }
      }
    }
  }
}
```

**Reasoning.** Pushing format conversion into every adapter duplicates code and, worse, duplicates decisions (gamut clipping strategy, for example, has multiple valid answers and should be decided once, not per-adapter). Centralizing conversion in the engine gives consistent output across adapters and moves gamut concerns into receipts, where audits can reason about them.

OKLCH as source of truth matches palette-pal’s existing internals and makes the resolver’s perceptual reasoning directly expressible. Contrast math (WCAG/APCA) still happens in the appropriate color spaces (sRGB for WCAG; perceptual for APCA); the OKLCH representation is upstream of those calculations.

P3 support is capability-ready but opt-in: the engine can emit P3 values and check P3 gamut; adapters choose whether to consume the P3 representation. Full end-to-end P3 (audit calculations in P3 space, sticker sheet rendering on P3 displays) is a larger commitment; see OQ-8.

**Consequences.**

- The resolver’s internal math stays in OKLCH; serialization to multiple formats happens after resolution.
- Receipts carry gamut metadata so audit tooling and adapter tooling can detect clipping and surface it to users.
- Adapters pick which format representation to emit to their target framework. Shadcn adapter takes HSL. Most adapters take hex. P3-capable adapters can optionally take the P3 value.
- File size grows (multiple representations per token × modes). Acceptable trade for consistency; alternative is per-adapter conversion libraries that drift over time.
- **DECISION NEEDED:** Gamut-clipping strategy. When an OKLCH value is outside sRGB gamut, options include: clip to nearest sRGB (chroma reduction, hue preserved); clip with chroma preservation (may shift perceived lightness); reject (force resolver to try a different step). Each has tradeoffs for perceptual fidelity vs compliance math. Needs a default with per-token override capability.

**Related.** Refines ADR-009 (receipts now carry gamut info in addition to contrast info), influences OQ-8 (P3 scope decision).

-----

### ADR-016: Alpha tokens as an opt-in compositing module

**Status.** Accepted. Scoped post-v1.

**Context.** Alpha transparency has three architectural shapes: parallel alpha ramps (Radix-style primitives), alpha as a token modifier with compositing, and state overlays at fixed opacities. Each solves different problems with different architectural cost. The question is what the engine commits to and when.

**Decision.** Alpha is expressed as a modifier on individual tokens, not as a parallel primitive system. Alpha-carrying tokens declare a reference surface and an alpha value; the resolver performs compositing-aware resolution that accounts for the composited result when evaluating contrast. Alpha support is an **opt-in module**, not a v1 baseline. The default vocabulary ships without alpha tokens; teams add them via overlay maps when they need overlays, scrims, or state layers.

Token shape with alpha:

```
"color.overlay.scrim": {
  "$extensions": {
    "usage": "decorative",
    "alpha": {
      "base": "{color.primitive.slate.900}",
      "value": 0.4,
      "referenceSurface": "color.bg.main"
    },
    "modes": {
      "light": {
        "values": {
          "hex": "#0f172a66",
          "rgba": "rgba(15, 23, 42, 0.4)",
          "colorMix": "color-mix(in oklch, var(--slate-900) 40%, transparent)"
        },
        "receipts": {
          "composited": { "hex": "#7d838b", "against": "color.bg.main" },
          "contrast": { "wcag21": 3.1, "apca": 45.2 },
          "compliance": { "level": "AA-nonText" }
        }
      }
    }
  }
}
```

Compositing-aware resolution works by: (1) resolving the base color via the normal contrast-target resolver, (2) compositing the base at the declared alpha value against the declared reference surface to get the effective rendered color, (3) running contrast math on the composited result against whatever the token needs to be legible over, (4) emitting a receipt that carries both the declared alpha/base/reference and the composited effective values.

Three sub-cases the module supports:

- **Fixed alpha, resolve step.** Designer declares alpha; resolver picks ramp step that produces a passing composited result. Default case.
- **Fixed step, resolve alpha.** Designer declares ramp step; resolver picks alpha that passes. Less common, useful for scrims over content.
- **Both free, constrained optimization.** Resolver picks both. Deferred; likely not before v2 of the alpha module.

**Reasoning.** Option 2 (alpha as modifier) is the least architecturally disruptive while providing real value. It preserves the primitive namespace, extends the token schema modestly, and fits the compositing-aware resolver into the existing receipt model. State overlays (MD3-style `hover = base + 8% white`) become a special case of the alpha modifier with fixed opacity conventions, which collapses what were two separate mechanisms in earlier thinking (ADR-011).

Making the module opt-in rather than baseline keeps v1 simpler and lets adapters that can’t handle compositing cleanly stay simple too. Teams adopt alpha when they actually need it, which matches real adoption patterns.

Reference-surface assumption is honest but imperfect: the receipt is accurate against the declared surface, and actual rendering may differ if the alpha token is placed over an unexpected surface. Adapters with runtime compositing capability (CSS `rgba` or `color-mix`) can emit instructions that let the browser do the real math at render time; adapters that require flattening (MUI, some theme systems) get pre-composed solids with the reference-surface caveat.

Parallel alpha ramps (Radix-style `redA1` through `redA12`) are deferred as a scope question for the Radix adapter specifically; see OQ-9.

**Consequences.**

- The default vocabulary (ADR-013) ships without alpha tokens.
- Alpha tokens route to a compositing sub-resolver, not the contrast-target resolver. Similar to how decorative tokens skip the main resolver; alpha tokens use a different one that accounts for compositing.
- Adapter manifests (ADR-017) declare whether and how they support alpha: pre-composed only, runtime instructions only, or both.
- Receipts for alpha tokens carry the reference surface explicitly and the composited effective values. Audit tooling uses the reference to verify, and flags alpha tokens placed on non-reference surfaces.
- State overlays (ADR-011) are a specialization of alpha modifiers with predefined opacity conventions; not a separate mechanism.
- **DECISION NEEDED:** Reference-surface policy. Does the system require alpha tokens to declare a reference surface explicitly, or default to something (e.g., bg-main for light mode, bg-inverse for dark)? Explicit is more honest; default is more ergonomic. Probably explicit with strong errors if missing.

**Related.** Refines ADR-006 (compositing sub-resolver alongside contrast-target resolver), ADR-011 (state overlays collapsed into alpha modifier case), ADR-013 (default vocabulary stays alpha-free), ADR-015 (alpha adds new output-format representations: rgba, color-mix, pre-composed hex).

-----

### ADR-017: Explicit config surfaces, adapter manifest and project config

**Status.** Accepted.

**Context.** Multiple earlier ADRs implicitly assumed configuration without naming where it lives. Adapters declare capabilities (ADR-007) and requirements (ADR-008). Projects declare overlay compositions (ADR-013), output format choices (ADR-015), and now alpha support (ADR-016). Without explicit config surfaces, these decisions get scattered across CLI flags, environment variables, and ad-hoc conventions.

**Decision.** Two explicit config files, with distinct lifecycles:

**Adapter manifest.** Shipped with each adapter package (e.g., `@color-engine/adapter-shadcn/adapter.yaml`). Declares the adapter’s capabilities: enforcement mode, supported modes, required ramp properties, supported output formats, alpha support shape, any framework-specific constraints. Authored by the adapter maintainer. Read by the engine at build time.

**Project config.** Written by the team using the engine (e.g., `color-engine.yaml` at project root). Declares what the team wants: target adapters, default spec version, overlay map paths, compliance policy, mode coverage, per-adapter options (output format choice, alpha enablement, reference-surface policy). Authored by the team. Read by the CLI.

Format is YAML (more comment-friendly than JSON for human-authored config, matches tooling conventions). The engine validates the project config against each adapter’s manifest: team asked for alpha on an adapter that doesn’t support it, error. Team asked for a mode no adapter supports, error. Team asked for HSL output from an adapter that only emits hex, error.

Illustrative shapes:

```yaml
# adapter.yaml (shipped with adapter)
name: shadcn
enforcement: compile-time
supportedModes: [light, dark, high-contrast-light, high-contrast-dark, cvd]
requiredPrimitives:
  minRamps: 8
  gridPositions: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
outputFormats: [hsl, hex]
alpha:
  supported: true
  modes: [pre-composed, color-mix]
  default: color-mix
```

```yaml
# color-engine.yaml (team-authored)
engine:
  compliance: wcag21
  target: AA
  modes: [light, dark, high-contrast-light, high-contrast-dark]
  cvd: [deuteranopia, protanopia]

defaults:
  vocabulary: '@color-engine/defaults/vocabulary@1.2'
  surfacePairs: '@color-engine/defaults/surface-pairs@1.2'

overlays:
  - ./overlays/org-standard.yaml
  - ./overlays/product-muted.yaml

adapters:
  - name: shadcn
    output: ./dist/shadcn
    alpha:
      enabled: true
      referenceSurface: color.bg.main
    formats: [hsl]
  - name: mui
    output: ./dist/mui-theme
    alpha:
      enabled: false
    formats: [hex]
```

**Reasoning.** Two lifecycles, two files. Adapter capabilities change when adapters update; project choices change when teams change their minds. Conflating them (one giant config) means updating an adapter version forces teams to touch every decision they’d made about it. Splitting means teams only touch what they care about.

YAML over JSON because humans read and write it; comments matter for annotating decisions (e.g., “alpha disabled here until we finish the MUI compositing review”). Schema validation and IDE integration are fine in YAML today.

The manifest-validates-config pattern pushes mismatch errors to build time with clear messages, rather than having the adapter silently ignore unsupported options or producing invalid output.

**Consequences.**

- Every adapter must ship a manifest. Adapters without manifests are rejected.
- The CLI reads project config as its primary input; other input modes (flags, environment) are secondary and for ergonomics only.
- Multiple config surfaces get consolidated here: overlay paths (ADR-013), format choices (ADR-015), alpha settings (ADR-016), compliance and mode policy, adapter targets. Future ADRs with config implications extend these files rather than inventing new surfaces.
- Strong error messages when config and manifest disagree. The engine should say what the team asked for, what the adapter can provide, and how to reconcile, not just “invalid config.”
- Config file location is conventional: `color-engine.yaml` at project root. Can be overridden with a CLI flag for monorepos or non-standard layouts.
- **The `adapters` section is optional** per ADR-018. A project config with no adapters declared produces DTCG output only, which is a first-class use case. Validation of adapter-specific fields skips when no adapters are targeted.

**Related.** Consolidates implicit config in ADR-007, ADR-008, ADR-013, ADR-015, ADR-016. ADR-018 (adapters-optional principle). Influences future ADRs that add configurable behavior.

-----

### ADR-018: Layer 1 emits standalone DTCG; adapters are additive

**Status.** Accepted.

**Context.** ADR-001 and ADR-002 establish the three-layer architecture but don’t explicitly state what happens when a team uses layer 1 without any adapter. The config schema in ADR-017 sketched an `adapters` section in a way that could be read as required, which would contradict the layered design.

**Decision.** The engine’s DTCG output is the primary product, always emitted. Adapters produce additional outputs in target-specific formats but are never required for the engine to deliver value. A project config with no adapters declared is a first-class use case: the engine runs, resolves tokens, emits DTCG, and stops. Teams consume DTCG directly via Style Dictionary, Tokens Studio, custom build scripts, or any tool that reads the format.

Config impact (refines ADR-017):

- `adapters` is an optional section of project config. Omitting it or leaving it empty is valid.
- When no adapters are declared, the engine validates only engine-level config (compliance policy, overlay paths, modes) and emits DTCG output to a default location.
- When adapters are declared, their manifests are validated against project config per ADR-017; adapter outputs are produced in addition to the DTCG output, not instead of it.

**Reasoning.** Framing adapters as additive keeps the engine honest about what it is: a resolver that produces a portable intermediate representation, plus optional transforms to target-specific formats. This matches Style Dictionary’s model and avoids the trap where “use the engine” means “also commit to an adapter.” Teams that haven’t chosen a framework, or teams with custom build pipelines, or teams that want to evaluate the engine before committing to any specific adapter, all get full value from layer 1 alone.

This is also a scope-protection principle. If the engine’s value is only realized through adapters, every team must wait for an adapter that matches their framework before they can evaluate the system. That’s a high adoption floor. If DTCG is the primary output, the floor is “can you read DTCG,” which is yes for anyone using modern token tooling.

**Consequences.**

- Build sequence step 1 is explicitly “layer 1 alone produces value.” Reinforces the original build plan.
- Adapter quality is decoupled from engine quality. A team using the engine standalone isn’t blocked by adapter bugs or missing adapter features.
- The receipts, audit tool, and authoring workflow (layer 3) all operate on DTCG output directly. None require an adapter to function.
- Marketing and documentation should lead with “the engine produces portable DTCG tokens with accessibility receipts”; adapter-specific output is a secondary story.

**Related.** Makes explicit what ADR-001 and ADR-002 imply. Refines ADR-017 (adapters section of project config is optional). Supports the build-sequence rationale for shipping step 1 before any adapter work.

-----

### ADR-019: CLI-UI parity as default, with agent workaround guarantee

**Status.** Accepted.

**Context.** The authoring workflow (ADR-011 layer 3) has UI components (dual view, intent editor, surface pair viewer, sticker sheet, audit integrator). The CLI is also an authoring surface, particularly for designer-agent pairing (ADR-014). The question is whether every UI capability must have a corresponding CLI operation, or whether UI-only features are permitted.

Strict parity (every UI feature blocks until CLI coverage exists) stalls UI-first experimentation. Zero parity (UI and CLI diverge freely) locks agents out of features that are available to humans. Neither extreme is right.

**Decision.** Three-tier commitment:

1. **Named CLI coverage is the default target.** When designing a UI feature that changes authored state (ramps, intents, overlays, config), the corresponding engine operation should be exposed as a CLI command. Feature design includes CLI shape as a first-class consideration.
1. **UI-only operations are permitted for shipping velocity.** It is acceptable to ship a UI feature without named CLI coverage when the underlying engine operation is new and CLI ergonomics need separate design work, or when the feature is a UI-first experiment that may change before stabilizing. CLI coverage follows as a deliberate subsequent step.
1. **File-level access is the guaranteed floor.** Regardless of named CLI coverage, agents can always achieve the same effect as any UI operation by manipulating the engine’s state files directly (project config per ADR-017, overlay maps per ADR-013, intent specs per ADR-014). This guarantee depends on the engine keeping its state fully serialized in files at all times, with no UI-local hidden state.

The principle distinguishing acceptable from problematic UI-only work: **gestures can be UI-only, but outcome-changing operations must go through engine operations that read from and write to files the agent can also read and write.** A drag interaction can be UI-only. The operation the drag represents cannot be UI-local; it must modify shared state through shared operations.

**Reasoning.** Strict parity is appealing in principle but produces friction that slows UI development without proportional benefit to agent workflows. Agents don’t need a named command for every UI micro-interaction; they need reliable access to the state those interactions produce. File-level access gives agents that reliability even when named CLI commands lag.

Naming “outcome-changing operations must be shared” as the specific constraint (rather than “all operations”) surfaces the real question when designing features: “does this change authored state, and if so, is the state change expressible through engine operations that write to serializable files?” Features that pass that test are safe to ship UI-first; features that fail it are creating UI-local state that agents can’t reach, which is the failure mode to avoid.

This commitment depends on the engine’s state being fully file-resident. That’s already consistent with ADR-017 (config as files), ADR-013 (overlays as files), and ADR-014 (intent specs as files). ADR-019 names this as a principle rather than an implementation detail so it doesn’t drift later: any future UI feature that wants to maintain in-memory or hidden state must surface a proposal for how that state becomes file-accessible, not ship the hidden state and hope.

**Consequences.**

- Feature design for UI work includes a “CLI coverage” item in its checklist. Either named CLI commands ship alongside, or the feature is tagged as “UI-only, file-workaround” with a tracking item for CLI follow-up.
- Engine operations are the stable API. UI and CLI are both clients. Neither is privileged; agents have access to every operation either client uses.
- Documentation must keep the file format stable and documented enough that agents can manipulate state directly. The files are a public contract, not an implementation detail.
- “Unsaved changes” in the UI are the one legitimate exception: in-progress authoring not yet serialized to files is not agent-accessible, and that’s consistent with normal tooling boundaries.
- Refines ADR-014: the agent’s role extends beyond natural-language-to-formal-intent translation. Agents can author ramps, intents, overlays, and config by manipulating files or invoking CLI commands, with full parity to UI authoring at the state-change level.

**Related.** Refines ADR-014 (agent as full authoring participant, not just intent translator). Depends on ADR-013, ADR-017 (file-based state as public contract). Influences future layer 3 feature design.

-----

### ADR-020: Local-only, personal-scope tool; Tailwind and MUI as the only targeted adapters

**Status.** Accepted.

**Context.** Earlier ADRs assumed a broad potential audience: multiple frameworks, cross-project feedback aggregation, polished documentation, stable public APIs. That framing was never made explicit, and it was driving scope decisions that don’t match the author’s actual goals. This ADR names the scope posture deliberately.

**Decision.**

**Deployment.** Local-only. CLI runs on the author’s machine. All state in local files (config, overlays, intent specs, ramp definitions). No hosted offering planned or reserved for. Palette-pal’s existing hosted web app continues to operate independently as a browser-based ramp experimentation surface, but it is not part of this engine’s deployment story.

**Audience.** The author’s own work (MUI at work) and side projects (Tailwind). External adoption is welcome but not a design constraint. The engine is not being built to serve hypothetical future teams.

**Monetization.** Not a requirement. If monetization happens later, it will be a wrapper around the open tool (template libraries, paid support, sponsorships), not a feature of it. No licensing layer, no feature gating, no paid-tier reservations baked into the architecture.

**Targeted adapters.** Two:

- **Tailwind adapter** with a shadcn naming preset. Emits CSS vars in a configurable naming scheme; a preset matches shadcn’s conventions for teams using that ecosystem. Compile-time enforcement (ADR-007).
- **MUI adapter** with a runtime validator as a required component, not an optional addition. Emits one theme object per mode. Runtime enforcement (ADR-007). MUI version target is OQ-11.

Radix adapter is dropped from the plan entirely. Not deferred, not “later,” just not planned. Revisit only if Radix becomes relevant to the author’s work.

**Reasoning.**

Scope discipline. Most of the architectural complexity the doc was accumulating (cross-project aggregation, stable public APIs, polished external-facing documentation, adapter pluralism beyond two) was serving a hypothetical audience. Narrowing scope to “author plus side projects” removes that pressure without sacrificing the architectural soundness of the core engine.

Tailwind and MUI span the full range of adapter difficulty. Tailwind is the easiest compile-time target; MUI is the hardest runtime-enforcement target. A design that works for both almost certainly works for Radix and anything else later, even without explicit planning. If these two work, adding a third target is a known path rather than an architectural risk.

Shadcn as a Tailwind naming preset (rather than its own adapter) matches how shadcn actually relates to Tailwind (a token-naming convention plus component patterns, built on Tailwind’s CSS-var mechanics). One adapter with a preset is the right factoring.

The runtime validator stops being optional for MUI. The original framing (“compile-time enforcement as the primary story; runtime as fallback”) made runtime enforcement sound like a second-class feature. For MUI usage, the runtime validator is the enforcement mechanism; calling it optional undersells what the adapter actually needs to deliver.

**Consequences.**

- **OQ-5 (feedback aggregation across teams) is closed.** There are no teams. Project-level audit feedback (ADR-010 channel 1) still applies; cross-project and spec-gap channels are removed.
- **Scope-honesty section** is rewritten around personal-use minimums, not public-release minimums. Minimum credible personal-use release is steps 0-2 plus the Tailwind adapter; MUI follows when the base is solid.
- **Build sequence** drops Radix, combines shadcn work into the Tailwind adapter step, and keeps MUI as the second adapter (not third).
- **Documentation polish** calibrated to “good enough for the author to use months from now without re-deriving context,” not “good enough for strangers adopting the tool.” ADRs in this doc serve the first audience well.
- **Default vocabulary and intents** (ADR-013) evolve based on the author’s own experience. No aggregation, no telemetry, no opt-in sharing. The defaults become whatever the author has found useful.
- **Licensing and portability** remain clean. If the tool is ever useful externally or commercialized, clean code and a permissive license keep that option open. This is a portability commitment, not a distribution commitment.

**Related.** Closes OQ-5. Refines ADR-007 (MUI runtime validator is required, not optional). Adds OQ-11 (MUI version target). Dissolves Radix references in build sequence and OQ-9.

-----

## System layers

### Layer 1: resolver engine

**Responsibilities.**

- Generate ramps from source hex + curves (palette-pal’s math, extracted).
- Build contrast matrices (WCAG 2.1 and APCA) per ramp set.
- Accept intent specifications and apply the contrast-target resolver (ADR-006) to select per-ramp per-surface per-intent steps.
- Emit DTCG file with primitives + tokens + modes + receipts (ADR-003, ADR-004, ADR-009).
- Consume audit feedback reports and surface suggestions in next run (ADR-010).

**Inputs.**

- Ramp definitions (from palette-pal or direct authoring): source hex, curve parameters, step count.
- Intent specification: list of desired semantic tokens with roles, thresholds, preferences, consistency policies.
- Compliance policy: WCAG 2.1 or APCA, AA or AAA, supported modes, CVD coverage.
- Surface declarations: named surfaces with primary/elevated states.
- Optional: audit feedback report from previous run.

**Outputs.**

- DTCG token file with primitives + tokens + modes + receipts.
- Intermediate registry artifact (useful for adapter debugging and audit tooling).

**Named subsystems.**

- Ramp generator (palette-pal math).
- Contrast matrix builder.
- **Contrast-target resolver** (ADR-006, the hard part).
- Mode matrix expander (ADR-004).
- DTCG emitter.
- Audit feedback consumer.

### Layer 2: adapter framework

**Responsibilities.**

- Define adapter contract: required methods, capability declaration (enforcement mode, supported modes, framework-specific constraints), receipt preservation requirements.
- Provide reference adapters for Tailwind (with shadcn naming preset) and MUI. Radix and other targets are out of scope per ADR-020.
- Provide adapter validation tooling (forward-direction, ADR-008).

**Adapter contract (sketch).**

- `declareCapabilities() → { enforcementMode, supportedModes, rampConstraints }`
- `validate(dtcgInput) → ValidationResult` (forward-direction checks).
- `emit(dtcgInput) → FrameworkSpecificOutput`
- `emitReceipts(dtcgInput) → ReceiptSidecar` (if framework format can’t carry `$extensions`).

**Reference adapters and their characteristics.**

|Adapter                      |Enforcement |Surface pattern                        |Notes                                                                                                                                                                                                                                                           |
|-----------------------------|------------|---------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|Tailwind (with shadcn preset)|Compile-time|CSS vars on root + `.dark`             |Easiest target. Mode switching via class toggle. Shadcn naming preset maps canonical vocabulary to shadcn’s conventions.                                                                                                                                        |
|MUI                          |Runtime     |Multiple theme objects or CssVars (v6+)|Emits one theme object per mode, or a single theme with colorSchemes if using v6+ CssVarsProvider. Runtime validator is a required component per ADR-020. Component overrides needed for derived colors (hover, active, disabled). MUI version target per OQ-11.|

Radix and other framework adapters are out of scope per ADR-020. The architecture supports them (ADR-002, ADR-008), but no work is planned.

### Layer 3: validation and preview

**Responsibilities.**

- Authoring workflow (five coordinated phases, described below).
- Framework-agnostic audit tool.
- Per-adapter runtime validators (MUI first).

**UI and CLI share engine operations.** Per ADR-019, every state-changing operation exposed in the authoring UI is backed by an engine operation the CLI can invoke, with file-level access as the guaranteed floor for agents when named CLI coverage lags. The UI and CLI are both clients of the same operation set; neither is privileged. This shapes how each phase below is designed.

**Five authoring phases.** The authoring workflow is not one view but five coordinated views over overlapping data, each serving a different phase of design work.

**Phase 1: Ramp authoring (palette viewer) with dual view.** Pick source hexes, tune curves, see the generated ramps. Extends palette-pal’s existing UX but adds a critical new element per ADR-012: a **dual view** showing both the continuous gradient and the primitive grid sampled from it.

- The **gradient side** shows the ramp as a continuous curve with contrast band overlays (e.g., “this region passes AA-text against white; this region passes AA-nonText only”). Tuning curves reshapes the bands, which lets designers author against contrast constraints directly, not against discrete step outputs.
- The **primitive side** shows the sampled named positions on the ramp. Can overlay markers showing where the current intent set’s resolved tokens landed, so pulling a curve shows primitives and intent markers sliding along the gradient live.
- Diagnostic overlays: “deadweight” portions of the curve no intent or primitive samples (signals either unnecessary range or coverage gaps), and sensitivity indicators on intent markers (which ones move the most per curve adjustment).
- A “simple mode” hides the gradient and shows only primitives with contrast markers, matching conventional Tailwind/Radix mental models. Power users open the gradient when needed. The dual view is not the default, because asking every designer to learn continuous-curve thinking before picking a brand color is the wrong default.
- Output: ramp curve definitions and primitive grid declarations.
- Fast, pure math iteration. Does not render components.
- Where designers differentiate the brand.

**Phase 2: Intent authoring (intent editor).** Declare what semantic tokens the system needs, what roles they serve, what thresholds they hit, what consistency policies apply. Novel, doesn’t exist in palette-pal or gamut-all today. Structured form editor plus a YAML/JSON escape hatch for power users. Output: intent spec consumed by the contrast-target resolver.

**Phase 3: Surface pair viewer.** Visualize resolver output at the color-pair level: for each surface, show every token resolved against it with contrast values and receipts. Matrix or grid layout. Answers “does this token set feel right?” Not yet components, just systematic color-on-color. Hovering a token exposes its receipt (source position, intent, resolved-against surface, contrast).

**Phase 4: Sticker sheet / verification surface.** Real components in the target framework under every (mode × contrast × CVD) combination. Organized by surface pair. Per-adapter, because rendering MUI components and rendering shadcn components are different infrastructure. Slower loop, full build each time.

**Phase 5: Audit integrator.** Consume audit reports from production usage (ADR-010), surface suggestions on ramps/intents, let the designer accept or reject feedback into the source of truth. Where the feedback loop surfaces to humans.

**Audit tool.**

- Takes DTCG file + built HTML/CSS/JS as input.
- Reports violations: unknown tokens, missing modes, contrast failures against actual rendered surfaces, receipt mismatches.
- Emits structured JSON report feeding back into layer 1 (ADR-010).
- Framework-agnostic.

**Per-adapter runtime validators.**

- Only for adapters with runtime enforcement mode.
- MUI: babel plugin for `sx` prop linting (compile-ish) or React runtime hook walking rendered components. Required component of the MUI adapter per ADR-020, not a separate optional artifact.
- Tailwind adapter has compile-time enforcement and does not require a runtime validator.

-----

## Build sequence

Each step independently shippable. Stop points are defensible products. Scope per ADR-020 (local-only, Tailwind and MUI as targets; other frameworks like Radix and Base UI remain useful reference points for the architecture but are not build targets).

**Step 0: Spec composition.** Write the canonical spec covering DTCG container, modes, states, receipts, audit reports, intent language, usage categories. 1-2 weeks. No code. ADR-011. *Artifacts live at [`/spec/`](./spec/): 00-overview, 01-dtcg-container, 02-modes, 03-receipts, 04-usage-categories, 05-intent-language, 06-states, 07-alpha-modifier, 08-gamut-and-formats, 09-vocabulary-v1, 10-surface-pairs, 11-audit-report, 12-config — plus JSON Schema stubs under [`/spec/schema/`](./spec/schema/).*

**Step 1: Layer 1 alone, CLI output.** Extract palette-pal math into a library. Build the contrast-target resolver. Emit DTCG + audit-ready registry. Useful immediately because Style Dictionary can consume DTCG files, which satisfies ADR-018’s standalone-value commitment. Minimum viable product.

**Step 2: Tailwind adapter (with shadcn naming preset).** Easiest compile-time target. Proves the adapter pattern end-to-end. The same adapter emits CSS vars in either a generic naming scheme or shadcn’s conventions; a preset selects between them. Shipping both from one adapter avoids duplicating work for two closely-related ecosystems.

**Step 3: Audit tool (advisory mode).** DTCG + built output in, structured report out. Works against any adapter’s output. This is where accessibility-as-receipts cashes out. Framework-agnostic.

**Step 4: Feedback loop wired into layer 1.** Layer 1 reads audit reports and surfaces suggestions. Per ADR-020, the feedback loop is project-level only (no cross-project aggregation).

**Step 5: MUI adapter + required runtime validator.** The hard target. Emits theme object(s) per mode (shape depends on MUI version target, OQ-11). Runtime validator is part of the adapter, not optional (ADR-007 refined by ADR-020). Only attempt after 1-4 are solid because MUI will stress-test every assumption.

**Step 6: Authoring workflow views.** Five phases (see Layer 3). Distributed across earlier steps where possible:

- **Phase 1 (ramp authoring with dual view). Shipped.** Palette-pal forked into `packages/authoring-app`, rewired to `@pigmint/core` for all math. Dual view ships as a two-state toggle on `CurveOverlayEditor` — `curves` (default editor: L/C/H curve nodes, P3 dashes) and `gradient` (continuous 64-sample OKLCH band rendered via `buildMonotoneCubicInterpolant` over the same smoothing → hue-shift → P3-clamp → `oklchToHex` pipeline used by `generateRamp`). Intent markers are overlaid on the gradient view — one pin per resolved vocabulary token whose `source.ramp === scale.name`, positioned by `source.position`, colored by compliance (`AAA*`→green, `AA*`→amber, `exempt`→grey, fail→red), with a greedy row-assignment label deconflict pass and connector lines for bumped rows. An engine-mode selector chooses which `resolveAll` mode feeds the markers; labels abbreviate `-high-contrast` → `-HC` to fit. Contrast and deadweight views were dropped as separate modes: contrast information already lives in per-step badges elsewhere, and deadweight coverage is a different grain of feedback than a canvas overlay.
- **Phase 2 (intent editor). Shipped.** Fourth app mode. Renders `VOCABULARY_V1_SLICE` entries with per-token `preference` / `consistency` / `surfaceContext` overrides. Compliance kind and target level are engine-level config per ADR-017, not per-token. Persisted in `pigmint:intents:v1`; round-trips through `pigmint.yaml`'s `engine:` + `intents:` blocks.
- Phase 3 (surface pair viewer) ships between steps 1 and 2; resolver output is the only input, no adapters required. **Next.**
- Phase 4 (sticker sheet) ships per-adapter as each adapter matures, with step 2 (Tailwind) and step 5 (MUI).
- Phase 5 (audit integrator) ships with step 4 when the feedback loop is wired up.

“Step 6” is a set of deliverables spread across earlier steps, not a single late milestone.

**Current snapshot.** Steps 0-5 shipped. Step 6 phases 1+2+3 shipped (C1), phase 1.5 dual view shipped (C2). Monorepo typecheck + tests green across `core`, `adapter-tailwind`, `adapter-mui`, `audit`, `authoring-app`, `cli` (85 tests total).

-----

## Action items (post step 6 phases 1+2)

These are concrete next tasks, grouped by what they unblock. Each is sized so it can be picked up cold; pick the group that matches your goal.

### A. Make the intent editor load-bearing (not cosmetic)

The intent editor writes `intents:` into `pigmint.yaml` and `pigmint:intents:v1` in localStorage, but **nothing downstream reads them yet**. Until this group is done, intent editing is purely UI state — the CLI's emitted DTCG doesn't change when intents change.

- **A1. CLI reads `intents:` from `pigmint.yaml`. [shipped]** `ProjectConfig.intents?: Record<tokenPath, Partial<FormalIntent>>` added to `packages/core/src/types/spec.ts`; `resolveAll` in `packages/core/src/resolver/driver.ts` now merges overrides over `VOCABULARY_V1_SLICE` defaults via `applyIntentOverrides`; `packages/cli/src/config.ts` validates the `intents:` block shape. Covered by `packages/core/tests/driver.test.ts`.
- **A2. Round-trip test (UI → CLI). [shipped]** `packages/cli/tests/end-to-end.test.ts` now has an intent-override test that builds the same fixture twice (with/without an override on `color.action.primary.background`) and asserts the emitted DTCG `$value` alias differs and `intent.preference` reflects the override while unrelated tokens match. Full UI → disk → CLI file round-trip still pending once A3 lands.
- **A3. File-backed save from the UI. [shipped]** `packages/authoring-app/src/lib/fileSystem.ts` exposes `hasFileSystemAccess`, `saveToNewFile` (picker + write, AbortError→`cancelled`, graceful fallback to `<a download>` when the API is unavailable), and `saveToExistingHandle` (re-save to a cached handle). `ExportPigmintYamlModal` now shows "Save as…" (always) and "Save" (once a handle is cached in a `useRef`) with a live status line. Handle is session-scoped — no IndexedDB persistence yet. Covered by `packages/authoring-app/tests/fileSystem.test.ts`.
- **A4. Migration from `palette-pal:color-tokens`. [shipped]** `migrateLegacyStorage` in `packages/authoring-app/src/store/paletteStore.ts` runs before `loadInitialState`: if the current `pigmint:color-tokens` key is empty, it copies the legacy value over and deletes the old key. Idempotent, SSR-safe (guards `typeof localStorage === 'undefined'`). Covered by `packages/authoring-app/tests/migrateLegacyStorage.test.ts`.

### B. Core gaps surfaced by the UI

- **B1. APCA threshold resolution (or remove from UI). [shipped — deferred path]** Took OQ-12 option 3: hide APCA from the UI and reject it early in the CLI until a concrete design lands. The UI engine panel now renders Compliance as a read-only `WCAG 2.1` badge (`packages/authoring-app/src/components/intents/IntentEditor.tsx`); the intent store dropped `setEngineCompliance`, coerces `apca` → `wcag21` on `loadFromStorage` and `loadState`. CLI `validateProjectConfig` in `packages/cli/src/config.ts` rejects `engine.compliance !== 'wcag21'` with a pointer to OQ-12 so builds fail at parse time instead of deep in the resolver. Covered by `packages/cli/tests/config.test.ts`.
- **B2. Engine panel parity with `EngineConfig`. [partial — modes shipped, cvd deferred]** `engine.modes` is now UI-editable: four named toggles in the engine panel (`light` / `dark` / `light-high-contrast` / `dark-high-contrast`), with a one-mode minimum enforced by disabling the last active checkbox. State lives on `intentStore` (`engineModes: EngineMode[]`, `toggleEngineMode`, `sanitizeModes`) and round-trips through `pigmintYaml.ts`, which canonicalizes order and drops unknown strings on parse. `engine.cvd` intentionally left yaml-only for now — it's a preview-sim concern tangled with the CVD overlays story (C2) and deserves its own UI pass rather than a bolt-on checkbox row. Covered by expanded `intentStore.test.ts` + `pigmintYaml.test.ts`.

### C. Remaining step 6 phases

- **C1. Phase 3 — Surface pair viewer. [shipped]** New fifth app mode `'surfaces'` wired through `App.tsx` + `TopBar.tsx`. `packages/authoring-app/src/components/surfaces/SurfacePairViewer.tsx` pipes the paletteStore's `ColorScale[]` through `@pigmint/core`'s `generateRamp`, assembles a `ProjectConfig` from intentStore engine state (target + modes + overrides), mirrors the CLI's `buildTokenRamp` heuristic (neutral for surfaces/foregrounds, accent for others), and calls `resolveAll`. Renders a per-mode two-table matrix: surfaces table + non-surfaces table with resolved swatch, `{color.surface.*}` alias, WCAG ratio, compliance pill, and source `ramp.step`. Empty-scales and resolver errors surface as a soft failure message rather than a throw. Covered by `packages/authoring-app/tests/surfacePairViewer.test.ts`.
- **C2. Dual view overlays (phase 1.5). [shipped]** Per user direction ("changing the view should start as a toggle; we can layer later"), the dual view ships as a four-state `viewMode` toggle on `packages/authoring-app/src/components/curves/CurveOverlayEditor.tsx` rather than stacked overlays. All non-default views are column-scoped because swatches run light→dark along X and canvas Y is not a lightness axis. (1) `curves` — default editor (curves, nodes, P3 dashes). (2) `intents` — `IntentMarkers` renders one pin per resolved vocabulary token whose `source.ramp === scale.name` on the first engine mode, positioned by `source.position` on the x-axis and `oklch.l` on the y-axis, colored by compliance (`AAA*`→green, `AA*`→amber, `exempt`→grey, fail→red), with token path as a monospace label; empty state shows a hint card. (3) `contrast` — `ContrastBands` draws per-column stacked badges showing each step's actual WCAG ratio + level vs `#ffffff` (top row) and vs `#000000` (bottom row), bucketed AAA (7+), AA (4.5+), AA-large (3+), fail; replaced an earlier horizontal-threshold-lines sketch that implied a lightness y-axis. (4) `deadweight` — `DeadweightMarkers` renders a per-column mid-canvas chip: red "DEAD" on steps no vocabulary token's `source.nearestPrimitive` resolves to (coverage map built from `runResolve`), green token-count on covered steps. Shared helper `packages/authoring-app/src/lib/resolveState.ts` extracted so both `SurfacePairViewer` and `CurveOverlayEditor` call the same `runResolve` / `buildTokenRamp`.
- **C3. Phase 4 — Sticker sheet (Tailwind).** Real shadcn/Tailwind components rendered under every `mode × contrast × CVD` combination, organized by surface pair. Per-adapter infrastructure; likely a new package `packages/sticker-sheet-tailwind`. Slow loop (full build each edit). Bigger scope than C1.
- **C4. Phase 5 — Audit integrator.** Consume the audit JSON report (already emitted by `packages/audit`) in the UI and surface suggestions against ramps and intents. Accept/reject applies changes back into the authoring store. Depends on A-group (audit suggestions reference intents by path).

### D. Hygiene

- **D1. Replace palette-pal's seed palette.** `packages/authoring-app/src/color-tokens.json` still contains palette-pal's sample data. Replace with a minimal pigmint default (one neutral ramp, or empty) or remove the seed entirely so the app opens to the BulkCreatePanel.
- **D2. Drop any remaining palette-pal references.** Grep for `palette-pal`, `palette pal`, and related strings; clean up comments and imports. First pass done during the fork but worth a sweep after phase 3.
- **D3. Engine `modes` defaulting.** Currently defaults to `['light']` on both serialize and parse. Once dark/high-contrast modes are exercised end-to-end (step 5 / phase 4), revisit whether the UI should seed `['light', 'dark']` by default.

-----

## Scope honesty

Per ADR-020, this is a local-only, personal-use tool. Minimum credible personal-use release is steps 0-2 plus the Tailwind adapter (step 2): roughly 6-10 weeks of focused work for one person, probably less in practice since authoring phases 1-3 are distributed across those steps. That floor produces a working tool the author can use on side projects immediately.

Step 3 (audit tool) and step 4 (feedback loop) are the next tier, roughly another 4-6 weeks, after which the accessibility-as-receipts story cashes out end-to-end against Tailwind output.

Step 5 (MUI adapter plus runtime validator) is another 4-6 weeks on top of that, probably more depending on MUI version complexity (OQ-11). Only worth starting once 1-4 are solid, because MUI is where the architectural claims either hold up or get revised.

Total: roughly 3-5 months of focused work, most of which is the author building for the author. Scope contracts further if phases are deferred or the authoring UI is delayed past the CLI; scope expands if OQ-11 resolves to requiring a broader MUI version support target.

This is still substantially larger than a CLI wrapper. The scope is defensible because the accessibility-as-receipts architecture doesn’t cleanly exist in any tool the author uses today. Style Dictionary has no a11y opinion. Radix has strong opinions about scale semantics but is single-target and its model (paired light/dark scales, 12-step semantic roles) is worth learning from even though Radix isn’t an adapter target here. Base UI is still stabilizing and focused on unstyled component primitives. MUI’s own theming has no receipt concept. Gamut-all is runtime-bound. None of them solve the portable-receipts problem this engine is aimed at.

The scope is still real, and treating it as “wrap two CLIs” will undersize the work.

-----

## Open questions

**Embedded decisions needed inside accepted ADRs.** Some accepted ADRs contain sub-decisions that are deliberately unresolved and flagged `DECISION NEEDED` inline. Tracking them here for visibility:

- **ADR-011 (spec composition):** Mixed-usage tokens, split at design time (Option A, preferred) or tag-and-audit at runtime (Option B). Affects the canonical vocabulary shape.
- **ADR-015 (output format plurality):** Gamut-clipping strategy when OKLCH values fall outside sRGB. Clip-to-chroma, clip-with-preservation, or reject. Needs a default with per-token override.
- **ADR-016 (alpha tokens):** Reference-surface policy. Require explicit declaration on every alpha token, or default to a surface (e.g., bg-main) with override capability. Explicit is more honest; default is more ergonomic.

Resolve these alongside OQ-1 through OQ-11 below.

### OQ-1: Canonical semantic vocabulary

What’s the full list of semantic token names layer 1 emits? Needs to cover at minimum: action (primary/secondary/tertiary), feedback (danger/success/warning/info), surface (main/elevated/inverse), foreground-on-surface (main/muted/subtle), borders (main/subtle/prominent), focus rings, overlays. Each with hover/active/focus states where applicable. Target: single document, versioned, that adapters map against.

**Addressed in [`/spec/09-vocabulary-v1.md`](./spec/09-vocabulary-v1.md) — pending ratification.** Shipped as artifact `vocabulary@0.1`.

Must resolve before step 1. Blocking dependency.

### OQ-2: Intent policy schema

What fields describe “subtle border,” “prominent text,” etc., and how do they query the matrix? Needs to express: threshold (AA-text, AA-nonText, AAA-text, etc.), preference (lowest-passing, highest-contrast, matched-to-set), surface context (primary, elevated, current-in-context), consistency policy (independent, matched-across-ramps, anchored-to-reference).

**Partly answered by ADR-014.** The schema splits into two layers: formal queries the resolver executes (engine concern, deterministic) and natural-language descriptions the agent translates (agent concern, not in the engine). The question remaining is the full formal schema, specifically which preference and consistency policies to support and how they combine. Still blocking on step 1.

**Addressed in [`/spec/05-intent-language.md`](./spec/05-intent-language.md) and [`/spec/schema/intent.schema.json`](./spec/schema/intent.schema.json) — pending ratification.** Preference policies: `lowest-passing`, `highest-contrast`, `matched-to-set`, `anchored`. Consistency policies: `independent`, `matched-across-ramps`, `anchored-to-reference`. Invalid combinations rejected at parse time.

Must resolve before step 1. Blocking dependency on ADR-006.

### OQ-3: Receipt schema precisely

What goes in `$extensions.modes.*` beyond hex and contrast? At minimum: source (ramp name, step number), resolvedAgainst (token reference, not hex), contrast (engine-specific values), compliance (level passed), cvd (per-type resolved variants), state (base/hover/active/focus expression).

**Addressed in [`/spec/03-receipts.md`](./spec/03-receipts.md), [`/spec/02-modes.md`](./spec/02-modes.md), and [`/spec/schema/receipt.schema.json`](./spec/schema/receipt.schema.json) — pending ratification.** Receipt fields: `value`, `source` (ramp + position + nearestPrimitive per ADR-012), `resolvedAgainst`, `contrast` (wcag + apca + simulated), `compliance`, `gamut`, `intent`, `cvd`, `provenance`.

Must resolve before step 1.

### OQ-4: Authoring tool technology

**Closed.** Fork path taken. Palette-pal's UI (37 files, ~7400 LOC including CurveOverlayEditor, paletteStore, TopBar, RightPanel, export/import modals) was copied into `packages/authoring-app/` and rewired to `@pigmint/core` for all color math. Palette-pal-only libraries (`lib/curveInterpolation.ts`, `lib/exportTokens.ts`, `lib/importTokens.ts`, `lib/exportContrastMap.ts`) stay local. Palette-pal at `/Users/davidthorn/git/palette-pal` is no longer a live dependency — the fork diverges here. Dual view overlays remain unbuilt and tracked as action item C2. Whether to later extract authoring-app's UI into a standalone library is a future question, not reopened here.

### OQ-5: Feedback aggregation mechanism

**Closed by ADR-020.** Cross-project aggregation is out of scope for a personal-use tool. Project-level audit feedback (ADR-010 channel 1) remains; spec-gap detection across teams is no longer a concern. Retained here as a pointer to ADR-020.

### OQ-6: Canonical ramp step count

**Superseded by ADR-012.** Ramps are continuous curves; primitives are a canonical named grid over the curve. Step count is a grid decision, not a ramp decision. Retained here as a pointer to ADR-012.

### OQ-7: Single app or split app for the authoring workflow

The five-phase authoring workflow (ramp authoring, intent authoring, surface pair viewer, sticker sheet, audit integrator) overlaps but doesn’t neatly fit in one app. Phase 4 (sticker sheet) has real technical reasons to potentially be separate, rendering real framework components is different infrastructure than rendering color chips. Plausible outcome: authoring app (phases 1-3, 5) plus verification harness (phase 4, per-adapter).

Defer until phase 4 is closer. Not blocking.

### OQ-8: P3 pipeline scope, day-one or deferred?

ADR-015 makes the engine capable of emitting P3 values, but full end-to-end P3 support requires more than output representation. Decisions needed:

- **Audit calculations in P3 space.** WCAG contrast math is defined for sRGB. APCA is perceptual and somewhat gamut-independent. If a team targets P3 displays and uses out-of-sRGB colors, which gamut does audit tooling evaluate against? Probably both, with separate reports, but that’s a choice.
- **Sticker sheet rendering on P3 displays.** The verification surface (Layer 3, phase 4) needs to render in the target gamut to show the truth. Browsers support `color(display-p3 ...)` on capable hardware; the harness needs to use it intentionally.
- **Resolver gamut awareness.** When resolving “matched chroma across all ramps,” should the resolver match in OKLCH (gamut-independent perceptual) or clamp to the target output gamut? Affects the subtle-border consistency story directly.
- **Adapter opt-in.** Most shadcn, MUI, Radix users today don’t care about P3. Making it mandatory bloats output for no benefit. Making it optional keeps the door open without forcing the work.

Likely answer: **capability day-one, full pipeline deferred.** Engine emits P3 values and flags gamut in receipts; audit tooling treats sRGB as default compliance target; adapters opt into P3 consumption when they’re ready; sticker sheet gets P3 rendering as a later improvement.

Must resolve before step 1 in the narrow sense (what representations to emit). Full pipeline can defer past step 5.

### OQ-9: Parallel alpha ramps (Radix-style)

ADR-016 commits to alpha-as-modifier as the primary alpha mechanism. Open question: whether to also emit parallel alpha ramps as primitives (Radix’s pattern: `redA1` through `redA12` alongside `red1` through `red12`), addressable by name for cases where teams want “a hint of red” without knowing the background.

**Arguments for.** Useful for tinted overlays over dynamic content (photo backgrounds, video) where the background genuinely can’t be known at token definition time. Makes certain design patterns expressible that alpha-as-modifier can’t, specifically “use red.a5 here and I don’t care what’s behind it.”

**Arguments against.** Doubles primitive count. Alpha primitives can’t have contrast receipts the same way solid tokens do because the rendered color depends on runtime background. Forces the audit tool to either ignore alpha primitives or flag them as “cannot verify.” Most usage that wants alpha primitives is better served by alpha-as-modifier with an explicit reference surface.

**Likely scope, revised per ADR-020.** Since Radix is no longer a build target, the main motivator (Radix parity) is gone. Most remaining use cases (scrims over photos, overlays on video) are covered by alpha-as-modifier with an explicit reference surface per ADR-016. Mark as **unlikely to build** unless a concrete need surfaces in the author’s own work. Retain the entry for completeness, not as a planned feature.

Not blocking. Effectively dormant.

### OQ-10: Hosted authoring surface strategy

**Closed by ADR-020.** The engine is local-only. Palette-pal’s existing hosted web app continues to operate independently as a browser-based ramp experimentation surface, but is not part of this engine’s deployment story. If the author’s needs ever change (e.g., collaboration with non-developers on ramp authoring), revisit whether a hosted companion makes sense. Not a planned feature; retained as a pointer so the decision isn’t silently reopened.

### OQ-11: MUI version target for the adapter

The MUI adapter’s implementation differs significantly based on the MUI version being targeted. The author’s work uses MUI v5 today. Version landscape:

- **MUI v5.** Emits multiple theme objects (one per mode), swapped via `ThemeProvider`. CssVarsProvider exists but is experimental (`experimental_extendTheme`, `Experimental_CssVarsProvider`). Runtime validator has to do more work because no CSS-vars cascade is available to lean on.
- **MUI v6.** CssVarsProvider and `extendTheme` are stabilized; one theme object with `colorSchemes: { light, dark }` replaces the two-theme-object pattern. `theme.applyStyles()` replaces `theme.palette.mode === 'dark'` checks in component overrides. Smaller bundle, no IE 11, codemods handle most breaking changes. Pigment CSS available as opt-in.
- **MUI v7.** Further cleanup; CssVarsProvider features fold into the regular `ThemeProvider`. Package layout fixes for ESM/CommonJS. Grid renamed (breaking), deprecated APIs removed. Small upgrade from v6.

**Tradeoff.**

- Building against v5 produces a more fragile adapter (two-theme-object juggling, experimental APIs, thicker runtime validator) and needs rewriting when the app migrates to v6+.
- Building against v6+ produces a cleaner adapter (CSS vars, `applyStyles()`, single theme with color schemes) but requires the author’s work to upgrade MUI first, or the adapter to ship ahead of adoption.

**Decision path.** Check two things at work before committing:

1. What would the v5-to-v6 upgrade actually cost? Run `npx @mui/envinfo` and compare the codemod output against the migration guide.
1. How much custom theming exists (`components.*.styleOverrides`)? Heavy custom theming means the v6 `variants` vs `styleOverrides` precedence change needs attention.

If upgrade is tractable (a few weeks of work), target **v6+ directly** and let the adapter assume stable CssVarsProvider. If upgrade is blocked, build the **v5 adapter** but plan for meaningful rewrite when the upgrade happens, and don’t over-invest in v5-specific patterns (experimental CssVarsProvider hacks, two-theme-object juggling beyond what’s necessary).

Must resolve before step 5. Not blocking for earlier steps.

### OQ-12: APCA threshold mapping

`EngineConfig.target` is typed as `'AA' | 'AAA'`, inherited from WCAG 2.1's conformance levels. But `ContrastKind` allows `'apca'` alongside `'wcag'`, and APCA has no official AA/AAA levels — it uses Lc thresholds (Lc 60, Lc 75, Lc 90 being common). The resolver currently throws on APCA thresholds (`packages/core/src/resolver/resolve.ts:41`), so this question is latent but real.

Options:

- **Map AA/AAA to Lc values.** E.g., `AA-text ≈ Lc 75`, `AAA-text ≈ Lc 90`, with a similar scale for nonText. Pros: keeps the `target: AA | AAA` surface simple across both compliance kinds. Cons: the mapping is pigmint's convention, not a spec; documenting which Lc maps to which tier is its own explainer. Different tools disagree on the right numbers.
- **Add explicit Lc thresholds when `compliance: apca`.** Engine config grows a parallel `apcaThreshold: number` field (or target becomes `target: 'AA' | 'AAA' | { apca: number }`). Pros: honest — no implied equivalence. Cons: more UI surface; the engine panel needs a different control per compliance kind.
- **Defer APCA entirely until the spec resolves.** Hide `compliance: apca` from the UI, document that only `wcag21` is supported. Revisit when WCAG 3 drafts stabilize APCA thresholds with named tiers.

Likely answer: **defer** (third option) in the short term — hide APCA from the engine panel and skip the resolver path until a concrete use case surfaces. The AA/AAA mapping option is tempting but creates an invisible pigmint-specific convention that audits in other tools will disagree with.

**Resolved (deferred).** Took option 3 as part of action item B1. UI hides the compliance selector (read-only "WCAG 2.1" badge), intent store coerces any persisted `apca` → `wcag21`, and CLI `validateProjectConfig` rejects `engine.compliance !== 'wcag21'` at parse time pointing back to this question. Revisit when there's a concrete APCA adopter or when WCAG 3 stabilizes named tiers — at that point the resolver work in `packages/core/src/resolver/resolve.ts:41` and the UI selector can come back together.

-----

## Decisions deferred from earlier conversation

These came up in discussion and were explicitly not adopted, recorded here so they don’t resurface as “did we consider that?”

- **Stacks (elevation system) from gamut-all.** Rejected. Most frameworks (MUI, Material) handle elevation natively and conflict with gamut-all’s stack model. A narrower two-state “base vs elevated” surface modifier survives (ADR-006), but arbitrary stack levels do not.
- **Combining authoring and verification into one tool.** Rejected. Different questions (brand differentiation vs brand validation), different performance profiles. Separate tools.
- **Light-as-default DTCG output with dark-as-override.** Rejected. See ADR-003.
- **Treating modes as composable transforms.** Rejected. See ADR-004.
- **Pushing adapter constraints back into ramp generation.** Rejected. See ADR-008.
- **MCP server instead of CLI.** Deferred, not rejected. A CLI is strictly more general, and an MCP server can wrap a CLI later. Worth revisiting once layer 1 is stable.

-----

## Document maintenance

- New decisions get new ADR numbers; existing ADRs are updated in-place if refined, or superseded with a pointer if fundamentally changed.
- Open questions move from OQ-n to resolved ADRs as they’re answered.
- Build sequence updates as steps complete.
- This doc is the source of truth across conversations. Future conversations should reference ADR numbers rather than re-deriving decisions.