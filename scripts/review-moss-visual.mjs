import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import sharp from "sharp";
import { codeToTokens } from "shiki";
import { getThemeMetaListForSchemeId, loadRoleAdapters } from "./color-system.mjs";
import { contrastRatio, deltaE, hexToRgba, mixHex, normalizeHex, rgbToHsl, rgbaToHex } from "./color-utils.mjs";

const CI_MODE = process.argv.includes("--ci");
const SCHEME_ID = "moss";
const REPORT_DIR = join("reports", "moss-visual-review");
const REPORT_JSON_PATH = join(REPORT_DIR, "report.json");
const REPORT_MD_PATH = join(REPORT_DIR, "report.md");
const MANIFEST_PATH = join(REPORT_DIR, "snapshot-manifest.json");
const IMAGE_DIR = join(REPORT_DIR, "snapshots");
const FIXTURES = [
  { path: "fixtures/theme-review/sample.tsx", lang: "tsx", label: "TSX" },
  { path: "fixtures/theme-review/sample.json", lang: "json", label: "JSON" },
  { path: "fixtures/theme-review/sample.md", lang: "md", label: "Markdown" },
  { path: "fixtures/theme-review/sample.css", lang: "css", label: "CSS" },
];
const REVIEW_ROLES = ["keyword", "function", "method", "type", "number", "string", "operator", "property", "comment"];
const SIGNAL_LANES = {
  keyword: { label: "old warning yellow", hueMin: 38, hueMax: 62, minSaturation: 0.3 },
  function: { label: "terminal lichen green", hueMin: 95, hueMax: 115, minSaturation: 0.28 },
  method: { label: "olive method bridge", hueMin: 68, hueMax: 82, minSaturation: 0.22 },
  type: { label: "oxidized CRT blue", hueMin: 190, hueMax: 220, minSaturation: 0.28 },
  number: { label: "oxidized CRT blue", hueMin: 190, hueMax: 220, minSaturation: 0.28 },
  string: { label: "lacquered paper string", hueMin: 25, hueMax: 50, minSaturation: 0.24 },
};
const CRITICAL_PAIRS = [
  { left: "keyword", right: "string", minDeltaE: 9 },
  { left: "method", right: "string", minDeltaE: 9 },
  { left: "function", right: "type", minDeltaE: 10 },
];
const MAIN_SIGNAL_ROLES = ["keyword", "function", "method", "type", "number", "string"];

const ROLE_ADAPTER_BY_ID = Object.fromEntries(loadRoleAdapters().map((role) => [role.id, role]));

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}

function fileSha256(path) {
  return sha256(readFileSync(path));
}

function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function writeText(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content.endsWith("\n") ? content : `${content}\n`);
}

