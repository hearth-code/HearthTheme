# HearthCode 全面评估：可改进点、竞争力与推广方案

更新：2026-11-06
范围：`hearth-code/HearthTheme`（源码单仓）、`hearthcode-obsidian`、`hearthcode-zed` 三个仓库，以及 VS Code Marketplace、Open VSX、Zed、Obsidian 四个分发渠道和 theme.hearthcode.dev 网站的实时数据。
方法：10 个独立分析维度（主题质量、扩展工程、仓库流程、网站转化、Obsidian、Zed/终端/平台、定位文案、竞争格局、市场数据、推广策略），其中两个维度完成了独立的对抗式复核，其余维度的复核因额度中断（详见附录 B）。所有数字均来自 2026-11-05/06 抓取的公开 API 或仓库文件，可复现。

---

## 0. 一页结论

**一句话判断：产品工艺在同类里属于前列，但分发为零；现在的瓶颈不是"主题不够好"，而是"没有人知道、看到的人也没被说服"。**

三个最重要的事实：

1. **规模与速度。** 发布 232 天，VS Code Marketplace 284 次安装（每天 1.2 次），1 条评分；GitHub 2 星、0 fork。可比的 2021–2026 年新进入者（Vesper、Houston、Vitesse、Noctokai）每天 58–112 次安装，差距 50–100 倍。它们无一例外都有一个"受众引擎"：作者自带粉丝、组织品牌、Neovim 首发或社区组织。HearthCode 一个都没有。
2. **产品有真功夫，但功夫没被看见。** 校准管线、暗/亮配对、CI 对比度门禁、Theme Forge 都是真的，且 Theme Forge 在约 60 个对手里没有同类。但用户在列表页看到的是一句谜语式口号（"Warmth or structure. Meaning stays clear."）、三张生成式海报、零张真实编辑器截图，以及一条 140 字符、不含任何搜索词的描述。
3. **有几处会直接伤害口碑的硬伤需要先修。** VS Code 主题只定义 124 个工作台颜色键（One Dark Pro 233、Catppuccin 564），补全、diff、Git 行号槽、悬浮窗等整块区域回退到 VS Code 默认冷色；Obsidian 主题在 Obsidian 1.13+ 上自定义 callout 会"隐形"，社区提交的修复 PR 三个月无人回复；Marketplace 首图有可见的排版缺陷，却被标注为"真实编辑器布局"。

**是否有竞争力？** 分渠道看：
- VS Code / Cursor：**工艺有竞争力，市场表现没有**。处于"生存线"以下（Marketplace 同类 20,867 个主题，每 9 天新增约 100 个，按安装量加权的搜索让新主题对通用词几乎不可见）。
- Obsidian：**相对最好的渠道**。1,095 次下载，在 1,560 个主题中排第 557，高于同期注册主题的 p75（685），且从未做过任何宣传。
- Zed：209 次下载，304 个主题扩展中排第 269，与同季度发布的主题中位数（210）持平。
- Open VSX：27,392 次下载是**版本更新造成的虚高指标**（51 个版本 × 自动更新），不是用户数；README 徽章却把它放在最前面，是一个信誉风险。

**天花板（基于同类数据的判断，属于估计）：** 不建立受众引擎，12 个月后大概率停在 1–5k 安装（GruvDark、Modus 移植版、Kanagawa Paper 一档）；选定一个引擎坚持 12 个月，2–3 年可达 20–100k（Vesper、Houston、Noctokai 一档）。百万级在所有观察到的案例中都需要组织或既有受众。

**最值得先做的 10 件事（按影响/成本排序）：**

| # | 行动 | 工作量 | 为什么 |
| --- | --- | --- | --- |
| 1 | 换掉口号与 Marketplace 描述：改成"类别 + 好处"的直白句子，把 2–3 个高意图搜索词放进描述本身 | S | 列表页 5 秒测试目前不及格；"eye strain" 是声明的关键词却在前 100 名之外 |
| 2 | 补三张**真实编辑器截图**（React/TSX、Python、Forge 面板）作为列表前三张图 | S–M | 所有竞品首图都是真截图；HearthCode 的用户从未见过它在真实代码上的样子 |
| 3 | 修 Obsidian 1.13 callout 破损，回复社区 PR #2 和 Issue #1，发 3.7.8 | M | 这是唯一一处"用户已经在报告、而且正在变坏"的缺陷 |
| 4 | 把 VS Code 工作台颜色从 124 键扩到约 300 键（补全/悬浮/diff/Git 槽/minimap/inlay hint/peek/chat） | M | 这是对比 Top 主题时最大的产品差距，且 Theme Forge 继承同一缺口 |
| 5 | 统一所有渠道元数据：GitHub 描述与 topics（仍是 3 月的旧定位）、Zed/Obsidian 描述、社交预览图 | S | 每个"View on GitHub"点击都会落到一个讲另一款产品的页面 |
| 6 | 网站：移动端首屏先出预览再出安装；修 robots.txt/404；zh/ja 页面本地化 `<title>`；加 VS Code 主题类目词 | S | 移动端首屏没有一行代码预览；三页站点无任何长尾落地页 |
| 7 | 选定**一个**受众引擎并坚持 12 个月：Neovim 移植 + r/neovim，或 Obsidian 写作人群，或中/日文开发者社区 | L | 所有突破 50k 的同类都有一个引擎；平台数量本身不带来安装 |
| 8 | 修扩展里已确认的小 bug：斜体开关与 Forge 的覆盖顺序冲突；Forge 深链只认 `vscode://`，Cursor/Windsurf 用户点不开；vscode.dev 预览链接改用文档化路径 | S | 便宜；大部分下载来自 Cursor 等 Open VSX 编辑器 |
| 9 | 发布节奏：每月一次小版本（一个预设、一张对比图、一个变体），让"last updated"保持 30 天内 | S | 101 天没有发布，人类提交停在 8 月 16 日，外部观感是"没人维护" |
| 10 | 停掉对用户无感的内部工程投入（30 篇内部文档、重复脚本、休眠的 moss 产品骨架），把时间换给上面 9 条 | S | 97 个脚本 / 29k 行给一个 4 主题产品，边际收益已为负 |

---

## 1. 现状数据快照（2026-11-05 抓取）

### 1.1 四个渠道

| 渠道 | HearthCode | 渠道参照 | 位置判断 |
| --- | --- | --- | --- |
| VS Code Marketplace | 284 安装 / 1,631 下载 / 1 评分（5★）/ v3.7.7 / 最后更新 2026-07-27 | 主题类目 20,867 个；Top 25 均 ≥ 185 万安装；可比新进入者 Vesper 98k、Houston 94k、Vitesse 119k、Noctokai 23k | 生存线以下 |
| Open VSX | 27,392 下载 / 5★（3 评） | Everforest 18.9k、Rosé Pine 107k、Catppuccin 585k；对手 OpenVSX:Marketplace 比例通常 1:5 到 1:14，HearthCode 为 96:1 | 数字不可用于证明用户规模 |
| Zed | 209 下载 / 304 个主题中第 269 | 中位数 36,319；2026 Q3 同期发布的 74 个主题中位数 210 | 与同期持平，整体垫底 |
| Obsidian | 1,095 下载 / 1,560 个中第 557 | 中位数 429；后注册的 430 个主题 p75=685、p90=1,369；Flexoki 70k、Everforest 246k、Minimal 2.75M | 相对最好，但绝对量小 |
| GitHub | 主仓 2 星 / 0 fork；两个镜像仓 0 星；3 个未合并的 dependabot PR | 可比项目 700–20,000 星 | 无社区信号 |

安装速度：主仓 2026-03-18 首次提交以来约 **1.2 次/天**。Obsidian 镜像每日下载速度从 3.4.0 时期的 31/天降到 3.7.7 的 7.3/天。

### 1.2 Marketplace 搜索排名（HearthCode 自己声明的关键词）

