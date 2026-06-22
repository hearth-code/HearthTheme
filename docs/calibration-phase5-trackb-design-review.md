# Phase 5 Track B Design Review — joint `globalSeparation` optimizer

Standalone design review for the deferred Track B of Phase 5. No code is changed
by this document. Its purpose is to choose the objective and approach before any
implementation, because Track B is a new aesthetic (a different set of light
colors), not a refactor — so it needs its own sign-off, color diff, and visual
rebaseline the way 3c did.

This document presents options with a recommendation for each decision. The
**Decision** section at the bottom is intentionally left open pending sign-off.

## Where Track A left it

Track A (shipped, `146de4d`, byte-identical) made `globalSeparation` a declared
group constraint solved by `solveGlobalSeparationConstraint` in
[scripts/color-system/solve.mjs](../scripts/color-system/solve.mjs), but the
solve strategy is still the original heuristic: when the light variant's
pairwise-ratio distribution (median/p25/p10) misses target, inflate EVERY token
and semantic color's chroma by a per-role factor, iterate up to N rounds.

Two properties carried over from the heuristic that Track B exists to fix:

1. **The boost is not per-token-constraint-aware.** It scales chroma blindly;
   the result is only kept legal because downstream passes (`applyRoleLaneProfile`
   → chroma ceiling / role lane / near-foreground) re-assert the per-token
   invariants AFTER the boost. The group solve itself can momentarily violate
   readability, hue lane, chroma ceiling, or near-fg separation.
2. **Uniform inflation, not least-drift.** Every token moves to lift a statistic
   that only a few "collided" pairs actually fail. This departs further from the
   authored palette than necessary and is the widest-blast-radius channel.

Targets today (`globalSeparationTargetByVariant.light`): `median 1.28, p25 1.03,
p10 0.77`; `baselineDeltaE 8` (pairs whose dark separation is below 8 are ignored).

## The objective, precisely

`globalSeparation` is a distribution statistic over O(n²) pairwise ratios
`deltaE(light_i, light_j) / deltaE(dark_i, dark_j)`. Moving any one token changes
every pair it belongs to, so there is no per-token closed form. Track B reframes
it as a **constrained group optimization**:

> Choose, per token, a color from a candidate set that ALREADY satisfies that
> token's own per-token constraints, such that the chosen combination meets the
> declared distribution target with the least total drift from the authored
> anchors.

The pieces that already exist and get reused (Track B is assembly, not greenfield):

- Per-token satisfaction/margin: `constraintSatisfied` / `constraintMargin`, and
  the axis solvers `solveReadabilityColor`, `solveHueLaneColor`,
  `solveChromaCeilingColor`, `solveNearForegroundColor` in `solve.mjs`.
- A candidate scorer with a worst-pair concept:
  [scripts/optimize-theme-colors.mjs](../scripts/optimize-theme-colors.mjs)
  `scoreCandidate({ candidate, current, bg, roleId, lane, targets, criticalPairs })`
  (contrast + `materialDelta` drift + `criticalPairs`). Folding this into the
  engine is the plan's "three paths collapse into one engine" end state.
- The group measurement: `computeGlobalSeparationStats` (unchanged).

## Design decisions (options + recommendation)

### D1 — Target predicate

- **(a) Keep median/p25/p10 as the satisfaction predicate** (same numbers as
  today), optimizer minimizes drift to reach it. **[recommended]** Comparable to
  Track A, lowest aesthetic surprise, reuses the shipped targets.
- (b) Switch to "maximize the worst quantile subject to a drift budget" — no
  fixed target, push separation as far as a drift cap allows. More principled but
  introduces a new knob (the drift budget) that itself needs tuning/review.

Recommendation: **(a)**. Keep the contract; change only how it is reached.

### D2 — Candidate axes

- **(a) chroma + lightness** **[recommended]** — the two axes the current boost
  already uses; stays closest to the hand-tuned look; smaller search.
- (b) chroma + lightness + in-lane hue micro-rotation — more separation freedom
  (rotate two colliding roles apart within their hue lanes) but departs further
  from authored hues and enlarges the search.

Recommendation: **(a)** for the first cut; treat hue rotation as a follow-up only
if chroma+lightness can't clear the target within an acceptable drift.

### D3 — Drift weighting

- (a) Equal weight per token.
- **(b) Per-role weight, frequency/saliency-aware** **[recommended]** — protect
  high-frequency, high-saliency roles (e.g. `function`, `string`) from large
  moves; spend drift on rarer roles. Mirrors the existing warm-exposure profile
  philosophy and the role profile already in tuning.

Recommendation: **(b)**, seeded from the existing `globalSeparationRoleProfile`
weights so the optimizer's "who moves" matches today's hand-tuned intent.

### D4 — Tie-break (multiple combinations meet target)

- (a) Minimize total weighted drift.
- (b) Minimize the single largest per-token drift (fairness — no one role lurches).
- **(c) (a) with (b) as a secondary key** **[recommended]** — least total drift,
  break ties by smallest max move, so the result is both economical and even.

Recommendation: **(c)**.

### D5 — Search algorithm

Full joint search is O(kⁿ) — intractable. Options:

- **(a) Greedy / coordinate descent over critical pairs** **[recommended]**:
  start at anchors, repeatedly take the single highest-value move (largest
  separation gain per unit weighted drift) on a token belonging to a currently
  deficient ("critical") pair, until the distribution target is met or no move
  helps. Deterministic, explainable, reuses `criticalPairs`.
- (b) Local beam / simulated annealing — better global optima, but
  non-deterministic and harder to gate for reproducible output.

Recommendation: **(a)**. Determinism matters: the build must be reproducible and
re-baselineable.

### D6 — Scope & convergence

