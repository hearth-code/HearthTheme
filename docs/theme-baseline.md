# Hearth Theme Baseline

Updated: 2026-03-20

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
| background | `#23201c` | `#2a2723` | `#efe6d8` | `#ece2d3` | Blackboard vs parchment substrate |
| foreground | `#d3c9b8` | `#d7cdbc` | `#2f210e` | `#3a2c18` | Chalk ink vs walnut ink |
| keyword | `#d36b4a` | `#d36b4a` | `#8f2f1b` | `#8f2f1b` | Ember red control-flow anchors |
| operator | `#8f846f` | `#8f846f` | `#7a6d51` | `#7a6d51` | Low-noise brass connective symbols |
| function | `#e3b368` | `#e3b368` | `#6a4102` | `#6a4102` | Brass amber callable targets |
| string | `#8fbd79` | `#8fbd79` | `#2f6f2d` | `#2f6f2d` | Moss green literal content |
| number | `#d5865f` | `#d5865f` | `#b14f30` | `#b14f30` | Terracotta numeric constants |
| type | `#5aa7b6` | `#5aa7b6` | `#0f6a73` | `#0f6a73` | Mineral teal structural symbols |
| variable | `#dfd5c7` | `#dfd5c7` | `#3d3022` | `#3d3022` | Neutral content carrier |
| comment | `#6b5f4d` | `#6b5f4d` | `#847257` | `#847257` | Intentionally quiet guidance layer |

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
- dark soft fg/bg: `9.4`
- light fg/bg: `12.6`
- light soft fg/bg: `10.5`
- dark comment: `2.6`
- dark soft comment: `2.4`
- light comment: `3.8`
- light soft comment: `3.6`
- dark operator: `4.4`
- dark soft operator: `4.0`
- light operator: `4.1`
- light soft operator: `4.0`

## 4) Token Coverage Standard

Theme releases must keep both layers aligned:

- TextMate token coverage: `comment keyword operator function string number type variable property`
- Semantic token alignment: `keyword function enumMember type variable property`
- Semantic/TextMate drift should stay visually close (audit warns when drift grows)

## 5) Stable Change Protocol

All palette changes must follow this order:

1. Edit only source themes in `themes/`.
2. Run `node scripts/sync-themes.mjs`.
3. Run `npm run audit:theme`.
4. Run `npm run audit:cjk` for zh/ja typography safeguards.
5. Check fixtures in `fixtures/theme-audit/` (TS/Python/Rust/Go/JSON/Markdown).
6. Run `npm run changelog:draft` (or `npm run changelog:append -- vX.Y.Z`) to generate/update history entry.
7. Add a versioned entry to `src/data/themeChangelog.ts`.
8. If thresholds or governance changed, update this document and audit scripts in the same PR.

One-shot alternative:

- `npm run release:theme -- vX.Y.Z` (runs audit, build/sync, preview generation, and changelog append)

## 6) PR Acceptance Checklist

- `themes/hearth-dark.json`, `themes/hearth-dark-soft.json`, `themes/hearth-light.json`, and `themes/hearth-light-soft.json` preserve role parity.
- `src/data/tokens.ts` regenerated via sync script.
- `npm run audit:theme` passes without blocking issues.
- `npm run audit:cjk` passes without typography regressions.
- `npm run build` passes and static pages can be generated.
- Any warnings are explicitly accepted with rationale in PR notes.
- `src/data/themeChangelog.ts` includes a clear versioned entry for this change.

## 7) Change History

Website `/docs` change history is sourced from `extension/CHANGELOG.md` to stay aligned with Marketplace releases.

- 2026-03-20 `v0.4.5`: Added Hearth Light Soft and expanded governance from 3 to 4 variants.
- 2026-03-19 `v0.4.4`: Cross-mode material refinement.
- 2026-03-19 `v0.4.2`: Added audit script, fixtures, and CI guardrails.
- 2026-03-19 `v0.4.1`: Reduced long-session noise by dimming comments/operators.
- 2026-03-19 `v0.4.0`: Unified blackboard + parchment language across dark/light modes.