| 搜索词 | HearthCode 排名 | 该词前 5 名的安装量 | 判断 |
| --- | --- | --- | --- |
| eye strain | 前 100 名之外 | 26,704 / 871 / 2,227 / 48 / 24 | 有需求、可赢，但描述里没有这个词 |
| warm theme | 35 | 2,855 / 447,868 / 1,054 / 1,240 / 863 | 可赢：前 5 里有 4 个千级安装的小主题 |
| low glare | 18 | 422 / 8 / 30 / 12 / 12 | 可赢：全是个位/百位安装 |
| paper theme | 32 | 1,962 / 8,462 / 2,007 / 481 / 343 | 可赢 |
| readable theme | 17 | 20 / 4,424 / 20,767 / 11,232 / 166 | 可赢 |
| theme customizer | 8 | 83 / 451 / 2,956 / 484 / 61 | 唯一非品牌词进前 10 |
| cjk | 27（共 27 个结果） | 全是 CJK 工具扩展 | 无搜索价值 |
| editorial theme | 1 | — | 没有人搜这个词 |
| light theme / dark theme / theme | 前 100 名之外 | 百万级主题垄断 | 放弃 |

结论：Marketplace 搜索权重最高的字段（displayName、description、前几个 tag）里**没有任何一个高意图词**；30 个关键词里 9 个是自指（hearthcode、hearth-code、ember dark…）。这是零成本就能改善的部分。

### 1.3 Open VSX 数字为什么不能用

HearthCode 发布过 51 个版本；Cursor / Windsurf / VSCodium 的自动更新每次都会计入一次下载（平均每版本 537 次）。所有对手的 Open VSX 下载都远**少于** Marketplace 安装（One Dark Pro 1.06M vs 12.9M；Everforest 18.9k vs 135k），只有 HearthCode 反过来相差两个数量级。真实用户数更可能在数百量级。建议把 Open VSX 徽章移到页面下方，改按"每版本下载"追踪。

---

## 2. 竞争力评估

### 2.1 可比对手矩阵（暖色 / 纸感 / 低眩光细分 + 定制器 + 多平台品牌）

| 主题 | VS Code 安装 | GitHub 星 | 平台 | 变体 | 亮色 | 定制 | 增长引擎 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **HearthCode** | 284 | 2 | VS Code、Open VSX、Zed、Obsidian（仅 Moss）、5 种终端；无 Neovim | 4 | 有，约束求解的配对 | Theme Forge（独有）、斜体开关、Obsidian Style Settings | 无 |
| Flexoki（kepano） | 26k（第三方移植） | 3,739 | README 列 52 个移植，Ghostty 内置 | 亮+暗 | 亮色优先 | 调色板库，无编辑器定制器 | 作者是 Obsidian CEO；被 Minimal 主题内置 |
| Gruvbox Material | 337k | 2,660 | Neovim 首发，VS Code 仓已于 2026-01 归档 | 3 调色板 × 硬/中/软 × 暗/亮 | 有 | 调色板/对比度/工作台风格/斜体设置 | Neovim 首发 |
| Everforest | 135k | 4,273 | Neovim 首发，VS Code 仓 2026-01 归档 | 硬/中/软 × 暗/亮 = 6 | 有 | 对比度档位 | Neovim 首发 |
| Rosé Pine | 349k | 1,633 | 200+ 移植、模板仓 + 自动目录 | 3 | 有（Dawn） | 无 | 社区组织 |
| Kanagawa | 288k（被弃更的移植仍领先） | 6,448 | Neovim 首发 | wave/dragon/lotus | 有 | nvim 覆盖函数 | Neovim 首发 + 强叙事 |
| Catppuccin | 1.48M | 19,917 | 约 457 个移植条目 | 4 口味 × 14 强调色 | 有（Latte） | 强调色、UI 覆盖、工作台模式、括号模式、斜体开关 | 社区组织 + Discord 5.2k |
| Night Owl | 3.6M | 2,957 | VS Code 首发 | 2 + 无斜体版 | 有 | 无 | 作者粉丝（Sarah Drasner） |
| Modus（Emacs 原版 / VS Code 移植） | 1,452 | 918 | Emacs 首发 | 8（含色盲变体） | 亮色优先 | Emacs 内丰富 | 可访问性口碑，Zed 移植 83k |
| Vitesse | 119k | 701 | VS Code | 5 | 有 | 无 | 作者粉丝（Anthony Fu） |
| Vesper | 98k | 788 | VS Code | 1（仅暗） | 无 | 无 | 作者粉丝（Rauno） |
| Houston | 94k | 152 | VS Code | 1（仅暗，WIP） | 无 | 无 | Astro 组织品牌 |
| GruvDark（Moss 的灵感来源） | 3,400 | 10 | VS Code | 4 + 亮色 | 有 | 无 | 无 |
| Noctokai（2026 新进入者） | 23k | — | VS Code | 1 | 无 | 无 | 借 Monokai/Dracula 熟悉度 + "护眼"框架 |
| Nushu | 33k | — | VS Code | 2 | 有 | 无 | 无（文案直接写"Warm, low-contrast light and dark"） |

### 2.2 HearthCode 真正的差异点、平手与落后

**真正独有（经核对约 60 个对手）**
- **Theme Forge**：从一个种子色重建整套主题（含编辑器 UI），暗/亮同时生成，带质量门禁、可应用/可恢复、可分享链接、`vscode://` 深链。最接近的是 Catppuccin 的 accent/UI 覆盖设置、Monokai Pro 的固定滤镜、Zed 内置的 Theme Builder、themer.dev。但要注意：没有任何数据表明用户在搜索这种能力，"theme customizer" 类目很小，Zed 已把它做成平台功能。它是**证据**，不是**钩子**。
- **校准的实质**：联合求解 + 逐对 ΔE 下限 + CI 门禁，比绝大多数对手扎实。但在用户看到的表面上只是一句话，而 Dracula、Kanagawa 有 WCAG AA 徽章，Modus 有 AAA，Flexoki 2.0 讲 Oklab。实质领先、可见度平手。
- **en/zh/ja 三语网站与 README**：暖色细分里没有对手做本地化。但尚未在任何中/日文社区出现过。

**平手（不是卖点）**
- 暗/亮配对：Night Owl/Light Owl、Vitesse、Rosé Pine Dawn、Catppuccin Latte、Everforest、Flexoki、Kanagawa Lotus、Modus 等都有。HearthCode 的优势是亮色配对的质量（约束求解），这需要用一个数字去证明，而不是宣称。
- 多口味家族：Ember/Moss 两个方向在同类里偏小（Catppuccin 4×14、Nightfox 7、Noctis 11、Everforest 3×2）。暖色细分的惯例是"硬/中/软"对比度档位，HearthCode 没有。
- 关闭斜体 / CJK：机制上 One Dark Pro、Night Owl、Catppuccin、Gruvbox Material 都有同类开关；差异只在"为 CJK 字体解释原因"和本地化，而 `cjk` 这个词没有搜索价值。

**落后**
- 工作台颜色覆盖面（124 键 vs 233 / 564）。
- 没有 Neovim 移植：暖色细分的头部（Gruvbox Material、Everforest、Kanagawa、Tokyo Night）全部是 Neovim 首发或靠 Neovim 社区传播。
- 没有真实截图、没有社区、没有评分、没有发布节奏。

### 2.3 "有没有竞争力"的量化口径

| 渠道 | 生存线 | 细分成功 | 主流 | HearthCode 今天 |
| --- | --- | --- | --- | --- |
| VS Code Marketplace | 1–5k 安装、≥ 10 条评分 | 20–100k、≥ 50 评分 | 1M+ | 284 / 1 |
| Zed | 同期中位数（约 200）以上 | 10k+（同期 74 个主题里有 21 个做到） | 100k+ | 209 |
| Obsidian | 中位数 429 以上 | 10–70k（Kanagawa 27k、Flexoki 70k） | 300k+ | 1,095 |
| GitHub | 50 星 | 500–1,000 星 | 5,000+ | 2 |

### 2.4 机会窗口与威胁

