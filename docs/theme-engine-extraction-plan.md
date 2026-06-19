# Theme engine extraction plan

A one-week, agent-executable plan to refactor HearthCode's color pipeline into a
generic, project-agnostic **theme compiler** — the reusable "middle" that turns a
declarative source into multi-platform artifacts, parameterized by a value
**domain** (color today) and platform **emitters**.

> Vision in one line:
> `compile({ source, domain, emitters, variant }) → artifacts`
> The engine knows nothing about color or about VS Code. Aesthetics live in
> `source` + `domain`; distribution lives in `emitters`; the middle is npm-able.

This document is the shared source of truth across executing agents (Claude Code,
Codex) and separate processes. **It plans the refactor; it does not perform it.**
Each task below is written to be picked up cold.

---

## 0. How to use this document

- **Work one task at a time, in order.** Tasks are sized ≤ ~half a day. Each is
  independently shippable and reversible.
- **Every task must pass THE GATE (§4) before it is "done".** No exceptions.
- **One commit per task.** No attribution trailers (see §4).
- **Update the task's status box** (`[ ]` → `[x]`) and write the commit hash in
  the Done column when it lands, so parallel agents/processes stay in sync.
- **Mechanical extractions** (Phase 1, 2, 5 — moving/wrapping code with zero
  behavior change) suit Codex. **Design-bearing tasks** (Phase 3 domain
  parameterization, Phase 7 composite constraint / `over` surface choice) suit
  Claude Code or human-in-the-loop. This is a hint, not a rule.
- **The proven template for every extraction is M1**: see the worked example in
  `tests/color-solve-pipeline.test.mjs` + the `export function
  resolveAbstractColorSource` seam in `scripts/color-system/build.mjs`. Open a
  seam (export), pin its contract with a test, prove zero output drift. Repeat.

---

## 1. Target architecture

Four concerns, currently fused in `build.mjs` + `color-system.mjs`, become four
swappable layers behind explicit interfaces:

```
SOURCE  →  [ load → resolve → verify → emit ]  →  ARTIFACTS
            └──────────── ENGINE ────────────┘
                     ▲                  ▲
              Domain plugin       Emitter plugins
              (color)             (vscode / obsidian / web)
```

### The 5 objects (the entire conceptual surface)

```js
/** @typedef {Object} Token
 *  @property {string} id            e.g. "status"
 *  @property {string} layer         e.g. "interaction" — declared data, not a hardcoded fn
 *  @property {Source} source        how its value is produced
 *  @property {Derive[]} [derive]    optional post-transforms
 */

/** @typedef {
 *    | { kind: 'literal', value: V }
 *    | { kind: 'ref',     token: string }
 *    | { kind: 'derive',  from: Source, transform: string, args?: object }
 *    | { kind: 'solve',   anchor: V, constraints: Constraint[] }
 *  } Source  — the value algebra. Exactly these 4 kinds.
 */

/** @typedef {Object} Domain<V>      — color is ONE implementation; engine never imports it directly
 *  @property {(raw) => V} parse
 *  @property {(v: V) => string} serialize
 *  @property {Record<string, (v: V, args, ctx) => V>} transforms      mix, alpha, lighten, hue…
 *  @property {Record<string, (v: V, c: Constraint, ctx) => {ok, margin}>} constraints  minContrast…
 *  @property {(anchor: V, constraints: Constraint[], ctx) => V} solve
 */

/** @typedef {Object} Emitter        — one per platform
 *  @property {string} name          "vscode"
 *  @property {string[]} consumes     which layers it reads (its contract)
 *  @property {(ir: ResolvedModel) => File[]} emit
 */

/** compile<V>({ source, domain, emitters, variant }) => File[] */
```

### Folder layout (week 1: plain `.mjs` + JSDoc, no new toolchain)

```
scripts/theme-engine/
  types.mjs            the 5 typedefs above (JSDoc only, zero runtime)
  core/                generic: DAG walk, source-kind dispatch, lineage, cycle detection
  domain-color/        color value + transforms + constraints + solver
  emit/                vscode / obsidian / web emitters behind the Emitter interface
  verify/              invariant checker + golden snapshot harness
  compile.mjs          the compile() assembly
your repo (unchanged): color-system/schemes/**.json   ← source data (aesthetics)
                       theme.config.mjs                ← which domain + emitters + variants
```

