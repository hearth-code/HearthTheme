import type { Lang } from "../i18n/utils";

type LocalizedText = Record<Lang, string>;
type LocalizedList = Record<Lang, string[]>;

export interface ThemeChangeEntry {
	date: string;
	version: string;
	title: LocalizedText;
	summary: LocalizedText;
	changes: LocalizedList;
}

export const themeChangelog: ThemeChangeEntry[] = [
	{
		date: "2026-03-20",
		version: "v0.4.5",
		title: {
			en: "Light Soft counterpart release",
			zh: "Light Soft 对照版本发布",
			ja: "Light Soft 対照バリアント追加",
		},
		summary: {
			en: "Added Hearth Light Soft as the daylight counterpart to Dark Soft and expanded all governance/docs pipelines to four variants.",
			zh: "新增 Hearth Light Soft 作为 Dark Soft 的白天对照，并将治理与文档链路扩展为四主题。",
			ja: "Dark Soft の日中対照として Hearth Light Soft を追加し、運用/ドキュメントを4バリアントへ拡張。",
		},
		changes: {
			en: [
				"Added new source theme: themes/hearth-light-soft.json.",
				"Expanded sync, preview generation, and audit scripts to include lightSoft.",
				"Updated website preview, proof section, and baseline docs to four-variant governance.",
				"Added marketplace/website screenshots for Hearth Light Soft.",
			],
			zh: [
				"新增主题源文件：themes/hearth-light-soft.json。",
				"同步扩展 sync、预览图生成与审计脚本，纳入 lightSoft。",
				"更新网站预览、证明区与基线文档，升级为四主题治理。",
				"新增 Hearth Light Soft 的商店与网站截图输出。",
			],
			ja: [
				"新規テーマソース themes/hearth-light-soft.json を追加。",
				"sync / プレビュー生成 / 監査スクリプトを lightSoft 対応へ拡張。",
				"Webプレビュー/Proof/基準ドキュメントを4バリアント運用に更新。",
				"Hearth Light Soft の Marketplace/Web スクリーンショットを追加。",
			],
		},
	},
	{
		date: "2026-03-19",
		version: "v0.4.4",
		title: {
			en: "Cross-mode material refinement",
			zh: "跨模式材质层优化",
			ja: "クロスモード素材レイヤー調整",
		},
		summary: {
			en: "Refined dark and light themes with consistent role semantics and calmer visual rhythm.",
			zh: "对深浅主题进行同步精修，在保持语义一致的前提下让视觉节奏更平稳。",
			ja: "ダーク/ライトを同時調整し、役割整合性を維持したまま視覚リズムを安定化。",
		},
		changes: {
			en: [
				"Updated dark syntax roles: comment, keyword, operator, function, string +4.",
				"Adjusted dark UI surfaces: editor.background, editor.foreground, editor.lineHighlightBackground, editor.selectionBackground, statusBar.background +5.",
				"Editor contrast (dark) changed 10.0 -> 11.4.",
				"Updated light syntax roles: comment, keyword, operator, function, string +4.",
				"Adjusted light UI surfaces: editor.background, editor.foreground, editor.lineHighlightBackground, editor.selectionBackground, statusBar.background +5."
			],
			zh: [
				"更新深色语法角色：注释, 关键字, 操作符, 函数, 字符串 +4。",
				"调整深色界面层：编辑器背景, 编辑器前景, 当前行背景, 选区背景, 状态栏背景 +5。",
				"编辑器对比度（深色）从 10.0 调整到 11.4。",
				"更新浅色语法角色：注释, 关键字, 操作符, 函数, 字符串 +4。",
				"调整浅色界面层：编辑器背景, 编辑器前景, 当前行背景, 选区背景, 状态栏背景 +5。"
			],
			ja: [
				"ダークの役割を更新: コメント, キーワード, 演算子, 関数, 文字列 +4。",
				"ダークのUI層を調整: エディタ背景, エディタ前景, 行ハイライト背景, 選択背景, ステータスバー背景 +5。",
				"エディタコントラスト（ダーク）: 10.0 -> 11.4。",
				"ライトの役割を更新: コメント, キーワード, 演算子, 関数, 文字列 +4。",
				"ライトのUI層を調整: エディタ背景, エディタ前景, 行ハイライト背景, 選択背景, ステータスバー背景 +5。"
			],
		},
	},
	{
		date: "2026-03-19",
		version: "v0.4.3",
		title: {
			en: "Cross-mode material refinement",
			zh: "跨模式材质层优化",
			ja: "クロスモード素材レイヤー調整",
		},
		summary: {
			en: "Refined dark and light themes with consistent role semantics and calmer visual rhythm.",
			zh: "对深浅主题进行同步精修，在保持语义一致的前提下让视觉节奏更平稳。",
			ja: "ダーク/ライトを同時調整し、役割整合性を維持したまま視覚リズムを安定化。",
		},
		changes: {
			en: [
				"Updated dark syntax roles: comment, keyword, operator, function, string +4.",
				"Adjusted dark UI surfaces: editor.background, editor.foreground, editor.lineHighlightBackground, editor.selectionBackground, statusBar.background +5.",
				"Editor contrast (dark) changed 10.0 -> 11.4.",
				"Updated light syntax roles: comment, keyword, operator, function, string +4.",
				"Adjusted light UI surfaces: editor.background, editor.foreground, editor.lineHighlightBackground, editor.selectionBackground, statusBar.background +5."
			],
			zh: [
				"更新深色语法角色：注释, 关键字, 操作符, 函数, 字符串 +4。",
				"调整深色界面层：编辑器背景, 编辑器前景, 当前行背景, 选区背景, 状态栏背景 +5。",
				"编辑器对比度（深色）从 10.0 调整到 11.4。",
				"更新浅色语法角色：注释, 关键字, 操作符, 函数, 字符串 +4。",
				"调整浅色界面层：编辑器背景, 编辑器前景, 当前行背景, 选区背景, 状态栏背景 +5。"
			],
			ja: [
				"ダークの役割を更新: コメント, キーワード, 演算子, 関数, 文字列 +4。",
				"ダークのUI層を調整: エディタ背景, エディタ前景, 行ハイライト背景, 選択背景, ステータスバー背景 +5。",
				"エディタコントラスト（ダーク）: 10.0 -> 11.4。",
				"ライトの役割を更新: コメント, キーワード, 演算子, 関数, 文字列 +4。",
				"ライトのUI層を調整: エディタ背景, エディタ前景, 行ハイライト背景, 選択背景, ステータスバー背景 +5。"
			],
		},
	},
	{
		date: "2026-03-19",
		version: "v0.4.2",
		title: {
			en: "Theme governance foundation",
			zh: "主题治理基础设施上线",
			ja: "テーマ運用基盤を導入",
		},
		summary: {
			en: "Added repeatable quality controls to keep palette evolution stable over time.",
			zh: "加入可重复执行的质量检查，确保主题演进长期稳定。",
			ja: "パレット改善を継続しても品質を維持できる運用基盤を追加。",
		},
		changes: {
			en: [
				"Added scripts/theme-audit.mjs for contrast, role drift, and coverage checks.",
				"Added language fixtures for TS/Python/Rust/Go/JSON/Markdown regression review.",
				"Added CI workflow (.github/workflows/theme-audit.yml) to run audit on PR and main push.",
			],
			zh: [
				"新增 scripts/theme-audit.mjs：自动检查对比度、语义漂移和覆盖完整性。",
				"新增 TS/Python/Rust/Go/JSON/Markdown 回归样例。",
				"新增 CI 工作流（.github/workflows/theme-audit.yml），在 PR 与 main push 自动执行审计。",
			],
			ja: [
				"scripts/theme-audit.mjs を追加し、コントラスト・役割ドリフト・カバレッジを自動検証。",
				"TS/Python/Rust/Go/JSON/Markdown の回帰フィクスチャを追加。",
				".github/workflows/theme-audit.yml を追加し、PR/main push で監査を自動実行。",
			],
		},
	},
	{
		date: "2026-03-19",
		version: "v0.4.1",
		title: {
			en: "Long-session noise reduction",
			zh: "长时编码降噪微调",
			ja: "長時間作業向けのノイズ低減",
		},
		summary: {
			en: "Lowered visual noise while preserving role hierarchy and warmth.",
			zh: "在保留语义层级与暖调氛围的前提下，降低了视觉噪声。",
			ja: "暖かさと役割階層を維持したまま視覚ノイズを抑制。",
		},
		changes: {
			en: [
				"Dimmed comments one step in both dark and light themes.",
				"Reduced operator saturation one step to make connective symbols calmer.",
				"Synced preview fallback colors to avoid display drift.",
			],
			zh: [
				"深浅主题的注释颜色各降一档亮度。",
				"操作符颜色各降一档饱和度，降低连接符干扰。",
				"同步预览组件回退色，避免展示与主题文件偏差。",
			],
			ja: [
				"ダーク/ライト双方でコメント色を1段階落として静粛化。",
				"演算子の彩度を1段階下げ、接続記号の主張を抑制。",
				"プレビューのフォールバック色を同期して表示ズレを解消。",
			],
		},
	},
	{
		date: "2026-03-19",
		version: "v0.4.0",
		title: {
			en: "Blackboard + parchment language unification",
			zh: "黑板 + 羊皮纸设计语言统一",
			ja: "黒板 + 羊皮紙のデザイン言語を統一",
		},
		summary: {
			en: "Unified dark and light modes under one semantic narrative with stronger role parity.",
			zh: "把深浅主题统一到同一语义叙事，并强化跨模式角色一致性。",
			ja: "ダークとライトを同一セマンティック物語で統合し、役割整合性を強化。",
		},
		changes: {
			en: [
				"Dark mode shifted toward soot-blackboard substrate and chalk-like foreground.",
				"Light mode stabilized as parchment substrate with walnut-ink foreground.",
				"Aligned TextMate and semantic token mappings for role-consistent behavior.",
			],
			zh: [
				"深色主题统一为炭黑黑板底与粉笔感前景。",
				"浅色主题稳定为羊皮纸底与胡桃墨前景。",
				"对齐 TextMate 与 semantic token 映射，保证语义角色一致表现。",
			],
			ja: [
				"ダークを煤けた黒板面 + チョーク前景へ再設計。",
				"ライトを羊皮紙面 + ウォルナットインク前景へ安定化。",
				"TextMate と semantic token を整合し、役割一貫性を確保。",
			],
		},
	},
];
