# HearthCode Color Language Spec

HearthCode is a color-language system, not just a single platform theme.

The public story should stay simple:

- one scheme
- one philosophy
- four tuned climates
- the same recognizable personality across VS Code, Obsidian, and the website

The internal system exists to make that public promise reliable.

## 1. System Thesis

HearthCode starts from palette philosophy first, then turns that philosophy into machine-readable contracts, then turns those contracts into generated platform artifacts.

The goal is not pixel identity.

The goal is **expressive parity**:

- the same thermal feel
- the same semantic hierarchy
- the same emphasis priorities
- the same variant climates
- the same public-facing identity

A user should be able to move between products and still feel that the same color language is speaking.

## 2. Five-Layer Architecture

HearthCode is organized as a five-layer single-direction pipeline:

1. Philosophy / Scheme Manifest
2. Color Language Core
3. Variant System
4. Platform Contracts + Calibration
5. Generated Artifacts + Lineage

The layers should only flow downward. Generated artifacts never become design authority.

## 3. Layer Contracts

### 3.1 Philosophy / Scheme Manifest

Purpose:

- define what the scheme is
- define how it should be described to humans
- define constraints that stay above any single platform

Primary files:

- `color-system/active-scheme.json`
- `color-system/schemes/hearth/scheme.json`
- `color-system/schemes/hearth/philosophy.md`
- `color-system/schemes/hearth/taxonomy.json`

This layer owns:

- naming
- positioning
- mood
- audience
- vocabulary
- abstract family / role / surface / interaction grouping
- variant philosophy
- non-platform constraints

This layer must not contain VS Code / Obsidian / website token fields.

### 3.2 Color Language Core

Purpose:

- define the abstract color language before platform mapping

Primary files:

- `color-system/schemes/hearth/foundation.json`
- `color-system/schemes/hearth/semantic-rules.json`
- `color-system/schemes/hearth/surface-rules.json`
- `color-system/schemes/hearth/interaction-rules.json`

This layer owns:

- named families
- semantic role derivation
- sparse surface anchors plus derived environment layers
- sparse interaction anchors plus derived shared emphasis states

This is the main design authority.

### 3.3 Variant System

Purpose:

- define how climate changes across `dark`, `darkSoft`, `light`, and `lightSoft`
- keep role meaning stable while changing contrast texture and atmosphere

Primary files:

- `color-system/framework/variant-profiles.json`
- `color-system/framework/variants.json`
- `color-system/schemes/hearth/variant-knobs.json`

This layer owns:

- polarity
- contrast texture
- variant inheritance
- climate intent
- scheme-level intensity knobs that adjust the same interaction grammar without redefining it

This layer must not redefine role meaning.
It must also stay platform-free; migration metadata belongs lower in the stack.

### 3.4 Platform Contracts + Calibration

Purpose:

- translate abstract roles / surfaces / interactions into platform fields
- compensate for platform-specific readability and compatibility constraints

Primary files:

- `color-system/framework/adapters.json`
- `color-system/framework/vscode-chrome-contract.json`
- `color-system/framework/tuning.json`
- `color-system/hearth-dark.source.json`
- `color-system/templates/*.base.json`

Contracts:

- adapters map abstract tokens into platform tokens
- vscode chrome contract maps selected workbench colors back to abstract surfaces and interactions
- tuning applies bounded calibration only
- source/template files are migration anchors and compatibility baselines, not long-term design authority

Rules:

- adapters must not own design colors
- tuning must not own design philosophy
- any calibration drift must stay traceable

### 3.5 Generated Artifacts + Lineage

Purpose:

- produce publishable platform outputs
- expose the exact chain from scheme -> role -> variant -> adapter -> artifact

Generated files include:

- `color-system/semantic.json`
- `themes/*.json`
- `public/themes/*.json`
- `extension/themes/*.json`
- `obsidian/themes/*.css`
- `obsidian/app-theme/theme.css`
- `src/data/tokens.ts`
- `src/styles/theme-vars.css`
- `docs/theme-baseline.md`
- `docs/color-language-report.md`
- `reports/color-language-consistency.json`
- `reports/color-language-lineage.json`
- `reports/vscode-chrome-residual.json`