- Token + semantic entries both (as today).
- Fold `optimize-theme-colors.mjs`'s candidate generation + `scoreCandidate` into
  the engine as the joint solver's scorer, retiring the offline side path. This
  realizes the plan's "collapse three paths into one engine" goal. **[recommended]**

## Wiring

Keep `buildGlobalSeparationConstraint` and the declared `globalSeparation` kind
unchanged; add a `strategy: 'boost' | 'joint'` field. `solveGlobalSeparationConstraint`
dispatches: `boost` = today's heuristic (kept for comparison / fallback),
`joint` = the Track B optimizer. The final downstream per-token invariant
assertions (`applyRoleLaneProfile` etc.) stay in place — but with candidate
pre-filtering they should now be no-ops, which is itself a useful assertion that
the joint solve respected every per-token constraint.

## Track A+ — the lighter middle option (recorded, not recommended as the target)

If full joint optimization is more than wanted: **Track A+** keeps the boost
heuristic but pre-filters each boosted candidate through `constraintSatisfied`
for that token's per-token constraints (so the group solve never violates them
mid-flight). Smaller change, smaller blast radius, closest to the hand-tuned
feel — but still a reviewed visual rebaseline, and it does NOT give the
least-drift property. Listed so the decision is explicit; the recommendation
below is full Track B.

## Risks

- **Widest blast radius.** Every light token may move; this is a full visual
  rebaseline across VS Code + web + Obsidian (preview assets + moss-visual
  snapshot), like 3c.
- **Aesthetic departure.** A least-drift optimum is still not the hand-tuned
  optimum; the result needs a human before/after pass, not just passing audits.
- **Determinism.** The chosen search must be deterministic or `check:sync` /
  reproducible builds break.

## Acceptance criteria

- Explicit sign-off on D1–D6 (this document) BEFORE implementation.
- Full audit suite green; per-token invariant re-assertions become no-ops.
- A reviewed color diff + telemetry (NOT byte-identical); regenerated preview
  assets + moss-visual snapshot baseline.
- One commit, imperative message, no attribution trailer, `pnpm-lock` reverted.

## Recommended objective (summary)

D1 (a) keep median/p25/p10 targets · D2 (a) chroma+lightness · D3 (b) per-role
frequency-weighted drift · D4 (c) min total then min max drift · D5 (a) deterministic
greedy over critical pairs · D6 fold in `optimize-theme-colors.mjs`.

## Decision

Approved: **full Track B (joint optimizer)**, reliability-first, with the
recommended objective on every axis:

- D1 (a) keep `median 1.28 / p25 1.03 / p10 0.77` as the satisfaction predicate.
- D2 (a) candidate axes = chroma + lightness only; in-lane hue micro-rotation
  (D2 b) is a **deferred fallback**, used only if chroma+lightness provably
  cannot clear the target within the drift budget, and only as a separately
  reviewed follow-up — hue stays authored in the first cut.
- D3 (b) per-role frequency/saliency-weighted drift, seeded from
  `globalSeparationRoleProfile`.
- D4 (c) minimize total weighted drift, break ties by smallest max single-token
  drift.
- D5 (a) **deterministic** greedy / coordinate descent over critical pairs. No
  stochastic search — reproducible builds are a hard requirement.
- D6 fold `optimize-theme-colors.mjs` candidate generation + `scoreCandidate`
  into the engine; retire the offline side path.

Track A+ is explicitly NOT the target; it is recorded only as the lighter
alternative that was considered and declined.

## Reliability guardrails (why "full" is still the safe call)

The reliability of this change comes from HOW it lands, not from the
sophistication of the optimizer. Three guardrails are mandatory:

1. **Determinism + regression tests.** D5 must be deterministic. Add two tests:
   (i) the emitted light distribution meets the declared target; (ii) two
   independent builds are `deepEqual` (determinism), mirroring the existing
   engine determinism invariant.
2. **Keep the `boost` strategy as a fallback.** `solveGlobalSeparationConstraint`
   dispatches on `strategy: 'boost' | 'joint'`; the Track A heuristic is retained
   for A/B comparison and one-line revert. Nothing is deleted in the switch.
3. **Per-token invariants stay asserted downstream** (`applyRoleLaneProfile` etc.)
   and should become NO-OPS under `joint` — that no-op is itself the proof the
   joint solve respected every per-token constraint by construction.

## Implementation sequence (B1 → B2 → B3)

Staged like Phase 3 (3a/3b/3c) so each step is independently verifiable and
revertable. Only B2 moves colors.

- **B1 — joint solver, behind `strategy:'joint'`, not yet wired to production.**
  Build per-token candidate sets pre-filtered through `constraintSatisfied`,
  deterministic greedy search over critical pairs, least-drift selection. Compare
  its output to the `boost` path in tests. Production still runs `boost`, so this
  step is **zero output drift** and gated like Track A. Lands the determinism +
  target regression tests.
- **B2 — switch light production to `strategy:'joint'`.** This is the **reviewed
  visual rebaseline**: full audit suite green, per-token re-assertions become
  no-ops, reviewed color diff + telemetry, regenerated preview assets +
  moss-visual snapshot baseline, human before/after sign-off. One commit, no
  trailer, `pnpm-lock` reverted.
- **B3 — convergence.** Fold `optimize-theme-colors.mjs` into the engine as the
  joint scorer and retire the offline path. Ideally **zero drift** (pure
  consolidation); any movement is reviewed.

## Resolved questions

1. Full Track B (joint optimizer) — **approved**, reliability-first.
2. D1–D6 — **adopted as recommended.**
3. In-lane hue micro-rotation (D2 b) — **deferred fallback only**; hue is
   preserved in the first cut, revisited as a separate reviewed step only if
   chroma+lightness cannot clear the target.
