# Hearth Theme Baseline

Updated: 2026-03-22

## 1) Design Intent

Hearth uses one semantic language across four variants:

- Dark mode (`Hearth Dark`): soot blackboard, chalk-like glyphs, ember highlights.
- Dark Soft (`Hearth Dark Soft`): same semantic roles with softer substrate contrast.
- Light mode (`Hearth Light`): parchment base, walnut ink text, brass/ember accents.
- Light Soft (`Hearth Light Soft`): same light-mode semantics with calmer daytime contrast.

Role parity is mandatory: syntax roles keep the same meaning across all variants; only lightness and saturation may shift.

## 2) Semantic Color Matrix

| Role | Dark | Dark Soft | Light | Light Soft | Narrative Role |
| --- | --- | --- | --- | --- | --- |
| background | `#23201c` | `#2b2926` | `#efe6d8` | `#e4d8c5` | Blackboard vs parchment substrate |
| foreground | `#d3c9b8` | `#d3c9b8` | `#2a1e0f` | `#4b3a27` | Chalk ink vs walnut ink |
| keyword | `#c26f59` | `#c26f59` | `#9e2f31` | `#b25749` | Ember red control-flow anchors |
| operator | `#8f846f` | `#8f846f` | `#81704e` | `#80704f` | Low-noise brass connective symbols |
| function | `#d7ad70` | `#d7ad70` | `#0f69ca` | `#1680cd` | Brass amber callable targets |
| string | `#8fb87d` | `#8fb87d` | `#006a0c` | `#447f4d` | Moss green literal content |
| number | `#ba846d` | `#ba846d` | `#983e04` | `#b35823` | Terracotta numeric constants |
| type | `#5d98a4` | `#5d98a4` | `#036470` | `#3a7c7e` | Mineral teal structural symbols |
| variable | `#dfd5c7` | `#dfd5c7` | `#563620` | `#4b2f16` | Neutral content carrier |
| comment | `#6b5f4d` | `#6b5f4d` | `#a48e6a` | `#988465` | Intentionally quiet guidance layer |

## 3) Readability Budget (Theme Audit Gates)

The following thresholds are enforced by `scripts/theme-audit.mjs`.

| Check | Target |
| --- | --- |
| editor fg/bg contrast | `>= 7.0` |
| comment contrast window | `2.2 - 4.2` |
| operator contrast window | `2.8 - 6.2` |
| minimum role separation (`deltaE`) | `>= 10` |
| cross-theme role hue drift | `<= 45 deg` |

Current snapshot from audit:

- dark fg/bg: `9.9`
- dark soft fg/bg: `8.9`
- light fg/bg: `13.2`
- light soft fg/bg: `7.7`
- dark comment: `2.6`
- dark soft comment: `2.3`
- light comment: `2.6`
- light soft comment: `2.6`
- dark operator: `4.4`
- dark soft operator: `3.9`
- light operator: `3.9`
- light soft operator: `3.4`

## 4) Token Coverage Standard

Theme releases must keep both layers aligned:

- TextMate token coverage: `comment keyword operator function string number type variable property`
- Semantic token alignment: `keyword function enumMember type variable property`
- Semantic/TextMate drift should stay visually close (audit warns when drift grows)

## 5) Stable Change Protocol

All palette changes must follow this order:

1. Edit the core source theme: `themes/hearth-dark.json`.
2. If this is a deliberate palette-direction reset, update templates in `themes/templates/*.base.json` in the same PR.
3. Run `npm run sync` (this generates Dark Soft / Light / Light Soft, then refreshes `src/data/tokens.ts`, `src/styles/theme-vars.css`, docs snapshot rows, and extension metadata color sync).
4. Run `npm run check:sync` (must be clean right after sync).
5. Run `npm run audit:generated-origin` (generated outputs must be backed by changes in `themes/` or `scripts/`).
6. Run `npm run audit:all` (`theme + copy + generated-origin + cjk + release`).
7. Check fixtures in `fixtures/theme-audit/` (TS/Python/Rust/Go/JSON/Markdown).
8. If thresholds or governance changed, update this document and audit scripts in the same PR.
9. If you are releasing extension metadata/theme changes, update `extension/CHANGELOG.md` in the same PR.

One-shot alternative:

- `npm run release:theme` (runs audit, build/sync, and preview generation)

## 6) PR Acceptance Checklist

- `themes/hearth-dark.json` is the only hand-edited source theme for palette evolution.
- `themes/hearth-dark-soft.json`, `themes/hearth-light.json`, and `themes/hearth-light-soft.json` are regenerated from core dark.
- `themes/templates/*.base.json` are updated only when intentionally changing derivation baseline.
- `src/data/tokens.ts` regenerated via sync script.
- `src/styles/theme-vars.css` regenerated via sync script.
- `extension/package.json` `galleryBanner.color` matches `themes/hearth-dark.json` background.
- `docs/theme-baseline.md` semantic matrix + snapshot lines are in sync with current themes.
- `npm run check:sync` passes (no generated drift after sync).
- `npm run audit:generated-origin` passes (generated outputs are source-linked).
- `npm run audit:theme` passes without blocking issues.
- `npm run audit:copy` passes (variant count + color copy + README metrics parity).
- `npm run audit:copy` also enforces "no hardcoded color literals" in site source files.
- `npm run audit:cjk` passes without typography regressions.
- `npm run build` passes and static pages can be generated.
- Local git hooks are enabled (`pnpm install` runs `prepare` to install Husky).
- Any warnings are explicitly accepted with rationale in PR notes.
- `extension/CHANGELOG.md` is updated when extension metadata/themes are changed.

## 7) Change History

Website `/docs` change history is sourced from `extension/CHANGELOG.md` to stay aligned with Marketplace releases.

- 2026-03-20 `v0.4.5`: Added Hearth Light Soft and expanded governance from 3 to 4 variants.
- 2026-03-19 `v0.4.4`: Cross-mode material refinement.
- 2026-03-19 `v0.4.2`: Added audit script, fixtures, and CI guardrails.
- 2026-03-19 `v0.4.1`: Reduced long-session noise by dimming comments/operators.
- 2026-03-19 `v0.4.0`: Unified blackboard + parchment language across dark/light modes.
