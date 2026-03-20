# HearthCode

[English](./README.md) | [简体中文](./README.zh-CN.md) | [日本語](./README.ja.md)

[![VS Code Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/hearth-code.hearth-theme)](https://marketplace.visualstudio.com/items?itemName=hearth-code.hearth-theme)
[![VS Code Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/hearth-code.hearth-theme)](https://marketplace.visualstudio.com/items?itemName=hearth-code.hearth-theme)
[![Open VSX Downloads](https://img.shields.io/open-vsx/dt/hearth-code/hearth-theme)](https://open-vsx.org/extension/hearth-code/hearth-theme)
[![Preview in vscode.dev](https://img.shields.io/badge/preview%20in-vscode.dev-blue)](https://vscode.dev/theme/hearth-code.hearth-theme/Hearth%20Dark)

HearthCode は、長時間コーディング向けに設計した暖色・低グレアの VS Code テーマセットです。
`Hearth Dark`、`Hearth Dark Soft`、`Hearth Light`、`Hearth Light Soft` でセマンティクスの階層を保ち、環境変更時の視覚的な再学習を減らします。

![HearthCode Long-session Preview](./extension/images/preview-contrast.png)

## インストール

- VS Code Marketplace: <https://marketplace.visualstudio.com/items?itemName=hearth-code.hearth-theme>
- Open VSX: <https://open-vsx.org/extension/hearth-code/hearth-theme>
- VS Code Quick Open: `ext install hearth-code.hearth-theme`

## HearthCode が選ばれる理由

- 暖色系かつ抑えた彩度で強いグレアを軽減
- 3バリアントでセマンティックトークンの意味づけを統一
- 固定フィクスチャのスクリーンショットと自動監査で品質を維持

## テーマバリアント

### Hearth Dark（デフォルト）

日常利用の主力向け。暖かいコントラストと明快な階層。

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
- Source: <https://github.com/hearth-code/HearthTheme>
- Issues: <https://github.com/hearth-code/HearthTheme/issues>

## メンテナー向けメモ

このリポジトリは Web サイトと拡張を同一 mono-repo で管理しています。

- Website: `src/`
- Extension package: `extension/`
- Theme source of truth: `themes/`
- Automation scripts: `scripts/`

主要コマンド:

- `pnpm dev`
- `pnpm run preview:generate`
- `pnpm run audit:all`