**机会**
- 暖色 / 护眼细分的两个最大 VS Code 主题（Gruvbox Material、Everforest 的 VS Code 仓）已在 2026-01 归档，约 47 万安装的用户停在不再维护的扩展上；Flexoki 在 VS Code 上没有官方扩展，只有冻结的第三方移植。一个**持续维护**的暖色/纸感家族可以明确面向"从 X 迁移"的用户。
- Obsidian 是纸感审美的主场（Minimal 2.75M、Flexoki 70k），而 HearthCode 在这里的相对排名最好，却只上架了 Moss、没做过一次宣传。
- Cursor / Windsurf 只从 Open VSX 拉取扩展，HearthCode 已在 Open VSX 上有 5★ 评分和认证发布者。

**威胁**
- 类目饱和：主题扩展 20,867 个，每 9 天新增约 100 个；按安装量加权的搜索使新进入者对通用词不可见。
- 平台默认值与内置能力：Zed 自带 One Dark 和 Theme Builder；Cursor 自家暗/亮主题；VS Code Dark Modern。
- AI 生成主题正在商品化"经过对比度检查"的主题；校准管线是内容资产，不是护城河。
- 命名空间被蚕食：2026 年 8–11 月出现了 "Hearth"、"Hearth Ember"、"Pumpkin Hearth"、"Moss and Ember" 等主题；搜索 "hearth" 时一个 83 次安装的同名主题排在 HearthCode 前面。
- 单人维护：人类提交停在 2026-08-16。sainnhe 归档两个头部主题说明细分领导者可以很快沉寂，而对现有用户几乎没有代价。

---

## 3. 可改进点（按领域）

严重度标注为复核后的结果：🔴 关键 / 🟠 高 / 🟡 中 / ⚪ 低。工作量 S（< 1 天）/ M（几天）/ L（数周）。

### 3.1 VS Code 主题本身

| 严重度 | 发现 | 证据 | 建议 | 工作量 |
| --- | --- | --- | --- | --- |
| 🟠 | **工作台只定义 124 个颜色键，整块现代界面没被主题化** | 4 个主题文件各 124 colors / 25 tokenColors 规则 / 20 semanticTokenColors；One Dark Pro 233 / 275；Catppuccin Mocha 564 / 197。前缀计数（Hearth/OneDark/Catppuccin）：diffEditor 0/1/6、editorSuggestWidget 0/3/5、editorHoverWidget 0/3/3、editorGutter 0/3/7、peekView 0/5/14、minimap 0/4/12、editorInlayHint 0/2/6、editorStickyScroll 0/5/1、scmGraph 0/13/8、chat 0/14/0、breadcrumb 0/0/5、textLink 0/1/2、debug 0/1/28。两个对手都定义而 HearthCode 缺失的键有 58 个。键数自 v1.0.8（122）以来几乎没变；`forge.js:40` 原样复制 colors，所以 Forge 继承同一缺口 | 在 `color-system/framework/vscode-chrome-contract.json` 里从已有抽象表面派生缺失家族（弹窗 = 侧栏表面 + 边框；diff/Git 槽/scmGraph 用已有终端/Git 色相；inlay hint = 注释墨色叠行高亮），目标约 300 键；在 `theme-audit.mjs` 加覆盖率门禁。优先级：editorWidget/Hover/Suggest → diffEditor → editorGutter → minimap → inlayHint → stickyScroll → peekView → scmGraph → textLink/breadcrumb → quickInput → chat/inlineChat | M |
| 🟡 | **亮色主题语法色 3.0–4.4:1，与笼统的 "WCAG AA" 宣称不符** | `tuning.json` 亮色下限 3.2–3.4，由 `tests/light-syntax-clarity.test.mjs` 强制；GitHub 描述、v1.0.0 changelog 写 "WCAG AA contrast"。复核：同一指标下 Catppuccin Latte 更低（字符串 2.96、数字 2.64），HearthCode 亮色属于同类偏上 | 改宣称而不是改调色：写成"UI 文本 WCAG AA，语法色保持可分辨"。若以后加 hard 对比度档位，再宣传"每个语法角色 ≥ AA" | S |
| 🟡 | **终端 ANSI 色：亮色低于 AA，暗色 ansiBlack 不可见** | Moss Light 普通色 3.23–3.81:1、亮色组 2.70–2.98:1；暗色 ansiBlack 对背景 1.03 / 1.20。复核：VS Code 集成终端默认 `minimumContrastRatio = 4.5` 会自动纠正，真正受影响的是 5 种终端导出和 Zed，它们用同样的十六进制值且无门禁 | 加终端门禁（7 个彩色 + bright ≥ 4.5:1，ansiBlack ≥ 1.5:1 或改用面板表面色）；Moss Light 四个彩色压暗约 10–15% L | S |
| ⚪ | 次级 UI 文本（占位符、非活动 tab/标题、活动栏图标）1.75–4.2:1，门禁只覆盖强调色填充 | 复核：与 Catppuccin、One Dark Pro 同档或更好，弱化文本低于 AA 是行业常态 | 只需提亮 Ember Light 的 muted ink（#a99f91，1.75–1.82:1） | S |
| 🟡 | TextMate 规则偏薄：JS/TS 的 `new`/`typeof`/`instanceof` 渲染成灰色运算符，字符串转义不区分，`this`/`self` 无色；Markdown/YAML/HTML/Shell/SQL/TOML/diff 没有语义层兜底 | 25 规则 / 71 作用域 | 增加约 30 条规则（keyword.operator.new → keyword 道；constant.character.escape → 常量道；variable.language → 只读道；markup.inserted/deleted/changed → Git 装饰色…） | M |
| 🟡 | 变体结构（4 主题 + 1 开关）比所有头部主题都薄 | Catppuccin 4 口味 + 10 项设置；Gruvbox Material/Everforest 软/中/硬 + 平面/高对比工作台；Rosé Pine 有显式无斜体变体 | 先加一个轴并以设置形式发布：`hearthcode.contrast: soft|medium|hard`（hard = 全 AA，顺带解决上面的 AA 问题）；其次 `hearthcode.workbench: default|flat|bordered` | L |
| ⚪ | 亮色主题选区与行号偏淡 | 亮色选区 alpha 13–15%（混合后 1.15:1，Latte 1.38），亮色行号 1.82–1.99:1（Latte 2.83）。暗色在同类范围内 | 亮色选区 alpha 提到约 25%，亮色行号 ≥ 2.8:1 | S |
| 🟠 | Marketplace 首图有可见的空格缺陷，且被标注为"真实编辑器布局" | 生成图渲染出 `type ThemePreview=  {`、`"ember"|  "moss"`；原因是 `scripts/marketing/template-components.mjs:420` 逐段输出 `<text>` 且未设 `xml:space="preserve"`；README 第 5 行的 alt 写 "shown in a real editor layout"，但它是合成海报 | 修 SVG 文本构建（xml:space="preserve" 或合并 tspan）；每个方向至少一张真实 VS Code 截图 | S |
| ⚪ | 斜体/粗体策略全有全无；括号配对样式基础 | 单个全局开关 | 拆成 italicComments / italicTypes / boldKeywords，并在主题选择器里注册 "(no italics)" 标签 | S |
| ⚪ | README/Forge 文案承诺了主题没定义的表面（"keeps the meaning of terminal, error, Git, and diff colors"、"AA-checked chrome"） | diff 与大部分 chrome 键不在主题里 | 先补键，或把措辞收窄为"terminal、error、Git decoration" | S |

**值得写进宣传的真实优点：** 4 个主题结构完全一致，发布包与源码字节级一致（本地 vsce 打包与 Marketplace 3.7.7 逐文件相同）；编辑器正文对比度 9.4–11.3:1，选区/查找高亮上文字 ≥ 6.6:1，按钮/徽章/状态栏 ≥ 4.55:1；语义 token 层 20 键且与 TextMate 颜色一致（One Dark Pro 只有 10 键）；function/method、property/variable 刻意分道并有 ΔE 门禁。

### 3.2 VS Code 扩展工程（含 Theme Forge）

