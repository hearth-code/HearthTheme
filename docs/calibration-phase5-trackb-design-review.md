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

**Resolved (evaluation point + infeasible behavior).** Keep (a)'s median/p25/p10
predicate, but evaluate it on the **final emitted theme** (end of
`buildVariantTheme`), not at calibration time. Today's emitted distribution sits
*below* target (ember `1.19`, moss `1.26` vs `1.28`;
[tests/theme-variant-interaction-constraints.test.mjs:71-90](../tests/theme-variant-interaction-constraints.test.mjs))
precisely because the predicate is only checked pre-downstream. If no candidate
combination reaches target, **fail loud** with a deficit report (which quantile
missed, by how much, the deficient pairs, the max drift spent). Track B never
silently emits below target — that silent miss is exactly today's behavior it
exists to remove. Widening the axes is D2's pre-agreed escalation, not a build-time
improvisation.

### D2 — Candidate axes

- **(a) chroma + lightness** **[recommended]** — the two axes the current boost
  already uses; stays closest to the hand-tuned look; smaller search.
- (b) chroma + lightness + in-lane hue micro-rotation — more separation freedom
  (rotate two colliding roles apart within their hue lanes) but departs further
  from authored hues and enlarges the search.

Recommendation: **(a)** for the first cut; treat hue rotation as a follow-up only
if chroma+lightness can't clear the target within an acceptable drift.

**Resolved (feasibility probe + escalation).** (a) is the first cut but **unproven**
until a feasibility probe shows the `joint` path reaches target on *both* schemes'
emitted themes; B1 ships that probe as a regression test. If chroma+lightness
provably cannot clear target within the drift budget, the pre-agreed escalation is
D2(b) in-lane hue micro-rotation as a **separately reviewed** follow-up — never a
silent below-target emit. The candidate axes only reach emission for tokens the
downstream writers do not overwrite, which is why the solve must run *after*
`applySemanticPalette` (see Wiring).

### D3 — Drift weighting

- (a) Equal weight per token.
- **(b) Per-role weight, frequency/saliency-aware** **[recommended]** — protect
  high-frequency, high-saliency roles (e.g. `function`, `string`) from large
  moves; spend drift on rarer roles. Mirrors the existing warm-exposure profile
  philosophy and the role profile already in tuning.

Recommendation: **(b)**, frequency/saliency-weighted so the optimizer's "who moves"
matches today's hand-tuned intent.

**Resolved (data source corrected).** The original "seeded from
`globalSeparationRoleProfile`" was wrong: that profile
([tuning.json:233-253](../color-system/framework/tuning.json)) has **no**
frequency/saliency — only `baselineDeltaE` / `boostFactorByRole` /
`lightnessLiftByRole`, which stay the `boost`-path "who moves" knobs. The
frequency/saliency data lives in `roleLaneProfile.warmExposureProfile`
([tuning.json:516-678](../color-system/framework/tuning.json):
`languageMixWeights`, `roleFrequencyByLanguage`, `saliencyByRole`, `variantTuning`).
The joint drift weight reuses *that* profile: per-role weight ∝ `saliencyByRole` ×
language-mix-weighted frequency (compute via the existing `computeWarmRoleFrequencyMap`
logic), where higher weight = protect from large moves, so least-weighted-drift
spends drift on rare / low-saliency roles. Do **not** duplicate the data into
`globalSeparationRoleProfile`.

### D4 — Tie-break (multiple combinations meet target)

- (a) Minimize total weighted drift.
- (b) Minimize the single largest per-token drift (fairness — no one role lurches).
- **(c) (a) with (b) as a secondary key** **[recommended]** — least total drift,
  break ties by smallest max move, so the result is both economical and even.

Recommendation: **(c)**.

**Resolved (direction sound, dependencies noted).** The lexicographic objective
(min total weighted drift, then min max single-token drift) stands. It is not
standalone: the *weights* come from D3 (`warmExposureProfile`) and the *total order*
that makes ties deterministic comes from D5. "Drift" is `deltaE` from the per-token
anchor.

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

**Resolved (total ordering + stop + naming).** "Greedy over critical pairs" is not
reproducible without a total order and a stop contract:

- *Candidates* per token: a fixed chroma×lightness grid in a fixed order, filtered
  through `constraintSatisfied`, deduped by normalized hex.
- *Move / tie total order:* token-entry before semantic entry; then stable token id
  (token index; semanticKey lexicographic); then role id; then candidate hex. Every
  argmax tie breaks down this order — no insertion-order reliance. (The offline sort
  at [optimize-theme-colors.mjs:419](../scripts/optimize-theme-colors.mjs) uses only
  score+drift and can still tie.)
