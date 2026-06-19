# Handoff: color constraint compiler direction

## Purpose

This handoff captures the follow-up strategy after the `type:"solve"` pilot in the
HearthCode color pipeline.

The goal is not to keep hand-converting individual tokens forever. The goal is to
separate concerns:

- keep reusable color solving algorithms in a small, testable engine;
- keep theme-specific policy, anchors, thresholds, and token intent in this repo;
- make migrations repeatable through probes, zero-drift checks, tests, and audits.

In short: treat the color system as a constraint compiler. The theme source files
declare intent; the generator compiles that intent into stable platform artifacts.

## Current repository context

- Branch: `color-system/variant-consolidation`.
- Existing pilot: `cursor` already uses `source.type = "solve"`.
- New pilot completed in this handoff chain: `status` now uses `source.type = "solve"`.
- Do not convert `focusRing` yet. Its real constraint applies after alpha
  compositing, while current `solve` runs before `derive.alphaFromVariantKnob`.

## Verified facts

### Paradigm split

The current diagnosis still looks correct:

- Syntax colors are mostly pure derivation from the source model.
- Chrome / interaction colors contain hand-pinned literals where the real
  constraint is written in prose.

Reproduced command:

```bash
grep -c '"literal"' color-system/schemes/moss/{semantic,interaction,interface,guidance}-rules.json
```

Observed:

- `semantic-rules.json`: `0`
- `interaction-rules.json`: literal entries remain
- `interface-rules.json`: literal entries remain
- `guidance-rules.json`: literal entries remain

This supports the diagnosis that syntax is already modeled as derivation, while
chrome/interaction is partly modeled as frozen literals plus comments.

### Baseline gates

Before converting `status`, the existing pilot was reproduced:

```bash
node scripts/sync-themes.mjs && git diff --stat
node --test tests/color-solve.test.mjs
pnpm run test
pnpm run audit:all
```

Observed before the `status` change:

- `node scripts/sync-themes.mjs && git diff --stat`: no tracked diff.
- `node --test tests/color-solve.test.mjs`: 8 pass.
- `pnpm run test`: 35 pass.
- `pnpm run audit:all`: exit 0.

Note: the original handoff said baseline sync may update only
`reports/color-language-lineage.json`. In the reproduced state, baseline sync was
even stricter: it produced no tracked diff.

## Completed `status` conversion

Changed `color-system/schemes/moss/interaction-rules.json`:

```json
"status": {
  "description": "Persistent emphasis band used for status presence and release accents. Anchored at the authored amber tone; solved so the charcoal status ink clears 4.5:1.",
  "source": {
    "type": "solve",
    "anchor": {
      "dark": "#b37f16",
      "light": "#bb7c12"
    },
    "constraints": [
      {
        "kind": "minContrast",
        "against": { "type": "interface", "id": "onStatusInk" },
        "ratio": 4.5
      }
    ]
  }
}
```

Pre-flight contrast check:

- `onStatusInk.dark = #191815`
- `onStatusInk.light = #191815`
- contrast `#191815` on dark status `#b37f16`: `5.04`
- contrast `#191815` on light status `#bb7c12`: `5.08`

Both clear `4.5`, so the conversion should be zero-drift.

Added regression coverage in `tests/color-solve.test.mjs`:

- `shipped status anchors clear their on-status ink constraint (zero output drift)`

## Post-change verification

Commands run after conversion:

```bash
node --test tests/color-solve.test.mjs
node scripts/sync-themes.mjs && git diff --stat
pnpm run check:sync
pnpm run check:preview
pnpm run test
pnpm run audit:all
pnpm run build
git diff --check
```

Observed:

- `node --test tests/color-solve.test.mjs`: 9 pass.
- `pnpm run test`: 36 pass.
- `pnpm run audit:all`: exit 0.
- `pnpm run build`: pass.
- `git diff --check`: pass.

Tracked diff after regeneration is limited to:

- `color-system/schemes/moss/interaction-rules.json`
- `reports/color-language-lineage.json`
- `tests/color-solve.test.mjs`

Confirmed no diff in:

- `themes/**`
- `public/themes/**`
- `extension/themes/**`
- `src/data/tokens.ts`
- `color-system/semantic.json`
- `src/styles/theme-vars.css`
- `docs/theme-baseline.md`
- `obsidian/**`

The lineage diff is expected: `status` changed from `literal.values` lineage to
`solve.anchor` lineage and now records `onStatusInk` as a dependency. Resolved
colors stayed byte-identical: `#b37f16` and `#bb7c12`.

## Solver assessment

Current solver: `scripts/color-system/solve.mjs`.

Strengths:

