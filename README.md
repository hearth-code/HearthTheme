# HearthCode

[English](./README.md) | [Chinese (Simplified)](./README.zh-CN.md) | [Japanese](./README.ja.md)

[![Open VSX Downloads](https://img.shields.io/open-vsx/dt/hearth-code/hearth-theme)](https://open-vsx.org/extension/hearth-code/hearth-theme)
[![VS Code Marketplace Installs](https://vsmarketplacebadges.dev/installs/hearth-code.hearth-theme.svg)](https://marketplace.visualstudio.com/items?itemName=hearth-code.hearth-theme)
[![VS Code Marketplace Version](https://vsmarketplacebadges.dev/version/hearth-code.hearth-theme.svg)](https://marketplace.visualstudio.com/items?itemName=hearth-code.hearth-theme)
[![Start on theme.hearthcode.dev](https://img.shields.io/badge/start%20on-theme.hearthcode.dev-8b6b4d)](https://theme.hearthcode.dev)

HearthCode is a theme family for code interfaces with two design directions: Ember and Moss. Each direction ships Dark and Light for VS Code, Open VSX-compatible editors, and five terminal formats; Moss is also available for Obsidian.

![HearthCode Theme Preview](./extension/images/preview-contrast-v2.png)

## Start Here

- `Ember`: warm paper, softer warmth, ember-led hierarchy.
- `Moss`: drier paper, cleaner separation, more structural feel.
- `Dark`: balanced default for mixed light and long coding sessions.
- `Light`: bright-room and docs-heavy version.

## Note On Moss

`Moss` takes directional inspiration from the GruvDark theme family, especially its charcoal-and-paper balance and clearer split syntax lanes. It is translated through HearthCode's own semantic system and calibration rules rather than copied one-to-one.

## Obsidian

HearthCode is a first-class Obsidian theme too — the same color language applied to functional Markdown: typed callouts, task states with a struck-through done state, layered list markers, flat code and quote surfaces, and tag pills, kept consistent across edit and reading views.

It also integrates with the Style Settings plugin: tune typography (monospace notes, upright comment italics, readable line length), callout intensity, and a contrast-vetted accent (Moss / Amber / Slate) — all without touching the calibrated palette.

![HearthCode for Obsidian](./docs/marketing/obsidian-hero.png)

## Install

1. VS Code Marketplace: <https://marketplace.visualstudio.com/items?itemName=hearth-code.hearth-theme>
2. Open VSX-compatible editors: <https://open-vsx.org/extension/hearth-code/hearth-theme>
3. VS Code Quick Open: `ext install hearth-code.hearth-theme`
4. Obsidian: <https://community.obsidian.md/themes/hearthcode> — or in-app **Settings → Appearance → Themes → Manage**, then search **HearthCode**.
5. Terminal: [Warp, Windows Terminal, Kitty, Alacritty, and iTerm2 files](./terminal/README.md). Start with `HearthCode Moss Dark`.

## Shipped Themes

- `HearthCode Moss Dark`
- `HearthCode Moss Light`
- `HearthCode Ember Dark`
- `HearthCode Ember Light`

## Theme Forge

Want a different primary color? Run **HearthCode: Open Theme Forge** to open a panel, pick a color, and watch the whole theme — syntax **and** editor chrome (status bar, side/activity/title bars, and surfaces) — recolor live in a side-by-side dark/light preview. **Apply** writes the result as theme-scoped color customizations (live, no reload), painting only your active HearthCode scheme's dark and light variants and leaving the other scheme untouched — switch to a Moss or Ember variant first. **HearthCode: Reset Theme Forge** removes exactly what Forge wrote. Quality holds by construction: Forge is bound by the same quality contract as the shipped themes — the syntax lanes rotate together so role separation holds, saturation is clamped to a safe band, the chrome tint is contrast-checked so editor text stays at AA, and functional colors (terminal, errors, git, diff) keep their meaning.

## Prefer No Italics?

HearthCode styles comments, types, and decorators in italics. If your font renders italics poorly (common with CJK fonts), enable the `hearthcode.disableItalics` setting — the extension switches every italic rule off while keeping all colors intact, and undoes it when toggled back. Details and a manual alternative live in [docs/disable-italics.md](./docs/disable-italics.md).

## Links

- Site preview: <https://theme.hearthcode.dev>
- Preview Ember in vscode.dev: <https://vscode.dev/theme/hearth-code.hearth-theme/HearthCode%20Ember%20Dark>
- Preview Moss in vscode.dev: <https://vscode.dev/theme/hearth-code.hearth-theme/HearthCode%20Moss%20Dark>
- Source: <https://github.com/hearth-code/HearthTheme>
- Issues: <https://github.com/hearth-code/HearthTheme/issues>
- Changelog: <https://github.com/hearth-code/HearthTheme/blob/main/extension/CHANGELOG.md>
