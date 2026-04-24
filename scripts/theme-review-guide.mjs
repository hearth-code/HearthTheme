const scheme = process.argv[2] ?? "moss";

const packageScriptByScheme = {
  moss: "pnpm run pack:moss:local"
};

const packCommand = packageScriptByScheme[scheme] ?? "add a local pack script for this scheme";

const lines = [
  `Theme review guide: ${scheme}`,
  "",
  "Design loop:",
  "1. State the desired change in non-color language.",
  "2. Split it into substrate, semantic roles, and product identity.",
  "3. Keep stable material anchors stable.",
  "4. Edit the smallest source layer that expresses the intent.",
  "5. Treat audit warnings as design feedback.",
  "6. Install a local package before final judgment.",
  "",
  "Source files to inspect first:",
  `- color-system/schemes/${scheme}/scheme.json`,
  `- color-system/schemes/${scheme}/color-contract.json`,
  `- color-system/schemes/${scheme}/philosophy.md`,
  `- color-system/schemes/${scheme}/foundation.json`,
  `- color-system/schemes/${scheme}/semantic-rules.json`,
  "",
  "Commands:",
  "- pnpm run sync",
  "- pnpm run audit:color-contract",
  "- pnpm run audit:theme",
  "- pnpm run preview:generate",
  "- pnpm run verify",
  `- ${packCommand}`,
  "",
  "Generated review artifacts:",
  "- reports/color-contract-audit.json",
  "- public/previews/preview-contrast-v2.png",
  "- obsidian/app-theme/screenshot.png",
  `- themes/${scheme}-dark.json`,
  `- themes/${scheme}-light.json`,
  "- docs/color-language-report.md",
  "- reports/color-language-consistency.json",
  "- reports/color-language-lineage.json",
  "- reports/color-language-parity.json",
  "",
  "Manual review questions:",
  "- Is the flavor identity visible in under five seconds?",
  "- Are hero syntax roles readable without reading the rules?",
  "- Does light mode preserve structure without becoming flat paper?",
  "- Do JSON, TS/TSX, Markdown, and CSS still scan differently?",
  "- Is any color beautiful but too loud for daily work?",
  "",
  "Fixed review fixtures:",
  "- fixtures/theme-review/sample.tsx",
  "- fixtures/theme-review/sample.json",
  "- fixtures/theme-review/sample.md",
  "- fixtures/theme-review/sample.css",
  "",
  "Commit rule:",
  "Commit accepted visual checkpoints before starting the next subjective pass."
];

console.log(lines.join("\n"));
