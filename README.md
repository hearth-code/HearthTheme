# HearthCode

[English](./README.md) | [Chinese (Simplified)](./README.zh-CN.md) | [Japanese](./README.ja.md)

[![VS Code Marketplace Version](https://vsmarketplacebadges.dev/version/hearth-code.hearth-theme.svg)](https://marketplace.visualstudio.com/items?itemName=hearth-code.hearth-theme)
[![VS Code Marketplace Installs](https://vsmarketplacebadges.dev/installs/hearth-code.hearth-theme.svg)](https://marketplace.visualstudio.com/items?itemName=hearth-code.hearth-theme)
[![Open VSX Downloads](https://img.shields.io/open-vsx/dt/hearth-code/hearth-theme)](https://open-vsx.org/extension/hearth-code/hearth-theme)
[![Preview in vscode.dev](https://img.shields.io/badge/preview%20in-vscode.dev-blue)](https://vscode.dev/theme/hearth-code.hearth-theme/Hearth%20Dark)

HearthCode is a warm, low-glare color language for code interfaces.
It is available on Open VSX-compatible editors, VS Code, and Obsidian, with one consistent semantic hierarchy across four tuned variants.

![HearthCode Long-session Preview](./extension/images/preview-contrast-v2.png)

## Why HearthCode

- Warm palette with controlled saturation to reduce glare in long sessions
- Stable semantic token roles across variants, so dark/light switching stays predictable
- Contrast and hierarchy tuned as one system, not isolated single themes

## Quick Start

1. Open VSX-compatible editors: <https://open-vsx.org/extension/hearth-code/hearth-theme>
2. VS Code Marketplace: <https://marketplace.visualstudio.com/items?itemName=hearth-code.hearth-theme>
3. VS Code Quick Open: `ext install hearth-code.hearth-theme`
4. Obsidian Theme: <https://github.com/hearth-code/HearthTheme/releases>

## Implementation Status

| Surface | Status | Notes |
| --- | --- | --- |
| Open VSX ecosystem | Available | Primary cross-editor channel for Open VSX-compatible editors |
| VS Code Marketplace | Available | Official VS Code distribution |
| Obsidian Theme | Available | Install from GitHub Releases |
| Community theme directory | In review flow | Submission is in progress |
| More editor targets | Planned | Next expansion stage |

## Variants

### Hearth Dark (default)

Balanced warm contrast for daily coding.

![Hearth Dark](./extension/images/preview-dark.png)

### Hearth Dark Soft

Lower contrast pressure for late-night or dim-room sessions.

![Hearth Dark Soft](./extension/images/preview-dark-soft.png)

### Hearth Light

Paper-toned light mode for daylight work and docs-heavy tasks.

![Hearth Light](./extension/images/preview-light.png)

### Hearth Light Soft

Softer light contrast for long daytime sessions and reduced visual pressure.

![Hearth Light Soft](./extension/images/preview-light-soft.png)

## Links

- Website: <https://theme.hearthcode.dev>
- Docs (EN): <https://theme.hearthcode.dev/docs>
- Docs (ZH): <https://theme.hearthcode.dev/zh/docs>
- Docs (JA): <https://theme.hearthcode.dev/ja/docs>
- Open VSX: <https://open-vsx.org/extension/hearth-code/hearth-theme>
- VS Code Marketplace: <https://marketplace.visualstudio.com/items?itemName=hearth-code.hearth-theme>
- Obsidian Releases: <https://github.com/hearth-code/HearthTheme/releases>
- Source: <https://github.com/hearth-code/HearthTheme>
- Changelog: <https://github.com/hearth-code/HearthTheme/blob/main/extension/CHANGELOG.md>
- Issues: <https://github.com/hearth-code/HearthTheme/issues>

## Maintainer Notes

Core source locations: `themes/`, `extension/`, `obsidian/`, `src/`, and `scripts/`.

Color-language references:

- Spec: `docs/color-language-spec.md`
- Generated report (human-readable): `docs/color-language-report.md`
- Generated report (machine-readable): `reports/color-language-consistency.json`

Release version source-of-truth:

- Canonical version file: `releases/color-language.json`
- Recommended bump command: `pnpm run bump:release:patch` (also supports `minor` / `major`)
- This command updates `releases/color-language.json`, `extension/package.json`, and ensures a new changelog heading.

Obsidian app-theme release:

1. Run `pnpm run release:obsidian`
2. Package output: `release/obsidian/hearth-obsidian-app-theme-v<version>.zip`

Optional snippet-only bundle:

1. Run `pnpm run pack:obsidian:snippets`
2. Package output: `release/obsidian/hearth-obsidian-snippets-v<version>.zip`

CI automation note:

- On `main` push with release version/changelog update, `.github/workflows/publish.yml` automatically packs and uploads both Obsidian zip assets to the matching GitHub Release tag.

Community directory source: <https://github.com/obsidianmd/obsidian-releases/blob/master/community-css-themes.json>
