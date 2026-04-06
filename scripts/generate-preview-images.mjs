import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { loadColorProductManifest, loadColorProductPreviewConfig, loadColorSchemeManifest, loadColorSystemVariants, loadRoleAdapters } from "./color-system.mjs";

const WIDTH = 1600;
const HEIGHT = 900;
const OUTPUT_DIR = join("extension", "images");
const WEBSITE_OUTPUT_DIR = join("public", "previews");
const MANIFEST_PATH = join("reports", "preview-manifest.json");
const PREVIEW_RENDERER = "promo-color-board-v5";

const PRODUCT = loadColorProductManifest();
const PREVIEW = loadColorProductPreviewConfig();
const THEME_META = loadColorSystemVariants().variants.map((variant) => ({
  id: variant.id,
  name: PREVIEW.variantNames[variant.id] || variant.name,
  file: variant.outputPath,
}));
const CONTRAST_OUTPUTS = [
  join(OUTPUT_DIR, "preview-contrast-v2.png"),
  join(WEBSITE_OUTPUT_DIR, "preview-contrast-v2.png"),
];
const LEGACY_PREVIEW_OUTPUTS = [
  join(WEBSITE_OUTPUT_DIR, "preview-dark.png"),
  join(WEBSITE_OUTPUT_DIR, "preview-dark-soft.png"),
  join(WEBSITE_OUTPUT_DIR, "preview-light.png"),
  join(WEBSITE_OUTPUT_DIR, "preview-light-soft.png"),
  join(OUTPUT_DIR, "preview-dark.png"),
  join(OUTPUT_DIR, "preview-dark-soft.png"),
  join(OUTPUT_DIR, "preview-light.png"),
  join(OUTPUT_DIR, "preview-light-soft.png"),
  join(OUTPUT_DIR, "preview-contrast.png"),
  join(WEBSITE_OUTPUT_DIR, "preview-contrast.png"),
];
const PROMO_ROLE_SWATCHES = [
  { label: "keyword", role: "keyword", sample: "if ready" },
  { label: "function", role: "function", sample: "renderTheme()" },
  { label: "string", role: "string", sample: '"embers"' },
];
const SCHEME = loadColorSchemeManifest();
const ROLE_SCOPES = Object.fromEntries(loadRoleAdapters().map((role) => [role.id, role.scopes || []]));

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function toPosixPath(path) {
  return String(path || "").replaceAll("\\", "/");
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function writeJsonIfChanged(path, data) {
  const next = `${JSON.stringify(data, null, 2)}\n`;
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path)) {
    const prev = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
    if (prev === next) return false;
  }
  writeFileSync(path, next);
  return true;
}

