# HearthCode

[English](./README.md) | [简体中文](./README.zh-CN.md) | [日本語](./README.ja.md)

[![VS Code Marketplace Version](https://vsmarketplacebadges.dev/version/hearth-code.hearth-theme.svg)](https://marketplace.visualstudio.com/items?itemName=hearth-code.hearth-theme)
[![VS Code Marketplace Installs](https://vsmarketplacebadges.dev/installs/hearth-code.hearth-theme.svg)](https://marketplace.visualstudio.com/items?itemName=hearth-code.hearth-theme)
[![Open VSX Downloads](https://img.shields.io/open-vsx/dt/hearth-code/hearth-theme)](https://open-vsx.org/extension/hearth-code/hearth-theme)
[![Preview in vscode.dev](https://img.shields.io/badge/preview%20in-vscode.dev-blue)](https://vscode.dev/theme/hearth-code.hearth-theme/Hearth%20Dark)

HearthCode はコードUI向けの暖色・低グレアなカラー言語です。  
現在は Open VSX 互換エディタ、VS Code、Obsidian で利用でき、4つのバリアントでセマンティクス階層を一貫して維持します。

![HearthCode Long-session Preview](./extension/images/preview-contrast-v2.png)

## HearthCode の価値

- 暖色と抑えた彩度で、長時間作業時のグレア刺激を軽減
- 4バリアントでセマンティクス役割を統一し、ダーク/ライト切替時の再学習を削減
- コントラスト、階層、質感をひとつの体系として調整

## クイックスタート

1. Open VSX 互換エディタ: <https://open-vsx.org/extension/hearth-code/hearth-theme>
2. VS Code Marketplace: <https://marketplace.visualstudio.com/items?itemName=hearth-code.hearth-theme>
3. VS Code Quick Open: `ext install hearth-code.hearth-theme`
4. Obsidian テーマ: <https://github.com/hearth-code/HearthTheme/releases>

## 実装ステータス

| Surface | Status | Notes |
| --- | --- | --- |
| Open VSX エコシステム | Available | Open VSX 互換エディタ向けの主要チャネル |
| VS Code Marketplace | Available | VS Code 向け公式配布 |
| Obsidian テーマ | Available | GitHub Releases から導入可能 |
| コミュニティテーマディレクトリ | In review flow | 提出フローを進行中 |
| 他エディタ展開 | Planned | 次フェーズの拡張対象 |

## バリアント

### Hearth Dark（デフォルト）

日常利用向け。暖かいコントラストと明快な階層。

![Hearth Dark](./extension/images/preview-dark.png)

### Hearth Dark Soft

夜間や暗い環境でのコントラスト負荷を抑えるモード。

![Hearth Dark Soft](./extension/images/preview-dark-soft.png)

### Hearth Light

紙のようなライトモード。日中作業やドキュメント読解向け。

![Hearth Light](./extension/images/preview-light.png)

### Hearth Light Soft

より柔らかなライトコントラストで、長時間の日中作業に適したモード。

![Hearth Light Soft](./extension/images/preview-light-soft.png)

## リンク

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

## メンテナー向け

主要ディレクトリ: `themes/`, `extension/`, `obsidian/`, `src/`, `scripts/`。

カラー言語参照ファイル:

- 仕様: `docs/color-language-spec.md`
- レポート（閲覧用）: `docs/color-language-report.md`
- レポート（機械読取用）: `reports/color-language-consistency.json`

リリース版番号の単一ソース:

- 正式な版番号ファイル: `releases/color-language.json`
- 推奨 bump コマンド: `pnpm run bump:release:patch`（`minor` / `major` も対応）
- このコマンドは `releases/color-language.json` と `extension/package.json` を同期更新し、changelog の新見出しを保証します。

Obsidian App Theme リリース:

1. `pnpm run release:obsidian` を実行
2. 出力先: `release/obsidian/hearth-obsidian-app-theme-v<version>.zip`

任意: snippets 専用バンドル:

1. `pnpm run pack:obsidian:snippets` を実行
2. 出力先: `release/obsidian/hearth-obsidian-snippets-v<version>.zip`

CI 自動化メモ:

- `main` への push でリリース version/changelog が更新された場合、`.github/workflows/publish.yml` が対応する GitHub Release tag へ Obsidian の2つの zip アセットを自動アップロードします。

Obsidian コミュニティディレクトリ元データ: <https://github.com/obsidianmd/obsidian-releases/blob/master/community-css-themes.json>