整体评价：**明显高于主题扩展的平均水平**。Forge 在 require 和 activate 两层都有 try/catch 隔离，主题永远不依赖它；设置写入是合并而非覆盖、只删自己的键；webview 用 nonce + blob 的严格 CSP、无远程加载；实测激活成本约 1 ms require + 0.1 ms activate，斜体开关关闭时零设置 I/O；34 个单元测试通过。以下是复核确认的问题：

| 严重度 | 发现 | 建议 | 工作量 |
| --- | --- | --- | --- |
| 🟡 | **先开 `disableItalics` 再点 Forge Apply，斜体会悄悄回来**：VS Code 按设置键顺序拼接主题作用域的 textMateRules，后者覆盖前者；复核发现反向顺序还会丢掉 Forge 的语义 token 颜色 | applyForgeOverride 在 disableItalics 开启时剥离生成规则里的 italic；或在同一次 update 里删除并重新追加斜体键使其保持在最后；加回放测试 | S |
| ⚪ | **`browser` 入口指向未打包的 CommonJS 文件，vscode.dev / github.dev 下 Forge 不可用（主题本身正常）**：web 扩展宿主无法 `require('./forge')`，命令和 URI handler 声明了却从未注册，而列表标注为 web 扩展 | 在 `generate-forge-webview.mjs` 里加第三个 rollup 产物（extension.js + forge.js → `extension/dist/web.js`），Forge 运行时已经不依赖 fs | M |
| ⚪ | VSIX 73% 的字节是运行时根本不用的 README PNG（533 KB，其中图片 392 KB；去掉后约 140 KB） | `.vscodeignore` 加 `images/**`（保留 icon.png）；worker 用 terser 压缩 | S |
| ⚪ | 高对比度用户拿到错误的 Forge 变体：ColorThemeKind 3（HC Dark）被当作 Light，4（HC Light）被当作 Dark | 用 `kind === Light || kind === HighContrastLight` 判断；补 kind 3/4 测试 | S |
| ⚪ | Forge 状态不参与 Settings Sync，卸载不清理：约 25 KB 生成设置会同步到其他机器，但恢复点在未同步的 globalState；卸载后所有 HearthCode 块残留 | `setKeysForSync([FORGE_STATE_KEY])`；加 "HearthCode: Remove all HearthCode settings" 命令；README 加卸载提示 | S |
| 🟡 | 深链只支持 `vscode://`，而大部分下载来自 Open VSX 编辑器：Cursor/Windsurf/VSCodium 各有自己的 URI scheme | 网站 CTA 加编辑器选择（记在 localStorage）+ "复制种子色" 兜底；扩展侧用 `vscode.env.uriScheme` | M |
| ⚪ | 只要颜色的用户没有"零代码"说明 | 保持单扩展；在列表写明"主题是纯 JSON；宿主代码约 27 KB，启动后 1 ms 激活，无网络请求，不开开关不写任何设置" | S |
| ⚪ | 宿主消息处理有小的校验空隙（省略字段可绕过质量门禁、URI handler 不检查 path、并发 apply 不串行） | webview 发送 `transformed` 标记并要求 `quality.verified === true`；检查 `uri.path === '/forge'`；串行化 apply | S |
| ⚪ | Profile/工作区作用域可能让覆盖"失效"或残留 | 激活时若开关关闭且块与生成版本字节一致则清理；Apply 检测到工作区级 colorTheme 时写工作区 | S |
| ⚪ | webview 每次打开内联约 0.4 MB JS，worker 未压缩 | terser；`retainContextWhenHidden: false` + getState/setState | S |
| ⚪ | vscode.dev 预览链接用的是 `/theme/` 旧路径，官方文档是 `/editor/theme/<id>/<name>` | 全部改为 `/editor/theme/`，并在浏览器里验证（这是唯一的零安装试用路径） | S |
| ⚪ | 3.7.5 和 3.7.6 两个版本从未发布到任何商店，但 Changelog 标签页写着它们 | 查 publish.yml 对应运行；把未发布条目并入下一个版本 | S |
| ⚪ | 没有任何在真实 VS Code 宿主里跑的集成测试，而上面三个确认的 bug 正好都在宿主层 | 一个 `@vscode/test-electron` 套件 + 一个 `@vscode/test-web` 运行 | M |

### 3.3 Obsidian 主题

整体评价：**CSS 卫生好于类目头部**（48.6 KB、192 条规则、0 个 `!important`、0 个硬编码颜色、99 个 Obsidian 变量 + 57 个自有变量），有真正的"功能性 Markdown"层（callout 分型、任务态、分层列表标记），分发流水线自动化且接线正确；在零宣传下跑赢了同期注册的主题。但产品上有一个正在变坏的硬伤和一组"没人在家"的信号：

| 严重度 | 发现 | 证据 | 建议 | 工作量 |
| --- | --- | --- | --- | --- |
| 🔴 | **callout 使用 1.13 之前的 RGB 三元组约定；在当前 Obsidian 上自定义 callout 会"隐形"；社区修复 PR 三个月无人回复，且该 PR 本身不完整** | theme.css 94–104、779–789 行输出裸三元组，643/646/652/656、1328–1341 行用 `rgba(var(--callout-color), …)` 包装；生成器 `generate-obsidian-themes.mjs` 359–370 行，审计脚本 `obsidian-audit.mjs` 62、217–220 行强制三元组。Chromium 测试（1.13 语义）：自定义 callout 背景 rgba(0,0,0,0)、左边框 0、标题黑色。`hearthcode-obsidian` PR #2（saberzero1，2026-08-01）0 条回复；套用其 diff 后内置 important callout 又会坏。Obsidian 1.13.7 已于 2026-08-12 前公开；Minimal 的 manifest 已要求 1.14.0 | 在源头修：12 个 `--callout-*` 改为 `rgb(r, g, b)`；`rgba(var(--callout-color), a)` 改为 `color-mix(in srgb, var(--callout-color) calc(a*100%), transparent)`；更新审计脚本的 parseRgbTripletVar；minAppVersion 设 1.13.0；加十六进制自定义 callout 的 Chromium 回归测试；发 3.7.8；在 PR #2 下回复并致谢 | M |
| 🟠 | **镜像仓看起来已弃坑**：两条社区贡献无回应、3 个月无发布、描述错误 | Issue #1（2026-07-23，Meta Bind 冲突）、PR #2 均 0 回复；仓库描述仍是旧文案；无 topics、无 homepage | 当天：回复两条线程；描述改成真实定位；加 topics（obsidian-theme、obsidian、dark-theme、light-theme）；homepage 指向网站。随 3.7.8 发布 | S |
| 🟠 | 内联代码直接在 `.markdown-rendered :not(pre) > code` 上刷颜色/背景/边框，覆盖了把内联代码渲染成按钮/输入框的插件（Meta Bind），报告者只能手改 theme.css | Issue #1 | 把内联代码样式移到 Obsidian 原生 `--code-*` 变量上，删掉元素规则（保留编辑器 `.cm-inline-code`）；把该场景加入审计；关闭 #1 | S |
| 🟠 | Obsidian 只有 Moss，而品牌和市场都在要"暖" | 用户按氛围选主题；Flexoki 70k、Minimal 2.75M 都是纸感 | 在同一个主题里加 Ember：作用域到 `body.hearthcode-direction-ember`，在 Style Settings 暴露 "Direction: Moss / Ember"（避免和已存在的 "Ember" 主题撞名）；刷新截图 | M |
| 🟡 | 零社区宣传 | 论坛 0 帖、Reddit 0 帖、Discord 0 | 3.7.8 发布后：论坛 Share & showcase 一帖（真实暗/亮截图、面向写作者的"颜色即阅读顺序"、Style Settings GIF、与 Gruvbox/Everforest 的对比）、Discord #appearance 一帖、r/ObsidianMD 一帖 | S |
| 🟡 | 列表文案第一句 "Moss turns color into reading order" 对没听过 HearthCode 的人像复制错了 | 自动摘要工具将其标记为复制粘贴错误 | 重写为"感觉 → 适合谁 → Moss 是方向名"的顺序 | S |
| 🟡 | 画廊截图是合成 SVG 图，不是运行中的 Obsidian | 512×288 的 "Functional Markdown" 示意图，没有 ribbon、tab、状态栏 | 在沙盒库里截真实截图（暗/亮、有 callout/任务/属性、文件树、tab 栏），同一组图用于镜像 README 和网站 | M |
| 🟡 | 没有扩展色、图谱、画布、属性、chrome 变量：Bases、属性图标、Kanban、画布、图谱都漏出 Obsidian 默认色 | 未设置 `--color-red/…/pink`、`--graph-*`、`--canvas-*`、`--tab-*`、`--nav-*`、`--metadata-*`、`--pdf-*` 等 | 在生成器里从已有的终端 ANSI 角色派生 8 个 `--color-*`，补 `--graph-node/--graph-line` 与 `--canvas-color-1..6`；在真实库里验证 | S |
| 🟡 | Obsidian 值得**有边界的投入**，不是押注 | 中段被有外部认知的调色板品牌占据（Gruvbox、Everforest、Tokyo Night、Kanagawa、Flexoki） | 把上述修复合成一次 3.7.8/3.8.0 发布，然后做一轮宣传；按镜像 Release 的每日资产下载追踪 60 天（基线 7.3/天），速度至少翻倍再继续投入 | — |
| ⚪ | 没有移动端、打印、reduced-motion 处理 | 0 条 `@media`、0 个 `.is-mobile` | iOS/Android 各过一遍；加 `.is-mobile` 块与简短的 `@media print` | S |
| ⚪ | 主仓每次 Release 上传 5 个无人消费的 Obsidian 资产；versions.json 回填了 30 个从未在镜像发布的版本 | Release 资产下载数全为 0 | 从主仓发布任务里去掉 Obsidian 资产上传；versions.json 从 3.1.1 起 | S |