- *Stop:* (i) target met; (ii) no move yields net progress > ε → hand off to D1's
  infeasible behavior; (iii) a hard iteration cap.
- *Naming:* the pairs the greedy step targets are the **engine-deficient pairs**
  (pairs dragging a failing quantile inside `computeGlobalSeparationStats`), **not**
  the static contract `criticalPairs` the offline optimizer uses. Same word, different
  concept — the plan must not conflate them (see D6).
- *Tests:* two independent builds `deepEqual` (determinism) + the emitted-target
  probe from D2.

### D6 — Scope & convergence

- Token + semantic entries both (as today).
- Fold `optimize-theme-colors.mjs`'s candidate generation + `scoreCandidate` into
  the engine as the joint solver's scorer, retiring the offline side path. This
  realizes the plan's "collapse three paths into one engine" goal. **[recommended]**

**Resolved (not a zero-drift fold-in).** The offline `scoreCandidate`
([optimize-theme-colors.mjs:314-364](../scripts/optimize-theme-colors.mjs)) is a
**different objective** from the engine group metric, so it cannot be dropped in as
the joint scorer:

- *offline:* light-only, per-role over a fixed 7-role list (`ROLE_IDS:22`), scoring
  absolute `deltaE(candidate, otherRole)` ÷ static contract `criticalPairs.minDeltaE`
  ([moss/color-contract.json:124-145](../color-system/schemes/moss/color-contract.json)),
  reading committed JSON.
- *engine:* `deltaE(light_i,light_j) / deltaE(dark_i,dark_j)` ratio distribution over
  **all** token pairs, with a `baselineDeltaE` dark filter
  ([solve.mjs:475-503](../scripts/color-system/solve.mjs)).

B1's joint scorer therefore optimizes the **engine** objective directly (minimize
weighted drift subject to `globalSeparationConstraintSatisfied`).
`optimize-theme-colors.mjs` stays an **offline diagnostic**. B3 is re-scoped from
"fold the scorer in, ideally zero drift" to "keep it as a separate reporting path, or
re-derive it against the engine metric in a separately reviewed step — any color
movement is reviewed, not presumed zero."

## Wiring

Keep `buildGlobalSeparationConstraint` and the declared `globalSeparation` kind
unchanged; add a `strategy: 'boost' | 'joint'` field that
`solveGlobalSeparationConstraint` dispatches on (`boost` = today's heuristic, kept
for comparison / one-line revert; `joint` = the Track B optimizer).

**Solve placement is the load-bearing change.** Today the group solve runs *inside*
`calibrateLightReadability` ([generate-theme-variants.mjs:1498](../scripts/generate-theme-variants.mjs)),
**before** the deterministic color writers in `buildVariantTheme`:
`applySemanticPalette` (`:1554`, an unconditional static overwrite of role
token/semantic colors), light polarity (`:1556`), chroma ceiling (`:1558`), semantic
anchor (`:1564`), `applyRoleLaneProfile` (`:1566`), final chroma ceiling (`:1567`).
Any color the solve picks for a role-mapped token is then discarded by
`applySemanticPalette` and re-derived by the later passes — which is why the emitted
distribution lands below target. So under `joint`, the solve must move to run
**last**, after every deterministic writer, choosing per-token from candidates built
around each token's **post-writer** anchor.

That splits the downstream passes into two honest categories:

- **Anchor-establishing passes** (`applySemanticPalette`, polarity, semantic anchor,
  warm exposure): run **before** the joint solve and are *not* re-run after it. They
  are not no-ops; they define the per-token starting color the solve searches around,
  i.e. *inputs* to the candidate model — never post-solve overwriters.
- **Pure-constraint passes** (chroma ceiling, `applyRoleLaneProfile`'s near-foreground
  / hue-band enforcement): the joint solve pre-filters every candidate through these
  exact constraints via `constraintSatisfied`, then they re-run once **after** the
  solve as assertions. *Those* re-assertions are no-ops **by construction** — and that
  narrowed no-op is the real proof the joint solve respected the per-token
  constraints. The original "all downstream assertions become no-ops" claim was false:
  it mischaracterized the static / scoring writers as assertions.

**Final invariant:** assert `globalSeparationConstraintSatisfied` on the emitted theme
at the end of `buildVariantTheme` (not at `:1500`, which runs before the writers).
That emitted-theme assertion is the B2 contract.

### As implemented (2026-06-23, moss-light + ember-light)

Landed and verified, with empirical corrections to the plan above:

