# AI Agent Operating Guide

This repository is source-of-truth driven. Treat generated artifacts as outputs of the scripts, not as independent design surfaces.

## Start Here

- Read `CONTRIBUTING.md` before making theme, release, or generated-output changes.
- Active product: `products/active-product.json`.
- Active scheme: `color-system/active-scheme.json`.
- Primary source inputs live under `color-system/schemes/*` and `color-system/framework/*`.
- Generated outputs include `themes/*`, `public/themes/*`, `extension/themes/*`, `obsidian/*`, `src/data/tokens.ts`, `src/styles/theme-vars.css`, `docs/theme-baseline.md`, and selected `reports/*`.

## Safe Change Workflow

1. Edit source inputs or generator code first.
2. Run `pnpm run sync`.
3. Run `pnpm run check:sync`.
4. Run `pnpm run check:preview`.
5. Run `pnpm run test`.
6. Run `pnpm run audit:all`.
7. Run `pnpm run build`.

Use `pnpm run verify` when you want the full local gate in the expected order.

## Generated Drift Rules

- If `check:sync` reports drift, run `pnpm run sync` once, inspect `git diff`, then rerun `pnpm run check:sync`.
- Do not hand-edit generated files to silence drift.
- `reports/theme-audit/` is runtime audit output and is intentionally ignored.
- If a script changes generated files without a source or generator change, pause and inspect the active scheme/product before committing.

## Multi-Scheme Notes

HearthCode ships Ember and Moss from the same framework. Some scripts temporarily run with `COLOR_SYSTEM_SCHEME_ID` and `COLOR_SYSTEM_SCHEME_DIR` overrides. Keep final committed global snapshots aligned with the active scheme unless a generator explicitly documents a multi-scheme aggregate output.

## Release Notes

If extension payload changes, keep these aligned:

- `releases/color-language.json`
- `extension/package.json`
- top section of `extension/CHANGELOG.md`

Never leave placeholder release notes in a publishable change.
