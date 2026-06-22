# Calibration Constraint Plan

## Purpose

This plan moves the VS Code theme calibration pipeline from imperative color repair to declared constraints plus solving.

This is a visual change, not a byte-identical refactor. The current imperative pipeline pins one specific satisfying color by mixing, scaling, or boosting through local rules. A constraint solver may choose a different color that still satisfies the declared requirements. Every phase therefore needs a small visual rebaseline, audit evidence, telemetry, and human sign-off before the next phase starts.

## Current State

VS Code theme generation still runs through `scripts/generate-theme-variants.mjs`. The engine now owns emission, but `buildVscodeThemes()` remains the real calibration stage before the VS Code emitter serializes themes.

The main imperative calibration channels are:

- Interaction state visibility: `enforceInteractionStateContrast`, `enforceLineNumberActiveDelta`, and `applyInteractionStateBudget`.
- Light readability: `calibrateColorForReadability` and `calibrateLightReadability`.
- Role hue lanes: `enforceRoleHueBand`.
- Chroma and near-foreground budgets: `applySoftRoleChromaBudget` and `enforceNearForegroundBudget`.
- Warm-role guards and exposure balance: `enforceWarmGamutGuard` and `applyWarmRoleExposureBalance`.
- Global distribution: `boostGlobalSeparation` and `computeGlobalSeparationRatio`.

`color-system/framework/tuning.json` already holds the thresholds for these behaviors. During this migration, those thresholds become the parameter source for token-level constraints rather than post-hoc repair knobs.

`scripts/color-system/solve.mjs` is currently a narrow solver:

- It supports `minContrast`.
- It adjusts only Lab lightness.
- It preserves anchor hue and chroma.
- It keeps an already-satisfying anchor unchanged.
- It throws when no lightness value can satisfy all constraints.

`scripts/optimize-theme-colors.mjs` is an offline candidate search path for visual rhythm and role constraints. Long-term, its search/scoring ideas should converge into the same constraint engine instead of remaining a separate optimizer.

## Constraint Vocabulary

The target vocabulary is deliberately small and executable.

| Constraint | Scope | Meaning | Solver need |
| --- | --- | --- | --- |
| `minContrast` | Single token | Color must meet or exceed a contrast ratio against a resolved color. | Existing lightness axis works for many cases. |
| `maxContrast` | Single token | Color must stay below a contrast ceiling. | Requires bidirectional margin handling and conflict reporting. |
| `hueInBand` | Single token | Color hue must fall inside a declared lane. | Requires hue rotation or candidate search. |
| `maxChroma` / `chromaBudget` | Single token | Chroma must stay below a ceiling or inside a role budget. | Requires Lab/LCH chroma axis. |
| `minSeparation` | Pairwise token | Token must be perceptually separated from another token by deltaE or equivalent. | Requires pair-aware candidate evaluation. |
| `globalSeparation` | Token group | A group distribution must meet median/p25/p10 separation targets. | Requires joint optimization over a token set. |

Composite constraints are needed for VS Code state colors that may carry alpha. Stage 1 introduces an interaction-state contrast constraint that measures the state color composited over `editor.background`.

## Solver Direction

The migration keeps the existing `solve.mjs` contract as the nucleus:

- Constraint kinds are allow-listed.
- Each kind has a satisfaction check and signed margin.
- The solver ranks candidates by worst margin.
- Unsatisfied or unknown constraints throw loudly.

The solver then grows in three steps:

1. Multi-constraint single-token solving using the existing margin model.
2. Multi-axis candidate search for hue/chroma/lightness constraints.
3. Group solving for distribution constraints such as `globalSeparation`.

The final state should collapse three paths into one engine:

- `solve.mjs` / `colorDomain.solve`
- VS Code generator calibration in `generate-theme-variants.mjs`
- Offline candidate search in `optimize-theme-colors.mjs`

## Phase Plan

### Phase 1 - Interaction-State `minContrast` (done)

