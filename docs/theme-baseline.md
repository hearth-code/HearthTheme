# HearthCode Ember Baseline

Updated: 2026-04-25

## 1) Design Intent

Ember uses one warm semantic language across four variants:

- Dark mode (`HearthCode Ember Dark`): soot blackboard, chalk-like glyphs, amber-led warmth; tuned as a daily driver for mixed-light environments.
- Dark Soft (`HearthCode Ember Dark Soft`): same semantic roles with softer substrate contrast; tuned for night work and low-stimulation focus.
- Light mode (`HearthCode Ember Light`): parchment base, walnut ink text, yellow-led warmth with brick-red accents; tuned for daytime office and document-dense reading.
- Light Soft (`HearthCode Ember Light Soft`): same light-mode semantics with calmer daytime contrast; tuned for long daytime sessions.

Role parity is mandatory: syntax roles keep the same meaning across all variants. This line stays warm-neutral with a bounded mineral cool anchor, and calibration is mainly handled through lightness/chroma control, role-weighted exposure balancing, and bounded hue compensation when readability requires it.

## 2) Semantic Color Matrix

| Role | Dark | Dark Soft | Light | Light Soft | Narrative Role |
| --- | --- | --- | --- | --- | --- |
| background | `#1b1d1a` | `#22211d` | `#e7e5d8` | `#e1ded2` | Soot board base vs parchment desk-paper base |
| foreground | `#d2bea2` | `#cab89d` | `#342d28` | `#433c35` | Chalk-walnut ink readability spine |
| keyword | `#d4b84f` | `#c9b362` | `#83640f` | `#87671c` | Brick-red control-flow anchors (accent only) |
| operator | `#979087` | `#938d85` | `#66635d` | `#68635d` | Brass connective symbols with low noise |
| function | `#91cf72` | `#96d07b` | `#397626` | `#3e7929` | Denim-blue callable anchors for deliberate contrast |
| method | `#68bca3` | `#6dc0ab` | `#287766` | `#2a7966` | Leather-orange method calls for secondary action |
| property | `#8ebb7f` | `#a4ce96` | `#3f7138` | `#40763a` | Muted olive member access cues |
| string | `#caa46c` | `#c3a377` | `#756823` | `#746b2c` | Calm olive literals for reading rhythm |
| number | `#77a7d2` | `#82a7cf` | `#346fa8` | `#376fa2` | Sunset terracotta numeric constants |
| type | `#68adc1` | `#5cabc3` | `#237296` | `#247593` | Dark-ochre structural symbols |
| variable | `#c3bfb9` | `#bfbcb5` | `#46423d` | `#4b4742` | Coffee-neutral information carriers |
| comment | `#817566` | `#887c70` | `#766f65` | `#81796f` | Quiet guidance layer |

## 3) Readability Budget (Theme Audit Gates)

The following thresholds are enforced by `scripts/theme-audit.mjs`.

| Check | Target |
| --- | --- |
| editor fg/bg contrast | `>= 7.0` |
| comment contrast window | `2.2 - 4.2` |
| operator contrast window | `2.8 - 6.2` |
| minimum role separation (`deltaE`) | `>= 10` |
| method/property critical separation (`deltaE`) | `>= 10` |
| operator/comment critical separation (`deltaE`) | `>= 4.5` (`light`/`lightSoft` use `>= 5.0`) |
| cross-theme role hue drift (comment/keyword/operator/string/number/type/variable/method/property) | `<= 45 deg` |
| light function/background hue distance | `>= 3 deg` |
| light function anchor separation (`deltaE` vs keyword/number/tag) | `>= 10` |
| warm gamut guard | `forbid 170-250 deg (s>=0.08), except type/number` |
| red/yellow exposure balance | `frequency-damped chroma + saliency boost (ts/py/go/rust/json/md)` |
| light key pair separation (`deltaE`) | `keyword/tag>=9, comment/type>=8.5, property/string>=8, method/variable>=12` |
| light soft key pair separation (`deltaE`) | `keyword/tag>=7, comment/type>=8, property/string>=6, method/variable>=11` |
| variable/parameter near-foreground deltaE | `dark 3-14, darkSoft 3-14, light 6-22, lightSoft 3-16` |
| function critical separation deltaE | `keyword>=13, number>=11, tag>=12, variable>=13, method>=9` |
| method critical separation deltaE | `variable>=12` |
| property critical separation deltaE | `operator>=9` |
| type critical separation deltaE | `variable>=9, operator>=9` |

Current snapshot from audit:

- dark fg/bg: `9.4`
- dark soft fg/bg: `8.3`
- light fg/bg: `10.7`
- light soft fg/bg: `8.0`
- dark comment: `3.8`
- dark soft comment: `4.0`
- light comment: `3.9`
- light soft comment: `3.2`
- dark operator: `5.4`
- dark soft operator: `4.9`
- light operator: `4.7`
- light soft operator: `4.4`

## 4) Token Coverage Standard

