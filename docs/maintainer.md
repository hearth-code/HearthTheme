# HearthCode Maintainer Guide

This document is the operational reference for maintaining the color-language pipeline.

Public messaging belongs in the scheme philosophy and README.
This guide is about source layers, generation order, and release discipline.

## 1. Source-of-Truth Map

### Scheme Layer

- `color-system/active-scheme.json`
- `color-system/schemes/hearth/scheme.json`
- `color-system/schemes/hearth/philosophy.md`
- `color-system/schemes/hearth/taxonomy.json`

### Color Language Core

- `color-system/schemes/hearth/foundation.json`
- `color-system/schemes/hearth/semantic-rules.json`
- `color-system/schemes/hearth/surface-rules.json`
- `color-system/schemes/hearth/interaction-rules.json`
- `color-system/schemes/hearth/variant-knobs.json`

### Shared Framework

- `color-system/framework/variant-profiles.json`
- `color-system/framework/variants.json`
- `color-system/framework/adapters.json`
- `color-system/framework/vscode-chrome-contract.json`
- `color-system/framework/tuning.json`

### Migration Anchors / Compatibility Baselines

- `color-system/hearth-dark.source.json`
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
- `src/styles/theme-vars.css`
- `docs/theme-baseline.md`
- `docs/color-language-report.md`
- `reports/color-language-lineage.json`
- `reports/color-language-consistency.json`
- `reports/vscode-chrome-residual.json`

### Release Metadata

- `releases/color-language.json`
- `extension/package.json`
- `extension/CHANGELOG.md`

## 2. Editing Policy

Normal order of operations:

1. scheme manifest / philosophy
2. taxonomy
3. foundation
4. semantic rules
5. surface rules
6. interaction rules
7. variant knobs
8. variant profiles
9. adapters
10. tuning
11. migration anchors only if the change is truly platform-compatibility work

Do not directly edit generated artifacts.

`color-system/semantic.json` is a generated snapshot.
It is not a source file.

## 3. Required Local Workflow

1. Update scheme/core/framework inputs.
2. Run `pnpm run sync`.
3. Run `pnpm run preview:generate` if preview assets are affected.
4. Run `pnpm run audit:source-layer`.
5. Run `pnpm run check:schemes`.
6. Run `pnpm run check:sync`.
7. Run `pnpm run check:preview`.
8. Run `pnpm run audit:generated-origin`.
9. Run `pnpm run audit:all`.
10. Run `pnpm run build`.
11. Commit source and generated outputs together.

## 4. Interpretation Rules

- `adapters.json` is a platform contract file, not a design file.
- `tuning.json` is a calibration file, not a palette-definition file.
- `taxonomy.json` is the machine-readable abstract grouping layer; it should stay platform-free.
- `surface-rules.json` and `interaction-rules.json` should prefer sparse anchors plus derivation, not full per-variant result tables unless a bounded escape hatch is truly necessary.
- Environment anchors like `canvas`, `ink`, and `sidebar` should stay rooted in foundation families whenever possible, so the rest of the environment layer can derive from one shared scheme language.
- Interaction anchors may derive from semantic roles when cursor, status, focus, or selection should inherit the same expressive family as the code language.
- If a repeated interaction state needs a durable cross-product identity, prefer adding a scheme-level tone such as `shell.lift` or `terracotta.presence` in foundation instead of leaving per-variant `output` escapes inside interaction rules.
- If the interaction grammar stays the same but the climate intensity changes, prefer `variant-knobs.json` over duplicating per-variant `derive` blocks inside interaction rules.
- `check:schemes` is the registry guardrail; it proves every scheme can build its abstract model and lineage without changing generators.
- `audit:parity` keeps the final VS Code / Obsidian / web outputs aligned, so cross-terminal expression drift is caught before release.
- `hearth-dark.source.json` is a migration anchor, not the final philosophical authority.
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
