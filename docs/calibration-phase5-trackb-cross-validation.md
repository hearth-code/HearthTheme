# Phase 5 Track B Cross-Validation

Independent review of `docs/calibration-phase5-trackb-design-review.md` and the
Phase 5 section of `docs/calibration-constraint-plan.md`.

Date: 2026-06-22

Scope: design review only. No code or generated artifacts were changed during
the review. Evidence was taken from the current branch
`docs/calibration-phase5-trackb-review` at commit `ee55a0a`.

## Review Result

Track B should not enter B1 implementation as currently written.

> **Status update (2026-06-22): RESOLVED.** A second independent review confirmed
> every finding below against the code; all six must-fix items were then closed in
> [calibration-phase5-trackb-design-review.md](./calibration-phase5-trackb-design-review.md).
> See [Resolution](#resolution-2026-06-22) at the bottom. B1 is unblocked **against
> the revised design**; the findings below are kept as the audit trail.

The high-level direction, a joint `globalSeparation` optimizer, is still
reasonable, but the current plan has must-fix design gaps:

- The downstream no-op claim is not true under the current generator order.
- The per-token candidate prefilter does not cover every downstream light-token
  repair channel.
- D3 references frequency/saliency data in the wrong profile.
- D6 treats the offline optimizer scorer as reusable even though its pair model
  differs from the engine's `globalSeparation` model.

## Findings

### P0

None.

### P1 - downstream no-op assumption is false

The plan says downstream per-token assertions such as `applyRoleLaneProfile`
should become no-ops after the joint solver prefilters candidates. Current
pipeline order does not support that claim.

`globalSeparation` is solved inside `calibrateLightReadability`, then
`softenCoolRolesForLight` runs immediately after it:

- `scripts/generate-theme-variants.mjs:1497` builds and solves the
  `globalSeparation` constraint.
- `scripts/generate-theme-variants.mjs:1499` runs `softenCoolRolesForLight`.
- `scripts/generate-theme-variants.mjs:1500` recomputes the separation after
  that later mutation.

The variant builder then performs additional downstream color writes:

- `scripts/generate-theme-variants.mjs:1554` runs `applySemanticPalette`.
- `scripts/generate-theme-variants.mjs:1556` runs light polarity compensation.
- `scripts/generate-theme-variants.mjs:1558` runs chroma ceiling.
- `scripts/generate-theme-variants.mjs:1564` runs light semantic anchor.
- `scripts/generate-theme-variants.mjs:1566` runs `applyRoleLaneProfile`.
- `scripts/generate-theme-variants.mjs:1567` runs final chroma ceiling.

The strongest conflict is `applySemanticPalette`: it writes role token colors and
semantic keys directly from `SEMANTIC_PALETTE` after the joint solve would have
chosen candidate colors (`scripts/generate-theme-variants.mjs:468-482`). Unless
Track B moves the joint solve after those writers, or folds those writers into
the joint candidate model, the chosen candidates can still be overwritten and the
final `globalSeparation` distribution can regress.

Impact: B2 cannot use downstream no-op as proof of per-token correctness, and a
candidate set that passes prefiltering does not guarantee the final emitted theme
still satisfies the group target.

### P1 - candidate prefilter does not cover all light repair channels

`constraintSatisfied` can express these currently declared single-token
constraints:

- `minContrast`
- `minCompositeContrast`
- `hueInBand`
- `maxDeltaE`
- `minSeparation`
- `maxSeparation`
- `maxChroma`

Evidence: `scripts/color-system/solve.mjs:69-99`.

That covers the reusable solvers listed in the plan:

- `solveReadabilityColor` filters by `minContrast`
  (`scripts/color-system/solve.mjs:631-698`).
- `solveHueLaneColor` filters by `hueInBand`, `minContrast`, and optional
  `maxDeltaE` (`scripts/generate-theme-variants.mjs:789-803`).
- `solveChromaCeilingColor` enforces `maxChroma`
  (`scripts/color-system/solve.mjs:385-412`).
- `solveNearForegroundColor` filters by `minSeparation`, `maxSeparation`, and
  `minContrast` (`scripts/color-system/solve.mjs:310-377`).

But current generator behavior also includes light repair/scoring channels that
are not fully expressible as existing constraints:

- `applyLightPolarityCompensation` uses bg hue distance, anchor-role deltaE,
  guard-role deltaE, preferred hue, drift cap, and conditional
  `applyOnlyWhenCompensationNeeded` scoring
  (`scripts/generate-theme-variants.mjs:557-710`).
- `applySemanticPalette` overwrites role token and semantic colors from the
  semantic palette (`scripts/generate-theme-variants.mjs:468-482`).
- `applyLightSemanticAnchor` mixes roles back toward the semantic palette
  (`scripts/generate-theme-variants.mjs:485-509`).
- `applyWarmRoleExposureBalance` applies a frequency/saliency-derived chroma and
  lightness transform (`scripts/generate-theme-variants.mjs:868-917`).
- `enforceWarmGamutGuard` forbids a hue range for configured roles
  (`scripts/generate-theme-variants.mjs:920-973`).

Current Moss uses `roleLaneMode: "material-editorial"`, so it returns from
`applyRoleLaneProfile` after near-foreground enforcement. Current Ember uses
`roleLaneMode: "earthy-groove"`, so it returns after cool band plus
near-foreground enforcement (`color-system/schemes/moss/scheme.json:37-46`,
`color-system/schemes/ember/scheme.json:30-34`,
`scripts/generate-theme-variants.mjs:1031-1040`). That makes warm exposure/gamut
inactive for the two current schemes, but they are still part of the generator's
constraint surface and not represented in the planned prefilter.

Impact: "candidate prefilter means per-token constraints stay satisfied" is only
true for a subset of constraints, and only if later non-represented writers are
kept out of the final path.

### P1 - D3 points at the wrong data source

The plan says drift weighting should be seeded from
`globalSeparationRoleProfile` frequency/saliency. That profile has no
frequency/saliency data. It contains:

- `baselineDeltaE`
- `boostFactorByRole`
- `lightnessLiftByRole`

Evidence: `color-system/framework/tuning.json:233-253` and the validation shape
in `scripts/color-system.mjs:1747-1768`.

Frequency and saliency data exist in
`roleLaneProfile.warmExposureProfile`:

- `languageMixWeights`
- `roleFrequencyByLanguage`
- `saliencyByRole`
- `variantTuning`

Evidence: `color-system/framework/tuning.json:516-675` and validation in
`scripts/color-system.mjs:2078-2215`.

Impact: D3 cannot be implemented as documented. Track B must either add a real
frequency/saliency field to `globalSeparationRoleProfile`, or explicitly use the
warm exposure profile as the drift-weight data source.

### P1 - D6 scorer reuse is not same-model reuse

`scripts/optimize-theme-colors.mjs` is an offline reporting path, not a direct
engine scorer:

- It reads committed generated theme JSON files
  (`scripts/optimize-theme-colors.mjs:499-503`).
- It evaluates a fixed role list, not every token entry
  (`scripts/optimize-theme-colors.mjs:22`, `scripts/optimize-theme-colors.mjs:511-523`).
- It scores candidates against current bg contrast, lane saturation, lane hue,
  material drift, anti-neon risk, and role separation
  (`scripts/optimize-theme-colors.mjs:314-364`).
- Its `criticalPairs` come from scheme `color-contract.json` as absolute
  role-to-role `minDeltaE` values
  (`color-system/schemes/moss/color-contract.json:124-144`).

The engine `globalSeparation` metric is different:

- It iterates all token-entry pairs.
- It filters out pairs whose dark-theme `deltaE` is below `baselineDeltaE`.
- It scores the distribution of
  `deltaE(light_i, light_j) / deltaE(dark_i, dark_j)`.

Evidence: `scripts/color-system/solve.mjs:475-503`.

Impact: D6 cannot be an "ideally zero drift" fold-in unless B1's joint scorer is
already deliberately modeled after the offline scorer. As written, the offline
`criticalPairs` concept and the engine pairwise-ratio concept are not
interchangeable.

### P2 - D1 and D2 lack an infeasible fallback

D1 keeps fixed median/p25/p10 targets. D2 limits candidates to chroma and
lightness only. That combination may be infeasible once candidates must also
survive final per-token constraints and downstream writers.

The current test suite documents that Track A does not make the final emitted
distribution a hard invariant. It snapshots final light stats as:

- Ember: median `1.19`, p25 `0.94`, p10 `0.79`.
- Moss: median `1.26`, p25 `0.98`, p10 `0.84`.

Evidence: `tests/theme-variant-interaction-constraints.test.mjs:71-90`.

Those snapshots are not proof that Track B is impossible; they are proof that the
current final emitted pipeline can land below the declared light target after
downstream passes.

Impact: Track B needs an explicit infeasible-state behavior, such as fail loudly
with diagnostics, fall back to boost for B1-only comparison, widen candidate axes,
or require a separate design approval for hue rotation.

### P2 - D5 determinism needs a total ordering contract

Greedy search can be deterministic, but the plan does not specify enough
tie-breakers. The existing offline sort uses score and drift only:

- `scripts/optimize-theme-colors.mjs:419`

For B1/B2 reproducibility, candidate and move ordering should be total and
stable across machines, including ties:

- token kind and stable token id/index
- role id
- candidate hex
- score tuple rounded or compared consistently
- drift tuple
- final no-progress stop condition

Impact: "deterministic greedy" is a requirement, but not yet a complete design.

## D1-D6 Status

| Decision | Status | Reason |
| --- | --- | --- |
| D1 target predicate | Risky | Median/p25/p10 is clear, but no infeasible fallback is defined. |
| D2 candidate axes | Risky | Chroma+lightness may be enough, but there is no evidence after final downstream passes. |
| D3 drift weighting | Invalid as written | `globalSeparationRoleProfile` has no frequency/saliency fields. |
| D4 tie-break | Valid direction | Total drift + max drift is sound, but implementation needs a total ordering. |
| D5 deterministic greedy | Risky | Greedy needs no-progress stop and explicit stable tie-breaks. |
| D6 offline scorer fold-in | Invalid as written | Offline scorer and engine group metric use different pair models. |

## Reuse Validation

Reusable as per-token filters:

- `constraintSatisfied`
- `constraintMargin`
- `solveReadabilityColor`
- `solveHueLaneColor`
- `solveChromaCeilingColor`
- `solveNearForegroundColor`

Not sufficient as a complete final-token model:

- semantic palette overwrite
- light semantic anchor
- light polarity compensation
- warm exposure transform
- warm gamut guard
- scheme contract critical pairs
- theme-audit global role separation warnings

## Step Safety

### B1

The current code has no `strategy` dispatch yet. Existing production behavior is
boost-only through `solveGlobalSeparationConstraint`
(`scripts/color-system/solve.mjs:566-622`). B1 can remain zero drift only if the
new joint path is entirely behind a non-default option and no production caller
passes `strategy: "joint"`.

### B2

B2 has broad generated-output blast radius. The sync path writes:

- `themes/*.json` via the VS Code emitter (`scripts/sync-themes.mjs:53-58`).
- `public/themes/*.json` and `extension/themes/*.json`
  (`scripts/sync-themes.mjs:60-82`).
- `src/data/tokens.ts` (`scripts/sync-themes.mjs:85-90`).
- lineage/parity/site assets (`scripts/sync-themes.mjs:92-99`).
- `obsidian/themes/*.css` and app-theme assets
  (`scripts/sync-themes.mjs:101-109`).

B2 should also expect preview regeneration and moss visual snapshot rebaseline.

### B3

B3 cannot be assumed zero drift until the scorer model is unified. If B1's scorer
differs from `optimize-theme-colors.mjs`, folding the offline optimizer later may
move colors.

## Must-Fix Design Updates Before B1

1. Decide whether Track B solves before or after all role/semantic/polarity/lane
   writers. Prefer solving after every deterministic token writer, or fold those
   writers into the candidate model.
2. Replace "downstream assertions become no-ops" with a concrete final invariant
   story: which passes must be no-op, which are allowed to mutate, and where the
   final `globalSeparation` assertion runs.
3. Fix D3's data source: add frequency/saliency to
   `globalSeparationRoleProfile` or explicitly use
   `roleLaneProfile.warmExposureProfile`.
4. Define infeasible behavior for D1/D2.
5. Define deterministic total ordering for greedy moves and candidates.
6. Reframe D6 as a follow-up unification task with a deliberate metric mapping,
   not a presumed zero-drift fold-in.

## Claude Cross-Validation Prompt

```text
You are reviewing the HearthTheme repository independently. Do not trust this
document; verify every claim against the code.

Repository: /Users/joy/Project/HearthTheme
Branch: docs/calibration-phase5-trackb-review
Current commit: ee55a0a "Plan Phase 5 Track B joint optimizer"

Task:
Cross-validate docs/calibration-phase5-trackb-cross-validation.md. This is a
design review only. Do not modify files. Do not run sync/build commands that can
change generated outputs. Read code and run only read-only checks if needed.

Questions to verify:

1. Is the "downstream no-op" finding correct?
   - Check scripts/generate-theme-variants.mjs.
   - Confirm where solveGlobalSeparationForTheme runs.
   - Confirm what runs after it: softenCoolRolesForLight, applySemanticPalette,
     applyLightPolarityCompensation, applyRoleChromaCeiling,
     applyLightSemanticAnchor, applyRoleLaneProfile, final chroma ceiling.
   - Decide whether any of those can overwrite or mutate joint-selected
     token/semantic colors.

2. Is the per-token prefilter coverage finding correct?
   - Check scripts/color-system/solve.mjs constraintSatisfied/constraintMargin.
   - Confirm which solver functions can be reused as candidate filters.
   - List generator constraints/repairs that cannot currently be expressed by
     existing constraint kinds.
   - Pay special attention to light polarity compensation, semantic palette
     writes, semantic anchor, warm exposure, warm gamut guard, near foreground,
     role lane, and chroma ceiling.

3. Is D3 invalid as written?
   - Check color-system/framework/tuning.json and scripts/color-system.mjs.
   - Confirm whether globalSeparationRoleProfile contains frequency or saliency.
   - Confirm whether those data live under roleLaneProfile.warmExposureProfile.

4. Is D6 invalid as written?
   - Compare scripts/optimize-theme-colors.mjs scoreCandidate / criticalPairs /
     VARIANT_TARGETS to scripts/color-system/solve.mjs
     computeGlobalSeparationStats.
   - Decide whether the offline criticalPairs model is the same as the engine
     pairwise-ratio distribution. If not, explain the mismatch.

5. Evaluate D1-D6 independently:
   - D1: target predicate and infeasible fallback.
   - D2: chroma+lightness-only evidence.
   - D3: drift weighting data source.
   - D4: tie-break objective.
   - D5: deterministic greedy convergence and tie-breaks.
   - D6: scorer fold-in and zero-drift risk.

Required output:
Code/design review format. Findings first, P0/P1/P2 order, with file:line
references. For each D1-D6, state "valid", "risky", or "invalid". End with a
single overall judgment: can Track B enter B1 implementation as written, or are
there must-fix design gaps?
```

## Resolution (2026-06-22)

A second independent code review confirmed all findings, then closed them in
[calibration-phase5-trackb-design-review.md](./calibration-phase5-trackb-design-review.md).
Mapping each must-fix to its resolution:

| Finding | Resolution | Where |
| --- | --- | --- |
| P1 downstream no-op false | `joint` solve **relocated to run after** every deterministic writer; only the pure-constraint passes (chroma ceiling, role-lane near-fg/hue-band) re-assert as no-ops; static/scoring writers (`applySemanticPalette`, polarity, anchor) are upstream anchor inputs. Final invariant asserted on the **emitted** theme. | design-review *Wiring* + guardrail 3 |
| P1 prefilter coverage | Only pure-constraint passes are modeled as candidate filters; the non-expressible writers are reframed as anchor-establishing inputs run *before* the solve, not assertions it must satisfy. | design-review *Wiring* |
| P1 D3 wrong data source | Drift weights seed from `roleLaneProfile.warmExposureProfile` (`saliencyByRole` × language-mix-weighted frequency via `computeWarmRoleFrequencyMap`); `globalSeparationRoleProfile` is **not** the source. | design-review *D3 Resolved* |
| P1 D6 scorer model mismatch | B1 optimizes the **engine** ratio-distribution objective directly; `optimize-theme-colors.mjs` stays an offline diagnostic; B3 re-scoped — no zero-drift fold-in. | design-review *D6 Resolved* + B3 |
| P2 D1/D2 infeasible behavior | Predicate evaluated on the emitted theme; **fail loud** with a deficit report; D2 ships a feasibility probe; escalation to D2(b) hue rotation is a pre-agreed separately reviewed step. | design-review *D1 / D2 Resolved* |
| P2 D5 ordering | Total move/tie order (token kind → stable id → role → hex), explicit stop contract (target met / no-progress / cap), and "engine-deficient pairs" renamed away from the static contract `criticalPairs`. | design-review *D5 Resolved* |

Updated D1–D6 verdicts after resolution: D1 valid (emitted-theme predicate +
fail-loud) · D2 valid-pending-probe (axes unchanged, feasibility now tested rather
than assumed) · D3 valid (source corrected) · D4 valid · D5 valid (ordering + stop
specified) · D6 valid (re-scoped, no zero-drift claim). B1 may proceed against the
revised design; B2 remains a reviewed visual rebaseline with sign-off.