Theme releases must keep both layers aligned:

- TextMate token coverage: `comment keyword operator function string number type variable property`
- Semantic token alignment: `keyword function enumMember type variable property`
- Semantic/TextMate drift should stay visually close (audit warns when drift grows)

## 5) Stable Change Protocol

All palette changes must follow this order:

1. Edit the highest valid authority:
   - `color-system/active-scheme.json` to switch the active scheme
   - `color-system/schemes/ember/scheme.json`, `philosophy.md`, and `taxonomy.json` for public-facing identity plus abstract grouping
   - `color-system/schemes/ember/foundation.json` for named families
   - `color-system/schemes/ember/semantic-rules.json` for role derivation
   - `color-system/schemes/ember/surface-rules.json` for abstract surfaces
   - `color-system/schemes/ember/interaction-rules.json` for shared interaction primitives
   - `color-system/framework/variant-profiles.json` for climate strategy
   - `color-system/framework/adapters.json` for platform contracts
   - `color-system/framework/variants.json` for output routing
2. If compensation/chroma policy changes, update `color-system/framework/tuning.json` in the same PR.
3. If this is a UI/chrome compatibility shift, first update `color-system/framework/vscode-chrome-contract.json`; only edit `color-system/base-dark.source.json` directly if the token-scope baseline itself must change.
4. If this is a deliberate derivation reset, update templates in `color-system/templates/*.base.json` in the same PR, but treat their `colors` blocks as sync-managed snapshots.
5. Run `pnpm run sync` (this regenerates `color-system/semantic.json`, `themes/*.json`, and all downstream artifacts).
6. Run `pnpm run check:sync` (must be clean right after sync).
7. Run `pnpm run audit:generated-origin` (generated outputs must be backed by scheme/core/framework or generator changes).
8. Run `pnpm run audit:all` (`theme + lineage + obsidian + copy + claims + generated-origin + cjk + release`).
9. Check fixtures in `fixtures/theme-audit/` (TS/Python/Rust/Go/JSON/Markdown).
10. If thresholds or governance changed, update this document and audit scripts in the same PR.
11. If you are releasing extension metadata/theme changes, update `extension/CHANGELOG.md` in the same PR.

One-shot alternative:

- `pnpm run release:theme` (runs audit, build/sync, and preview generation)

## 6) PR Acceptance Checklist

- `color-system/active-scheme.json` selects the current scheme.
- `color-system/schemes/ember/scheme.json` and `philosophy.md` are the public scheme identity authority.
- `color-system/schemes/ember/taxonomy.json` is the machine-readable abstract grouping authority.
- `color-system/schemes/ember/foundation.json`, `semantic-rules.json`, `surface-rules.json`, and `interaction-rules.json` are the top-down color language authority.
- `color-system/semantic.json` is a generated semantic snapshot, not a manual source file.
- `color-system/framework/adapters.json` is the adapter contract authority.
- `color-system/framework/variant-profiles.json` and `variants.json` are the shared variant framework authority.
- `color-system/framework/tuning.json` is the algorithmic calibration authority.
- `color-system/base-dark.source.json` is the UI/token migration anchor; migrated workbench colors are synced from `color-system/framework/vscode-chrome-contract.json`.
- `themes/ember-dark.json`, `themes/ember-dark-soft.json`, `themes/ember-light.json`, and `themes/ember-light-soft.json` are regenerated artifacts.
- `color-system/templates/*.base.json` are updated only when intentionally changing derivation baseline; their workbench colors are sync-managed for migrated keys.
- `src/data/tokens.ts` regenerated via sync script.
- `src/styles/theme-vars.css` regenerated via sync script.
- `reports/color-language-lineage.json` regenerated via sync script.
- `extension/package.json` `galleryBanner.color` matches `themes/ember-dark.json` background.
- `docs/theme-baseline.md` semantic matrix + snapshot lines are in sync with current themes.
- `pnpm run check:sync` passes (no generated drift after sync).
- `pnpm run audit:generated-origin` passes (generated outputs are source-linked).
- `pnpm run audit:lineage` passes (every downstream token can be traced back to upstream families/rules).
- `pnpm run audit:theme` passes without blocking issues.
- `pnpm run audit:copy` passes (variant count + color copy + README metrics parity).
- `pnpm run audit:copy` also enforces "no hardcoded color literals" in site source files.
- `pnpm run audit:claims` passes (no stale or misleading public claims).
- `pnpm run audit:cjk` passes without typography regressions.
- `pnpm run build` passes and static pages can be generated.
- Local git hooks are enabled (`pnpm install` runs `prepare` to install Husky).
- Any warnings are explicitly accepted with rationale in PR notes.
- `extension/CHANGELOG.md` is updated when extension metadata/themes are changed.

## 7) Change History

Website `/docs` change history is sourced from `extension/CHANGELOG.md` to stay aligned with Marketplace releases.

- Full history source: `extension/CHANGELOG.md`
- Live docs page preview: `/docs`
