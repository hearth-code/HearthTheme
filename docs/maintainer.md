# HearthCode Maintainer Guide

This document is the operational reference for maintaining the color-language pipeline.

Public messaging belongs in the scheme philosophy and product layer.
This guide is about source layers, generation order, and release discipline.

For the visual-design workflow that turns subjective review into repeatable theme changes, see `docs/theme-iteration-playbook.md`.

## 1. Source-of-Truth Map

### Product Layer

- `products/active-product.json`
- `products/hearthcode/product.json`
- `products/hearthcode/preview.json`
- `products/hearthcode/release.json`

### Scheme Layer

- `color-system/active-scheme.json`
- `color-system/schemes/ember/scheme.json`
- `color-system/schemes/ember/color-contract.json`
- `color-system/schemes/ember/philosophy.md`
- `color-system/schemes/ember/taxonomy.json`

### Color Language Core

- `color-system/schemes/ember/foundation.json`
- `color-system/schemes/ember/semantic-rules.json`
- `color-system/schemes/ember/surface-rules.json`
- `color-system/schemes/ember/guidance-rules.json`
- `color-system/schemes/ember/terminal-rules.json`
- `color-system/schemes/ember/interface-rules.json`
- `color-system/schemes/ember/interaction-rules.json`
- `color-system/schemes/ember/feedback-rules.json`
- `color-system/schemes/ember/variant-knobs.json`

### Shared Framework

- `color-system/framework/variant-profiles.json`
- `color-system/framework/variants.json`
- `color-system/framework/adapters.json`
- `color-system/framework/vscode-chrome-contract.json`
- `color-system/framework/compatibility-boundaries.json`
- `color-system/framework/contract-checklist.json`
- `color-system/framework/contract-review-checklist.json`
- `color-system/framework/tuning.json`

### Migration Anchors / Compatibility Baselines

- `color-system/base-dark.source.json`
- `color-system/templates/*.base.json`

The `colors` sections in these files are sync-managed migration snapshots.
They exist to keep the current VS Code derivation path stable while design intent moves upward into scheme/core/framework files.

### Generated Outputs

- `color-system/semantic.json`
- `themes/`
- `public/themes/`
- `extension/themes/`
- `obsidian/themes/`
- `obsidian/app-theme/`
- `src/data/tokens.ts`
- `src/data/product.ts`
- `src/styles/theme-vars.css`
- `docs/theme-baseline.md`
- `docs/color-language-report.md`
- `docs/color-language-contract-checklist.md`
- `docs/color-language-contract-review.md`
- `reports/color-language-lineage.json`
- `reports/color-language-consistency.json`
- `reports/color-language-parity.json`
- `reports/color-contract-audit.json`
- `reports/color-contract-audit.md`
- `reports/vscode-chrome-residual.json`

### Release Metadata

- `releases/color-language.json`
- `extension/package.json`
- `extension/CHANGELOG.md`

## 2. Editing Policy

Normal order of operations:

1. active product / product manifests when distribution identity changes
2. scheme manifest / philosophy
3. taxonomy
4. foundation
4. semantic rules
5. surface rules
6. guidance rules
7. terminal rules
8. interface rules
9. interaction rules
10. feedback rules
11. variant knobs
12. variant profiles
13. adapters
14. tuning
15. migration anchors only if the change is truly platform-compatibility work

Do not directly edit generated artifacts.

`color-system/semantic.json` is a generated snapshot.
It is not a source file.

## 3. Required Local Workflow

1. Update product/scheme/core/framework inputs.
2. Run `pnpm run sync`.
3. Run `pnpm run preview:generate` if preview assets are affected.
4. Run `pnpm run audit:source-layer`.
5. Run `pnpm run audit:contracts`.
6. Run `pnpm run audit:contract-review`.
7. Run `pnpm run audit:compatibility`.
8. Run `pnpm run check:schemes`.
9. Run `pnpm run check:sync`.
10. Run `pnpm run check:preview`.
11. Run `pnpm run audit:generated-origin`.
12. Run `pnpm run audit:all`.
13. Run `pnpm run build`.
14. Commit source and generated outputs together.

## 4. Interpretation Rules

