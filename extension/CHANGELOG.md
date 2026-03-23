## 1.0.20

- Re-ran a clean full release cycle to ensure Marketplace/Open VSX/GitHub release automation publishes from the latest stable pipeline state.
- Hardened release workflow reliability by ensuring diff-based jobs read full git history (prevents false "unable to diff commits" warnings and skipped release steps).
- Republished current color-system governance and soft-mode readability tuning as the active distributable baseline.

## 1.0.19

- Added `color-system/tuning.json` as a first-class source-of-truth for algorithmic color tuning (light polarity compensation + soft-mode chroma budgets).
- Refactored the theme generator to load tuning profiles from config instead of hardcoded script constants, improving reproducibility and release governance.
- Updated theme audit and color-language docs so pipeline checks, source references, and change protocol now explicitly include tuning configuration.
- Tuned `Hearth Dark Soft` and `Hearth Light Soft` warm/cool role saturation to reduce visual noise while preserving semantic separation and readability thresholds.

## 1.0.18

- Completed three-surface release alignment across VS Code Marketplace, Open VSX, and Obsidian app-theme distribution.
- Added CI upload of Obsidian release assets (`manifest.json`, `theme.css`, `versions.json`, and zip bundles) to the matching GitHub Release tag.
- Unified website and multilingual README messaging so public pages stay promotion-oriented while maintainer release details remain in dedicated sections.

## 1.0.17

- Refreshed extension icon to the circular transparent-corner mark so Marketplace and Open VSX branding matches the website identity.
- Bumped patch version to republish branding asset updates and unblock release pipeline checks.

## 1.0.16

- Reworked light-theme separation strategy to prioritize perceptual layering (lightness structure) over aggressive chroma boosts.
- Kept blue semantic roles in light variants while reducing over-saturation in `function`/`method`/`property`/`type` for a cleaner, more textured look.
- Updated philosophy copy and homepage presentation for background strategy, replacing parameter-heavy text with direct visual swatches.
- Regenerated synced theme assets, docs baseline, and preview images across website and extension outputs.

## 1.0.15

- Fine-tuned blue/cool token saturation in `Hearth Light` and `Hearth Light Soft` to reduce over-vivid highlights while preserving token separability.
- Wired light-variant cool-role softening into the generation pipeline so `function` / `method` / `property` / `type` adjustments are reproducible from `Hearth Dark`.
- Regenerated synced theme assets, baseline docs, and preview images across website and extension outputs.

## 1.0.14

- Rebalanced `Hearth Light` token palette for cleaner daytime readability, with lower visual noise in warm reds/oranges.
- Refined `Hearth Light Soft` to keep its original comfortable paper-like background while increasing token separation for method/property/type roles.
- Reduced haze in `Hearth Dark Soft` by tightening editor and chrome background layers, improving long-session focus without harsh contrast.
- Regenerated synced theme assets, docs baseline snapshot, and preview outputs across website and extension packages.

## 1.0.13

- Expanded brand-oriented search keywords (`hearth`, `hearth dark`, `hearth light`, `hearth soft`) to improve name-based discovery in theme search.
- Bumped extension patch version to refresh Marketplace and Open VSX indexing metadata.

## 1.0.12

- Added a new `Hearth Light Soft` variant as the daylight counterpart to `Hearth Dark Soft`.
- Expanded extension packaging to include `themes/hearth-light-soft.json` and aligned marketplace metadata to four variants.
- Updated preview pipeline outputs to generate and publish `preview-light-soft.png` for Marketplace and website parity.

## 1.0.11

- Updated Marketplace display name to `HearthCode Theme` for clearer category recognition in search results.
- Improved extension discoverability metadata (description + keywords), including `hearth code` and `cursor theme`.
- Bumped patch release to publish updated listing metadata on Marketplace and Open VSX.

## 1.0.10

- Reworked Marketplace README for clearer first-screen conversion flow (value proposition, quick install, variant guidance).
- Added promotion-oriented website proof section with side-by-side fixture comparisons and stronger install CTAs.
- Added website-ready preview image outputs (`public/previews`) from the automated screenshot generator.
- Refreshed multilingual GitHub READMEs with synchronized product messaging and install paths.

## 1.0.9

- Updated extension repository and issue tracker links to the `hearth-code/HearthTheme` organization path.
- Fixed Marketplace version detection in CI so duplicate-version checks resolve the extension correctly.

## 1.0.8

- Added Open VSX distribution support in CI (`publish-openvsx`), including duplicate-version guards.
- Added automatic GitHub release creation from `extension/CHANGELOG.md` on extension version updates.
- Updated project docs with Open VSX install/distribution links and release workflow details.
- Refreshed extension README install section to include Open VSX.

## 1.0.7

- Refined extension README to a mature, English-first presentation style for Marketplace.
- Added explicit issue tracker metadata (`bugs.url`) and disabled Marketplace Q&A tab (`qna: false`) for cleaner support routing.
- Expanded search keywords for discoverability (`warm theme`, `low glare`, `accessibility`, `cjk`, etc.).
- Added MIT license files for both repository root and extension package; publish/package commands now run without `--skip-license`.

## 1.0.6

- Added a dedicated `Hearth Dark Soft` preview image for Marketplace and GitHub README.
- Improved Marketplace publish resilience by skipping duplicate-version publish failures in CI.
- Added multilingual GitHub project docs with English as default and Chinese/Japanese alternatives.

## 1.0.5

- Switched extension display name to `HearthCode` so VS Code and Marketplace branding stay consistent.
- Corrected install/publish references to the current Marketplace identifier `hearth-code.hearth-theme`.
- Updated release consistency audit to derive Marketplace URL from `publisher + name`, preventing future link drift.

## 1.0.4

- Rebranded extension identity to HearthCode while continuing the existing Marketplace item id `hearth-code.hearth-theme`.
- Fixed Marketplace overview screenshots by switching extension README image links to stable absolute URLs.
- Aligned website install CTA with the VS Marketplace listing URL.
- Unified release history source so `/docs` now reflects `extension/CHANGELOG.md` for version parity.

## 1.0.3

- Added new Hearth brand icon with higher-resolution Marketplace asset.
- Added gallery screenshots (dark, light, long-session comfort preview).
- Refreshed extension README presentation and design-language notes.

## 1.0.2

- Bumped extension patch version for Marketplace republish
- Kept dark/light Hearth palette synchronization updates

## 1.0.1

- Refined color saturation for better eye comfort
- Updated warm-toned palette

## 1.0.0

- Initial release
- Hearth Dark and Hearth Light variants
- Optimized for TypeScript, Python, Go, HTML/CSS
- WCAG AA/AAA contrast
- Semantic highlighting support
