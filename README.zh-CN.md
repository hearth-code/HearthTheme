# HearthCode

[English](./README.md) | [简体中文](./README.zh-CN.md) | [日本語](./README.ja.md)

[![VS Code 版本](https://img.shields.io/visual-studio-marketplace/v/hearth-code.hearth-theme)](https://marketplace.visualstudio.com/items?itemName=hearth-code.hearth-theme)
[![VS Code 安装量](https://img.shields.io/visual-studio-marketplace/i/hearth-code.hearth-theme)](https://marketplace.visualstudio.com/items?itemName=hearth-code.hearth-theme)
[![Open VSX 下载量](https://img.shields.io/open-vsx/dt/hearth-code/hearth-theme)](https://open-vsx.org/extension/hearth-code/hearth-theme)
[![在 vscode.dev 预览](https://img.shields.io/badge/preview%20in-vscode.dev-blue)](https://vscode.dev/theme/hearth-code.hearth-theme/Hearth%20Dark)

HearthCode 是一套为长时编码设计的暖色、低眩光 VS Code 主题。
在 `Hearth Dark`、`Hearth Dark Soft`、`Hearth Light`、`Hearth Light Soft` 四种模式下保持稳定语义层次，减少切换环境时的视觉重适应。

![HearthCode 长时编码预览](./extension/images/preview-contrast-v2.png)

## 安装

- VS Code Marketplace：<https://marketplace.visualstudio.com/items?itemName=hearth-code.hearth-theme>
- Open VSX：<https://open-vsx.org/extension/hearth-code/hearth-theme>
- VS Code 快速安装：`ext install hearth-code.hearth-theme`

## 为什么选择 HearthCode

- 暖色与受控饱和度，减少刺眼眩光
- 四个变体共享稳定语义映射，切换模式更自然
- 固定样例截图 + 自动审计，保证版本一致性

## 主题变体

### Hearth Dark（默认）

适合日常主力开发，暖色对比与层次平衡。

![Hearth Dark](./extension/images/preview-dark.png)

### Hearth Dark Soft

适合夜间或暗光环境，降低高对比带来的视觉压力。

![Hearth Dark Soft](./extension/images/preview-dark-soft.png)

### Hearth Light

纸张感浅色模式，适合白天工作与文档阅读。

![Hearth Light](./extension/images/preview-light.png)

### Hearth Light Soft

更柔和的浅色对比，适合长时间白天编码与文档阅读。

![Hearth Light Soft](./extension/images/preview-light-soft.png)

## 链接

- 网站：<https://theme.hearthcode.dev>
- 文档（英文）：<https://theme.hearthcode.dev/docs>
- 文档（中文）：<https://theme.hearthcode.dev/zh/docs>
- 文档（日文）：<https://theme.hearthcode.dev/ja/docs>
- 源码仓库：<https://github.com/hearth-code/HearthTheme>
- 问题反馈：<https://github.com/hearth-code/HearthTheme/issues>

## 维护说明

该仓库为网站与扩展的一体化 mono-repo。

- 网站代码：`src/`
- 扩展包：`extension/`
- 主题源：`themes/`
- 自动化脚本：`scripts/`

常用命令：

- `pnpm dev`
- `pnpm run sync`
- `pnpm run check:sync`
- `pnpm run preview:generate`
- `pnpm run audit:all`
- `pnpm run build`

质量闸门：

- Git hooks（Husky）：
  - `pre-commit`：执行 `pnpm run check:sync`
  - `pre-push`：执行 `pnpm run audit:all` 与 `pnpm run build`
- CI（PR）：
  - 执行 `pnpm run check:sync`
  - 执行 `pnpm run audit:all`
  - 执行 `pnpm run build`