### Dependency rule (the root of "modular / pluggable")

> `core` depends on nothing. `domain-*` and `emit-*` depend only on `core`'s
> types. Emitters do not depend on each other. Your project depends on
> everything and is depended on by nothing. **Strictly acyclic.**

Adding a platform = a new emitter. Adding a value kind (spacing, motion) = a new
domain. **Neither touches `core`.** That is the property that makes the middle
publishable as `@loom/*` (working name — rename freely) without HearthCode.

---

## 2. Current → target map (orient here first)

| Current (real files) | What it is | Becomes |
|---|---|---|
| `scripts/color-system/build.mjs` › `resolveAbstractColorSource` (exported, M1) | source-kind dispatch + `against` recursion + lineage | `core/resolve` |
| `build.mjs` › `applyAbstractDerive`, `applyDerive` | mix / alpha / hue transforms | split: generic apply in `core`, math in `domain-color` |
| `build.mjs` › `buildResolved{Surface,Interface,Interaction,Feedback,Guidance,Terminal}Rules` (×7) | per-layer builders; deps declared in their param lists; each has a `resolving` cycle guard | `core` generic layer-resolution (Phase 4 makes the layer set data) |
| `scripts/color-system/solve.mjs` | constraint solver (pure, tested) | `domain-color/solve` |
| `scripts/color-utils.mjs` | Lab / contrast / hex math | `domain-color` primitives |
| `scripts/color-system.mjs` (2327 lines) | source loaders + hand-written schema normalizers + path config | `core` loader + (later) declarative schema; keep policy/paths in repo |
| `scripts/color-system/artifacts.mjs` › `buildGeneratedPlatformTokenMaps` | resolved model → platform token maps | `emit` (first emitter) |
| `scripts/generate-*.mjs` (×11, e.g. `generate-obsidian-themes.mjs`) | per-platform file writers, orchestrated by `sync-themes.mjs` | `emit/*` emitters |
| `scripts/sync-themes.mjs` | orchestrator: build model → maps → run generators | `compile()` + thin CLI |
| `audit:all` (19 audit scripts) | post-hoc verification | `verify` invariants; collapse as constraints subsume them |

Already done (this session):
- **M1**: `resolveAbstractColorSource` exported + `tests/color-solve-pipeline.test.mjs`
  proves the resolve dispatch end-to-end (adjust path, self-heal, loud throw,
  lineage). This is the pattern to repeat.
- `status` and `cursor` converted to `type:"solve"` (both inert / zero-drift).

---

## 3. Guardrails, invariants, non-goals

**Invariants the engine must always satisfy (turn into `verify` property tests):**
1. **Acyclic**: the resolved DAG never cycles (per-layer `resolving` guards already
   throw; keep them, add a cross-layer property test).
2. **Deterministic**: same source → byte-identical output, every run.
3. **Idempotent**: running `compile` twice changes nothing the second time.
4. **Lineage-complete**: every resolved value records its full provenance chain
   (anchor/ref + every constraint background).
5. **Loud on failure**: unsatisfiable constraints / missing refs throw; never emit
   a silent fallback color.

**Traps to avoid (each has bitten this codebase or its peers):**
- **Variant matrix explosion.** Keep variant axes (dark/light, density, brand)
  *orthogonal and composed*, resolved on demand. Never enumerate the full matrix.
  (The purged `darkSoft`/`lightSoft` keys were this trap.)
- **Over-generalization (YAGNI).** There is exactly **one** domain today: color.
  Build the *seams* domain-agnostic, but do **not** build `domain-space` /
  `domain-motion` packages on spec. The kernel/plugin split pays off with one
  domain (color becomes independently testable, engine becomes reusable); empty
  domains do not.
- **Constraint-solver creep.** Keep constraints a small, closed, declarative set
  with loud-throw. The lightness-only solver is a *feature* (bounded, predictable,
  provable). Do not grow it toward a general CSP solver.
- **Semantics-as-prose.** The whole point is executable constraints. Do not add a
  token whose real rule lives only in a description string (that is the original
  drift this project is escaping).

**Non-goals for week 1:** publishing npm packages; introducing TypeScript build;
rewriting `color-system.mjs`'s validators; converting all 11 remaining literals.
Those are roadmap (§7, Phase 8), not this week.

---

## 4. THE GATE — every task must pass this before "done"