### 3.4 网站（theme.hearthcode.dev）与转化

实测：Lighthouse 移动端首页 性能 86 / 可访问性 93 / 最佳实践 77 / SEO 92（Forge 页 94/100/77/92）；LCP 3.7 s（首页）、2.9 s（Forge）；TBT 0 ms、CLS 0；首页总传输 160.7 KB，其中 96.7 KB（60%）是 Google Fonts，阻塞渲染的字体 CSS 约占 890 ms。技术底子干净，漏斗漏在三个最关键的点：第一印象、证据、可发现性。

| 严重度 | 发现 | 建议 | 工作量 |
| --- | --- | --- | --- |
| 🟠 | **移动端首屏没有任何主题预览**：选择器胶囊在 CSS 里被排在代码样本之前（`HeroSection.astro:874-881`），手机访客先被要求在五个安装渠道里选一个，第一行带颜色的代码在约 1,000 px 之下 | ≤ 720px 时先渲染一个紧凑的 Dark|Light 样本（或直接用 `editor-moss-dark-light.png`），再放一个主 CTA，五格安装网格下移 | S |
| 🟠 | 唯一的零安装试用路径 "Try in vscode.dev" 用的是未文档化的 URL 形式（见 3.2） | 改为 `/editor/theme/…`，在真实浏览器里验证，列表页加官方 "Preview in vscode.dev" 徽章 | S |
| 🟠 | 标题、H1、正文从不出现 "VS Code theme"；zh/ja 页面沿用英文 `<title>`；无结构化数据 | 首页可索引文本里 "VS Code theme" 0 次、"warm" 1 次、"light theme" 0 次，而 "audit" 8 次、"contract" 5 次 | Title 改为 "HearthCode – Warm & Structured VS Code Themes (Dark/Light) for VS Code, Cursor, Zed and Obsidian"；每个 locale 加 site.title/site.description；加 JSON-LD | S |
| 🟠 | 信息架构只有 3 页，没有按编辑器/意图的落地页；/docs 是一个未进导航却被索引的内部基线页 | 成功的主题站靠每编辑器安装页、画廊、对比页、changelog 赢长尾 | 加 /vscode、/cursor、/zed、/obsidian（各含真实截图 + 三步安装 + 可复制命令/深链）、/changelog（从 CHANGELOG.md 渲染）、/compare | M |
| 🟡 | 全站没有一张真实编辑器截图，唯一的 `<img>` 是 favicon | 仓库已有的编辑器布局图网站却没用 | 每个方向一张标注"真实编辑器布局"的图放进 surfaces 区和移动端首屏 | S |
| 🟡 | 证据预算花在校准术语上；零社会证明；没有 star/评分请求 | 校准区展示工程指标而无用户好处，与项目自己的营销规则矛盾 | 改写为三条"开发者承诺 + 一个数字"：UI 文本全主题 AA 且每次提交复审；注释退后但不消失（≥ 3.7:1）；暗/亮切换每个颜色意义不变。把 Open VSX 5★、Marketplace 链接、GitHub star 放到可见位置 | M |
| 🟡 | 阻塞渲染的 Google Fonts 占 LCP 约 0.9 s、60% 字节 | 自托管子集化的 JetBrains Mono (400/500) 与 Noto Sans (400–700) woff2，`preload` + `font-display: swap`；CJK 字体保持远程并按 locale 加载 | S |
| 🟡 | robots.txt、sitemap.xml 和所有未知路径都返回首页 HTML 200（软 404；Lighthouse 72 个错误） | 加 `public/robots.txt`（Disallow: /go/，Sitemap 指向 sitemap-index.xml）；加 `src/pages/404.astro` | S |
| 🟡 | 分析只有页面浏览，没有 UTM、没有安装归因：维护者无法知道哪个渠道有效 | 已有 /go/<channel>/<placement> 虚拟 PV 钩子 | 换成支持事件的隐私友好工具（Plausible/Umami/Cloudflare Zaraz），19 个 CTA 变成带 channel × placement × locale 属性的事件；所有入站链接带 UTM | S |
| 🟡 | i18n 缺口：zh/ja 页面英文标题、4 个未翻译字符串（footer.tagline、issues、warnings）、日文计数与破折号 | 翻译本身质量高 | 每 locale 加 site.title/site.description；补译；日文加计数词；"——" 改 "—" | S |
| ⚪ | 可访问性小瑕疵（`<code>` 上多余 aria-label、语言 pill 的可访问名、预览槽未 aria-hidden）出现在一个宣传"对比度经审计"的页面上 | 修掉后页面可到 100，且把宣称措辞收精确 | S |
| ⚪ | Forge 页主 CTA 是 `vscode://` 深链，未安装扩展的访客点了没有任何反馈 | 首次访客改成两步卡片（先装扩展，再"在 VS Code 中打开此颜色"），或 visibilitychange/超时兜底显示安装步骤 | S |
| ⚪ | Cursor/Windsurf、Zed、Obsidian 的安装路径止步于一个商店页，没有"接下来做什么" | 每格下加两行微指南，有深链就用（`obsidian://show-theme?name=HearthCode`、`vscode:extension/hearth-code.hearth-theme`） | S |
| ⚪ | 首页代码样本里残留竞品名（`api.vesper.dev`、`VesperService`） | 立即替换 | S |

**值得保留并宣传的优点：** 桌面端的拖拽式 Dark/Light 分屏预览（7 种语言、Moss/Ember 切换、Shiki 渲染的精确主题色）；CLS 0、TBT 0、160 KB 的页面；正确的 canonical/hreflang/OG/sitemap；可复制的 `ext install` 命令；五渠道平等的安装网格；可分享的 Forge 链接与 `vscode://` 交接——这一项在所有对手的站点里都没有。

### 3.5 定位、命名与各渠道文案

文案系统的**纪律**罕见：一句口号从 `products/hearthcode/preview.json` 同步到 Marketplace、Open VSX、Zed、Obsidian、三份 README 和三语网站；平台表诚实；安装路径在首屏。问题在于系统传播的内容。

