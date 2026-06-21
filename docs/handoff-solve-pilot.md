# Handoff — HearthCode color pipeline: `type:"solve"` constraint-source pilot

**For:** Codex (fresh agent, no prior context). **Two jobs:**
1. **Cross-validate** the diagnosis below and the landed `cursor` pilot — be skeptical, reproduce the checks.
2. **Do the next pilot:** convert `status` (clean), then `focusRing` (advanced — read the caveat).

Repo: HearthCode theme (VS Code + Obsidian + Astro site generated from a single color model).
Baseline: branch `color-system/variant-consolidation`, current **HEAD already contains the pilot**, working tree clean. All paths below are repo-relative and readable by you.

---

## Part 1 — The core finding (paradigm mismatch). Cross-validate this.

**Claim:** the pipeline was designed as one paradigm — *derive everything from a small root* (mood → seed colors → role table → platform output) — but the domain is really **two** problems, and only one is modeled honestly:

- **(a) Syntax coloring** = place N role colors over ONE known background. This fits "derivation" and is implemented cleanly: `color-system/schemes/moss/semantic-rules.json` maps every syntax role to `source:{family,tone}`, **zero literal hex**. ✅
- **(b) Chrome / interaction / feedback** = find a color that satisfies MULTIPLE composited-surface contrast constraints at once. This is **constraint-solving**, which `family→tone` can't express. So it was solved by hand and **pinned as `type:"literal"` with the reasoning stranded in prose comments**.

**How to falsify/confirm (do these yourself):**
- `grep -c '"literal"' color-system/schemes/moss/{semantic,interaction,interface,guidance}-rules.json` → expect 0 in semantic (syntax), several in the chrome layers.
- Read `color-system/schemes/moss/interaction-rules.json` — note comments like *"light is deepened so the composited ring clears 3:1"* and *"lifted so the charcoal status ink clears 4.5:1"*. These are **executable constraints written as prose next to a frozen literal**. That is the drift.
- Consequence the user feels ("complex + regression-prone"): a literal is frozen, so when its underlying surface/seed moves, it goes stale silently — caught (if at all) only by the ~19 post-hoc audits in `pnpm run audit:all`. The audits exist *because* generation isn't correct-by-construction for the chrome half.

**The fix direction (what the pilot proves):** make the constraint first-class. Replace `literal + comment` with `anchor (authored aesthetic) + executable constraint`, solved on the main generation path. Value becomes correct-by-construction and re-solves when the surface under it moves.

---

## Part 2 — What landed: the `solve` source convention

One token converted: `cursor` in `color-system/schemes/moss/interaction-rules.json`:

```json
"source": {
  "type": "solve",
  "anchor":      { "dark": "#8bb49e", "light": "#486a59" },
  "constraints": [
    { "kind": "minContrast", "against": { "type": "surface", "id": "canvas" }, "ratio": 3 }
  ]
}
```

- `anchor` — the authored color per variant (same shape as a literal `values` map). The aesthetic intent, preserved.
- `constraints[]` — hard requirements. `kind` (only `minContrast` today), `against` (**any abstract color source** — surface/foundation/role/interaction/interface — reusing the existing source vocabulary, so the constraint background re-resolves when it changes), `ratio` ∈ [1,21].
- **Solver semantics:** keep the anchor if it meets every constraint; else nudge **only lightness** (preserving hue/chroma, the way a human "deepens/lifts") to the nearest tone that satisfies all; **throw loudly** if unsatisfiable (never emit a silent bad color).