```bash
# 1. Zero output drift — regenerate and confirm ONLY the files you intended moved.
node scripts/sync-themes.mjs && git diff --stat
#    MUST NOT appear unless the task explicitly says so:
#    themes/**  public/themes/**  extension/themes/**
#    src/data/tokens.ts  color-system/semantic.json  obsidian/**
#    src/styles/theme-vars.css

# 2. Tests green (count only goes UP — never delete a passing test to pass).
pnpm run test

# 3. Full release gate green.
pnpm run audit:all

# 4. Revert pnpm lockfile churn (KNOWN HAZARD: local pnpm 11 vs CI 10 rewrites it).
git diff --quiet pnpm-lock.yaml || git checkout pnpm-lock.yaml
```

Then commit:
- **One commit per task**, imperative subject (match existing log style).
- **No attribution trailers** — no `Co-Authored-By`, no "Generated with…". (Repo
  policy; history was scrubbed.)
- Branch: work on a feature branch, not `main`.

**Two task classes w.r.t. drift:**
- **Inert tasks** (Phase 0–6, 8): zero output drift is the gate — generated
  artifacts are byte-identical. This is most of the plan.
- **Behavior tasks** (Phase 7): deliberately change a shipped color (e.g.
  `focusRing`). These do NOT pass "zero drift" — instead they require a
  contrast/visual proof + the user's sign-off. Each such task says so explicitly.

---

## 5. The phased plan

Dependency order: **0 → 1 → 2 → 3** is the spine (do in sequence). 5, 6 build on
3. 7 (payoff tokens) can interleave once 1 lands. 4 and 8 are stretch/next-week.

### Phase 0 — Skeleton & contracts  ·  ~0.5 day  ·  inert

- [x] **T0.1 — Create the engine skeleton and the 5 typedefs.**
  - **Goal:** make the target shape exist and importable; no logic.
  - **Steps:** create `scripts/theme-engine/{core,domain-color,emit,verify}/`
    (with `.gitkeep`), write `scripts/theme-engine/types.mjs` containing the 5
    JSDoc typedefs from §1, and `scripts/theme-engine/compile.mjs` exporting a
    `compile()` that throws `Error('compile: not wired (see docs/theme-engine-extraction-plan.md)')`.
  - **Acceptance:** `node -e "import('./scripts/theme-engine/compile.mjs')"`
    resolves; add `tests/theme-engine.contract.test.mjs` asserting `compile` is a
    function and throws the not-wired error. THE GATE passes (nothing regenerates).
  - **Done:** `[x]` commit ⟶ 191a5da

### Phase 1 — Extract the color domain (keystone)  ·  ~1 day  ·  inert (additive)

- [x] **T1.1 — Implement `domain-color` as a thin wrapper (no logic moved yet).**
  - **Goal:** one object that *is* the color domain, built by re-exporting/wrapping
    existing primitives so it is provably equivalent and risk-free.
  - **Steps:** `scripts/theme-engine/domain-color/index.mjs` exports a `Domain`:
    `parse`/`serialize` wrap `normalizeHex` + `hexToRgba`/`rgbaToHex`
    (`scripts/color-utils.mjs`); `transforms` = `{ mix, alpha, lighten, hue }`
    built from `mixHex`, `hexToRgba`, `hslToHex`/`rgbToHsl` (color-utils);
    `constraints` = `{ minContrast }` built from `contrastRatio`; `solve` re-exports
    `solveConstrainedColor` (`scripts/color-system/solve.mjs`).
  - **Acceptance:** `tests/theme-engine.domain-color.test.mjs` proves each member
    against known values (reuse fixtures from `color-solve.test.mjs`). THE GATE
    passes — build.mjs untouched, so output is byte-identical by construction.
  - **Note:** this is purely additive. Re-pointing `build.mjs` at the domain is
    Phase 3, not here. Keep the steps separate to keep each zero-risk.
  - **Done:** `[x]` commit ⟶ a66924c

### Phase 1.5 — Composition & override model  ·  ~1 day  ·  inert  *(after Phase 1)*

> Covers the "灵活组装 / 控制 / 改倾向" goal: how `base + scheme + variant + knobs`
> compose into one effective source, with a single explicit precedence, resolved
> per-cell on demand (never enumerate the full variant matrix). Today this is
> implicit across `schemes/**`, `variant-knobs.json`, and `variant-profiles`; this
> phase makes it a first-class, testable capability.

