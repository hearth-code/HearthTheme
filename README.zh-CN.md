# HearthCode

[English](./README.md) | [简体中文](./README.zh-CN.md) | [日本語](./README.ja.md)

HearthCode 是一个单仓库项目，包含：

- 网站：<https://theme.hearthcode.dev>
- VS Code 扩展：<https://marketplace.visualstudio.com/items?itemName=hearth-code.hearth-theme>
- Open VSX 扩展：<https://open-vsx.org/extension/hearth-code/hearth-theme>

## 项目产出

- Astro 网站：展示设计哲学、配色系统、预览与文档（en/zh/ja）
- VS Code 主题扩展，包含：
  - `Hearth Dark`（默认）
  - `Hearth Dark Soft`
  - `Hearth Light`

## 预览图

![Hearth Dark](./extension/images/preview-dark.png)
![Hearth Dark Soft](./extension/images/preview-dark-soft.png)
![Hearth Light](./extension/images/preview-light.png)
![Long-session Comfort Tuning](./extension/images/preview-contrast.png)

## 技术栈

- Astro 6
- Tailwind CSS 4
- Node.js `>=22.12.0`
- pnpm

## 仓库结构

```text
.
├─ src/                   # 网站页面/组件/布局/i18n
├─ themes/                # 主题源 JSON（单一真源）
├─ public/themes/         # 同步后的站点主题 JSON
├─ extension/             # VS Code 扩展包及资源
├─ scripts/               # 同步、审计、发布、changelog 工具
├─ fixtures/              # 审计与预览固定样例
└─ docs/theme-baseline.md # 主题治理基线文档
```

## 快速开始

```bash
pnpm install
pnpm dev
```

本地开发地址：`http://localhost:4321`

## 常用命令

在仓库根目录执行：

| Command | Action |
| :-- | :-- |
| `pnpm dev` | 先同步主题，再启动本地开发 |
| `pnpm build` | 先同步主题，再构建到 `dist/` |
| `pnpm preview` | 本地预览生产构建 |
| `pnpm run sync` | 同步主题 JSON，并重建 `src/data/tokens.ts` |
| `pnpm run preview:generate` | 基于固定样例生成 Marketplace 预览图 |
| `pnpm run audit:theme` | 主题质量审计（对比度/覆盖/漂移） |
| `pnpm run audit:cjk` | 中文/日文可读性审计 |
| `pnpm run audit:release` | 发布一致性审计 |
| `pnpm run audit:all` | 运行全部审计 |
| `pnpm run changelog:draft` | 从主题变更生成草稿 |
| `pnpm run changelog:append -- vX.Y.Z` | 追加自动生成的 changelog |
| `pnpm run bump:ext:patch` | 扩展补丁版本升级（支持 `minor`/`major`） |
| `pnpm run release:theme -- vX.Y.Z` | 一键发布准备（审计 + 构建 + changelog） |
| `pnpm run pack:ext` | 打包扩展 VSIX |

## 主题更新流程

1. 修改 `themes/*.json`
2. 运行 `pnpm run sync`
3. 运行 `pnpm run preview:generate`
4. 运行 `pnpm run audit:all`
5. 运行 `pnpm run changelog:append -- vX.Y.Z`
6. 发扩展时先 bump 版本，再通过 CI 发布（或手动 `pnpm run pack:ext`）

## CI / 发布

`/.github/workflows/publish.yml` 会在 `main` 分支 push 后执行：

1. 安装依赖并执行审计
2. 构建网站（作为站点改动回归校验）
3. 检查 Marketplace 与 Open VSX 版本并按需发布扩展
4. 根据 `extension/CHANGELOG.md` 自动创建/更新 GitHub Release

如果扩展内容变更但版本未升级，CI 会阻断发布。
