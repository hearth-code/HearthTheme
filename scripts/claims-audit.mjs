import { readFileSync } from "node:fs";

const issues = [];

function addIssue(message) {
	issues.push(message);
}

function readText(path) {
	try {
		return readFileSync(path, "utf8");
	} catch (error) {
		addIssue(`${path}: failed to read (${error.message})`);
		return null;
	}
}

function lineAt(text, index) {
	let line = 1;
	for (let i = 0; i < index; i += 1) {
		if (text[i] === "\n") line += 1;
	}
	return line;
}

function assertNoMatch(path, pattern, message) {
	const text = readText(path);
	if (!text) return;
	const match = text.match(pattern);
	if (!match || match.index == null) return;
	addIssue(`${path}:${lineAt(text, match.index)} ${message}`);
}

function assertHasMatch(path, pattern, message) {
	const text = readText(path);
	if (!text) return;
	if (!pattern.test(text)) addIssue(`${path}: ${message}`);
}

function validateAlgorithmClaims() {
	const baselineDocs = "src/components/ui/BaselineDocs.astro";
	const baselineDocFile = "docs/theme-baseline.md";

	assertNoMatch(
		baselineDocs,
		/only brightness and saturation shift/i,
		"outdated claim: should not assert brightness/saturation-only tuning.",
	);
	assertNoMatch(
		baselineDocs,
		/只调整明度与饱和度/,
		"outdated claim: should not assert brightness/saturation-only tuning.",
	);
	assertNoMatch(
		baselineDocs,
		/明度と彩度のみ調整/,
		"outdated claim: should not assert brightness/saturation-only tuning.",
	);
	assertNoMatch(
		baselineDocFile,
		/only lightness and saturation may shift/i,
		"outdated baseline wording: mention bounded hue compensation when readability requires it.",
	);
	assertHasMatch(
		baselineDocFile,
		/bounded hue compensation/i,
		"missing bounded hue compensation statement in design intent.",
	);
}

function validateRoleNarrativeClaims() {
	const baselineDocs = "src/components/ui/BaselineDocs.astro";
	const baselineDocFile = "docs/theme-baseline.md";

	assertNoMatch(
		baselineDocs,
		/Brass amber callable targets|黄铜琥珀可调用目标|ブラスアンバーの呼び出し対象/,
		"function narrative is stale for light/light-soft polarity behavior.",
	);
	assertNoMatch(
		baselineDocFile,
		/Brass amber callable targets/,
		"function narrative is stale for light/light-soft polarity behavior.",
	);
}

function validateStatusClaims() {
	for (const readme of ["README.md", "README.zh-CN.md", "README.ja.md"]) {
		assertNoMatch(
			readme,
			/In review flow|评审流程中/,
			"avoid static review-status wording; use upstream-index wording instead.",
		);
	}
}

function validateReadmeAlgorithmClaims() {
	const readmes = ["README.md", "README.zh-CN.md", "README.ja.md"];
	for (const readme of readmes) {
		assertNoMatch(
			readme,
			/only (?:brightness|lightness) and saturation/i,
			"outdated claim: should not assert brightness/saturation-only tuning.",
		);
		assertNoMatch(
			readme,
			/只调整明度与饱和度/,
			"outdated claim: should not assert brightness/saturation-only tuning.",
		);
		assertNoMatch(
			readme,
			/明度と彩度のみ調整/,
			"outdated claim: should not assert brightness/saturation-only tuning.",
		);
	}
}

function validateVariantCountClaims() {
	assertNoMatch(
		"README.md",
		/\b(?:3|three)\s+variants?\b/i,
		"stale variant count claim: should describe four variants.",
	);
	assertNoMatch(
		"README.zh-CN.md",
		/三个变体/,
		"stale variant count claim: should describe four variants.",
	);
	assertNoMatch(
		"README.ja.md",
		/3バリアント/,
		"stale variant count claim: should describe four variants.",
	);
}

function validateDocsHygiene() {
	const baselineDocFile = "docs/theme-baseline.md";
	assertNoMatch(
		baselineDocFile,
		/`npm run\s+/,
		"docs command style drift: use `pnpm run` consistently.",
	);
	assertNoMatch(
		baselineDocFile,
		/^- \d{4}-\d{2}-\d{2}\s+`v\d+\.\d+\.\d+`/m,
		"remove static historical release bullets; source history from extension/CHANGELOG.md.",
	);
}

function run() {
	validateAlgorithmClaims();
	validateRoleNarrativeClaims();
	validateStatusClaims();
	validateReadmeAlgorithmClaims();
	validateVariantCountClaims();
	validateDocsHygiene();

	if (issues.length > 0) {
		console.error("[FAIL] Claims audit found issues:");
		for (const issue of issues) console.error(`  - ${issue}`);
		process.exit(1);
	}

	console.log("[PASS] Claims audit passed.");
}

run();