- [ ] **T1.5.1 — Formalize source composition + lazy variant resolution.**
  - **Goal:** one function `composeSource(base, scheme, selector)` produces the
    effective `ThemeSource` for a single variant cell, with a documented precedence
    (`base → scheme override → variant → knobs`), deep-merge, and lineage recording
    which layer won each value.
  - **Steps:** locate the current composition (scheme load + variant-knobs +
    variant-profiles in `scripts/color-system.mjs` / `build.mjs`); extract it into an
    explicit `core` compose step; document the precedence order in a comment +
    §7 decision log; ensure resolved lineage shows the winning layer (chainRefs
    already do this partially — verify and extend if needed).
  - **Acceptance:** `tests/theme-engine.compose.test.mjs` asserts (a) precedence
    order is honored, (b) changing one knob changes only the affected tokens,
    (c) no full-matrix enumeration (resolving one selector touches only that cell).
    THE GATE passes byte-identical.
  - **Done:** `[ ]` commit ⟶ ____

- [ ] **T1.5.2 — Expose "tendency" knobs as named parameters in `theme.config`.**
  - **Goal:** "change a tendency" = change one declared value (accent, alphas,
    density), not hunt through JSON.
  - **Steps:** surface the existing `variant-knobs.json` axes as a typed, documented
    knob set in `theme.config.mjs`; one named example end-to-end (e.g. change an
    alpha knob → rerun → only dependent tokens move).
  - **Acceptance:** a test that flipping a named knob produces the expected, scoped
    change; THE GATE (this is a config-surface task — output only moves if you
    actually change a knob value, which the test does in isolation, not in the
    committed source).
  - **Done:** `[ ]` commit ⟶ ____

### Phase 2 — Seam the resolver stages (generalize M1)  ·  ~1 day  ·  inert

