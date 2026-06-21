# Phase 5 Design Review — `globalSeparation`

Standalone design review for the final and hardest calibration-constraint phase. No code is changed by this document. Its purpose is to choose a track before implementation.

## What the channel does today

Phase 5 owns two functions in `scripts/generate-theme-variants.mjs`:

### `computeGlobalSeparationRatio(theme, darkTheme)`

A distribution metric, not a per-token value. For every pair of token colors `(i, j)` it compares how far apart they sit in the light variant versus the dark theme:

- `ratio[i,j] = deltaE(light_i, light_j) / deltaE(dark_i, dark_j)`
- pairs whose dark separation is below `baselineDeltaE` (8) are ignored (roles that were never meant to be distinct).
- returns the distribution: `medianRatio`, `p10Ratio`, `p25Ratio`, `p75Ratio`, `pairCount`.

The property: a light variant should keep roles as mutually distinguishable as they were in dark. `ratio = 1` means "as separated as dark"; below 1 means the light remap squashed roles together.

### `boostGlobalSeparation(...)` (iterated by `calibrateLightReadability`)

If the distribution misses target, it inflates the whole palette:

1. `deficit = max(target/actual)` across median, p25, p10 (each floored).
2. `neededFactor = clamp(deficit, minNeededFactor 1.03, maxNeededFactor 1.45)`.
3. For EVERY token and semantic color: scale chroma by a per-role `localFactor = 1 + (neededFactor-1) * roleBoostFactor[role]` and add a per-role lightness lift, then `scaleColorChroma(..., maxChroma)`.
4. re-measure, return new stats.

It is called in a loop (up to `maxBoostRounds` = 6) until `meetsGlobalSeparationTarget`. Then `softenCoolRolesForLight` runs and the distribution is re-measured.

### Config and live behavior

- Targets (`globalSeparationTargetByVariant`): dark/default `{median 1.05, p25 0.86, p10 0.65}`; light `{median 1.28, p25 1.03, p10 0.77}`.
- `boostFactorByRole` `{_default 1.08, _unmapped 1.25, comment 0.65, operator 0.9, variable/parameter 0.75, method 1.08, function 1}`; `lightnessLiftByRole` `{method +1.4, function -1.6, property +0.4, type +0.2}`.
- `variantBoostProfile` is undefined, so the boost runs with `maxNeededFactor 1.45`, `roleBoostScale 1`, `lightnessLiftScale 1`, and **`maxChroma = null` — no chroma cap during the boost**.
- Only LIGHT variants boost (dark already clears its lower target without boosting). Live: moss-light median 0.98 → 1.29 over 4 rounds; ember-light 1.02 → 1.54 over 5 rounds. This is an active, large recolor of every light token.

## Why this phase is different

Phases 1-4 solved ONE token at a time against fixed surroundings. `globalSeparation` is a constraint over the whole token SET: the objective is a statistic (median/p25/p10) over all O(n^2) pairwise ratios, and moving any token changes every pair it belongs to. There is no per-token closed form; it needs either an iterative group heuristic (today) or joint optimization.

## Coupling and risks (the important part)

1. **The boost can violate the phase 1-4 per-token constraints.** It runs AFTER per-token calibration and only optimizes the distribution; it never re-checks hue lane, chroma ceiling, readability floor, or near-foreground separation. Concretely it conflicts with Phase 3c: 3c clamps role chroma to a hard `maxChroma`, then the boost re-inflates chroma with `maxChroma = null` (no cap), so a role can end up above the ceiling 3c just enforced. Today this is silent.
2. **Order-dependence.** readability -> boost loop (<=6 rounds) -> softenCoolRoles -> re-measure. The result depends on iteration order and round count; it is a heuristic, not a fixed point.
3. **Light-only, large magnitude.** Every light token's chroma/lightness moves; this is the channel with the widest blast radius, so any non-faithful change is a real visual rebaseline (preview assets + moss-visual snapshot, like 3c).

## Two implementation tracks

### Track A — faithful port (zero drift) [recommended first]

Make `globalSeparation` a first-class DECLARED group constraint (target median/p25/p10 over the pairwise-ratio distribution), measured by the engine, and move the iterative role-weighted boost into the engine as the group-solve path — reproducing the current algorithm exactly.

- Outcome: the requirement is now declared + engine-owned (architecture goal met); the solve strategy is unchanged, so output is byte-identical (zero drift), verified like phases 2/3a/3b/4.
- Pros: lowest risk; finishes the migration's architecture story; keeps the hand-tuned look.
- Cons: the group "solver" is still the existing heuristic; it does not fix the coupling risks above (3c re-inflation, no per-token re-check) — those are documented as known limitations.

### Track B — true joint optimization (reviewed visual rebaseline)

Replace the heuristic with a real group optimizer: per-token candidate sets (chroma/lightness variations) constrained to still satisfy the phase 1-4 per-token constraints, choosing the combination that lifts the worst quantile to target with least total drift.

- Outcome: principled, removes the constraint-violation risk (per-token constraints stay satisfied during the group solve), likely different — and arguably better-separated — light colors.
- Pros: realizes the plan's original "joint optimization" vision; one coherent constraint system end to end.
- Cons: changes colors -> full reviewed rebaseline; departs from the hand-tuned palette; much larger and riskier; the objective (which quantile, what drift weighting, how to break ties) needs its own aesthetic review.

## Recommendation

Do **Track A now** as the Phase 5 commit: declare the group constraint, fold the existing boost in as the engine's group-solve path, zero drift, finishing the architecture migration safely. Capture Track B (and the 3c-re-inflation coupling) as a documented, separately-reviewed follow-up, because "true joint optimization" is a new aesthetic, not a refactor — it deserves its own before/after review the way 3c got one.

If the priority is instead to FIX the coupling (boost respecting the chroma ceiling and other per-token constraints), that is inherently Track B (or a Track A+ that clamps the boost to per-token constraints), and it is a visual change — so it needs the rebaseline + sign-off.

## Acceptance criteria

Track A: `pnpm run test` + `pnpm run audit:all` green; zero output drift (themes/public/extension/obsidian unchanged); telemetry (median/p25/p10 per round) unchanged; one commit, no attribution, pnpm-lock reverted.

Track B: all of the above except byte-identical; instead a reviewed color diff + telemetry, regenerated preview assets + moss-visual snapshot, and explicit sign-off before commit.

## Open questions for sign-off

1. Track A (faithful, zero drift) or Track B (joint optimization, reviewed rebaseline) for the Phase 5 commit?
2. Should the Phase 3c chroma ceiling be enforced AFTER the separation boost (i.e. should the boost respect the ceiling)? That is a visual change regardless of track — decide now or defer.