function escapeXml(input) {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function normalizeHex(hex) {
  if (typeof hex !== "string") return null;
  const value = hex.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  if (/^#[0-9a-f]{8}$/i.test(value)) return value.slice(0, 7);
  return null;
}

function hexToRgb(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const value = normalized.slice(1);
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function rgbToHex(rgb) {
  return `#${rgb
    .map((channel) =>
      Math.max(0, Math.min(255, Math.round(channel)))
        .toString(16)
        .padStart(2, "0"))
    .join("")}`;
}

function mixHex(a, b, weight = 0.5) {
  const rgbA = hexToRgb(a);
  const rgbB = hexToRgb(b);
  if (!rgbA && !rgbB) return "#000000";
  if (!rgbA) return normalizeHex(b) ?? "#000000";
  if (!rgbB) return normalizeHex(a) ?? "#000000";
  const t = Math.max(0, Math.min(1, weight));
  return rgbToHex([
    rgbA[0] + (rgbB[0] - rgbA[0]) * t,
    rgbA[1] + (rgbB[1] - rgbA[1]) * t,
    rgbA[2] + (rgbB[2] - rgbA[2]) * t,
  ]);
}

function withAlpha(hex, alpha) {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(0, 0, 0, ${alpha})`;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function themeColor(theme, key, fallback) {
  return normalizeHex(theme.colors?.[key]) ?? fallback;
}

function normalizeStyleEntry(entry, fallbackColor, fallbackFontStyle = "") {
  if (typeof entry === "string") {
    return {
      color: normalizeHex(entry) ?? fallbackColor,
      fontStyle: fallbackFontStyle,
    };
  }

  if (!entry || typeof entry !== "object") {
    return {
      color: fallbackColor,
      fontStyle: fallbackFontStyle,
    };
  }

  return {
    color: normalizeHex(entry.foreground) ?? fallbackColor,
    fontStyle: typeof entry.fontStyle === "string" ? entry.fontStyle : fallbackFontStyle,
  };
}

function getTokenStyle(theme, scopes, fallbackColor, fallbackFontStyle = "") {
  const expected = Array.isArray(scopes) ? scopes : [scopes];
  let bestEntry = null;
  let bestRatio = -1;
  let bestCount = -1;
  let bestScopeLength = Number.POSITIVE_INFINITY;

  for (const entry of theme.tokenColors || []) {
    const entryScopes = (Array.isArray(entry.scope) ? entry.scope : [entry.scope]).map((scope) => String(scope || ""));
    const matchCount = entryScopes.filter((scope) => expected.includes(scope)).length;
    if (matchCount === 0) continue;

    const ratio = matchCount / entryScopes.length;
    const isBetter =
      ratio > bestRatio ||
      (ratio === bestRatio && matchCount > bestCount) ||
      (ratio === bestRatio && matchCount === bestCount && entryScopes.length < bestScopeLength);

    if (!isBetter) continue;

    bestEntry = entry;
    bestRatio = ratio;
    bestCount = matchCount;
    bestScopeLength = entryScopes.length;
  }

  return bestEntry
    ? normalizeStyleEntry(bestEntry.settings, fallbackColor, fallbackFontStyle)
    : {
        color: fallbackColor,
        fontStyle: fallbackFontStyle,
      };
}

function getSemanticStyle(theme, key, fallbackColor, fallbackFontStyle = "") {
  return normalizeStyleEntry(theme.semanticTokenColors?.[key], fallbackColor, fallbackFontStyle);
}

function getRoleScopes(roleId, fallback = []) {
  return ROLE_SCOPES[roleId] || fallback;
}

function defaultEditorStyle(theme) {
  return {
    color: themeColor(theme, "editor.foreground", "#d3c9b8"),
    fontStyle: "",
  };
}

function resolvePreviewStyle(theme, role) {
  const editorStyle = defaultEditorStyle(theme);

  switch (role) {
    case "comment":
      return getTokenStyle(theme, ["comment", "punctuation.definition.comment"], editorStyle.color, "italic");
    case "keyword": {
      const fallback = getTokenStyle(theme, ["keyword", "storage.type", "storage.modifier", "keyword.control"], editorStyle.color, "bold");
      return getSemanticStyle(theme, "keyword", fallback.color, fallback.fontStyle);
    }
    case "operator":
      return getTokenStyle(theme, ["keyword.operator", "keyword.operator.assignment"], editorStyle.color);
    case "punctuation":
      return getTokenStyle(theme, ["punctuation", "meta.brace"], editorStyle.color);
    case "namespace": {
      const fallback = getTokenStyle(theme, ["entity.name.namespace", "support.module"], editorStyle.color);
      return getSemanticStyle(theme, "namespace", fallback.color, fallback.fontStyle);
    }
    case "type": {
      const fallback = getTokenStyle(theme, ["entity.name.type", "entity.name.class", "support.type", "support.type.builtin"], editorStyle.color, "italic");
      return getSemanticStyle(theme, "type", fallback.color, fallback.fontStyle);
    }
    case "function": {
      const fallback = getTokenStyle(theme, getRoleScopes("function", ["entity.name.function", "support.function", "meta.function-call.generic"]), editorStyle.color);
      return getSemanticStyle(theme, "function", fallback.color, fallback.fontStyle);
    }
    case "method": {
      const fallback = getTokenStyle(theme, getRoleScopes("method", ["meta.method-call entity.name.function"]), editorStyle.color);
      return getSemanticStyle(theme, "method", fallback.color, fallback.fontStyle);
    }
    case "function.defaultLibrary": {
      const fallback = resolvePreviewStyle(theme, "function");
      return getSemanticStyle(theme, "function.defaultLibrary", fallback.color, fallback.fontStyle);
    }
    case "method.defaultLibrary": {
      const fallback = resolvePreviewStyle(theme, "method");
      return getSemanticStyle(theme, "method.defaultLibrary", fallback.color, fallback.fontStyle);
    }
    case "variable": {
      const fallback = getTokenStyle(theme, ["variable", "variable.other.readwrite", "variable.other.constant"], editorStyle.color);
      return getSemanticStyle(theme, "variable", fallback.color, fallback.fontStyle);
    }
    case "variable.readonly": {
      const fallback = resolvePreviewStyle(theme, "variable");
      return getSemanticStyle(theme, "variable.readonly", fallback.color, fallback.fontStyle);
    }
    case "parameter": {
      const fallback = resolvePreviewStyle(theme, "variable");
      return getSemanticStyle(theme, "parameter", fallback.color, fallback.fontStyle);
    }
    case "property": {
      const fallback = getTokenStyle(theme, [...getRoleScopes("property", ["variable.other.property", "variable.other.member", "meta.property-name", "support.type.property-name"])], editorStyle.color);
      return getSemanticStyle(theme, "property", fallback.color, fallback.fontStyle);
    }
    case "string":
      return getTokenStyle(theme, ["string", "string.quoted", "string.template", "string.regexp"], editorStyle.color);
    case "number":
      return getTokenStyle(theme, ["constant.numeric", "constant.language.boolean", "constant.language.null", "constant.language.undefined"], editorStyle.color);
    case "tag":
      return getTokenStyle(theme, ["entity.name.tag", "punctuation.definition.tag"], editorStyle.color);
    case "attribute":
      return getTokenStyle(theme, ["entity.other.attribute-name"], editorStyle.color);
    case "plain":
    default:
      return editorStyle;
  }
}

function roleColor(theme, role) {
  return resolvePreviewStyle(theme, role).color;
}

function fontWeightForStyle(style, fallback = 600) {
  return style?.fontStyle?.includes("bold") ? 700 : fallback;
}

function textStyleAttrs(style, fallbackWeight = 600) {
  const attrs = [`fill="${style.color}"`, `font-weight="${fontWeightForStyle(style, fallbackWeight)}"`];
  if (style?.fontStyle?.includes("italic")) attrs.push(`font-style="italic"`);
  return attrs.join(" ");
}

function renderCodeLine({ theme, segments, x, y, fontSize = 18 }) {
  let cursor = 0;
  const charWidth = fontSize * 0.6;

  const parts = segments.map((segment) => {
    const style = resolvePreviewStyle(theme, segment.role || "plain");
    const text = String(segment.text || "");
    const part = `<tspan x="${x + cursor * charWidth}" y="${y}" ${textStyleAttrs(style, 550)}>${escapeXml(text)}</tspan>`;
    cursor += text.length;
    return part;
  });

  return `
    <text font-size="${fontSize}" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" dominant-baseline="text-before-edge">
      ${parts.join("")}
    </text>
  `;
}

function renderFeaturePill({ x, y, label, fill, stroke, textColor }) {
  const width = Math.max(124, label.length * 10.8 + 32);
  return `
    <g>
      <rect x="${x}" y="${y}" width="${width}" height="38" rx="19" fill="${fill}" stroke="${stroke}" stroke-width="1" />
      <text x="${x + 16}" y="${y + 11}" fill="${textColor}" font-size="15" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">${escapeXml(label)}</text>
    </g>
  `;
}

function renderWrappedText({
  text,
  x,
  y,
  maxWidth,
  lineHeight,
  fontSize,
  fill,
  fontFamily,
  fontWeight,
}) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const averageCharWidth = fontSize * 0.54;
  const maxChars = Math.max(12, Math.floor(maxWidth / averageCharWidth));
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    if (current) lines.push(current);
    current = word;
  }

  if (current) lines.push(current);

  return `
    <text x="${x}" y="${y}" fill="${fill}" font-size="${fontSize}" font-family="${fontFamily}"${fontWeight ? ` font-weight="${fontWeight}"` : ""} dominant-baseline="text-before-edge">
      ${lines
        .map((line, index) => `<tspan x="${x}" y="${y + index * lineHeight}">${escapeXml(line)}</tspan>`)
        .join("")}
    </text>
  `;
}

function renderHeroShowcase({ theme, x, y, width, height }) {
  const bg = themeColor(theme, "editor.background", "#211d1a");
  const fg = themeColor(theme, "editor.foreground", "#d3c9b8");
  const sidebar = themeColor(theme, "sideBar.background", mixHex(bg, "#000000", 0.18));
  const activity = themeColor(theme, "activityBar.background", mixHex(sidebar, "#000000", 0.14));
  const panel = themeColor(theme, "editorGroupHeader.tabsBackground", mixHex(bg, "#000000", 0.08));
  const border = mixHex(themeColor(theme, "tab.border", "#35302b"), fg, 0.12);
  const focus = roleColor(theme, "function");
  const accent = themeColor(theme, "statusBar.background", roleColor(theme, "keyword"));
  const cardFill = mixHex(bg, "#000000", 0.12);
  const codeBg = mixHex(bg, "#000000", 0.04);
  const tabActive = mixHex(bg, fg, 0.08);
  const tabMuted = mixHex(fg, bg, 0.7);
  const gutterText = mixHex(fg, bg, 0.58);
  const lines = [
    [{ role: "comment", text: "// low-glare warmth with clear structure" }],
    [{ role: "keyword", text: "type " }, { role: "type", text: "Palette" }, { role: "plain", text: " = {" }],
    [{ role: "plain", text: "  " }, { role: "property", text: "keyword" }, { role: "plain", text: ": " }, { role: "string", text: "\"ember\"" }, { role: "plain", text: "," }],
    [{ role: "plain", text: "  " }, { role: "property", text: "callable" }, { role: "plain", text: ": " }, { role: "function", text: "renderTheme" }, { role: "plain", text: "(" }, { role: "string", text: "\"hearth\"" }, { role: "plain", text: ")," }],
    [{ role: "keyword", text: "const " }, { role: "variable", text: "theme" }, { role: "plain", text: " = " }, { role: "function", text: "buildTheme" }, { role: "plain", text: "(" }, { role: "string", text: "\"hearth\"" }, { role: "plain", text: ");" }],
  ];

  const codeStartX = x + 126;
  const codeStartY = y + 142;
  const lineHeight = 29;
  const footerY = y + height - 70;
  const footerX = x + 118;
  const footerWidth = width - 166;

  const renderedLines = lines
    .map((segments, index) => {
      const lineY = codeStartY + index * lineHeight;
      return `
        <text x="${x + 82}" y="${lineY}" fill="${gutterText}" font-size="14" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace" dominant-baseline="text-before-edge">${index + 1}</text>
        ${renderCodeLine({ theme, segments, x: codeStartX, y: lineY, fontSize: 19 })}
      `;
    })
    .join("");

  const signatureChips = PROMO_ROLE_SWATCHES.map((entry, index) => {
    const swatch = roleColor(theme, entry.role);
    const chipX = x + 126 + index * 172;
    const chipY = footerY + 6;
    return `
      <g>
        <rect x="${chipX}" y="${chipY}" width="154" height="36" rx="18" fill="${withAlpha(swatch, 0.14)}" stroke="${withAlpha(swatch, 0.35)}" />
        <circle cx="${chipX + 18}" cy="${chipY + 18}" r="5" fill="${swatch}" />
        <text x="${chipX + 32}" y="${chipY + 10}" fill="${swatch}" font-size="14" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">${escapeXml(entry.sample)}</text>
      </g>
    `;
  }).join("");

  return `
    <g>
      <rect x="${x + 12}" y="${y + 16}" width="${width}" height="${height}" rx="30" fill="${withAlpha("#000000", 0.18)}" />
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="28" fill="${cardFill}" stroke="${border}" stroke-width="1.2" />
      <rect x="${x + 24}" y="${y + 24}" width="${width - 48}" height="52" rx="18" fill="${panel}" />
      <circle cx="${x + 48}" cy="${y + 50}" r="6" fill="${withAlpha(roleColor(theme, "keyword"), 0.9)}" />
      <circle cx="${x + 68}" cy="${y + 50}" r="6" fill="${withAlpha(roleColor(theme, "string"), 0.85)}" />
      <circle cx="${x + 88}" cy="${y + 50}" r="6" fill="${withAlpha(roleColor(theme, "function"), 0.9)}" />
      <rect x="${x + 116}" y="${y + 36}" width="148" height="28" rx="14" fill="${tabActive}" />
      <rect x="${x + 278}" y="${y + 36}" width="126" height="28" rx="14" fill="${withAlpha("#ffffff", 0.04)}" />
      <text x="${x + 136}" y="${y + 43}" fill="${fg}" font-size="15" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">Ember Dark</text>
      <text x="${x + 296}" y="${y + 43}" fill="${tabMuted}" font-size="15" font-family="'Segoe UI', 'Noto Sans', sans-serif" dominant-baseline="text-before-edge">palette.ts</text>

      <rect x="${x + 24}" y="${y + 92}" width="60" height="${height - 124}" rx="20" fill="${activity}" />
      <rect x="${x + 36}" y="${y + 116}" width="36" height="8" rx="4" fill="${withAlpha(fg, 0.6)}" />
      <rect x="${x + 36}" y="${y + 140}" width="24" height="8" rx="4" fill="${withAlpha(roleColor(theme, "function"), 0.9)}" />
      <rect x="${x + 36}" y="${y + 164}" width="28" height="8" rx="4" fill="${withAlpha(roleColor(theme, "keyword"), 0.85)}" />
      <rect x="${x + 36}" y="${y + 188}" width="22" height="8" rx="4" fill="${withAlpha(roleColor(theme, "string"), 0.85)}" />

      <rect x="${x + 100}" y="${y + 92}" width="${width - 124}" height="${height - 124}" rx="22" fill="${codeBg}" stroke="${withAlpha(fg, 0.08)}" />
      <rect x="${x + 100}" y="${y + 92}" width="${width - 124}" height="40" rx="22" fill="${mixHex(codeBg, fg, 0.03)}" />
      <text x="${x + 126}" y="${y + 104}" fill="${mixHex(fg, bg, 0.4)}" font-size="12" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" letter-spacing="0.16em" dominant-baseline="text-before-edge">DEFAULT VARIANT</text>
      <text x="${x + width - 200}" y="${y + 104}" fill="${focus}" font-size="12" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" letter-spacing="0.12em" dominant-baseline="text-before-edge">DENIM CALLABLE ANCHORS</text>

      ${renderedLines}
      <rect x="${footerX}" y="${footerY}" width="${footerWidth}" height="48" rx="24" fill="${mixHex(codeBg, fg, 0.04)}" stroke="${withAlpha(fg, 0.08)}" />
      ${signatureChips}
      <rect x="${x + width - 168}" y="${footerY + 10}" width="120" height="28" rx="14" fill="${withAlpha(accent, 0.24)}" />
      <text x="${x + width - 144}" y="${footerY + 18}" fill="${accent}" font-size="13" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">low glare</text>
    </g>
  `;
}

function renderTraitsCard({ theme, x, y, width, height }) {
  const bg = themeColor(theme, "editor.background", "#211d1a");
  const fg = themeColor(theme, "editor.foreground", "#d3c9b8");
  const cardBg = mixHex(bg, "#000000", 0.08);
  const border = mixHex(themeColor(theme, "tab.border", "#35302b"), fg, 0.12);
  const muted = mixHex(fg, bg, 0.46);
  const rows = [
    {
      title: "Warm neutrals",
      body: "Soot-dark and parchment-light surfaces stay calm before accents.",
      color: mixHex(bg, fg, 0.78),
    },
    {
      title: "Ember keywords",
      body: "Control flow stays warm and visible, never neon.",
      color: roleColor(theme, "keyword"),
    },
    {
      title: "Denim callables",
      body: "Functions get a cool anchor that keeps the palette memorable.",
      color: roleColor(theme, "function"),
    },
  ];

  const renderedRows = rows.map((row, index) => {
    const rowY = y + 56 + index * 54;
    return `
      <g>
        <rect x="${x + 22}" y="${rowY + 6}" width="10" height="10" rx="5" fill="${row.color}" />
        <text x="${x + 48}" y="${rowY}" fill="${fg}" font-size="18" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">${escapeXml(row.title)}</text>
        ${renderWrappedText({
          text: row.body,
          x: x + 48,
          y: rowY + 24,
          maxWidth: width - 78,
          lineHeight: 18,
          fontSize: 14,
          fill: muted,
          fontFamily: "'Segoe UI', 'Noto Sans', sans-serif",
        })}
      </g>
    `;
  }).join("");

  return `
    <g>
      <rect x="${x + 10}" y="${y + 14}" width="${width}" height="${height}" rx="28" fill="${withAlpha("#000000", 0.12)}" />
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="26" fill="${cardBg}" stroke="${border}" stroke-width="1.2" />
      <text x="${x + 22}" y="${y + 20}" fill="${withAlpha(roleColor(theme, "keyword"), 0.9)}" font-size="12" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" letter-spacing="0.14em" dominant-baseline="text-before-edge">WHAT YOU NOTICE FIRST</text>
      ${renderedRows}
    </g>
  `;
}

function renderVariantSummaryCard({ themes, x, y, width, height }) {
  const darkTheme = themes.find((theme) => theme.id === "dark")?.theme;
  const bg = darkTheme ? themeColor(darkTheme, "editor.background", "#211d1a") : "#211d1a";
  const fg = darkTheme ? themeColor(darkTheme, "editor.foreground", "#d3c9b8") : "#d3c9b8";
  const border = mixHex(themeColor(darkTheme || {}, "tab.border", "#35302b"), fg, 0.12);
  const cardBg = mixHex(bg, "#000000", 0.06);
  const muted = mixHex(fg, bg, 0.46);
  const swatchWidth = 116;
  const swatchGap = 12;
  const swatchY = y + 80;
  const swatches = themes.map((meta, index) => {
    const swatchX = x + 22 + index * (swatchWidth + swatchGap);
    const swatchBg = themeColor(meta.theme, "editor.background", "#211d1a");
    const swatchFg = themeColor(meta.theme, "editor.foreground", "#d3c9b8");
    const swatchAccent = roleColor(meta.theme, "keyword");
    return `
      <g>
        <rect x="${swatchX}" y="${swatchY}" width="${swatchWidth}" height="70" rx="18" fill="${swatchBg}" stroke="${mixHex(swatchBg, swatchFg, 0.22)}" />
        <rect x="${swatchX + 14}" y="${swatchY + 14}" width="28" height="6" rx="3" fill="${swatchAccent}" />
        <rect x="${swatchX + 14}" y="${swatchY + 28}" width="42" height="6" rx="3" fill="${roleColor(meta.theme, "function")}" />
        <text x="${swatchX + 14}" y="${swatchY + 48}" fill="${swatchFg}" font-size="13.5" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">${escapeXml(meta.name.replace("Hearth ", ""))}</text>
      </g>
    `;
  }).join("");

  return `
    <g>
      <rect x="${x + 10}" y="${y + 14}" width="${width}" height="${height}" rx="28" fill="${withAlpha("#000000", 0.12)}" />
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="26" fill="${cardBg}" stroke="${border}" stroke-width="1.2" />
      <text x="${x + 22}" y="${y + 20}" fill="${withAlpha(roleColor(darkTheme || {}, "string"), 0.9)}" font-size="12" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" letter-spacing="0.14em" dominant-baseline="text-before-edge">FOUR TUNED ATMOSPHERES</text>
      ${renderWrappedText({
        text: "Same hierarchy, tuned for mixed light, night work, and daylight.",
        x: x + 22,
        y: y + 40,
        maxWidth: width - 44,
        lineHeight: 15,
        fontSize: 12.5,
        fill: muted,
        fontFamily: "'Segoe UI', 'Noto Sans', sans-serif",
      })}
      ${swatches}
    </g>
  `;
}

function renderVariantMiniCard({ meta, x, y, width, height }) {
  const bg = themeColor(meta.theme, "editor.background", "#211d1a");
  const fg = themeColor(meta.theme, "editor.foreground", "#d3c9b8");
  const border = mixHex(themeColor(meta.theme, "tab.border", "#35302b"), fg, meta.id.startsWith("light") ? 0.24 : 0.14);
  const cardBg = mixHex(bg, meta.id.startsWith("light") ? "#ffffff" : "#000000", meta.id.startsWith("light") ? 0.04 : 0.08);
  const muted = mixHex(fg, bg, 0.46);
  const keyword = roleColor(meta.theme, "keyword");
  const callable = roleColor(meta.theme, "function");
  const string = roleColor(meta.theme, "string");
  const note = SCHEME.variantPhilosophy?.[meta.id] || "";
  const sample = renderCodeLine({
    theme: meta.theme,
    x: x + 22,
    y: y + 102,
    fontSize: 16,
    segments: [
      { role: "keyword", text: "if " },
      { role: "plain", text: "ready " },
      { role: "function", text: "renderTheme" },
      { role: "plain", text: "(" },
      { role: "string", text: "\"hearth\"" },
      { role: "plain", text: ")" },
    ],
  });

  return `
    <g>
      <rect x="${x + 8}" y="${y + 12}" width="${width}" height="${height}" rx="26" fill="${withAlpha("#000000", 0.12)}" />
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="24" fill="${cardBg}" stroke="${border}" stroke-width="1.2" />
      <text x="${x + 22}" y="${y + 20}" fill="${fg}" font-size="19" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">${escapeXml(meta.name)}</text>
      <text x="${x + 22}" y="${y + 48}" fill="${muted}" font-size="13.5" font-family="'Segoe UI', 'Noto Sans', sans-serif" dominant-baseline="text-before-edge">${escapeXml(note)}</text>
      <rect x="${x + 22}" y="${y + 82}" width="${width - 44}" height="54" rx="16" fill="${mixHex(bg, fg, meta.id.startsWith("light") ? 0.08 : 0.05)}" />
      ${sample}
      <rect x="${x + 22}" y="${y + height - 46}" width="14" height="14" rx="7" fill="${keyword}" />
      <text x="${x + 44}" y="${y + height - 47}" fill="${keyword}" font-size="12.5" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">keyword</text>
      <rect x="${x + 126}" y="${y + height - 46}" width="14" height="14" rx="7" fill="${callable}" />
      <text x="${x + 148}" y="${y + height - 47}" fill="${callable}" font-size="12.5" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">function</text>
      <rect x="${x + 238}" y="${y + height - 46}" width="14" height="14" rx="7" fill="${string}" />
      <text x="${x + 260}" y="${y + height - 47}" fill="${string}" font-size="12.5" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">string</text>
    </g>
  `;
}

function renderPromoBoardSvg({ themes }) {
  const gradientId = "promo-board-bg";
  const glowId = "promo-board-glow";
  const defaultThemeMeta = themes.find((theme) => theme.id === "dark") || themes[0];
  const featurePills = [
    { label: "warm neutral", fill: withAlpha("#cf8740", 0.16), stroke: withAlpha("#cf8740", 0.38), textColor: "#f2dfc6" },
    { label: "low glare", fill: withAlpha("#d3c9b8", 0.08), stroke: withAlpha("#d3c9b8", 0.18), textColor: "#eadcc7" },
    { label: "blue callable anchors", fill: withAlpha(roleColor(defaultThemeMeta.theme, "function"), 0.18), stroke: withAlpha(roleColor(defaultThemeMeta.theme, "function"), 0.34), textColor: "#d7e4ea" },
  ];

  let pillX = 56;
  const renderedPills = featurePills.map((pill) => {
    const width = Math.max(124, pill.label.length * 10.8 + 32);
    const rendered = renderFeaturePill({ x: pillX, y: 176, ...pill });
    pillX += width + 12;
    return rendered;
  }).join("");

  const bottomCards = themes.map((meta, index) => renderVariantMiniCard({
    meta,
    x: 42 + index * (367 + 16),
    y: 646,
    width: 367,
    height: 198,
  })).join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
      <defs>
        <linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#17130f" />
          <stop offset="55%" stop-color="#241b15" />
          <stop offset="100%" stop-color="#2b221c" />
        </linearGradient>
        <radialGradient id="${glowId}" cx="0.2" cy="0.15" r="0.9">
          <stop offset="0%" stop-color="${withAlpha("#cf8740", 0.36)}" />
          <stop offset="32%" stop-color="${withAlpha(roleColor(defaultThemeMeta.theme, "function"), 0.18)}" />
          <stop offset="100%" stop-color="${withAlpha("#000000", 0)}" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="url(#${gradientId})" />
      <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="url(#${glowId})" />
      <rect x="42" y="232" width="930" height="352" rx="30" fill="${withAlpha("#0b0908", 0.14)}" />
      <rect x="996" y="232" width="562" height="228" rx="30" fill="${withAlpha("#0b0908", 0.14)}" />
      <rect x="996" y="466" width="562" height="160" rx="30" fill="${withAlpha("#0b0908", 0.14)}" />
      <text x="56" y="58" fill="#efe4d0" font-size="18" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" letter-spacing="0.08em" dominant-baseline="text-before-edge">${escapeXml((PREVIEW.badgeLabel || PRODUCT.name).toUpperCase())}</text>
      <text x="56" y="88" fill="#f2e7d2" font-size="46" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">${escapeXml(PREVIEW.headline)}</text>
      <text x="56" y="136" fill="#bfa88d" font-size="19" font-family="'Segoe UI', 'Noto Sans', sans-serif" dominant-baseline="text-before-edge">${escapeXml(PREVIEW.subheadline)}</text>
      ${renderedPills}
      ${renderHeroShowcase({ theme: defaultThemeMeta.theme, x: 42, y: 232, width: 930, height: 352 })}
      ${renderTraitsCard({ theme: defaultThemeMeta.theme, x: 996, y: 232, width: 562, height: 228 })}
      ${renderVariantSummaryCard({ themes, x: 996, y: 466, width: 562, height: 160 })}
      ${bottomCards}
    </svg>
  `;
}

function renderContrastSvg({ themes }) {
  return renderPromoBoardSvg({ themes });
}

function removeFileIfExists(path) {
  if (!existsSync(path)) return false;
  rmSync(path);
  return true;
}

async function writePng(svg, outputPath) {
  mkdirSync(dirname(outputPath), { recursive: true });
  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(outputPath);
  console.log(`✓ generated ${outputPath}`);
}

async function run() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  mkdirSync(WEBSITE_OUTPUT_DIR, { recursive: true });
  mkdirSync(dirname(MANIFEST_PATH), { recursive: true });

  const themes = THEME_META.map((meta) => ({ ...meta, theme: readJson(meta.file) }));
  const missingThemeIds = THEME_META
    .map((meta) => meta.id)
    .filter((id) => !themes.some((meta) => meta.id === id));
  if (missingThemeIds.length > 0) {
    throw new Error(`Theme metadata is incomplete: ${missingThemeIds.join(", ")}`);
  }

  const contrastSvg = renderContrastSvg({ themes });

  const promoSpecSha256 = sha256(JSON.stringify({
    renderer: PREVIEW_RENDERER,
    product: {
      id: PRODUCT.id,
      name: PRODUCT.name,
      displayName: PRODUCT.displayName,
      summary: PRODUCT.summary,
    },
    scheme: {
      id: SCHEME.id,
      name: SCHEME.name,
      headline: SCHEME.headline,
      vocabulary: SCHEME.vocabulary,
    },
    preview: PREVIEW,
    roles: PROMO_ROLE_SWATCHES,
    canvas: { width: WIDTH, height: HEIGHT },
  }));

  const manifest = {
    schemaVersion: 2,
    generator: "scripts/generate-preview-images.mjs",
    renderer: PREVIEW_RENDERER,
    promoSpecSha256,
    canvas: { width: WIDTH, height: HEIGHT },
    contrastImage: {
      inputSha256: sha256(JSON.stringify({
        renderer: PREVIEW_RENDERER,
        themes: themes.map((meta) => ({
          id: meta.id,
          name: meta.name,
          file: toPosixPath(meta.file),
          theme: meta.theme,
        })),
        product: {
          id: PRODUCT.id,
          name: PRODUCT.name,
          displayName: PRODUCT.displayName,
          summary: PRODUCT.summary,
        },
        scheme: {
          id: SCHEME.id,
          name: SCHEME.name,
          headline: SCHEME.headline,
          vocabulary: SCHEME.vocabulary,
        },
        preview: PREVIEW,
        promoSpecSha256,
        hero: true,
        canvas: { width: WIDTH, height: HEIGHT },
      })),
      outputs: CONTRAST_OUTPUTS.map(toPosixPath),
    },
  };

  for (const legacyOutput of LEGACY_PREVIEW_OUTPUTS) {
    if (removeFileIfExists(legacyOutput)) {
      console.log(`- removed stale ${legacyOutput}`);
    }
  }

  for (const output of CONTRAST_OUTPUTS) {
    await writePng(contrastSvg, output);
  }

  const manifestChanged = writeJsonIfChanged(MANIFEST_PATH, manifest);
  console.log(`${manifestChanged ? "✓ updated" : "- unchanged"} ${MANIFEST_PATH}`);
}

run().catch((error) => {
  console.error(`✗ failed to generate preview images: ${error.message}`);
  process.exit(1);
});