- Pure function with focused unit tests.
- Keeps the anchor unchanged when constraints already pass.
- If needed, changes only Lab lightness (`L`), preserving Lab `a` and `b`.
- Supports multiple `minContrast` constraints.
- Throws loudly when no lightness value can satisfy all constraints.

Known limits:

- Search step is discrete (`lightnessStep = 0.5`), so it is nearest-by-step, not
  mathematically continuous.
- At extreme colors, sRGB gamut conversion can clamp and distort hue/chroma.
- Current constraints are opaque-color constraints only.
- Current `solve` runs before `derive`, so it cannot correctly express constraints
  on alpha-composited output.

These limits are acceptable for `cursor` and `status`; they are not acceptable for
`focusRing` without an extension.

## Do not convert `focusRing` with current `minContrast`

`focusRing` currently has:

```json
"derive": {
  "alphaFromVariantKnob": "interactionAlpha.focusRing"
}
```

Its real requirement is about the visible, alpha-composited ring over the editor
page. The current pipeline order is:

```text
resolve source with solve -> apply derive alpha
```

A naive `minContrast` would constrain the opaque base color, not the displayed
composited color. That would make the constraint technically wrong.

Recommended extension:

```json
{
  "kind": "compositeMinContrast",
  "ratio": 3,
  "foregroundComposite": {
    "alphaFromVariantKnob": "interactionAlpha.focusRing",
    "over": { "type": "surface", "id": "canvas" }
  },
  "against": { "type": "surface", "id": "canvas" }
}
```

Alternative shape:

```json
{
  "kind": "minContrast",
  "ratio": 3,
  "against": { "type": "surface", "id": "canvas" },
  "composite": {
    "alphaFromVariantKnob": "interactionAlpha.focusRing",
    "over": { "type": "surface", "id": "canvas" }
  }
}
```

The important property is that the solver must measure contrast after blending
the candidate over the same surface that the UI will actually show.

## Larger abstraction direction

Do not start by creating a separate project. First modularize inside this repo,
while the real generator, lineage output, and audit gates are still close at hand.
Extract to a package only after the interface survives several token conversions.

Recommended layers:

### 1. Constraint engine

Reusable algorithm layer. It should not know about Moss, Ember, VS Code, or
Obsidian.

Responsibilities:

- evaluate constraints;
- solve by allowed adjustment strategy;
- return diagnostics;
- throw on unsatisfied constraints;
- eventually support:
  - `minContrast`
  - `maxContrast`
  - `compositeMinContrast`
  - possibly delta-E or perceptual separation constraints.

Candidate files:

- `scripts/color-system/solve.mjs`
- `scripts/color-system/constraints.mjs`
- `scripts/color-system/composite.mjs`

### 2. Source graph resolver

Reusable graph-resolution layer. It resolves abstract source references into
colors and dependency lineage.

Responsibilities:

- resolve `literal`, `foundation`, `surface`, `role`, `interface`,
  `interaction`, `feedback`, `guidance`, and `solve`;
- preserve chain refs;
- detect cycles where applicable;
- keep layer-specific allowed kinds explicit.

This layer can remain coupled to current source file shapes for now, but should
not contain color search policy.

### 3. Theme policy config

This stays in the HearthCode repo.

Responsibilities:

- anchors;
- ratios;
- token intent;
- variant knobs;
- scheme-specific surfaces;
- which layers are allowed to use `solve`;
- product-specific audit thresholds.

Examples:

- `color-system/schemes/moss/interaction-rules.json`
- `color-system/schemes/moss/interface-rules.json`
- `color-system/framework/tuning.json`
- `color-system/framework/variants.json`

### 4. Migration and verification workflow

Script the human process so large-scale conversion is ordered and repeatable.

Possible probe script:

```bash
node scripts/color-system/audit-constraint-candidates.mjs
```

Expected workflow:

```text
scan literals
classify candidate intent
probe current contrast / alpha-composited contrast
propose solve spec
apply one safe candidate
run sync
prove zero drift
add regression guard
run tests and audits
```

The migration script should report candidates. It should not silently rewrite many
tokens until the candidate class has a proven pattern.

## Questions for cross-validation

Please cross-validate these points skeptically:

1. Is the `status` conversion truly zero-drift in generated platform artifacts?
2. Is `against: { "type": "interface", "id": "onStatusInk" }` safe, or can it
   introduce a hidden dependency cycle?
3. Is the lineage change from `literal.values` to `solve.anchor` plus
   `onStatusInk` dependency semantically correct?
4. Are the current solver limits acceptable for `cursor` and `status`?
5. Is it correct to defer `focusRing` until a composite-aware constraint exists?
6. Is the recommended abstraction boundary right: in-repo modules first, package
   extraction only after the interface stabilizes?
7. What tests should be added before converting more interaction tokens?