Status: landed. `enforceInteractionStateContrast` is replaced by `minCompositeContrast` constraints declared in `tuning.json` and solved by the engine. The solver preserves anchor alpha through the lightness search and throws when a target is unsatisfiable. Seven interaction colors were rebaselined across `themes/`, `public/`, and `extension/`.

Goal: replace the imperative contrast repair in `enforceInteractionStateContrast` with declarations plus solver execution.

Scope:

- `editor.lineHighlightBackground`
- `list.hoverBackground`
- `tab.hoverBackground`

Non-scope:

- `editorLineNumber.activeForeground` delta remains imperative in this phase because it is a relative delta constraint, not a single-token `minContrast`.

Implementation:

- Declare the affected VS Code color tokens and their constraints in `color-system/framework/tuning.json`.
- Build concrete constraints per variant from `interactionStateBudget`.
- Solve each token through the constraint engine.
- Emit telemetry for before, after, target, margin, and whether the token adjusted.
- Throw if a declared constraint cannot be satisfied.

Acceptance:

- `node --test tests/color-solve.test.mjs`
- `pnpm run test`
- `pnpm run check:sync`
- `pnpm run check:preview`
- `pnpm run audit:ink-contrast`
- `pnpm run audit:theme`
- `pnpm run audit:all`
- Color diff for `themes/**`, `public/themes/**`, and `extension/themes/**` is reviewed and signed off.

### Phase 2 - `hueInBand` (done)

Status: landed, zero output drift. `enforceRoleHueBand` now declares `hueInBand` + `minContrast` + `maxDeltaE` constraints per role and solves them through a new multi-axis LCH engine path (`solveConstrainedColorLch`). `hexHue` / `labToLch` / `lchToLab` were consolidated into `color-utils.mjs`. The channel is a no-op on the shipped themes (every role already sits in its lane with adequate contrast), and the port preserves that exactly, so no colors moved.

Goal: replace `enforceRoleHueBand` with declared role lane constraints.

Scope:

- Cool and warm hue bands from `roleLaneProfile`.
- Per-role lane assignments from role adapters and theme token mappings.

Implementation:

- Add `hueInBand` to the constraint vocabulary.
- Add candidate generation over hue while preserving acceptable contrast.
- Keep telemetry for seed hue, solved hue, contrast margin, and deltaE from anchor.

Acceptance:

- Role-lane audit still passes.
- Theme audit hue-band failures stay zero.
- Color diff and telemetry are reviewed before commit.

Carried into Phase 3 - hue-space defect:

- The ported `solveConstrainedColorLch` faithfully reproduces a pre-existing defect: its adjust path is non-functional. `isHueInBand` / `nearestHueOnBand` judge membership in HSL hue (`hexHue`), but candidates are constructed in LCH hue. An LCH-hue-`H` color realizes a different HSL hue, so candidates seeded at the lane edge almost never land in the HSL band and every one is rejected by the `hueInBand` constraint. A full color-wheel sweep finds zero successful adjustments; the solver only ever early-outs (already in lane) or throws. This never surfaced because the channel is a no-op on shipped themes.
- Phase 3 must pick one consistent hue space (express `hueInBand` and the lane seeding/search in the same space) so the adjust path actually works. Making it functional will move colors, so it is a reviewed visual change, folded into the Phase 3 rebaseline rather than retrofitted into the zero-drift Phase 2 commit.

### Phase 3 - Chroma Budgets and Near-Foreground Separation

Goal: replace `applySoftRoleChromaBudget` and `enforceNearForegroundBudget`, and fix the hue-space defect carried from Phase 2.

Decomposed into sub-commits (one reviewable color diff each):

- 3a - near-foreground separation (done).
- 3b - hue-space fix (done).
- 3c - chroma budget (done; pure maxChroma ceiling, reviewed visual rebaseline).

#### 3a - Near-foreground separation (done)