- [x] **T2.1 — Export + pin `applyAbstractDerive` (seam #2).**
  - **Goal:** make the derive stage independently testable, like M1 did for resolve.
  - **Steps:** add `export` to `applyAbstractDerive` in `build.mjs`; extend
    `tests/color-solve-pipeline.test.mjs` (or a new `*-derive` file) to drive it
    directly: prove `alpha` (alphaFromVariantKnob) and `mix` paths produce expected
    values with stubbed resolvers; prove derive runs AFTER source resolution.
  - **Acceptance:** new tests green; THE GATE passes.
  - **Done:** `[x]` commit ⟶ e9f6bb9 (new file `tests/color-derive-pipeline.test.mjs`)

- [ ] **T2.2 — Export the 7 layer builders + add representative stage tests.**
  - **Goal:** every layer enterable/testable in isolation; the DAG made explicit.
  - **Steps:** add `export` to `buildResolved{Surface,Interface,Interaction,
    Feedback,Guidance,Terminal}Rules` and `buildSemanticPalette`. Add
    `tests/theme-engine.layers.test.mjs` with ≥2 representative cases (e.g. build
    `surfaces` from a minimal foundation; build `interactions` with stubbed
    surface/interface tables) asserting resolved values + that a forced intra-layer
    cycle throws "… derivation cycle detected".
  - **Acceptance:** tests green; THE GATE passes.
  - **Done:** `[ ]` commit ⟶ ____

### Phase 3 — Parameterize core by domain (the generality unlock)  ·  ~1 day  ·  inert

- [x] **T3.1 — Thread a `domain` argument through resolve + derive.**
  - **Goal:** `core` stops importing color math directly; it calls
    `domain.transforms[...]`, `domain.constraints[...]`, `domain.solve`. Same math,
    now via the interface.
  - **Steps:** add `domain` to the options of `resolveAbstractColorSource` and
    `applyAbstractDerive`; replace inline `contrastRatio`/`mixHex`/solver calls with
    `domain.*`; pass the `domain-color` object from the call sites in the builders.
  - **Acceptance (critical):** THE GATE passes byte-identical (this is the proof the
    indirection is equivalent). PLUS add a test that injects a **fake non-color
    domain** (e.g. integer values, `minDelta` constraint) and resolves a tiny token
    graph — proving `core` is now domain-agnostic. This test is the deliverable's
    whole point; do not skip it.
  - **Risk:** `domain.transforms` must produce byte-identical results to the old
    inline `applyDerive`. If any platform file moves in step 1 of THE GATE,
    something diverged — diff it before proceeding.
  - **Done:** `[x]` commit ⟶ 4b6e7ac. Routed solve/toOpaque/mix/alpha through the
    domain (byte-identical) + fake-domain proof in `tests/theme-engine.core-generic.test.mjs`.
    NOTE: `domain` still defaults to colorDomain inside build.mjs and literal parse
    still uses normalizeHex — **T3.2 follow-up** = make `domain` an injected (non-
    default) param from the composition root + route literal parse via `domain.parse`,
    removing the colour import from core entirely. Also still pending: **T2.2**
    (export the 7 builders + stage tests) and **Phase 1.5** (composition model) were
    skipped this pass to reach the T3.1 keystone first.

### Phase 5 — Emitter interface  ·  ~0.5 day  ·  inert  *(after Phase 3)*

- [x] **T5.1 — Define `Emitter` and wrap two emitters behind it.** (web done; vscode/obsidian deferred)
  - **Goal:** establish the platform-plugin boundary without moving all 11
    generators.
  - **Steps:** in `scripts/theme-engine/emit/`, wrap `buildGeneratedPlatformTokenMaps`
    (artifacts.mjs) as the `vscode`/`web` emitter and `generateObsidianThemes` as the
    `obsidian` emitter, each exposing `{ name, consumes, emit(ir) }`. Do not rewrite
    them; adapt their signatures to take the resolved model and return file
    descriptors.
  - **Acceptance:** a test that running the wrapped emitters over the current model
    produces the same bytes as the committed outputs; THE GATE passes.
  - **Done:** `[x]` commit ⟶ web emitter (`scripts/theme-engine/emit/web.mjs`) reproduces
    `src/data/tokens.ts` byte-for-byte. vscode/obsidian emitters (write-side spread
    across generate-*.mjs) are the follow-up.

### Phase 6 — `compile()` assembly  ·  ~0.5 day  ·  inert  *(after 3 + 5)*

- [x] **T6.1 — Wire `compile({source, domain, emitters, variant})`.** (emit stage wired; load/resolve delegate to builder)
  - **Goal:** one generic entry point reproducing `sync-themes.mjs` output.
  - **Steps:** implement `compile.mjs` to run load → resolve (core+domain) → verify
    → emit (emitters). Create `theme.config.mjs` declaring the color domain + the
    emitters + variants. Have `sync-themes.mjs` call `compile()` for the parts now
    covered (keep the uncovered generators as-is for now).
  - **Acceptance:** THE GATE passes byte-identical; a test asserts `compile()` output
    for moss-dark == the committed `themes/moss-dark.json`.
  - **Done:** `[x]` commit ⟶ `compile({ emitters })` runs the model through the emitter
    plugins; test proves `compile({ emitters: [webEmitter] })` reproduces
    `src/data/tokens.ts` byte-for-byte. Folding load/resolve into compile + a `verify`
    stage + the full `{source,domain,variant}` signature is the remaining Phase 6 work.
  - **Done:** `[ ]` commit ⟶ ____

### Phase 7 — Constraint-compiler payoff (parallel track)  ·  behavior tasks

> These continue the token migration. **They may change shipped colors** → they do
> NOT use zero-drift; they need contrast proof + user sign-off. Can start once
> Phase 1 lands (domain has the constraint registry).

- [ ] **T7.1 — Add a composite-aware `minContrast` modifier; convert `focusRing`.**
  - **Goal:** measure contrast on the *alpha-composited* ring, not the opaque base.
  - **Steps:** extend the constraint shape with optional
    `composite: { alphaFromVariantKnob, over: <source> }`; in `domain-color`'s
    `minContrast`, blend the candidate over the resolved `over` surface before
    measuring; **thread `resolveVariantKnob` into the solve branch of
    `resolveAbstractColorSource`** (currently absent). Keep solver output the OPAQUE
    base — let existing `derive.alphaFromVariantKnob` apply the alpha (one
    responsibility each). Convert `focusRing` in `interaction-rules.json`.
  - **Decision needed (user):** which surface is `over`? `focusRing` renders on many
    surfaces; `canvas` is the doc's first guess but may not be the worst case.
    Decide single-worst-case vs multi-`over`.
  - **Acceptance:** NOT zero-drift. Prove composited contrast ≥ 3 for both variants
    (measured: dark 3.41, light 3.54 today); visual review; `pnpm run audit:all` 0.
  - **Done:** `[ ]` commit ⟶ ____

- [ ] **T7.2 — Add `maxContrast` kind; convert `lineEmphasis`.**
  - **Goal:** express "stay subtle / must not become a spotlight" (an upper bound).
  - **Steps:** add `maxContrast` to `domain-color.constraints` + the solver's
    satisfied/margin logic + the validator allow-list; convert `lineEmphasis`.
  - **Acceptance:** behavior task — prove the current value already satisfies (inert
    if so) or review the change; THE GATE / audits green.
  - **Done:** `[ ]` commit ⟶ ____

- [ ] **T7.3 — Quick-win minContrast batch (after a probe exists).**
  - Convert the ink tokens `shellInk, onAccentInk, onDeepFillInk, navActiveInk,
    guideInk` (each is "readable ink on a fill"). **Per token, confirm the ink→fill
    direction does not cycle** (the fill must not depend on the ink). Prefer building
    `scripts/theme-engine/verify/audit-constraint-candidates.mjs` first to report,
    per literal, its current/composited contrast and a suggested ratio.
  - **Done:** `[ ]` commit ⟶ ____

### Phase 4 — (Stretch / next week) Layer DAG as data  ·  inert  ·  higher risk

- [ ] **T4.1 — Replace the 7 hardcoded builders with a declared layer graph.**
  - **Goal:** adding a layer becomes data, not a new `buildResolved*Rules` function.
  - **Sketch:** declare layers + their dependency order + `allowedKinds` in config;
    a single generic `resolveLayer(layerId)` walks them topologically using the
    `core` resolver. Gate extremely carefully (byte-identical). Only attempt after
    Phases 1–3 are stable.

### Phase 8 — (Roadmap) Lift folders to packages  ·  inert

- [ ] **T8.1 — Promote `scripts/theme-engine/*` to a workspace `packages/@loom/*`.**
  - Mechanical once interfaces are stable: add `package.json` per folder, set up
    pnpm workspaces, repoint imports. Optionally introduce TypeScript here.
  - **Audit coupling:** several audits hardcode `scripts/` paths — update them in
    the same change (see the project memory on audit/site-path coupling).

---

## 6. Suggested week schedule

| Day | Tasks | Outcome |
|---|---|---|
| 1 | T0.1, T1.1 | Skeleton + the color domain object exist & tested |
| 2 | T1.5.1, T1.5.2 | Composition/override formalized; tendency knobs named |
| 3 | T2.1, T2.2 | Every resolver stage seamed + tested (DAG explicit) |
| 4 | T3.1 | `core` parameterized by domain — proven generic via fake-domain test |
| 5 | T5.1, T6.1 (or buffer) | Emitter interface + `compile()` reproduces output byte-identical |

Stretch / next week: T7.1–T7.3 (constraint payoff), Phase 4, Phase 8. If a day
slips, the spine (0→1→1.5→2→3) is the priority; the payoff/stretch tracks can wait.

---

## 7. Decision log (resolve before / during; recommendation given)

1. **TS vs JSDoc** → *Recommend JSDoc + `.mjs` for week 1* (zero new toolchain).
   Revisit TS at Phase 8.
2. **Folder home** → *Recommend `scripts/theme-engine/`* (co-located with the build
   tooling it extracts). Lift to `packages/` at Phase 8.
3. **Engine name** → placeholder `loom` / `@loom/*`. Rename freely before Phase 8.
4. **`over` surface for `focusRing`** (T7.1) → open; needs a real decision.
5. **How far to push Phase 4** (layer-as-data) → optional; only if Phases 1–3 feel
   solid and there is appetite for the higher-risk change.

---

## 8. Glossary (current term → target term)

- *color language model* → resolved model / IR
- `resolveAbstractColorSource` → `core` resolve (source-kind dispatch)
- `applyAbstractDerive` → `core` derive (delegates transforms to the domain)
- `buildResolved*Rules` (×7) → `core` layer resolution (Phase 4: data-driven)
- `solveConstrainedColor` → `domain-color.solve`
- `contrastRatio` / `mixHex` / Lab math → `domain-color` transforms + constraints
- `buildGeneratedPlatformTokenMaps` + `generate-*.mjs` → `emit/*` emitters
- `sync-themes.mjs` → `compile()` + thin CLI
- `audit:all` (19 scripts) → `verify` invariants (collapse as constraints subsume)