These files are deliverables.
They are never hand-tuned sources of truth.

The residual chrome report is especially important during migration:

- it shows which workbench keys already come from abstract roles
- it groups the remaining keys into buckets that can become future chrome tone roles
- it keeps platform compatibility work visible instead of hidden inside snapshots

## 4. Directory Layout

Shared framework:

- `color-system/framework/*`

Active scheme:

- `color-system/schemes/hearth/*`
- `color-system/active-scheme.json`

Generated compatibility snapshot:

- `color-system/semantic.json`

Migration anchors:

- `color-system/hearth-dark.source.json`
- `color-system/templates/*`

Their workbench `colors` blocks are now sync-managed snapshots for migrated keys.
Token scope baselines remain in place temporarily while the platform migration continues.

This layout allows future schemes to reuse the same framework without rewriting generators or audits.

## 5. Daily Workflow

The expected workflow is:

1. choose the active scheme
2. edit only scheme/core files unless the change is truly calibration
3. run `pnpm run sync`
4. run `pnpm run audit:source-layer`
5. run `pnpm run check:schemes`
6. run `pnpm run audit:all`
7. run `pnpm run build`
8. inspect previews, reports, and docs
9. commit sources and generated outputs together

Key guardrails in that loop are `audit:source-layer`, `audit:lineage`, `audit:parity`, and `check:schemes`.

The normal edit order is:

1. `scheme.json` / `philosophy.md` when the public story changes
2. `taxonomy.json` when the abstract grouping vocabulary changes
3. `foundation.json` for palette family changes
4. `semantic-rules.json` for role meaning changes
5. `surface-rules.json` for environment-layer changes
6. `interaction-rules.json` for shared interaction behavior changes
7. `variant-profiles.json` for climate behavior changes
8. `variant-knobs.json` for scheme-specific climate intensities
9. `adapters.json` for platform contract changes
10. `tuning.json` only for bounded calibration

Direct edits to generated platform outputs are out of policy.

Within `surface-rules.json` and `interaction-rules.json`, prefer:

- a few explicit anchors such as `canvas`, `ink`, `cursor`, or `status`
- derived entries for dependent layers such as `panel`, `border`, or `lineEmphasis`
- interaction anchors that inherit from semantic roles when the behavior should speak the same color language as code semantics
- scheme-level foundation tones such as `shell.lift` or `terracotta.presence` when a repeated cross-product state needs its own stable identity
- scheme-level variant knobs when the interaction grammar stays the same but the climate-sensitive intensity changes by variant

That keeps the top layer expressive without turning it back into a flat result table.
Environment anchors like `canvas`, `ink`, and `sidebar` should ideally resolve from foundation families first, so downstream surfaces and interactions inherit one shared scheme-level environment language.

## 6. Multi-Scheme Expansion

Future styles should be added by creating a new scheme directory, not by forking the framework.

Recommended flow:

1. add `color-system/schemes/<schemeId>/`
2. write `philosophy.md` and `scheme.json`
3. define `foundation / semantic / surface / interaction`
4. switch `active-scheme.json`
5. run the same `sync / audit / build` commands
6. review previews and lineage

This keeps generators, audits, and delivery tooling shared.

The repository should also keep `pnpm run check:schemes` green so every registered scheme remains buildable without rewriting generators.

## 7. Migration Principle

During migration, VS Code dark remains a compatibility anchor because it protects current outputs from drifting.

But it is not the long-term design source.

The long-term direction is:

- scheme/core define intent
- framework defines translation and calibration
- generated artifacts reflect the result

The near-term migration rule is:

- move workbench chrome first
- keep token scope baselines only as temporary compatibility anchors

Platform files should gradually become outputs or bounded compatibility anchors, not hidden design authorities.

## 8. Success Criteria

The architecture is working when all of the following are true:

- a family tone change propagates across all products
- a role change updates every terminal consistently
- an interaction primitive change updates shared emphasis behavior
- public previews stay aligned with shipped artifacts
- lineage can explain any downstream token
- new schemes can be added without rewriting the pipeline

If those conditions hold, HearthCode is behaving like a real cross-product color philosophy rather than a collection of manually synchronized themes.
