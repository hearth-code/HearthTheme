# HearthCode Color System Tuning Reference

This document is a quick reference for editing `color-system/framework/tuning.json`.

`tuning.json` is the calibration source for:

- light-variant compensation behavior
- global separation/readability optimization controls
- telemetry thresholds used by generation warnings
- docs snapshot/profile mappings
- website CSS variable derivation (`siteAssetMapping`)

## 1. Top-Level Keys

- `lightPolarityRoleOptimization`
  - Per-role constraints for light-mode polarity recovery.
  - Controls targets like `minBgHueDistance`, `minAnchorDeltaE`, `minContrast`, and role anchors/guards.
- `globalSeparationTargetByVariant`
  - Per-variant minimum quality targets for pairwise token separation (`median`, `p25`, `p10`).
- `globalSeparationBoostProfileByVariant`
  - Per-variant boost behavior when separation target is not met.
- `lightReadabilityCalibration`
  - Readability scoring profile.
  - Includes `default` and role-specific overrides in `byRole`.
- `lightCoolRoleSoften`
  - Light-variant chroma softening for cool semantic roles.
- `globalSeparationRoleProfile`
  - Role-level boost/lift multipliers plus baseline pair filter (`baselineDeltaE`).
- `lightPolaritySearchProfile`
  - Search grid and scoring weights for polarity candidate exploration.
- `globalSeparationDeficitProfile`
  - Floors and minimum scaling behavior for deficit-to-boost conversion.
- `lightReadabilitySearchProfile`
  - Readability search granularity and scoring normalization divisors.
- `telemetryProfile`
  - Generation warning thresholds (for example drift warning deltaE).
- `interactionStateBudget`
  - Functional UI-state visibility budgets per variant (`lineHighlight`, `list/tab hover`, line-number active delta).
- `interactionStateConstraints`
  - Token-level VS Code interaction-state constraints that bind budget keys to concrete color tokens and measurement surfaces.
- `siteDocsProfile`
  - Source-of-truth rows and snapshot metrics for `docs/theme-baseline.md`.
- `siteAssetMapping`
  - Source-of-truth mapping for generated website CSS vars (`src/styles/theme-vars.css`).

## 2. `siteAssetMapping` Schema

`siteAssetMapping` supports a small expression DSL:

- string references
  - token ref: `dark.bg`, `dark.fn`, `light.bg`
  - derived color ref: `@ember`
  - direct hex: `#aabbcc`
- object expressions
  - mix:
    - `{ "type": "mix", "a": <expr>, "b": <expr>, "t": 0..1 }`
  - alpha:
    - `{ "type": "alpha", "color": <expr>, "value": 0..1 }`

Structure:

- `derivedColors`
  - reusable color expressions, referenced via `@name`
- `groups`
  - readable variable groups (for example `foundation`, `atmosphere`, `interactive`, `chrome`, `preview`)
  - each group maps CSS custom properties to expressions

Internally, loader logic flattens all groups into one unique var map for generation.

## 3. Safe Edit Workflow

1. Edit only `color-system/framework/tuning.json`.
2. Run `pnpm run sync`.
3. Run `pnpm run check:sync`.
4. Run `pnpm run check:preview`.
5. Run `pnpm run audit:all`.

If all checks pass and generated artifacts are unchanged (or expected), the tuning change is consistent.