| 严重度 | 发现 | 建议 | 工作量 |
| --- | --- | --- | --- |
| 🟠 | **口号是谜语，不是价值主张**："Warmth or structure. Meaning stays clear." 既没说品类、也没说好处、也没有画面。对手的一句话都做到了（Tokyo Night "celebrates the lights of Downtown Tokyo at night"；Everforest "Comfortable & Pleasant… soft contrast for eye protection"；Nushu "Warm, low-contrast light and dark themes"） | 换成"品类 + 好处"的句子（候选见 4.1），把 "Warmth or structure…" 降级到家族海报上 | S |
| 🟠 | **没有真实截图**：列表的三张图、Zed/终端/Obsidian 的"证据图"全是生成的样板，展示的是同一个 4 行 TypeScript 对象；网站上唯一多语言样本还带着竞品名 | 用 Playwright 对已有的 vscode.dev 主题 URL 做可复现的真实截图（固定字体与窗口），作为列表前三张图 | M |
| 🟠 | **Marketplace SEO**：30 个关键词里 0 个出现在 displayName/description；描述 140 字符（Top 100 中位数 51）；9 个关键词自指 | 描述里放 2–3 个高意图词（low-glare、dark and light themes、warm、paper、theme customizer）；displayName 考虑 "HearthCode Theme – Low-Glare Dark & Light"；删掉 editorial theme、hearthcode ember、hearth-code 等 | S |
| 🟠 | **定位漂移**：4 个月内 Marketplace 描述改了 6 次，三套故事同时在讲（"eye science / WCAG AA"→"low-glare long sessions"→"warmth or structure"）；GitHub 描述还停在第一版 | 冻结一个承诺 12 个月——建议选"低眩光 / 眼睛舒服"，因为它是唯一有可测搜索需求、且与策略文档一致的故事；所有表面从同一个 headline 派生 | S |
| 🟡 | 术语密度：用户文案里 calibrated、semantic、role、lane、contract、pipeline、ΔE、chrome、material、reading rhythm 等（en.json 里 pipeline 20 次、audit 13 次、calibrated 9 次、contract 9 次） | 采用 4.1 的白话映射与四层信息结构：标题 → 一句为什么 → 可见证据 → 折叠的"它是怎么做的" | M |
| 🟡 | 命名负担：5 种品牌写法（HearthCode / Hearth Code / HearthCode Theme / HearthTheme / Hearth）、4 个 id（hearth-code.hearth-theme / hearthcode-theme / HearthCode / hearthcode-obsidian）、约 22 个概念词（direction、scheme、variant、flavor、climate、lane、role、contract、pipeline、material、Color Field Guide、polarity…） | 对外词汇只留 6 个：HearthCode、Ember、Moss、Dark、Light、Theme Forge；direction/scheme/variant/flavor/climate 统一叫 "style"；"Color Field Guide"、"color language" 不再出现在用户面前 | M |
| 🟡 | Theme Forge 是唯一独有功能、唯一进前 10 的非品牌词，却因品牌文档"不准领衔"而被埋 | 海报保持品牌优先，但 Marketplace 描述和第 3 张图直接说"选任意强调色，整个编辑器重染，仍然好读"，配 6 秒 GIF | S |
| 🟡 | 子品牌名在搜索里不属于自己：Marketplace 搜 "ember" 出来的是 JS 框架，"moss"、"hearth" 已被其他主题占用，2026-11-05 刚有人发布了名为 "Moss & Ember" 的主题 | 不要争 "ember"；让品牌词承载搜索，氛围词（warm / paper）承载描述 | S |
| 🟡 | "Why HearthCode" 三条写的是构建过程，不是读者体验；紧接着把自己锚定到一个 3,400 次安装的前辈（GruvDark） | 改写为结果："暗室里更少眩光、亮色不发白"、"函数/类型/字符串一眼可分，暗亮皆然"、"每个版本发布前都经过对比度检查（UI 文本 WCAG AA）"；GruvDark 致谢移到仓库 README/docs，列表正文末行即可 | S |
| 🟡 | 社会证明存在（Open VSX 5.0、3 条评论）但没有任何表面使用；Marketplace Q&A 被关闭 | 口号下加一行证明；征得同意引用一条真实评论；qna 设为 true 或指向 GitHub Discussions；README 末尾一句"如果有帮助，Marketplace 评分能让更多人找到它" | S |
| 🟡 | 翻译完整但继承了术语、留有英文片段、zh/ja 页面英文 `<title>` | 从新的白话英文翻译，而不是再润色现有文本；标题结构用"结构"而非"语义"；注意 README.zh-CN 的"质感 / 语义始终清晰"读起来仍像翻译腔 | S |
| 🟡 | GitHub 与镜像仓的描述/topics 仍是 2026-03 的定位 | 三个仓库描述从同一句 headline 设置；topics 加 obsidian-theme、zed-extension、cursor、open-vsx、terminal-theme、warm-theme；上传 `docs/marketing/exports/github-social.png` 作为社交预览 | S |
| ⚪ | 视觉识别：家族海报很好，但图标、"Color Field Guide" 表格、编辑器样板是三套系统；图标是 Ember 色而产品以 Moss 领衔 | 只保留撕纸家族板作为品牌构图；direction-atlas / platform-coverage / moss-surfaces 从 README 移到 docs/；图标改为方向中立或加入 Moss 绿 | M |

---

## 4. 如何宣传

### 4.1 先把"说什么"定下来（文案提案）

**信息层级（四层）**
1. 标题（品类 + 好处）
2. 一句"为什么"
3. 可见证据（真实截图 + 一个数字 + 社会证明 + 平台覆盖）
4. 折叠的"它是怎么做的"（ΔE、联合求解、48 点 Forge 扫描、CI 审计）——这是给 Hacker News 和技术博客的素材，不是给列表页的

**口号候选（英 / 中）**
- Easy on the eyes. Clear on the code. / 眼睛舒服，代码清楚。
- Warm Ember or crisp Moss. Dark and Light that match. / 暖调 Ember，清爽 Moss，深浅两版风格一致。
- Low-glare themes that stay readable — plus a customizer that keeps them that way. / 低眩光、看得清的主题，还自带不破坏可读性的调色器。

**Marketplace 描述（两句，约 230 字符）**
> Low-glare dark and light themes for long coding sessions: warm Ember or crisp, paper-toned Moss, each with a matching Dark and Light pair. The built-in Theme Forge recolors syntax and editor UI from any accent color while keeping contrast readable.

**关键词（按优先级，前 5 个最重要）**
color theme, dark theme, light theme, warm theme, low glare, eye strain, paper theme, theme customizer, readable theme, cursor theme, charcoal theme, long coding sessions

**README 开头（60 词）**
> HearthCode is a set of low-glare color themes for VS Code, Cursor, Zed, five terminals and Obsidian (Moss). Pick Ember for warm charcoal and paper, or Moss for a crisper, greener structure; each comes in matched Dark and Light. Comments step back, control flow steps forward, and Theme Forge recolors the whole editor from one accent color without losing readability.

> HearthCode 是一组低眩光的代码配色主题，覆盖 VS Code、Cursor、Zed、五种终端与 Obsidian（Moss）。想要暖调就选 Ember：暖炭底、纸色面；想要更干净的结构就选 Moss：偏绿、层次更清。每个风格都有配套的深色与浅色版。注释退后、控制流前倾，一眼看清代码结构；内置 Theme Forge 还能用你喜欢的一种强调色重染整个编辑器，而不牺牲可读性。

**列表前三张图**
1. 真实 VS Code 截图，Moss Dark，一个真实的 React/TSX 组件（hooks、JSX、import 块、一条诊断波浪线），资源管理器、Git 槽、集成终端、状态栏可见；1600×900；用 Playwright 对 vscode.dev 主题 URL 截取，保证可复现。
2. 同一文件 Ember Dark | Ember Light 并排的真实截图，只标 "Dark" / "Light"——用画面证明"配对"而不是陈述；第二种语言（Python 或 Go）证明非 TypeScript 覆盖。
3. Theme Forge 真实面板的前/后截图或 6 秒 GIF，背后是 Rust 文件，选色、Apply；标题 "Pick a color. Everything recolors. Still readable."
4. 撕纸家族板保留为品牌图；direction-atlas、platform-coverage 移到 docs/。