- `adapters.json` is a platform contract file, not a design file.
- `contract-checklist.json` is the lifecycle registry for future-proof contracts, bounded compatibility, calibration layers, migration anchors, and generated outputs; update it whenever a file crosses one of those boundaries.
- `contract-review-checklist.json` is the promotion rubric that explains why each contract is currently stable, bounded, transitional, or generated, and what would need to change before that status moves.
- `tuning.json` is a calibration file, not a palette-definition file.
- `taxonomy.json` is the machine-readable abstract grouping layer; it should stay platform-free.
- `surface-rules.json`, `guidance-rules.json`, `terminal-rules.json`, `interface-rules.json`, and `interaction-rules.json` should prefer sparse anchors plus derivation, not full per-variant result tables unless a bounded escape hatch is truly necessary.
- Environment anchors like `canvas`, `ink`, and `sidebar` should stay rooted in foundation families whenever possible, so the rest of the environment layer can derive from one shared scheme language.
- Guidance anchors should express scaffold, whitespace, and bracket language as cross-product structure cues, not as VS Code-only leftovers.
- Terminal anchors should express cross-terminal ANSI semantics as part of the scheme language, not as a platform-local afterthought or a hand-tuned terminal table living in one product.
- Interface anchors should express shell ink hierarchy, on-accent contrast, and navigation-state tone as abstract cross-product language, not as a copy of one platform's chrome keys.
- Interaction anchors may derive from semantic roles when cursor, status, focus, or selection should inherit the same expressive family as the code language.
- Feedback anchors should express note / info / success / warning / error as abstract cross-product semantics, not as platform-local error colors or borrowed code tokens.
- If a repeated interaction state needs a durable cross-product identity, prefer adding a scheme-level tone such as `shell.lift` or `terracotta.presence` in foundation instead of leaving per-variant `output` escapes inside interaction rules.
- If the interaction grammar stays the same but the climate intensity changes, prefer `variant-knobs.json` over duplicating per-variant `derive` blocks inside interaction rules.
- If a surface relationship stays the same but its climate-sensitive mix ratio changes, prefer `variant-knobs.json` over duplicating per-variant `mix.t` blocks inside surface rules.
- `check:schemes` is the registry guardrail; it proves every scheme can build its abstract model and lineage without changing generators.
- `audit:contracts` keeps the lifecycle registry honest, so future-proof layers, calibration layers, migration anchors, and generated outputs do not silently blur back together.
- `audit:contract-review` keeps the review rubric aligned with the actual lifecycle state of each contract.
- `audit:parity` keeps the final VS Code / Obsidian / web outputs aligned, so cross-terminal expression drift is caught before release.
- `compatibility-boundaries.json` is where bounded host/rendering exceptions live; it must stay free of design values.
- The residual chrome report must either map a key to an abstract bucket or to a declared compatibility boundary with rationale.
- New residual keys are not acceptable by default; add them only when the cross-product abstraction is genuinely not worth the complexity yet, and explain that tradeoff in `compatibility-boundaries.json`.
- `ember-dark.source.json` is a migration anchor, not the final philosophical authority.
- `vscode-chrome-contract.json` owns migrated workbench color bindings; do not hand-tune those keys inside source/template snapshots.
- lineage must be able to explain every generated downstream token.
- the residual chrome report must explain which VS Code workbench keys still belong to abstract buckets vs temporary compatibility.

If a change cannot be explained in lineage, the change is not in a good state.

## 5. Versioning and Release

- Bump release version from the canonical file: `pnpm run bump:release:patch` (or `minor` / `major`).
- The bump command synchronizes `releases/color-language.json` and `extension/package.json`, and ensures a changelog heading exists.
- Before publishing, replace placeholder notes in the top changelog section.
- Obsidian package release (local): `pnpm run release:obsidian`.
- Optional snippets-only package: `pnpm run pack:obsidian:snippets`.

## 6. CI and Publishing

- Main workflow: `.github/workflows/publish.yml`
- `verify` requires clean generated outputs and all audits passing.
- Marketplace / Open VSX jobs skip when the same version already exists and only docs or preview assets changed.
- GitHub release job publishes release assets after verification.