Status: landed, zero output drift. `enforceNearForegroundBudget` now declares `minSeparation` / `maxSeparation` against the foreground plus `minContrast`, solved by `solveNearForegroundColor`. The solver searches toward the foreground (mix) when the color is too far or under-contrasted, and away from it (lift chroma/lightness) when too close, steering toward `targetDeltaE`. The only color the channel moves on shipped themes (light `operator`, deltaE-to-fg 31.4 -> 16.6) is reproduced exactly.

#### 3b - Hue-space fix (done)

Status: landed, zero output drift. The Phase 2 defect is fixed: `solveConstrainedColorLch` is rewritten as `solveHueLaneColor`, generating candidates in HSL — the space the lane is judged in (`rgbToHsl` hue) and audited in (`review-moss-visual`). An in-band target now lands in band by construction, so the adjust path works (a rotation that was impossible before now passes in tests). The channel remains a no-op on shipped themes (every role already sits in its lane), so no colors moved.

#### 3c - Chroma budget (done, reviewed visual rebaseline)

Status: landed as a pure `maxChroma` ceiling. `applySoftRoleChromaBudget` was a deterministic desaturation transform (it scaled chroma by a per-role `factor` of ~0.86-0.96, lifted lightness, then capped at `maxChroma`), applied at the scheme's `softRoleChromaStrengthByVariant` (moss light = 0.1). It is replaced by `applyRoleChromaCeiling`, which declares a hard `maxChroma` constraint and solves it with `solveChromaCeilingColor`: an over-cap color is scaled straight down to the cap on its own hue/lightness; an under-cap color is left untouched. The unconditional desaturation/lift is dropped.

Follow-up hardening: the ceiling is re-applied and asserted after the downstream semantic-anchor and role-lane passes. This keeps `maxChroma` a final generated-theme invariant instead of a mid-pipeline repair that later channels can silently invalidate. `tests/color-solve.test.mjs` reads the generated themes and tuning to guard every declared role ceiling.

Ceiling re-tuning: enforcing the ceiling as a final invariant exposed that the `function` light cap (38) sat below the role's intended chroma. Pre-hardening, `function` shipped at chroma ~47.8 by silently exceeding the cap, and that headroom was what separated it from `property` (chroma ~34). Once the cap became real, `function` was clamped to ~37.4 and the moss-light `function`/`property` pair collapsed to deltaE 4.5 (the moss-visual `<10` follow-up fired). The fix is to raise `softRoleChromaBudget.light.function.maxChroma` to 48 — the role's actual intended maximum (dark uses 52) — which restores `function` to chroma ~47.8 and the pair to deltaE ~14.2 while keeping the ceiling a real guard against runaway boosts. ember-light `function` is a low-chroma blue, unaffected.

This is a reviewed visual change across variants:

- moss-light: over-cap roles are clamped down as a final invariant - function deltaE 13.9 vs `main` (10.3 vs the pre-hardening Phase 4 output), property 5.4, string 1.4.
- moss-dark: the declared dark function ceiling now applies to the output dark theme - function deltaE 2.3.
- ember-dark: the declared dark keyword ceiling now applies to the output dark theme - keyword deltaE 1.7.
- ember-light: the earlier under-cap roles still drop the old soft desaturation (method 4.9, function 2.5, property 1.9), with additional small target-propagation movements from the hardened dark baseline.

The change flows to every platform that shares the role colors (VS Code, web, Obsidian moss). It required regenerating the preview assets and the moss-visual snapshot baseline.

Acceptance (3a + 3b + 3c):

- `pnpm run test` and `pnpm run audit:all` pass (after rebaselining preview assets).
- Role lane near-foreground checks pass in `theme-audit`.
- Moss visual review passes.
- Color diff and telemetry reviewed and signed off.

### Phase 4 - Readability Dual Targets (done)

Status: landed, then hardened. `calibrateColorForReadability` is replaced by `solveReadabilityColor` in the engine: hard `minContrast` floors against both the canvas and foreground, plus soft targets that steer the bg and fg contrasts toward the dark theme's feel, scored over a lightness x chroma-scale grid with drift and optional target-lightness penalties. The two callers (`calibrateTokenEntriesForLight`, `calibrateSemanticEntriesForLight`) keep computing the dark-derived targets and the strength mix; the per-role weights and grid steps are passed in as `options` / `search`. If no candidate satisfies the declared floors, the solver throws loudly instead of keeping the anchor.