- **The boost is kept as a pre-lift; the joint is a residual-closer — it does NOT
  replace the boost.** A from-scratch constrained joint *after* the writers cannot
  reach target: starting from the un-boosted post-writer baseline (~median 1.11) and
  bounded by each role's near-foreground lane, chroma+lightness moves leave it far
  short. With the existing boost left in place, the joint closes only the residual gap.
  Net effect: the shipped colors move only by the joint's small moves on top of today's
  boost — the *smallest* change that meets target. `solveGlobalSeparationJoint` runs at
  the end of `buildVariantTheme` on the emitted colors; the chroma-ceiling + role-lane
  re-assertions after it are verified no-ops; `assertGlobalSeparationTarget` fails loud
  otherwise.
- **Critical-pair floors are enforced in the search.** The joint candidate filter rejects
  any move that would pull a role within an audited minimum separation of its paired role,
  checked live against the other role's current colour. The floor set covers (a) the
  `criticalPairDeltaE` table + the operator/comment and method/property gates — audited by
  `theme-audit`, run per scheme via `check:schemes`; and (b) each scheme's
  `color-contract.json` criticalPairs — audited by `audit-color-contract`, which runs for
  every supported scheme. Without (a), ember's larger moves dropped operator↔comment to dE
  8.0 under its floor of 10.0. The (b) color-contract pairs currently pass with margin, but
  are enforced so a future tuning change cannot let the joint tip one under its floor and
  break the build. Both audits remain fail-loud backstops. Closes the cross-validation
  P1/Q5 floor-coverage gap.
- **Scope:** `strategy:'joint'` is gated to schemes `{moss, ember}` + variant `light`.
  Every other variant/scheme keeps `boost`, byte-identical. Both light schemes reach
  target at the **same** drift cap 6 (the earlier "ember needs ~dE 8" estimate came from
  a looser standalone probe; the real engine with the boost pre-lift does better), so no
  per-scheme cap and no D2(b) hue rotation was needed. The emitted-theme fail-closed
  assertion (`assertGlobalSeparationTarget`) is therefore exercised by both shipped light
  schemes. It is **joint-scoped by design**: a hypothetical future light scheme left on
  `boost` keeps Track A's calibration-stage *warning* (boost never promised a hard emitted
  target); promoting fail-closed to the boost path would be a separate, deliberate change.
- **Result:** emitted **moss-light median 1.293 / p25 1.032 / p10 0.878** (9 moves,
  maxDrift ≈ 4.9); **ember-light median 1.292 / p25 1.036 / p10 0.851** (12 role moves
  over 20 greedy steps, maxDrift ≈ 5.3) — both meet target 1.28 / 1.03 / 0.77. Fixed-order deterministic —
  reproducible, not order-independent: ties break on a total (unit index, candidate
  index) order (two builds `deepEqual`). Full `audit:all` + 122 tests + `check:sync` +
  `check:preview` + `astro build` green; moss-light stayed byte-identical when ember was
  added.
- **Follow-ups resolved (2026-06-23):** D3 frequency/saliency drift weighting was
  implemented and measured, then **reverted** — the high-saliency roles (keyword,
  function) are the colliding roles that *must* move to fix separation, so weighting
  cannot protect them; it only redistributed the remaining drift, raising max drift
  (moss 4.9 → 5.5, ember 5.3 → 5.7) and shrinking ember's p10 margin (0.851 → 0.831).
  Equal-weight least-drift (`gain / max(drift, 0.5)`) is retained as the better result.
  D2(b) hue rotation was not needed. B3: the offline `optimize-theme-colors.mjs` is a
  different objective (D6), so it is kept as a **labelled secondary diagnostic** (a header
  on the script says so) and is *not* folded into the engine.

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

D1 (a) keep median/p25/p10 targets, **asserted on the emitted theme, fail-loud if
infeasible** · D2 (a) chroma+lightness **with a feasibility probe** · D3 (b) per-role
frequency/saliency drift **seeded from `warmExposureProfile`** · D4 (c) min total then
min max drift · D5 (a) deterministic greedy over **engine-deficient** pairs with a
total-order + stop contract · D6 **keep `optimize-theme-colors.mjs` offline** (no
zero-drift fold-in).

## Decision

Original decision before independent cross-validation: **full Track B (joint
optimizer)**, reliability-first, with the recommended objective on every axis:

- D1 (a) keep `median 1.28 / p25 1.03 / p10 0.77` as the satisfaction predicate.
- D2 (a) candidate axes = chroma + lightness only; in-lane hue micro-rotation
  (D2 b) is a **deferred fallback**, used only if chroma+lightness provably
  cannot clear the target within the drift budget, and only as a separately
  reviewed follow-up — hue stays authored in the first cut.