**白话映射（用户文案里替换）**
calibrated → tuned / measured（或删）；semantic / role → 每类代码保持自己的颜色；lane → 色系；contract → 每次发布都测试的规则；pipeline / audit → 发布前的检查；material → 质感（暖纸 vs 干纸）；chrome → 编辑器界面；direction / scheme / variant / flavor / climate → style + Dark/Light；quality gate → 可读性检查。

### 4.2 把"说给谁听"定下来：选一个受众引擎

数据里的规律很一致：每一个从零做到 5 万+ 的主题，都有一个持续 12 个月以上的单一引擎。给 HearthCode 的三个可选项（按与现有资产的匹配度）：

| 引擎 | 为什么适合 | 第一步 | 代价 |
| --- | --- | --- | --- |
| **A. Obsidian / 纸感写作人群** | 相对排名最好的渠道；纸感审美的主场；"颜色即阅读顺序"对写作者比对程序员更有说服力；Flexoki 证明了这群人会跨到代码编辑器 | 3.7.8 修复 + Ember 方向 + 真实截图 + 论坛/Discord/r/ObsidianMD 各一帖 | M |
| **B. Neovim 移植 + r/neovim / dotfyle** | 暖色细分头部全部由 Neovim 社区推起来；theme-engine 的 emitter 架构已经把"新平台 = 新 emitter"的成本压低 | 用生成器产出 lua 主题（treesitter + lualine + 常见插件高亮），发 r/neovim | L |
| **C. 中 / 日文开发者社区** | 三语站点和 README 已经付了成本，对手无人本地化；CJK 斜体问题是真实痛点；Obsidian 中日用户基数大 | 掘金 / V2EX / 少数派 / 知乎 各一篇（角度：CJK 字体与斜体、亮色主题为什么难做、Theme Forge 玩具）；Zenn / Qiita 各一篇 | M |

建议：**A + C 并行作为前 90 天的主线**（两者都主要是内容与几次发布，不需要新平台），B 作为第二季度的产品投入。不要三条都浅尝。

### 4.3 渠道与内容（按杠杆排序）

**产品内 / 零成本的分发修复（先做）**
- Marketplace / Open VSX / Zed / Obsidian 四处列表文案与首图同步替换（4.1）。
- GitHub 三个仓库的描述、topics、社交预览、pinned README 首屏与网站一致。
- 网站 SEO 基础（标题、落地页、robots、404、本地化 title）与安装归因（UTM + 事件）。
- 评分请求：README 末尾与 CHANGELOG 顶部各一句；目标 90 天内 Marketplace 评分 ≥ 10 条（1 条评分的列表在算法权重上几乎等于没有）。
- 把 Theme Forge 的可分享链接做成"病毒循环"：网站上做一个社区种子色画廊（每个种子一张 OG 图、一键 "Open in VS Code / Cursor"），预置 "Everforest-ish"、"Rosé-ish" 等命名预设，顺带成为"从 X 迁移"的入口。

**内容（HearthCode 唯一能讲、AI 生成主题讲不了的故事）**
1. 技术长文："我们如何用 ΔE 与 WCAG 校准一套代码配色"（联合求解、光学约束、48 点扫描、CI 门禁）——Hacker News Show HN / Dev.to / 掘金 / Zenn 的主稿。
2. "为什么好的亮色主题这么难做"——亮色是 HearthCode 相对对手真正下过功夫的地方。
3. 对比页："从 Gruvbox Material / Everforest / Flexoki 迁移到 HearthCode"（两个对手已归档、一个没有官方 VS Code 扩展），并排截图 + Forge 预设。
4. CJK 专题（中/日文）："CJK 字体下的斜体问题与解决"。
5. 数据故事："我们生成并审计了 1,000+ 个主题"——Forge 扫描数据天然适合。

**社区渠道（每个渠道一帖、带真实截图，不重复刷）**
- Obsidian：论坛 Share & showcase、Discord #appearance、r/ObsidianMD。
- VS Code / Cursor：r/vscode、Cursor 论坛与目录、vscodethemes.com、awesome-vscode PR。
- Zed：Zed Discord / 社区帖、zed-themes.com 提交；Zed 列表描述改为"低对比暖色暗色 + 纸感亮色，AA 校验"。
- 终端：提交到 mbadolato/iTerm2-Color-Schemes（自动导出到含 Ghostty 在内的 30+ 终端格式）、Gogh、windowsterminalthemes.dev、Warp 主题库。
- 中文：掘金、V2EX、少数派、知乎，以及 Linux.do、阮一峰周刊投稿；日文：Zenn、Qiita。
- 英文社媒：X / Bluesky 上发前后对比 GIF 与 Forge 链接；Show HN 留给技术长文。

**不要做的事**
- 付费广告；Product Hunt 在没有真实截图和 GIF 之前；同一帖多子版群发；继续新增平台数量而不建受众；继续在用户不可见的内部工具上投入。

### 4.4 90 天行动计划

| 周 | 主题 | 交付物 | 衡量 |
| --- | --- | --- | --- |
| 1–2 | 修基础 | 3.7.8：Obsidian callout 修复 + 内联代码修复 + 回复 PR/Issue；Forge 斜体 bug、HC 映射、vscode.dev 路径；工作台颜色扩到约 300 键（可拆到 3.8.0）；四处列表文案/关键词/首图替换；GitHub 元数据；网站 SEO 基础与 UTM | 所有渠道 "last updated" 在 14 天内；Lighthouse SEO 100；vscode.dev 预览可打开 |
| 3–4 | 软发布 | Obsidian 三处各一帖；Zed 与 Cursor 社区各一帖；vscodethemes.com / awesome 列表；中文两篇（掘金 + V2EX） | Obsidian 日下载 ≥ 15（基线 7.3）；Marketplace 评分 ≥ 5 条；GitHub ≥ 25 星 |
| 5–8 | 内容主攻 | 技术长文（英/中/日）+ Show HN；Forge 种子画廊上线；"从 X 迁移"对比页；Ember for Obsidian（3.8.0） | Marketplace 周安装 ≥ 50；站点到商店点击转化可归因；星 ≥ 100 |
| 9–12 | 移植与合作 | Neovim 移植 beta + r/neovim；iTerm2-Color-Schemes / Gogh 合入；Zed 描述与截图刷新；月度小版本节奏固定 | Marketplace 累计 ≥ 2,000；Obsidian ≥ 3,000；Zed ≥ 1,000；评分 ≥ 15 条 |

目标数字是基于同类速度的估计，不是承诺；关键是每两周看一次归因数据，把预算挪到有效的渠道。

---

## 5. 工程流程：哪些该保留、哪些该停

**实测（2026-11-06）**

| 闸门 | 结果 | 耗时 |
| --- | --- | --- |
| `pnpm run test` | 219 通过 / 0 失败 | 约 64 秒 |
| `pnpm run check:sync` | 通过（生成物与源码无漂移） | 约 19 秒 |
| 本地 vsce 打包 vs Marketplace 3.7.7 VSIX | 逐文件一致 | — |

**真正值得保留的资产**
- 单一源头 → 九个目标的生成体系（VS Code、Open VSX、Zed、Obsidian、5 种终端），加上漂移检查。这是"一套调色板到处用"品牌的地基，也是以后加 Neovim、Ghostty 的低成本通道。
- 对比度与角色分离门禁：CHANGELOG 3.1.1、3.1.4 记录了它们抓到的真实回归（Moss Dark 按钮 2.2:1 → 4.8:1，Obsidian 强调按钮 3.8:1 → 5.6:1）。
- 营销图的颜色保真约定（图里的颜色必须是发布主题里的精确值）。这能防止宣传图"美颜"。

