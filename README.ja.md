# HearthCode

[English](./README.md) | [简体中文](./README.zh-CN.md) | [日本語](./README.ja.md)

HearthCode は以下を同一リポジトリで管理しています。

- Web サイト: <https://theme.hearthcode.dev>
- VS Code 拡張: <https://marketplace.visualstudio.com/items?itemName=hearth-code.hearth-theme>

## 提供内容

- Astro サイト: デザイン思想、配色システム、プレビュー、ドキュメント（en/zh/ja）
- VS Code テーマ拡張:
  - `Hearth Dark`（デフォルト）
  - `Hearth Dark Soft`
  - `Hearth Light`

## プレビュー

![Hearth Dark](./extension/images/preview-dark.png)
![Hearth Dark Soft](./extension/images/preview-dark-soft.png)
![Hearth Light](./extension/images/preview-light.png)
![Long-session Comfort Tuning](./extension/images/preview-contrast.png)

## 技術スタック

- Astro 6
- Tailwind CSS 4
- Node.js `>=22.12.0`
- pnpm

## リポジトリ構成

```text
.
├─ src/                   # サイトのページ/コンポーネント/レイアウト/i18n
├─ themes/                # テーマ JSON のソース（単一の真実）
├─ public/themes/         # サイト向け同期済みテーマ JSON
├─ extension/             # VS Code 拡張パッケージとアセット
├─ scripts/               # 同期・監査・リリース・changelog ツール
├─ fixtures/              # 監査とプレビュー用の固定サンプル
└─ docs/theme-baseline.md # テーマ運用の基準ドキュメント
```

## クイックスタート

```bash
pnpm install
pnpm dev
```

ローカル開発サーバー: `http://localhost:4321`

## コマンド

リポジトリのルートで実行します。

| Command | Action |
| :-- | :-- |
| `pnpm dev` | テーマ同期後に開発サーバー起動 |
| `pnpm build` | テーマ同期後に `dist/` へビルド |
| `pnpm preview` | 本番ビルドのローカル確認 |
| `pnpm run sync` | テーマ JSON 同期 + `src/data/tokens.ts` 再生成 |
| `pnpm run preview:generate` | 固定フィクスチャから Marketplace 画像を生成 |
| `pnpm run audit:theme` | テーマ品質監査（コントラスト/カバレッジ/ドリフト） |
| `pnpm run audit:cjk` | CJK 可読性監査 |
| `pnpm run audit:release` | リリース整合性監査 |
| `pnpm run audit:all` | すべての監査を実行 |
| `pnpm run changelog:draft` | テーマ差分から changelog 草案作成 |
| `pnpm run changelog:append -- vX.Y.Z` | 自動生成 changelog を追記 |
| `pnpm run bump:ext:patch` | 拡張のパッチ版を更新（`minor`/`major` も可） |
| `pnpm run release:theme -- vX.Y.Z` | リリース準備一括実行（監査 + ビルド + changelog） |
| `pnpm run pack:ext` | 拡張 VSIX をパッケージ |

## テーマ更新フロー

1. `themes/*.json` を編集
2. `pnpm run sync`
3. `pnpm run preview:generate`
4. `pnpm run audit:all`
5. `pnpm run changelog:append -- vX.Y.Z`
6. 拡張リリース時はバージョン更新後に CI で公開（または `pnpm run pack:ext`）

## CI / 公開

`/.github/workflows/publish.yml` は `main` への push で実行されます。

1. 依存関係インストールと監査実行
2. サイトビルドと（有効時）GitHub Pages へのデプロイ
3. Marketplace 版を確認し必要時に拡張公開

拡張内容が変わっているのにバージョン更新がない場合、CI は公開をブロックします。