Goal: replace `calibrateColorForReadability` with multi-constraint solving for light themes.

Scope:

- Token colors and semantic token colors in light variants.
- Simultaneous constraints against editor background and editor foreground.

Implementation:

- Express readability as two contrast constraints plus optional drift/target-lightness scoring.
- Solve one token at a time with multiple constraints.
- Record target contrast, solved contrast, drift, and chosen candidate score.

Acceptance:

- Text contrast, readability, and color-contract audits pass.
- `pnpm run test` and `pnpm run audit:all` pass.
- Color diff and telemetry are reviewed before commit.

### Phase 5 - `globalSeparation` (Track A done, Track B deferred)

Status: landed as Track A after explicit approval. The existing global separation boost is now expressed as a declared group constraint and solved by the engine-owned `solveGlobalSeparationConstraint` path. This is a faithful port: it preserves the existing role-weighted boost heuristic, round count, deficit math, telemetry shape, and post-boost pipeline order, so generated theme artifacts stay byte-identical. The solver measures the group target through `computeGlobalSeparationStats`, applies the same boost to token and semantic entries, and reports median/p25/p10 margins through the group constraint result.

Track A keeps `globalSeparation` as a calibration-stage constraint, not a final emitted-theme invariant. Downstream faithful passes can still shift the final generated distribution; making the final distribution a hard invariant belongs to Track B or a separately approved Track A+.

Track B, a true final-constraint-aware joint optimizer, is now planned (objective + approach locked in `docs/calibration-phase5-trackb-design-review.md`: full joint optimizer, deterministic greedy over critical pairs, least-drift selection, per-token candidate pre-filtering, folding in `optimize-theme-colors.mjs`). It lands in three independently-verifiable sub-steps — **B1** (joint solver behind `strategy:'joint'`, not wired to production: zero drift + determinism/target regression tests), **B2** (switch light production to `joint` — the reviewed visual rebaseline with preview + moss-visual snapshot regen and sign-off), **B3** (fold in the offline optimizer, retire the side path). It intentionally chooses a new set of light-theme colors, so B2 requires a color diff, preview rebaseline, and explicit sign-off.

Goal: replace `boostGlobalSeparation` with group constraints. Track A ports the existing group heuristic; Track B is the later joint-optimization follow-up.

Scope:

- Median, p25, and p10 pairwise separation ratios.
- Role-weighted group optimization across token and semantic token colors.

Implementation:

- Add a group constraint path that sees the full token set.
- Declare `globalSeparation` from `globalSeparationTargetByVariant`, tolerance, and `globalSeparationRoleProfile.baselineDeltaE`.
- For Track A, run the existing role-weighted boost heuristic inside the solver so the architecture moves without moving colors.
- Preserve final per-token invariant checks after downstream passes (`maxChroma`, role lanes, near-foreground, readability).
- Emit telemetry for each boost round with the same median/p25 format used by the old pipeline.

Acceptance:

- Explicit user approval before implementation.
- Dedicated design review of the group objective.
- Full audit suite passes.
- Track A: zero generated color/output drift; telemetry unchanged.
- Track B: color diff and telemetry are reviewed as a separate visual rebaseline.

## Phase Discipline

Each phase is one commit after review sign-off. Commit messages are imperative. Do not add attribution trailers such as `Co-Authored-By` or generated-by footers.

Every phase must include:

- Source or generator changes first.
- Generated artifacts from `pnpm run sync`.
- `pnpm run check:sync`.
- `pnpm run check:preview`.
- `pnpm run test`.
- `pnpm run audit:all`.
- `pnpm run build`.
- `git diff --quiet pnpm-lock.yaml || git checkout pnpm-lock.yaml`.
- A concise color diff and telemetry summary for human review.

Unsatisfiable constraints must throw. The pipeline must never silently emit a known-bad color.