function escapeXml(input) {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function toScopes(entry) {
  if (!entry?.scope) return [];
  return Array.isArray(entry.scope) ? entry.scope : [entry.scope];
}

function getTokenColor(theme, scopes) {
  if (!Array.isArray(scopes) || scopes.length === 0) return null;

  let bestColor = null;
  let bestRatio = -1;
  let bestCount = -1;
  let bestScopeLength = Number.POSITIVE_INFINITY;

  for (const entry of theme.tokenColors || []) {
    const entryScopes = toScopes(entry);
    const count = entryScopes.filter((scope) => scopes.includes(scope)).length;
    if (count === 0) continue;

    const color = entry.settings?.foreground ? normalizeHex(entry.settings.foreground) : null;
    if (!color) continue;

    const ratio = count / entryScopes.length;
    const isBetter =
      ratio > bestRatio ||
      (ratio === bestRatio && count > bestCount) ||
      (ratio === bestRatio && count === bestCount && entryScopes.length < bestScopeLength);

    if (!isBetter) continue;

    bestColor = color;
    bestRatio = ratio;
    bestCount = count;
    bestScopeLength = entryScopes.length;
  }

  return bestColor;
}

function getSemanticColor(theme, semanticKey) {
  const value = theme.semanticTokenColors?.[semanticKey];
  if (!value) return null;
  if (typeof value === "string") return normalizeHex(value);
  if (typeof value === "object" && value.foreground) return normalizeHex(value.foreground);
  return null;
}

function getRoleColor(theme, roleId) {
  const roleDef = ROLE_ADAPTER_BY_ID[roleId];
  if (!roleDef) return null;
  return getTokenColor(theme, roleDef.scopes || []) ?? (roleDef.semanticKeys || []).map((key) => getSemanticColor(theme, key)).find(Boolean) ?? null;
}

function blendColorOverBackground(colorHex, bgHex) {
  const color = hexToRgba(colorHex);
  const bg = hexToRgba(bgHex);
  if (!color || !bg) return colorHex;
  if (!color.hasAlpha) return rgbaToHex({ r: color.r, g: color.g, b: color.b, hasAlpha: false });
  const alpha = color.a / 255;
  return rgbaToHex({
    r: color.r * alpha + bg.r * (1 - alpha),
    g: color.g * alpha + bg.g * (1 - alpha),
    b: color.b * alpha + bg.b * (1 - alpha),
    hasAlpha: false,
  });
}

function hueInBand(hue, min, max) {
  if (hue == null) return false;
  if (min <= max) return hue >= min && hue <= max;
  return hue >= min || hue <= max;
}

function round(value, digits = 3) {
  if (value == null || Number.isNaN(value)) return null;
  return Number(value.toFixed(digits));
}

function fixed(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return "n/a";
  return Number(value).toFixed(digits);
}

function getThemeMetric(theme, variantId) {
  const bg = normalizeHex(theme.colors?.["editor.background"]);
  const fg = normalizeHex(theme.colors?.["editor.foreground"]);
  const lineHighlight = normalizeHex(theme.colors?.["editor.lineHighlightBackground"]);
  const selection = normalizeHex(theme.colors?.["editor.selectionBackground"]);
  const roleColors = Object.fromEntries(REVIEW_ROLES.map((role) => [role, getRoleColor(theme, role)]));
  const roleMetrics = {};
  const issues = [];
  const warnings = [];

  for (const [role, color] of Object.entries(roleColors)) {
    const hsl = color ? rgbToHsl(color) : null;
    const contrast = color && bg ? contrastRatio(color, bg) : null;
    const lane = SIGNAL_LANES[role];
    const laneStatus = lane && hsl
      ? hueInBand(hsl.h, lane.hueMin, lane.hueMax) && hsl.s >= lane.minSaturation
      : null;

    roleMetrics[role] = {
      color,
      contrast: round(contrast, 2),
      hue: round(hsl?.h, 1),
      saturation: round(hsl?.s, 3),
      lightness: round(hsl?.l, 3),
      signalLane: lane ? lane.label : null,
      signalLaneStatus: laneStatus,
    };

    if (lane && laneStatus === false) {
      issues.push(`${variantId}: ${role} leaves ${lane.label} lane (h=${fixed(hsl?.h)}, s=${fixed(hsl?.s, 2)})`);
    }
  }

  for (const pair of CRITICAL_PAIRS) {
    const left = roleColors[pair.left];
    const right = roleColors[pair.right];
    const distance = left && right ? deltaE(left, right) : null;
    if (distance != null && distance < pair.minDeltaE) {
      issues.push(`${variantId}: ${pair.left}/${pair.right} deltaE ${fixed(distance)} < ${pair.minDeltaE}`);
    }
  }

  const warmRoles = ["keyword", "method", "string"].map((role) => roleMetrics[role]).filter(Boolean);
  const warmMeanSaturation = warmRoles.length
    ? warmRoles.reduce((sum, metric) => sum + (metric.saturation ?? 0), 0) / warmRoles.length
    : null;
  const stringContrast = roleMetrics.string?.contrast ?? null;
  const functionTypeDeltaE = roleColors.function && roleColors.type ? deltaE(roleColors.function, roleColors.type) : null;
  const keywordStringDeltaE = roleColors.keyword && roleColors.string ? deltaE(roleColors.keyword, roleColors.string) : null;
  const lineHighlightContrast = lineHighlight && bg ? contrastRatio(blendColorOverBackground(lineHighlight, bg), bg) : null;
  const selectionContrast = selection && bg ? contrastRatio(blendColorOverBackground(selection, bg), bg) : null;
  const falloutClarityScore = [
    stringContrast == null ? null : Math.min(1, stringContrast / 4),
    functionTypeDeltaE == null ? null : Math.min(1, functionTypeDeltaE / 20),
    keywordStringDeltaE == null ? null : Math.min(1, keywordStringDeltaE / 16),
  ].filter((value) => value != null).reduce((sum, value, _, list) => sum + value / list.length, 0);
  const mudRisk = [
    warmMeanSaturation == null ? 0 : Math.max(0, 0.34 - warmMeanSaturation) / 0.34,
    keywordStringDeltaE == null ? 0 : Math.max(0, 14 - keywordStringDeltaE) / 14,
    stringContrast == null ? 0 : Math.max(0, 4 - stringContrast) / 4,
  ].reduce((sum, value) => sum + value, 0) / 3;

  if (mudRisk > 0.36) {
    warnings.push(`${variantId}: mud-risk proxy is ${fixed(mudRisk, 2)}; warm lanes may feel too earthy or blended`);
  }
  if (falloutClarityScore < 0.78) {
    warnings.push(`${variantId}: clarity proxy is ${fixed(falloutClarityScore, 2)}; syntax may not feel crisp enough`);
  }

  return {
    variantId,
    background: bg,
    foreground: fg,
    roleMetrics,
    pairDeltaE: {
      keywordString: round(keywordStringDeltaE, 2),
      methodString: round(roleColors.method && roleColors.string ? deltaE(roleColors.method, roleColors.string) : null, 2),
      functionType: round(functionTypeDeltaE, 2),
    },
    surfaceMetrics: {
      lineHighlightContrast: round(lineHighlightContrast, 2),
      selectionContrast: round(selectionContrast, 2),
    },
    visualProxies: {
      warmMeanSaturation: round(warmMeanSaturation, 3),
      mudRisk: round(mudRisk, 3),
      falloutClarityScore: round(falloutClarityScore, 3),
    },
    status: issues.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass",
    issues,
    warnings,
  };
}

function average(values) {
  const usable = values.filter((value) => value != null && Number.isFinite(value));
  if (usable.length === 0) return null;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function buildPairQualityMetrics(leftVariant, rightVariant, pairId) {
  if (!leftVariant || !rightVariant) return null;

  const roleComparisons = MAIN_SIGNAL_ROLES.map((role) => {
    const left = leftVariant.roleMetrics?.[role];
    const right = rightVariant.roleMetrics?.[role];
    const hueDelta = left?.hue != null && right?.hue != null
      ? Math.min(Math.abs(left.hue - right.hue), 360 - Math.abs(left.hue - right.hue))
      : null;
    return {
      role,
      hueDelta: round(hueDelta, 1),
      saturationDelta: round(right?.saturation != null && left?.saturation != null ? right.saturation - left.saturation : null, 3),
      contrastDelta: round(right?.contrast != null && left?.contrast != null ? right.contrast - left.contrast : null, 2),
    };
  });

  const rightColorPresence = average(MAIN_SIGNAL_ROLES.map((role) => rightVariant.roleMetrics?.[role]?.saturation));
  const hueContinuity = average(roleComparisons.map((item) => item.hueDelta));
  const minSignalContrast = Math.min(...MAIN_SIGNAL_ROLES.map((role) => rightVariant.roleMetrics?.[role]?.contrast).filter((value) => value != null));
  const issues = [];
  const warnings = [];

  if (rightColorPresence != null && rightColorPresence < 0.38) {
    warnings.push(`${pairId}: light-side signal presence ${fixed(rightColorPresence, 2)} is low; color may feel washed or overly material`);
  }
  if (hueContinuity != null && hueContinuity > 9) {
    warnings.push(`${pairId}: dark/light hue continuity ${fixed(hueContinuity, 1)}deg is loose; flavor may feel different across modes`);
  }
  if (minSignalContrast < 2.7) {
    issues.push(`${pairId}: light-side minimum signal contrast ${fixed(minSignalContrast, 1)} is below 2.7`);
  }

  return {
    pairId,
    leftVariant: leftVariant.variantId,
    rightVariant: rightVariant.variantId,
    lightSideSignalPresence: round(rightColorPresence, 3),
    averageHueContinuityDelta: round(hueContinuity, 1),
    lightSideMinimumSignalContrast: round(minSignalContrast, 2),
    roleComparisons,
    status: issues.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass",
    issues,
    warnings,
  };
}

function buildConsistencyMetrics(variants) {
  const byId = Object.fromEntries(variants.map((variant) => [variant.variantId, variant]));
  return [
    buildPairQualityMetrics(byId.dark, byId.light, "dark-light"),
    buildPairQualityMetrics(byId.darkSoft, byId.lightSoft, "darkSoft-lightSoft"),
  ].filter(Boolean);
}

function extensionLabel(path) {
  const ext = extname(path).replace(".", "");
  return ext || "text";
}

function tokenFontAttrs(token) {
  const attrs = [`fill="${token.color || "#d3c9b8"}"`];
  if ((token.fontStyle ?? 0) & 1) attrs.push('font-style="italic"');
  if ((token.fontStyle ?? 0) & 2) attrs.push('font-weight="700"');
  return attrs.join(" ");
}

async function renderFixture({ theme, fixture, x, y, width, lineLimit = 11 }) {
  const code = readFileSync(fixture.path, "utf8").replace(/\r\n/g, "\n").trimEnd();
  const tokens = await codeToTokens(code, { lang: fixture.lang, theme });
  const bg = normalizeHex(theme.colors?.["editor.background"]) || "#1d1a17";
  const fg = normalizeHex(theme.colors?.["editor.foreground"]) || "#d3c9b8";
  const border = mixHex(bg, fg, 0.16);
  const titleBg = mixHex(bg, fg, 0.06);
  const gutter = mixHex(fg, bg, 0.55);
  const lineHeight = 23;
  const fontSize = 16;
  const charWidth = 9.5;
  const headerHeight = 42;
  const paddingTop = 18;
  const bodyHeight = paddingTop * 2 + Math.min(tokens.tokens.length, lineLimit) * lineHeight;
  const height = headerHeight + bodyHeight;
  const content = [];

  content.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" fill="${bg}" stroke="${border}" />`);
  content.push(`<rect x="${x}" y="${y}" width="${width}" height="${headerHeight}" rx="12" fill="${titleBg}" />`);
  content.push(`<rect x="${x}" y="${y + 30}" width="${width}" height="12" fill="${titleBg}" />`);
  content.push(`<text x="${x + 18}" y="${y + 26}" fill="${fg}" font-size="14" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700">${escapeXml(fixture.label)}</text>`);
  content.push(`<text x="${x + width - 70}" y="${y + 26}" fill="${gutter}" font-size="12" font-family="'Segoe UI', 'Noto Sans', sans-serif">${escapeXml(extensionLabel(fixture.path))}</text>`);

  const shownLines = tokens.tokens.slice(0, lineLimit);
  for (let lineIndex = 0; lineIndex < shownLines.length; lineIndex++) {
    const lineY = y + headerHeight + paddingTop + lineIndex * lineHeight;
    content.push(`<text x="${x + 18}" y="${lineY}" fill="${gutter}" font-size="${fontSize}" font-family="Consolas, 'SFMono-Regular', Menlo, monospace">${lineIndex + 1}</text>`);
    let cursor = 0;
    const maxChars = Math.floor((width - 84) / charWidth);
    const tspans = [];
    for (const token of shownLines[lineIndex]) {
      if (cursor >= maxChars) break;
      const remaining = maxChars - cursor;
      const rawText = token.content || "";
      const shouldTruncate = rawText.length > remaining;
      const text = shouldTruncate
        ? `${rawText.slice(0, Math.max(0, remaining - 1))}…`
        : rawText;
      tspans.push(`<tspan x="${x + 58 + cursor * charWidth}" y="${lineY}" ${tokenFontAttrs(token)}>${escapeXml(text)}</tspan>`);
      cursor += text.length;
      if (shouldTruncate) break;
    }
    content.push(`<text font-size="${fontSize}" font-family="Consolas, 'SFMono-Regular', Menlo, monospace">${tspans.join("")}</text>`);
  }

  return { svg: content.join("\n"), height };
}

function renderMetricStrip({ metric, x, y, width }) {
  const bg = metric.background || "#1d1a17";
  const fg = metric.foreground || "#d3c9b8";
  const surface = mixHex(bg, fg, 0.07);
  const border = mixHex(bg, fg, 0.16);
  const roles = ["keyword", "function", "type", "string", "method", "number"];
  let swatchX = x + 18;
  const swatches = roles.map((role) => {
    const item = metric.roleMetrics[role];
    const color = item?.color || fg;
    const label = `${role} ${fixed(item?.hue, 0)}deg`;
    const block = `
      <rect x="${swatchX}" y="${y + 52}" width="22" height="22" rx="5" fill="${color}" />
      <text x="${swatchX + 30}" y="${y + 68}" fill="${fg}" font-size="12" font-family="'Segoe UI', 'Noto Sans', sans-serif">${escapeXml(label)}</text>
    `;
    swatchX += 126;
    return block;
  }).join("\n");

  return `
    <rect x="${x}" y="${y}" width="${width}" height="94" rx="12" fill="${surface}" stroke="${border}" />
    <text x="${x + 18}" y="${y + 26}" fill="${fg}" font-size="14" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700">Automated visual proxies</text>
    <text x="${x + width - 420}" y="${y + 26}" fill="${fg}" font-size="13" font-family="'Segoe UI', 'Noto Sans', sans-serif">clarity ${fixed(metric.visualProxies.falloutClarityScore, 2)} · mud ${fixed(metric.visualProxies.mudRisk, 2)} · string contrast ${fixed(metric.roleMetrics.string?.contrast, 1)}</text>
    ${swatches}
  `;
}

async function renderSnapshot(themeMeta, theme, metric) {
  const bg = normalizeHex(theme.colors?.["editor.background"]) || "#1d1a17";
  const fg = normalizeHex(theme.colors?.["editor.foreground"]) || "#d3c9b8";
  const surface = mixHex(bg, fg, themeMeta.type === "light" ? 0.045 : 0.035);
  const width = 1380;
  const gutter = 28;
  const columnWidth = Math.floor((width - gutter * 3) / 2);
  const headerHeight = 86;
  const rendered = [];

  for (let index = 0; index < FIXTURES.length; index++) {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = gutter + col * (columnWidth + gutter);
    const y = headerHeight + gutter + row * 342;
    rendered.push(await renderFixture({ theme, fixture: FIXTURES[index], x, y, width: columnWidth }));
  }

  const height = headerHeight + gutter + 2 * 342 + 124;
  const title = `Moss ${themeMeta.climateLabel}`;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect x="0" y="0" width="${width}" height="${height}" fill="${surface}" />
      <text x="${gutter}" y="42" fill="${fg}" font-size="28" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700">${escapeXml(title)}</text>
      <text x="${gutter}" y="68" fill="${mixHex(fg, bg, 0.38)}" font-size="14" font-family="'Segoe UI', 'Noto Sans', sans-serif">Fixed review fixtures rendered through the actual VS Code theme JSON.</text>
      ${rendered.map((entry) => entry.svg).join("\n")}
      ${renderMetricStrip({ metric, x: gutter, y: height - 112, width: width - gutter * 2 })}
    </svg>
  `;
  const output = join(IMAGE_DIR, `moss-${themeMeta.fileSlug}.png`);
  mkdirSync(dirname(output), { recursive: true });
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9, quality: 100 }).toFile(output);
  return output;
}

function buildMarkdown(report) {
  const lines = [
    "# Moss Visual Review",
    "",
    "Auto-generated by `scripts/review-moss-visual.mjs`.",
    "",
    "## Summary",
    "",
    `- Status: ${report.status}`,
    `- Snapshot drift: ${report.snapshotDrift ? "yes" : "no"}`,
    `- Blocking issues: ${report.issues.length}`,
    `- Warnings: ${report.warnings.length}`,
    "",
    "## Variant Metrics",
    "",
    "| Variant | Status | Clarity | Mud Risk | String Contrast | Keyword/String dE | Function/Type dE | Snapshot |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |",
  ];

  for (const variant of report.variants) {
    lines.push(`| ${variant.variantId} | ${variant.status} | ${fixed(variant.visualProxies.falloutClarityScore, 2)} | ${fixed(variant.visualProxies.mudRisk, 2)} | ${fixed(variant.roleMetrics.string?.contrast, 1)} | ${fixed(variant.pairDeltaE.keywordString, 1)} | ${fixed(variant.pairDeltaE.functionType, 1)} | ${variant.snapshotPath} |`);
  }

  lines.push("", "## Signal Lanes", "");
  for (const variant of report.variants) {
    lines.push(`### ${variant.variantId}`, "");
    lines.push("| Role | Color | Hue | Sat | Contrast | Lane |");
    lines.push("| --- | --- | ---: | ---: | ---: | --- |");
    for (const role of ["keyword", "function", "method", "type", "number", "string"]) {
      const metric = variant.roleMetrics[role];
      lines.push(`| ${role} | ${metric.color || "n/a"} | ${fixed(metric.hue, 1)} | ${fixed(metric.saturation, 2)} | ${fixed(metric.contrast, 1)} | ${metric.signalLaneStatus === true ? "pass" : "fail"} |`);
    }
    lines.push("");
  }

  lines.push("## Deep/Light Consistency", "");
  lines.push("| Pair | Status | Light Signal Presence | Avg Hue Drift | Min Light Contrast |");
  lines.push("| --- | --- | ---: | ---: | ---: |");
  for (const pair of report.consistency || []) {
    lines.push(`| ${pair.pairId} | ${pair.status} | ${fixed(pair.lightSideSignalPresence, 2)} | ${fixed(pair.averageHueContinuityDelta, 1)} | ${fixed(pair.lightSideMinimumSignalContrast, 1)} |`);
  }
  lines.push("");

  lines.push("## Issues", "");
  lines.push(...(report.issues.length ? report.issues.map((issue) => `- ${issue}`) : ["- none"]));
  lines.push("", "## Warnings", "");
  lines.push(...(report.warnings.length ? report.warnings.map((warning) => `- ${warning}`) : ["- none"]));
  lines.push("");
  return lines.join("\n");
}

async function run() {
  mkdirSync(REPORT_DIR, { recursive: true });
  mkdirSync(IMAGE_DIR, { recursive: true });

  const previousManifest = existsSync(MANIFEST_PATH) ? readJson(MANIFEST_PATH) : null;
  const themeMetaList = getThemeMetaListForSchemeId(SCHEME_ID);
  const variants = [];
  const images = [];
  const issues = [];
  const warnings = [];

  for (const themeMeta of themeMetaList) {
    if (!existsSync(themeMeta.path)) {
      issues.push(`${themeMeta.path}: theme file missing`);
      continue;
    }
    const theme = readJson(themeMeta.path);
    const metric = getThemeMetric(theme, themeMeta.id);
    const snapshotPath = await renderSnapshot(themeMeta, theme, metric);
    const snapshotHash = fileSha256(snapshotPath);
    const relativeSnapshotPath = snapshotPath.replaceAll("\\", "/");
    variants.push({
      ...metric,
      fileSlug: themeMeta.fileSlug,
      climateLabel: themeMeta.climateLabel,
      themePath: themeMeta.path.replaceAll("\\", "/"),
      snapshotPath: relativeSnapshotPath,
      snapshotSha256: snapshotHash,
    });
    images.push({
      variantId: themeMeta.id,
      path: relativeSnapshotPath,
      sha256: snapshotHash,
    });
    issues.push(...metric.issues);
    warnings.push(...metric.warnings);
  }

  const manifest = {
    schemaVersion: 1,
    generatedBy: "scripts/review-moss-visual.mjs",
    schemeId: SCHEME_ID,
    fixtures: FIXTURES.map((fixture) => ({
      path: fixture.path,
      lang: fixture.lang,
      sha256: fileSha256(fixture.path),
    })),
    images,
  };
  const previousImages = Object.fromEntries((previousManifest?.images || []).map((image) => [image.path, image.sha256]));
  const snapshotDrift = previousManifest != null && images.some((image) => previousImages[image.path] && previousImages[image.path] !== image.sha256);
  if (snapshotDrift) {
    warnings.push("snapshot drift detected against reports/moss-visual-review/snapshot-manifest.json");
  }
  const consistency = buildConsistencyMetrics(variants);
  for (const pair of consistency) {
    issues.push(...pair.issues);
    warnings.push(...pair.warnings);
  }

  const report = {
    schemaVersion: 1,
    generatedBy: "scripts/review-moss-visual.mjs",
    schemeId: SCHEME_ID,
    status: issues.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass",
    ciMode: CI_MODE,
    snapshotDrift,
    reportPath: REPORT_MD_PATH.replaceAll("\\", "/"),
    manifestPath: MANIFEST_PATH.replaceAll("\\", "/"),
    variants,
    consistency,
    issues,
    warnings,
  };

  writeJson(MANIFEST_PATH, manifest);
  writeJson(REPORT_JSON_PATH, report);
  writeText(REPORT_MD_PATH, buildMarkdown(report));

  if (issues.length > 0) {
    console.log("[FAIL] Moss visual review found blocking issues:");
    for (const issue of issues) console.log(`  - ${issue}`);
  } else if (warnings.length > 0) {
    console.log("[WARN] Moss visual review passed with follow-up warnings:");
    for (const warning of warnings) console.log(`  - ${warning}`);
  } else {
    console.log("[PASS] Moss visual review passed.");
  }

  console.log(`[INFO] Report: ${REPORT_MD_PATH}`);
  console.log(`[INFO] Snapshots: ${IMAGE_DIR}`);

  if (CI_MODE && (issues.length > 0 || snapshotDrift)) {
    process.exit(1);
  }
  process.exit(issues.length > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(`✗ failed to review Moss visuals: ${error.message}`);
  process.exit(1);
});