- D3 (b) per-role frequency/saliency-weighted drift, seeded from
  `globalSeparationRoleProfile`. **[superseded — that profile has no
  frequency/saliency; seed from `roleLaneProfile.warmExposureProfile`. See D3
  Resolved.]**
- D4 (c) minimize total weighted drift, break ties by smallest max single-token
  drift.
- D5 (a) **deterministic** greedy / coordinate descent over critical pairs. No
  stochastic search — reproducible builds are a hard requirement.
- D6 fold `optimize-theme-colors.mjs` candidate generation + `scoreCandidate`
  into the engine; retire the offline side path. **[superseded — different objective
  from the engine metric; not a zero-drift fold-in. B1 optimizes the engine ratio
  objective; the offline path stays a diagnostic. See D6 Resolved.]**

Track A+ is explicitly NOT the target; it is recorded only as the lighter
alternative that was considered and declined.

## Independent Cross-Validation Status

A follow-up cross-validation on 2026-06-22
([calibration-phase5-trackb-cross-validation.md](./calibration-phase5-trackb-cross-validation.md))
found must-fix design gaps; a second independent review confirmed them. All six are
now **resolved in this document** (2026-06-22): solve placement + narrowed no-op story
(Wiring), D1 infeasible behavior, D2 feasibility probe, D3 data source
(`warmExposureProfile`), D5 ordering / stop contract, D6 offline-scorer re-scope. B1
is **unblocked to implement against the resolved design**; B2 still requires the
reviewed visual rebaseline and sign-off.

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
3. **Pure-constraint passes bracket the joint solve and re-assert as no-ops.** Under
   `joint` the solve runs *after* the anchor-establishing writers and pre-filters
   candidates through `constraintSatisfied`; chroma ceiling + `applyRoleLaneProfile`
   near-fg / hue-band then re-run as no-op assertions (see Wiring). The static /
   scoring writers (`applySemanticPalette`, polarity, anchor) are upstream inputs, not
   no-op assertions — do not claim they become no-ops.

## Implementation sequence (B1 → B2 → B3)

Staged like Phase 3 (3a/3b/3c) so each step is independently verifiable and
revertable. Only B2 moves colors.

- **B1 — joint solver, behind `strategy:'joint'`, not yet wired to production.**
  Build per-token candidate sets around the **post-writer** anchor, pre-filtered
  through `constraintSatisfied`; deterministic greedy over **engine-deficient** pairs
  with the D5 total-order + stop contract; least-drift selection optimizing the
  **engine** ratio-distribution objective (not the offline scorer). Production still
  runs `boost`, so this step is **zero output drift** and gated like Track A. Lands
  three tests: determinism (`deepEqual` across two builds), the emitted-target
  **feasibility probe** on both schemes (D2), and **fail-loud-on-infeasible** (D1).
- **B2 — switch light production to `strategy:'joint'`.** This is the **reviewed
  visual rebaseline**: full audit suite green, per-token re-assertions become
  no-ops, reviewed color diff + telemetry, regenerated preview assets +
  moss-visual snapshot baseline, human before/after sign-off. One commit, no
  trailer, `pnpm-lock` reverted.
- **B3 — convergence (resolved).** `optimize-theme-colors.mjs` is a *different*
  objective from the engine metric (D6), so it is **not** a zero-drift fold-in.
  Decision: kept as a separate offline diagnostic — a header on the script documents
  that it is a secondary review lens (`pnpm run optimize:colors`, light-only per-role
  scoring), not the optimizer; the engine owns in-path optimization. No fold-in.

## Resolved questions

1. Full Track B (joint optimizer) — **approved**, reliability-first.
2. D1–D6 — **adopted with the cross-validation fixes folded in** (see the per-axis
   "Resolved" notes); the bare "as recommended" form is superseded.
3. In-lane hue micro-rotation (D2 b) — **deferred fallback only**; hue is
   preserved in the first cut, revisited as a separate reviewed step only if
   chroma+lightness cannot clear the target.
4. Solve placement — **resolved**: the `joint` solve runs *after* every deterministic
   writer; only the pure-constraint passes re-assert as no-ops (Wiring).
5. D3 data source — **resolved**: drift weights seed from
   `roleLaneProfile.warmExposureProfile`, not `globalSeparationRoleProfile`.
6. D6 — **re-scoped**: the offline optimizer is not the joint scorer and is not a
   zero-drift fold-in; B1 optimizes the engine ratio objective directly.
7. Infeasible target — **resolved**: assert on the emitted theme, fail loud with a
   deficit report; escalate to D2(b) only as a separately reviewed step.
