# HearthCode

[English](./README.md) | [简体中文](./README.zh-CN.md) | [日本語](./README.ja.md)

[![VS Code 版本](https://vsmarketplacebadges.dev/version/hearth-code.hearth-theme.svg)](https://marketplace.visualstudio.com/items?itemName=hearth-code.hearth-theme)
[![VS Code 安装量](https://vsmarketplacebadges.dev/installs/hearth-code.hearth-theme.svg)](https://marketplace.visualstudio.com/items?itemName=hearth-code.hearth-theme)
[![Open VSX 下载量](https://img.shields.io/open-vsx/dt/hearth-code/hearth-theme)](https://open-vsx.org/extension/hearth-code/hearth-theme)
[![在 theme.hearthcode.dev 开始](https://img.shields.io/badge/start%20on-theme.hearthcode.dev-8b6b4d)](https://theme.hearthcode.dev)

HearthCode 是一套面向代码界面的主题家族，核心只有两条设计方向：Ember 和 Moss。每条方向都提供 Dark 与 Light 两个版本，覆盖 VS Code、Open VSX 兼容编辑器和五种终端格式；其中 Obsidian 目前只有 Moss。

![HearthCode 主题预览](./extension/images/preview-contrast-v2.png)

## 先这样选

- `Ember`：更暖，更柔，偏余烬和纸面。
- `Moss`：更干，更清，更有结构感。
- `Dark`：适合混合光环境和长时间编码的默认起点。
- `Light`：适合白天、强光和文档偏多的工作流。

## 关于 Moss

`Moss` 的方向灵感来自 GruvDark 主题家族，主要借鉴了它的炭底纸面平衡和更清楚的分槽语法层次；但它仍然通过 HearthCode 自己的语义系统和校准规则来重新翻译，而不是做一比一复刻。

## Obsidian

HearthCode 同样是一套完整的 Obsidian 主题——把同一套色彩语言用在功能化的 Markdown 上：分类型的 callout、带删除线的已完成任务、分层的列表标记、扁平的代码与引用面，以及标签药丸，并在编辑视图与阅读视图之间保持一致。

它也接入了 Style Settings 插件：可调排版（等宽笔记、注释正体、可读行宽）、callout 强度，以及一组经对比度校验的强调色（Moss / Amber / Slate）——而这一切都不会改动经过校准的调色板。

![HearthCode for Obsidian](./docs/marketing/obsidian-hero.png)

## 安装

1. VS Code Marketplace：<https://marketplace.visualstudio.com/items?itemName=hearth-code.hearth-theme>
2. Open VSX 兼容编辑器：<https://open-vsx.org/extension/hearth-code/hearth-theme>
3. VS Code 快速安装：`ext install hearth-code.hearth-theme`
4. Obsidian：<https://community.obsidian.md/themes/hearthcode> —— 或应用内 **设置 → 外观 → 主题 → 管理**，搜索 **HearthCode**。
5. 终端：[Warp、Windows Terminal、Kitty、Alacritty 与 iTerm2 主题文件](./terminal/README.md)。建议从 `HearthCode Moss Dark` 开始。

## 当前主题

- `HearthCode Moss Dark`
- `HearthCode Moss Light`
- `HearthCode Ember Dark`
- `HearthCode Ember Light`

## Theme Forge

想换个主色？运行 **HearthCode: Open Theme Forge** 打开面板，选一个颜色，整个主题——语法**以及**编辑器外壳（状态栏、侧边栏 / 活动栏 / 标题栏，以及各表面）——会在深色 / 浅色并排预览里实时重染。**Apply** 会把结果写成 theme-scoped color customizations（即时生效、无需重载），只影响当前 HearthCode 方案的深色与浅色两个变体，另一个方案保持不动——请先切到 Moss 或 Ember 变体。**HearthCode: Reset Theme Forge** 会精确移除 Forge 写入的内容。质量由构建保证：Forge 受与官方主题同一套质量契约约束——语法通道整体旋转以保持角色分离，饱和度被限制在安全带内，外壳染色经过对比度校验以让编辑器文本维持 AA，功能色（终端、错误、git、diff）保持各自语义。

## 不想要斜体？

HearthCode 对注释、类型、装饰器使用斜体。如果你的字体斜体渲染效果不佳（CJK 字体常见伪斜体），打开 `hearthcode.disableItalics` 设置即可——扩展会关闭全部斜体规则，颜色保持不变，关掉开关即恢复。详情与手动配置方式见 [docs/disable-italics.md](./docs/disable-italics.md)。

## 链接

- 站内预览：<https://theme.hearthcode.dev>
- 在 vscode.dev 预览 Ember：<https://vscode.dev/theme/hearth-code.hearth-theme/HearthCode%20Ember%20Dark>
- 在 vscode.dev 预览 Moss：<https://vscode.dev/theme/hearth-code.hearth-theme/HearthCode%20Moss%20Dark>
- 源码仓库：<https://github.com/hearth-code/HearthTheme>
- 问题反馈：<https://github.com/hearth-code/HearthTheme/issues>
- 更新日志：<https://github.com/hearth-code/HearthTheme/blob/main/extension/CHANGELOG.md>