**该停或该收的投入**
- 规模：顶层 `scripts/*.mjs` 约 2 万行，加上 theme-engine 1.7k、marketing 0.6k、forge-webview 0.3k；docs/ 24 篇共 5,262 行，其中 9 篇是内部交接或阶段评审（`handoff-*`、`calibration-phase5-*`、`second-flavor-*`）。对一个 4 主题、284 安装的产品，再往校准系统里加东西的边际收益已经接近零。
- 重复与休眠：`generate-theme-variants.mjs` 与 `generate-theme-variants-node.mjs` 并存；`products/hearthcode-moss`、`products/moss-local` 是未启用的拆分骨架。建议归档到 `docs/archive/` 或删除。
- 过时说明：`AGENTS.md:47` 仍写"Zed 上架前保持 channels.zed 为 false"，而 Zed 早已上架、`product.json` 中为 true。
- 发布：3.7.5、3.7.6 写进了 CHANGELOG 但从未发布到任何商店（三次发布合并在一个 PR 里，只有最后一个版本触发了发布）。建议发布流程以"打 tag 即发布"为准，CHANGELOG 只记录已发布版本。
- 依赖维护：3 个 dependabot PR（#55、#59、#60）未合并。可以开启 dependabot 自动合并补丁版本，减少"无人维护"的外观。

**外部观感**：人类提交停在 2026-08-16，最后一次发布 2026-07-27，Obsidian 镜像的两条社区贡献无回应。对一个正在决定"要不要装"的人来说，这比任何代码质量都更显眼。建议每月一次小版本，并在 48 小时内回复每一个 issue/PR，哪怕只是"收到"。

## 6. 平台空缺：Zed、终端与其他

**Zed：完成度高于 VS Code 端。** 与 Zed 自带的 One 主题相比，HearthCode 定义了 130/141 个样式键、43/46 个语法作用域、6 个协作者颜色。缺的是 `version_control.*`（7 个，影响 Git 差异显示）、`terminal.ansi.dim_*`（8 个）、`search.active_match_background`、`editor.hover_line_number`、`link_text.hover`，以及语法 `namespace`、`selector`、`diff.plus/minus`。半天就能补齐。Zed 的问题不在质量，而在列表描述（以 "Warm Ember or structured Moss" 开头，没有"舒适 / 对比度"一类的词）和截图。

**终端**：已有 Warp、Windows Terminal、Kitty、Alacritty、iTerm2。缺失但需求高的：
- **Ghostty、WezTerm**：当下增长最快的两个终端。最省力的路径是向 mbadolato/iTerm2-Color-Schemes 提交一次，它会自动导出到包括 Ghostty、WezTerm 在内的 30 多种格式。
- **CLI 工具**：bat、delta、fzf、lazygit、starship、btop。这些是 r/unixporn 和 dotfiles 作者判断"这个调色板是不是一个完整生态"的依据。
- 终端导出目前没有对比度门禁（见 3.1），提交到公共主题库前应先补上。

**编辑器与工具（按对暖色/校准品牌的价值排序）**

| 平台 | 价值 | 理由 | 工作量（基于 theme-engine 的 emitter 架构） |
| --- | --- | --- | --- |
| Neovim | 很高 | 暖色细分的头部全部由 Neovim 社区推起来；没有它，在调色板爱好者里没有可信度 | M–L（lua + treesitter + lualine + 常见插件高亮组） |
| Ghostty / WezTerm（经 iTerm2-Color-Schemes） | 高 | 一次提交覆盖 30+ 终端 | S |
| JetBrains IDE | 中高 | 大量用户，暖色主题供给少 | M |
| Shiki / highlight.js 主题 | 中 | 博客与文档站作者会用，带来反向链接；网站本身已用 Shiki | S |
| Sublime Text、Helix | 中 | 社区小但口碑传播强 | S–M |
| Slack、Discord、浏览器开发者工具 | 低 | 只增加"港口数"，不带安装 | S |

建议顺序：先 iTerm2-Color-Schemes 提交（S，覆盖面最大），再 Neovim（与 4.2 的引擎 B 对应），JetBrains 往后放。

---

## 附录 A. 方法与数据来源

- Marketplace：`extensionquery` API（安装、下载、评分、日期、27 个搜索词的前 100 名），2026-11-05。
- Open VSX：`/api/{ns}/{name}`、`/api/-/search`。
- Zed：`api.zed.dev/extensions`（`filter=theme`，304 个主题扩展）。
- Obsidian：`releases.obsidian.md/stats/theme`（1,560 个主题）与 `community-css-themes.json`。
- GitHub REST API：仓库元数据、Releases、Issues/PR。
- 网站：Lighthouse（移动端）、Playwright 截图（390px / 1440px）、保存的 HTML。
- 主题文件：对 4 个主题 JSON 的键计数、WCAG 对比度计算，与 One Dark Pro、Catppuccin Mocha 的下载比对；本地 vsce 打包与 Marketplace 3.7.7 VSIX 逐文件比对。
- Obsidian：theme.css 度量、Chromium 下 1.13 语义的 callout 渲染测试、与 Minimal/Flexoki/Tokyo Night/Kanagawa 的 CSS 比对。

## 附录 B. 复核说明

**已完成独立对抗式复核的维度**：主题质量（10 项）、扩展工程（13 项）。复核者重新计算了全部对比度、键数和文件行号，数字全部复现。复核的主要修正是**严重度下调**：原分析只拿 One Dark Pro 和 Catppuccin Mocha 比较，并把所有低于 AA 的值都当缺陷；放进 Catppuccin Latte 等同类基线后，多项问题属于同档水平。

| 发现 | 原严重度 | 复核后 | 原因 |
| --- | --- | --- | --- |
| 工作台 124 键 | 关键 | 高 | 事实成立，是最大产品差距，但没有任何东西坏掉或不可读 |
| 亮色语法色低于 AA | 高 | 中 | 高于 Catppuccin Latte；应改宣称而不是改调色 |
| 终端 ANSI 低于 AA | 高 | 中 | VS Code 集成终端默认把前景色自动纠正到 4.5:1；影响主要在终端导出与 Zed |
| 次级 UI 文本对比度 | 中 | 低 | 与头部主题同档或更好 |
| 选区与行号偏淡 | 中 | 低 | 只在亮色成立；暗色行号比 One Dark Pro 还亮 |
| 首图空格缺陷 | 中 | 高 | 已确认根因，且 README 把合成图称为"真实编辑器布局" |
| Forge 覆盖斜体 | 高 | 中 | 成立，且反向顺序还会丢失 Forge 的语义 token；但只影响同时用两项功能的人 |
| vscode.dev 下 Forge 不可用 | 高 | 低 | 主题本身在 vscode.dev 正常；同类扩展多数也不支持 web 端定制 |
| VSIX 体积、高对比度映射、同步/卸载清理、零代码说明 | 中 | 低 | 都是真问题，但对 284 安装的产品影响很小 |
| Forge 深链不支持 Cursor 等 | 中 | 中（确认） | 94.4% 的下载来自 Open VSX 编辑器 |

**未能完成独立复核的维度**：网站转化、Obsidian、定位文案、竞争格局。四次复核尝试均因使用额度耗尽而中断。这些发现由原分析代理给出文件行号、API 数据与截图证据，我对其中几项做了直接核对：首页代码样本中的 `api.vesper.dev`（截图可见）、robots.txt 返回 HTML（curl 确认 `content-type: text/html`）、Obsidian 镜像仓 2 个未回复的 issue/PR（GitHub API）、搜索排名与安装数（自己抓取的数据）。其余项请视为"有证据但未经第二人复核"。

**未能运行的维度**：仓库流程、Zed/终端/平台、市场数据量化、推广案例研究四个分析代理也因额度中断。第 5、6 节由我直接运行测试、同步检查、行数统计和 Zed 键位比对写成；第 1、2、4 节的市场数据来自自己抓取的 API 数据与竞争格局分析。推广案例部分（4.3 的渠道清单）没有逐条附 URL 来源，属于基于公开常识的建议。
