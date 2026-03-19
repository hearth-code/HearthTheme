# HearthCode

HearthCode 的官网与 VS Code 主题扩展同仓库维护。

- 站点：<https://theme.hearthcode.dev>
- 扩展：<https://marketplace.visualstudio.com/items?itemName=hearth-code.hearth-theme>

## 项目定位

这是一个围绕「长时编码舒适度」的主题工程，包含两部分：

- Astro 站点：展示设计哲学、配色系统、预览与文档（含中/英/日多语言）
- VS Code 扩展：发布 `Hearth Dark`、`Hearth Dark Soft`、`Hearth Light` 三套主题

## 主题效果预览

![Hearth Dark](./extension/images/preview-dark.png)
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
├─ src/                     # 站点页面、组件、i18n、布局
├─ themes/                  # 主题源文件（单一真源）
├─ public/themes/           # 站点用主题 JSON（由脚本同步）
├─ extension/               # VS Code 扩展（package、README、CHANGELOG、images）
├─ scripts/                 # 同步、审计、发布、changelog 工具脚本
├─ fixtures/theme-audit/    # 主题回归检查样例代码
└─ docs/theme-baseline.md   # 主题治理基线文档
```

## 快速开始

```bash
pnpm install
pnpm dev
```

开发服务器默认在 `http://localhost:4321`。

## 常用命令

所有命令在仓库根目录执行：

| Command | Action |
| :-- | :-- |
| `pnpm dev` | 同步主题并启动本地开发 |
| `pnpm build` | 同步主题并构建站点到 `dist/` |
| `pnpm preview` | 预览构建结果 |
| `pnpm run sync` | 同步主题 JSON 到站点与扩展，并生成 `src/data/tokens.ts` |
| `pnpm run audit:theme` | 主题质量审计（对比度、覆盖、漂移） |
| `pnpm run audit:cjk` | CJK 排版审计（中文/日文可读性护栏） |
| `pnpm run audit:release` | 发布一致性审计（安装链接与版本同步） |
| `pnpm run audit:all` | 运行全部审计 |
| `pnpm run changelog:draft` | 生成变更草稿 |
| `pnpm run changelog:append -- vX.Y.Z` | 追加版本变更到 `extension/CHANGELOG.md` |
| `pnpm run bump:ext:patch` | 扩展补丁版本号递增（另有 `minor`/`major`） |
| `pnpm run release:theme -- vX.Y.Z` | 一键发布准备（审计 + 构建 + changelog） |
| `pnpm run pack:ext` | 打包扩展 `.vsix` |

## 主题更新流程

1. 编辑 `themes/*.json`
2. 执行 `pnpm run sync`
3. 执行 `pnpm run audit:all`
4. 执行 `pnpm run changelog:append -- vX.Y.Z`
5. 如需发布扩展，更新版本后执行 `pnpm run pack:ext` 或走 CI 发布

## 自动化发布

`/.github/workflows/publish.yml` 在 `main` 分支 push 时会执行：

1. 安装依赖并运行全部审计
2. 构建站点并部署 GitHub Pages（已启用时）
3. 检查 Marketplace 版本并按需发布扩展

如果扩展内容发生变化但版本未提升，流水线会直接失败并提示先 bump 版本。