**Four code touch points (read these to review the wiring):**
1. `scripts/color-system/solve.mjs` — NEW. Pure `solveConstrainedColor({anchor, constraints})`, dependency-free, reuses Lab math from `scripts/color-utils.mjs`.
2. `scripts/color-system.mjs` — `normalizeAbstractColorSource()` gained a `solve` branch (validates anchor + constraints; **recursively validates `against` against the layer's `allowedKinds`**); `'solve'` added to the interaction `allowedKinds` set in `loadInteractionRules()`.
3. `scripts/color-system/build.mjs` — `resolveAbstractColorSource()` gained a `solve` branch: resolves each `against` recursively to a bg hex, then calls the solver. Imports `solveConstrainedColor` from `./solve.mjs`.
4. `tests/color-solve.test.mjs` — 8 unit tests for the solver.

**Four validation gates that keep it disciplined (not just convention):**
1. Load-time schema validation in `normalizeAbstractColorSource` (anchor shape, non-empty constraints, `kind` allow-list, `ratio` range, `against` recursively valid).
2. Layer opt-in: `solve` is only in the **interaction** `allowedKinds` — not global. Expand per layer deliberately.
3. Solver throws on unsatisfiable constraints (loud failure).
4. Regression guard test ("shipped cursor anchors clear their canvas constraint") locks the zero-drift property — a future break becomes a red test, not a silent color shift.

**Result of the pilot:** generated `themes/`, `public/themes/`, `extension/themes/`, `src/data/tokens.ts`, and `color-system/semantic.json` are **byte-identical** before/after (only `reports/color-language-lineage.json` changed). Full `pnpm run audit:all` exit 0; full test suite 35/0.

---

## Part 3 — Working method (the methodology to reuse)

1. **Trace before touching the generation core.** Don't guess. The order I read things: dispatch (`resolveAbstractColorSource` in build.mjs) → validator (`normalizeAbstractColorSource` + `loadInteractionRules` in color-system.mjs) → consumers → variant handling. Only then edit.
2. **Anchor = the current authored value.** This is what makes a conversion **zero-drift today, self-healing tomorrow**. Before converting, *probe the contrast* the current value has against its constraint background; pick a `ratio` the current value already clears. If it clears, output is unchanged; the solver only kicks in if a future surface change breaks it.
3. **Verify zero-drift empirically, not by faith.** After editing: `node scripts/sync-themes.mjs` then `git diff --stat` — the generated output dirs MUST be unchanged. "Tests pass" is not the drift check; the byte diff is.
4. **Pure solver → unit tests; integration → golden gate.** The solver is a pure function (clear edge cases: satisfied / unsatisfiable / direction / multi-constraint / unknown-kind) → unit-test it. Integration correctness (no output drift) is already covered by the committed-output golden + `check-sync-clean`, proven by the byte diff.
5. **Watch for dead data.** `normalizeSurfaceValueMap` only reads `variantIds` (= `[dark, light]` per `color-system/framework/variants.json`); extra keys are silently dropped. The old `darkSoft`/`lightSoft` keys were vestigial and have now been purged. If you add keys, they won't error — they'll just vanish. Verify they're actually consumed.

---

## Part 4 — Cross-validation checklist (be skeptical)

- [ ] Reproduce zero-drift: from a clean tree, `node scripts/sync-themes.mjs && git diff --stat`. Only `reports/color-language-lineage.json` should change. If `themes/**` or `semantic.json` changes, the pilot is NOT inert — investigate.
- [ ] `pnpm run test` → 35 pass. `node --test tests/color-solve.test.mjs` → 8 pass.
- [ ] `pnpm run audit:all` → exit 0.
- [ ] Read `scripts/color-system/solve.mjs` — is the lightness-only search sound? Does it preserve hue/chroma (it fixes Lab a,b and moves L)? Does gamut-clamping in `labToHex` distort hue at extremes (acceptable for the small nudges here)?
- [ ] Sanity-check the diagnosis claims in Part 1 with the greps.
- [ ] Confirm `cursor`'s constraint (3:1 non-text vs canvas) is defensible (WCAG 1.4.11) and that the current anchors clear it: dark 7.37, light 4.77 (so ratio 3 is inert).

---

## Part 5 — Next pilot

### 5a. `status` (do this first — clean, single-body, zero-drift verified)
- `status` in `interaction-rules.json` is a literal band; its comment states the real constraint: *"the charcoal status ink clears 4.5:1."*
- The ink is `onStatusInk` (an interface in `interface-rules.json`) = **fixed literal `#191815` for both variants** → **no circular dependency** (status does not feed onStatusInk). `interface` is already in the interaction `allowedKinds`, so `against:{type:"interface",id:"onStatusInk"}` validates, and `resolveInterface` is available at the interaction resolution site.
- **Zero-drift is pre-verified:** contrast(`#191815`, status `#b37f16` dark) = 5.04; (`#191815`, `#bb7c12` light) = 5.08 — both ≥ 4.5. So:
  ```json
  "source": {
    "type": "solve",
    "anchor": { "dark": "#b37f16", "light": "#bb7c12" },
    "constraints": [
      { "kind": "minContrast", "against": { "type": "interface", "id": "onStatusInk" }, "ratio": 4.5 }
    ]
  }
  ```
- Then run the Part-3 verification. Expect zero output drift + green gate. Add/extend a regression test mirroring the cursor one if you want the lock.

### 5b. `focusRing` (advanced — read before attempting)
- Its comment: *"light is deepened so the composited ring clears 3:1 over the editor page."* The constraint applies to the **alpha-composited** color, and `focusRing` has `derive: { alphaFromVariantKnob: "interactionAlpha.focusRing" }`.
- **Architecture caveat:** in the pipeline, the `solve` source resolves the **opaque base** *before* `applyAbstractDerive` applies the alpha. So a naive `minContrast` on the source color constrains the WRONG (pre-alpha) color.
- **Recommended extension:** make the constraint composite-aware, e.g. add an optional `composite: { alphaFromVariantKnob: "...", over: { <source> } }` so the solver alpha-blends the candidate over the background before measuring contrast. The alpha (a variant knob) and the `over` surface are both resolvable at source time. This keeps solving in one place. Decide whether to build this or defer focusRing.

### Solver capability note
- Only `minContrast` exists. Tokens whose intent is "stay *subtle*" (e.g. `lineEmphasis` — a current-line wash that must NOT become a spotlight) would need a `maxContrast` kind. That's a clean extension to `solve.mjs`'s `constraintSatisfied`/`constraintMargin` + the validator allow-list — but out of scope until a token needs it.

---

## Reproducible commands
```bash
# unit tests for the solver
node --test tests/color-solve.test.mjs
# full suite (expect 35 pass)
pnpm run test
# regenerate everything from source
node scripts/sync-themes.mjs
# zero-drift check — output dirs must be unchanged
git diff --stat   # only reports/color-language-lineage.json should move
# full release gate (expect exit 0)
pnpm run audit:all
# probe a token's contrast vs a background before choosing a ratio
node -e "const {contrastRatio}=await import('./scripts/color-utils.mjs'); console.log(contrastRatio('#191815','#b37f16'))"
```

## Suggested skills (if continued inside Claude Code rather than Codex)
- `verify` — drive the app to confirm a change behaves, beyond tests.
- `tdd` — if extending the solver (e.g. `maxContrast`, composite-aware constraints), write the failing test first.
(These are Claude Code skills; ignore if Codex.)

## Deeper context (optional, repo-internal)
- The single in-memory model is `buildColorLanguageModel()` in `scripts/color-system/build.mjs`; platform token maps via `buildGeneratedPlatformTokenMaps()` in `scripts/color-system/artifacts.mjs`; orchestration in `scripts/sync-themes.mjs`.
- Gate thresholds are shared via `color-system/framework/tuning.json` (both the generator and `scripts/theme-audit.mjs` read it) — not duplicated.
- `optimize-theme-colors.mjs` is a real candidate-search solver but runs OFFLINE/side-path (syntax-rhythm focused); the `solve` source is the in-path, constraint-focused counterpart for chrome. Longer term these could converge.
