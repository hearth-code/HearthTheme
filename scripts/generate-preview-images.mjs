import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { getThemeMetaListForSchemeId, loadColorProductManifest, loadColorProductPreviewConfig, loadColorSchemeManifestById, loadRoleAdapters } from "./color-system.mjs";

const WIDTH = 1600;
const HEIGHT = 900;
const OUTPUT_DIR = join("extension", "images");
const WEBSITE_OUTPUT_DIR = join("public", "previews");
const MANIFEST_PATH = join("reports", "preview-manifest.json");
const PREVIEW_RENDERER = "promo-color-board-v8";

const PRODUCT = loadColorProductManifest();
const PREVIEW = loadColorProductPreviewConfig();
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
const ROLE_SCOPES = Object.fromEntries(loadRoleAdapters().map((role) => [role.id, role.scopes || []]));
const FLAVOR_IDS = PRODUCT.brandFlavorIds?.length ? PRODUCT.brandFlavorIds : PRODUCT.supportedSchemeIds;
const FLAVORS_BY_ID = Object.fromEntries(FLAVOR_IDS.map((schemeId) => [schemeId, loadColorSchemeManifestById(schemeId)]));
const VARIANTS_BY_SCHEME_ID = Object.fromEntries(FLAVOR_IDS.map((schemeId) => [schemeId, getThemeMetaListForSchemeId(schemeId)]));
const FLAVOR_PREVIEW_COPY = {
  ember: {
    summary: "Warm charcoal and paper, with ember control flow and cool callable anchors.",
    chips: ["warm neutrals", "ember control", "denim callables"],
    comment: "// warm-neutral structure with cool anchors",
    sampleFunction: "renderTheme",
    sampleVariable: "theme",
    sampleString: '"ember"',
    sampleValue: '"hearth"',
    directionLabel: "WARM-NEUTRAL DIRECTION",
    focusLabel: "COOL CALLABLES",
  },
  moss: {
    summary: "Dry charcoal and paper, with clearer lane split and greener callable structure.",
    chips: ["dry paper", "editorial lane split", "lichen callables"],
    comment: "// dry editorial lanes with calm callables",
    sampleFunction: "routeSignal",
    sampleVariable: "palette",
    sampleString: '"moss"',
    sampleValue: '"field"',
    directionLabel: "DRY EDITORIAL DIRECTION",
    focusLabel: "GREEN CALLABLES",
  },
};

function buildFallbackThemeMeta() {
  return FLAVOR_IDS.map((schemeId) => {
    const flavor = FLAVORS_BY_ID[schemeId];
    const variant = (VARIANTS_BY_SCHEME_ID[schemeId] || []).find((entry) => entry.id === flavor.defaultVariant) || (VARIANTS_BY_SCHEME_ID[schemeId] || [])[0];
    if (!variant) {
      throw new Error(`Missing preview variant metadata for "${schemeId}"`);
    }

    return {
      id: `${schemeId}-${variant.id}`,
      schemeId,
      variantId: variant.id,
      label: `${PRODUCT.name} ${flavor.name} ${variant.climateLabel}`,
      summary: flavor.summary,
      isDefault: schemeId === PRODUCT.defaultSchemeId,
    };
  });
}

const FEATURED_THEME_META = (PRODUCT.featuredThemes?.length ? PRODUCT.featuredThemes : buildFallbackThemeMeta()).map((entry) => {
  const flavor = FLAVORS_BY_ID[entry.schemeId];
  const variant = (VARIANTS_BY_SCHEME_ID[entry.schemeId] || []).find((item) => item.id === entry.variantId);
  if (!flavor || !variant) {
    throw new Error(`Preview generator: missing theme source for "${entry.id || `${entry.schemeId}-${entry.variantId}`}"`);
  }

  return {
    id: entry.id || `${entry.schemeId}-${entry.variantId}`,
    schemeId: entry.schemeId,
    variantId: entry.variantId,
    name: entry.label,
    shortName: `${flavor.name} ${variant.climateLabel}`,
    summary: entry.summary || flavor.variantPhilosophy?.[entry.variantId] || flavor.summary,
    file: variant.path || variant.outputPath,
    climateLabel: variant.climateLabel,
    isDark: variant.type === "dark",
    isDefaultTheme: entry.isDefault === true,
    flavor,
  };
});

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

function getFlavorPreviewCopy(schemeId) {
  return FLAVOR_PREVIEW_COPY[schemeId] || {
    summary: FLAVORS_BY_ID[schemeId]?.summary || PRODUCT.summary,
    chips: ["semantic color", "low glare", "daily drivable"],
    comment: "// designed semantic color for code",
    sampleFunction: "renderTheme",
    sampleVariable: "theme",
    sampleString: `"${schemeId}"`,
    sampleValue: '"hearth"',
    directionLabel: "FLAGSHIP DIRECTION",
    focusLabel: "SEMANTIC STRUCTURE",
  };
}

function getFlagshipThemes(themes) {
  return FLAVOR_IDS.map((schemeId) => {
    const flavor = FLAVORS_BY_ID[schemeId];
    return (
      themes.find((theme) => theme.schemeId === schemeId && theme.variantId === flavor.defaultVariant) ||
      themes.find((theme) => theme.schemeId === schemeId && theme.isDark) ||
      themes.find((theme) => theme.schemeId === schemeId)
    );
  }).filter(Boolean);
}

function orderThemesForPreview(themes) {
  const flavorOrder = new Map(FLAVOR_IDS.map((schemeId, index) => [schemeId, index]));
  const variantOrder = new Map([
    ["dark", 0],
    ["light", 1],
    ["darkSoft", 2],
    ["lightSoft", 3],
  ]);

  return [...themes].sort((a, b) => {
    const variantDelta = (variantOrder.get(a.variantId) ?? 99) - (variantOrder.get(b.variantId) ?? 99);
    if (variantDelta !== 0) return variantDelta;
    return (flavorOrder.get(a.schemeId) ?? 99) - (flavorOrder.get(b.schemeId) ?? 99);
  });
}

function renderLegendRow({ x, y, entries, textColor, fontSize = 12.5 }) {
  let cursorX = x;
  return entries.map((entry) => {
    const labelWidth = Math.max(54, entry.label.length * (fontSize * 0.58));
    const rendered = `
      <g>
        <circle cx="${cursorX + 7}" cy="${y + 7}" r="6" fill="${entry.color}" />
        <text x="${cursorX + 20}" y="${y - 2}" fill="${entry.color || textColor}" font-size="${fontSize}" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">${escapeXml(entry.label)}</text>
      </g>
    `;
    cursorX += labelWidth + 44;
    return rendered;
  }).join("");
}

function renderChipRow({ chips, x, y, accentColor }) {
  let chipX = x;
  return chips.map((chip, index) => {
    const width = Math.max(118, chip.length * 7.2 + 30);
    const fill = withAlpha(index === 0 ? accentColor : "#d3c9b8", index === 0 ? 0.18 : 0.06);
    const stroke = withAlpha(index === 0 ? accentColor : "#d3c9b8", index === 0 ? 0.34 : 0.16);
    const rendered = `
      <g>
        <rect x="${chipX}" y="${y}" width="${width}" height="26" rx="13" fill="${fill}" stroke="${stroke}" />
        <text x="${chipX + 14}" y="${y + 6}" fill="${index === 0 ? accentColor : "#e5d7c3"}" font-size="12.5" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">${escapeXml(chip)}</text>
      </g>
    `;
    chipX += width + 8;
    return rendered;
  }).join("");
}

function renderFlagshipCard({ meta, x, y, width, height }) {
  const copy = getFlavorPreviewCopy(meta.schemeId);
  const theme = meta.theme;
  const bg = themeColor(theme, "editor.background", "#211d1a");
  const fg = themeColor(theme, "editor.foreground", "#d3c9b8");
  const cardFill = mixHex(bg, "#000000", 0.1);
  const border = mixHex(themeColor(theme, "tab.border", "#35302b"), fg, 0.14);
  const panel = themeColor(theme, "editorGroupHeader.tabsBackground", mixHex(bg, "#000000", 0.08));
  const codeBg = mixHex(bg, "#000000", 0.03);
  const tabActive = mixHex(bg, fg, 0.09);
  const muted = mixHex(fg, bg, 0.5);
  const gutterText = mixHex(fg, bg, 0.62);
  const callable = roleColor(theme, "function");
  const keyword = roleColor(theme, "keyword");
  const string = roleColor(theme, "string");
  const directionColor = meta.schemeId === "moss" ? callable : keyword;
  const lines = [
    [{ role: "comment", text: copy.comment }],
    [{ role: "keyword", text: "type " }, { role: "type", text: "Palette" }, { role: "plain", text: " = {" }],
    [{ role: "plain", text: "  " }, { role: "property", text: "mode" }, { role: "plain", text: ": " }, { role: "string", text: copy.sampleString }, { role: "plain", text: "," }],
    [{ role: "plain", text: "  " }, { role: "property", text: "callable" }, { role: "plain", text: ": " }, { role: "function", text: copy.sampleFunction }, { role: "plain", text: "(" }, { role: "string", text: copy.sampleValue }, { role: "plain", text: ")," }],
    [{ role: "keyword", text: "const " }, { role: "variable", text: copy.sampleVariable }, { role: "plain", text: " = " }, { role: "function", text: copy.sampleFunction }, { role: "plain", text: "(" }, { role: "string", text: copy.sampleValue }, { role: "plain", text: ");" }],
  ];
  const codePanelX = x + 20;
  const codePanelY = y + 108;
  const codePanelWidth = width - 40;
  const codePanelHeight = 178;
  const codeFontSize = 18;
  const codeLineHeight = 30;
  const codeGutterX = codePanelX + 12;
  const codeTextX = codePanelX + 38;
  const codeBlockHeight = codeFontSize + (lines.length - 1) * codeLineHeight;
  const codeStartY = codePanelY + Math.round((codePanelHeight - codeBlockHeight) / 2);

  const renderedLines = lines.map((segments, index) => {
    const lineY = codeStartY + index * codeLineHeight;
    return `
      <text x="${codeGutterX}" y="${lineY}" fill="${gutterText}" font-size="13.5" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Courier New', monospace" dominant-baseline="text-before-edge">${index + 1}</text>
      ${renderCodeLine({ theme, segments, x: codeTextX, y: lineY, fontSize: codeFontSize })}
    `;
  }).join("");

  return `
    <g>
      <rect x="${x + 10}" y="${y + 14}" width="${width}" height="${height}" rx="28" fill="${withAlpha("#000000", 0.18)}" />
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="26" fill="${cardFill}" stroke="${border}" stroke-width="1.2" />
      <rect x="${x + 20}" y="${y + 22}" width="${width - 40}" height="48" rx="16" fill="${panel}" />
      <circle cx="${x + 42}" cy="${y + 46}" r="5" fill="${withAlpha(keyword, 0.92)}" />
      <circle cx="${x + 60}" cy="${y + 46}" r="5" fill="${withAlpha(string, 0.88)}" />
      <circle cx="${x + 78}" cy="${y + 46}" r="5" fill="${withAlpha(callable, 0.92)}" />
      <rect x="${x + 104}" y="${y + 33}" width="154" height="26" rx="13" fill="${tabActive}" />
      <text x="${x + 122}" y="${y + 39}" fill="${fg}" font-size="14" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">${escapeXml(meta.shortName)}</text>
      <text x="${x + width - 182}" y="${y + 38}" fill="${muted}" font-size="12" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" letter-spacing="0.14em" dominant-baseline="text-before-edge">${escapeXml(copy.directionLabel)}</text>

      <text x="${x + 24}" y="${y + 84}" fill="${muted}" font-size="12" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" letter-spacing="0.14em" dominant-baseline="text-before-edge">${escapeXml(`${meta.flavor.name.toUpperCase()} / ${meta.climateLabel.toUpperCase()}`)}</text>
      <text x="${x + width - 132}" y="${y + 84}" fill="${directionColor}" font-size="12" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" letter-spacing="0.12em" dominant-baseline="text-before-edge">${escapeXml(copy.focusLabel)}</text>

      <rect x="${codePanelX}" y="${codePanelY}" width="${codePanelWidth}" height="${codePanelHeight}" rx="18" fill="${codeBg}" stroke="${withAlpha(fg, 0.08)}" />
      ${renderedLines}

      ${renderChipRow({
        chips: copy.chips,
        x: x + 24,
        y: y + height - 82,
        accentColor: directionColor,
      })}
      ${renderLegendRow({
        x: x + 24,
        y: y + height - 38,
        textColor: fg,
        entries: [
          { label: "keyword", color: keyword },
          { label: "function", color: callable },
          { label: "string", color: string },
        ],
      })}
    </g>
  `;
}

function renderFlavorComparisonCard({ themes, x, y, width, height }) {
  const baseTheme = themes[0]?.theme || {};
  const bg = themeColor(baseTheme, "editor.background", "#211d1a");
  const fg = themeColor(baseTheme, "editor.foreground", "#d3c9b8");
  const cardBg = mixHex(bg, "#000000", 0.06);
  const border = mixHex(themeColor(baseTheme, "tab.border", "#35302b"), fg, 0.12);
  const muted = mixHex(fg, bg, 0.46);
  const sectionHeight = 132;

  const sections = themes.map((meta, index) => {
    const copy = getFlavorPreviewCopy(meta.schemeId);
    const keyword = roleColor(meta.theme, "keyword");
    const callable = roleColor(meta.theme, "function");
    const accent = meta.schemeId === "moss" ? callable : keyword;
    const sectionY = y + 54 + index * (sectionHeight + 18);
    return `
      <g>
        <rect x="${x + 22}" y="${sectionY}" width="${width - 44}" height="${sectionHeight}" rx="18" fill="${withAlpha("#ffffff", 0.02)}" stroke="${withAlpha(accent, 0.22)}" />
        <rect x="${x + 22}" y="${sectionY}" width="6" height="${sectionHeight}" rx="3" fill="${accent}" />
        <text x="${x + 44}" y="${sectionY + 18}" fill="${fg}" font-size="20" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">${escapeXml(meta.flavor.name)}</text>
        <text x="${x + width - 164}" y="${sectionY + 18}" fill="${accent}" font-size="12" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" letter-spacing="0.14em" dominant-baseline="text-before-edge">${escapeXml(meta.climateLabel.toUpperCase())}</text>
        ${renderWrappedText({
          text: copy.summary,
          x: x + 44,
          y: sectionY + 48,
          maxWidth: width - 88,
          lineHeight: 18,
          fontSize: 14,
          fill: muted,
          fontFamily: "'Segoe UI', 'Noto Sans', sans-serif",
        })}
        ${renderChipRow({
          chips: copy.chips,
          x: x + 44,
          y: sectionY + 92,
          accentColor: accent,
        })}
      </g>
    `;
  }).join("");

  return `
    <g>
      <rect x="${x + 10}" y="${y + 14}" width="${width}" height="${height}" rx="28" fill="${withAlpha("#000000", 0.12)}" />
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="26" fill="${cardBg}" stroke="${border}" stroke-width="1.2" />
      <text x="${x + 22}" y="${y + 20}" fill="#efe2ce" font-size="12" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" letter-spacing="0.14em" dominant-baseline="text-before-edge">TWO FLAGSHIP DIRECTIONS</text>
      <text x="${x + 22}" y="${y + 40}" fill="${muted}" font-size="14" font-family="'Segoe UI', 'Noto Sans', sans-serif" dominant-baseline="text-before-edge">One semantic language. Two clearly different material worlds.</text>
      ${sections}
    </g>
  `;
}

function renderVariantMiniCard({ meta, x, y, width, height }) {
  const copy = getFlavorPreviewCopy(meta.schemeId);
  const bg = themeColor(meta.theme, "editor.background", "#211d1a");
  const fg = themeColor(meta.theme, "editor.foreground", "#d3c9b8");
  const border = mixHex(themeColor(meta.theme, "tab.border", "#35302b"), fg, meta.variantId.startsWith("light") ? 0.22 : 0.14);
  const cardBg = mixHex(bg, meta.variantId.startsWith("light") ? "#ffffff" : "#000000", meta.variantId.startsWith("light") ? 0.04 : 0.08);
  const muted = mixHex(fg, bg, 0.46);
  const keyword = roleColor(meta.theme, "keyword");
  const callable = roleColor(meta.theme, "function");
  const string = roleColor(meta.theme, "string");
  const samplePanelX = x + 22;
  const samplePanelY = y + 92;
  const samplePanelWidth = width - 44;
  const samplePanelHeight = 56;
  const sampleFontSize = 16;
  const sampleY = samplePanelY + Math.round((samplePanelHeight - sampleFontSize) / 2);
  const sample = renderCodeLine({
    theme: meta.theme,
    x: samplePanelX + 18,
    y: sampleY,
    fontSize: sampleFontSize,
    segments: [
      { role: "keyword", text: "if " },
      { role: "plain", text: "ready " },
      { role: "function", text: copy.sampleFunction },
      { role: "plain", text: "(" },
      { role: "string", text: copy.sampleValue },
      { role: "plain", text: ")" },
    ],
  });

  return `
    <g>
      <rect x="${x + 8}" y="${y + 12}" width="${width}" height="${height}" rx="26" fill="${withAlpha("#000000", 0.12)}" />
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="24" fill="${cardBg}" stroke="${border}" stroke-width="1.2" />
      <text x="${x + 22}" y="${y + 18}" fill="${muted}" font-size="12" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" letter-spacing="0.14em" dominant-baseline="text-before-edge">${escapeXml(`${meta.flavor.name} / ${meta.climateLabel}`.toUpperCase())}</text>
      <text x="${x + 22}" y="${y + 40}" fill="${fg}" font-size="22" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">${escapeXml(meta.shortName)}</text>
      <text x="${x + 22}" y="${y + 70}" fill="${muted}" font-size="14" font-family="'Segoe UI', 'Noto Sans', sans-serif" dominant-baseline="text-before-edge">${escapeXml(meta.summary)}</text>
      <rect x="${samplePanelX}" y="${samplePanelY}" width="${samplePanelWidth}" height="${samplePanelHeight}" rx="16" fill="${mixHex(bg, fg, meta.variantId.startsWith("light") ? 0.08 : 0.05)}" />
      ${sample}
      ${renderLegendRow({
        x: x + 22,
        y: y + height - 34,
        textColor: fg,
        entries: [
          { label: "keyword", color: keyword },
          { label: "function", color: callable },
          { label: "string", color: string },
        ],
      })}
    </g>
  `;
}

function renderPaletteSwatchStrip({ x, y, colors }) {
  return colors.map((color, index) => `
    <rect x="${x + index * 34}" y="${y}" width="24" height="10" rx="5" fill="${color}" />
  `).join("");
}

function renderSkeletonPreviewCard({ meta, x, y, width, height }) {
  const theme = meta.theme;
  const bg = themeColor(theme, "editor.background", "#211d1a");
  const fg = themeColor(theme, "editor.foreground", "#d3c9b8");
  const panel = themeColor(
    theme,
    "editorGroupHeader.tabsBackground",
    mixHex(bg, meta.isDark ? "#000000" : "#ffffff", meta.isDark ? 0.07 : 0.03),
  );
  const cardFill = mixHex(bg, meta.isDark ? "#000000" : "#ffffff", meta.isDark ? 0.07 : 0.035);
  const border = mixHex(themeColor(theme, "tab.border", "#35302b"), fg, meta.isDark ? 0.14 : 0.24);
  const muted = mixHex(fg, bg, 0.54);
  const labelMuted = mixHex(fg, bg, 0.68);
  const surface = mixHex(bg, fg, meta.isDark ? 0.045 : 0.065);
  const surfaceStroke = withAlpha(fg, meta.isDark ? 0.08 : 0.12);
  const skeletonBase = mixHex(bg, fg, meta.isDark ? 0.13 : 0.11);
  const skeletonSoft = mixHex(bg, fg, meta.isDark ? 0.08 : 0.07);
  const accentKeyword = roleColor(theme, "keyword");
  const accentCallable = roleColor(theme, "function");
  const accentType = roleColor(theme, "type");
  const accentString = roleColor(theme, "string");
  const accent = meta.schemeId === "moss" ? accentCallable : accentKeyword;
  const previewX = x + 24;
  const previewY = y + 116;
  const previewWidth = width - 48;
  const previewHeight = 108;
  const lineStartX = previewX + 56;
  const lineNumberX = previewX + 18;
  const barAreaWidth = previewWidth - 86;
  const lineHeight = 18;
  const barHeight = 10;
  const rows = [
    [{ width: 0.58, fill: skeletonBase }],
    [
      { width: 0.12, fill: accentKeyword },
      { width: 0.26, fill: skeletonBase },
      { width: 0.16, fill: accentCallable },
      { width: 0.11, fill: accentString },
    ],
    [
      { width: 0.18, fill: accentType },
      { width: 0.08, fill: skeletonSoft },
      { width: 0.24, fill: skeletonBase },
    ],
    [
      { width: 0.11, fill: accentKeyword },
      { width: 0.23, fill: accentCallable },
      { width: 0.1, fill: accentType },
      { width: 0.2, fill: skeletonBase },
    ],
    [
      { width: 0.14, fill: skeletonSoft },
      { width: 0.12, fill: accentString },
      { width: 0.22, fill: skeletonBase },
      { width: 0.08, fill: skeletonSoft },
    ],
  ];

  const renderedRows = rows.map((segments, index) => {
    const rowY = previewY + 22 + index * lineHeight;
    let segmentX = lineStartX;
    const renderedSegments = segments.map((segment) => {
      const segmentWidth = Math.max(24, Math.round(barAreaWidth * segment.width));
      const markup = `<rect x="${segmentX}" y="${rowY}" width="${segmentWidth}" height="${barHeight}" rx="${Math.round(barHeight / 2)}" fill="${segment.fill}" />`;
      segmentX += segmentWidth + 10;
      return markup;
    }).join("");

    return `
      <rect x="${lineNumberX}" y="${rowY + 1}" width="12" height="8" rx="4" fill="${labelMuted}" />
      ${renderedSegments}
    `;
  }).join("");

  const tabs = [
    { width: 86, fill: mixHex(bg, fg, meta.isDark ? 0.1 : 0.08) },
    { width: 68, fill: mixHex(bg, fg, meta.isDark ? 0.05 : 0.04) },
    { width: 62, fill: mixHex(bg, fg, meta.isDark ? 0.05 : 0.04) },
  ];

  let tabX = x + 96;
  const renderedTabs = tabs.map((tab) => {
    const markup = `<rect x="${tabX}" y="${y + 26}" width="${tab.width}" height="20" rx="10" fill="${tab.fill}" />`;
    tabX += tab.width + 10;
    return markup;
  }).join("");

  return `
    <g>
      <rect x="${x + 10}" y="${y + 12}" width="${width}" height="${height}" rx="26" fill="${withAlpha("#000000", 0.14)}" />
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="24" fill="${cardFill}" stroke="${border}" stroke-width="1.2" />
      <rect x="${x + 20}" y="${y + 18}" width="${width - 40}" height="36" rx="14" fill="${panel}" />
      <circle cx="${x + 40}" cy="${y + 36}" r="4.5" fill="${withAlpha(accentKeyword, 0.9)}" />
      <circle cx="${x + 56}" cy="${y + 36}" r="4.5" fill="${withAlpha(accentString, 0.88)}" />
      <circle cx="${x + 72}" cy="${y + 36}" r="4.5" fill="${withAlpha(accentCallable, 0.9)}" />
      ${renderedTabs}

      <text x="${x + 24}" y="${y + 64}" fill="${labelMuted}" font-size="12" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" letter-spacing="0.14em" dominant-baseline="text-before-edge">${escapeXml(`${meta.flavor.name} / ${meta.climateLabel}`.toUpperCase())}</text>
      <text x="${x + 24}" y="${y + 82}" fill="${fg}" font-size="26" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">${escapeXml(meta.shortName)}</text>
      <rect x="${x + width - 146}" y="${y + 66}" width="118" height="26" rx="13" fill="${withAlpha(accent, meta.isDark ? 0.18 : 0.16)}" stroke="${withAlpha(accent, 0.32)}" />
      <text x="${x + width - 126}" y="${y + 72}" fill="${accent}" font-size="12" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" letter-spacing="0.12em" dominant-baseline="text-before-edge">${escapeXml(meta.isDark ? "DARK" : "LIGHT")}</text>

      <rect x="${previewX}" y="${previewY}" width="${previewWidth}" height="${previewHeight}" rx="18" fill="${surface}" stroke="${surfaceStroke}" />
      ${renderedRows}

      ${renderPaletteSwatchStrip({
        x: x + 24,
        y: y + height - 36,
        colors: [accentKeyword, accentCallable, accentType, accentString],
      })}
      <text x="${x + 170}" y="${y + height - 42}" fill="${muted}" font-size="13" font-family="'Segoe UI', 'Noto Sans', sans-serif" dominant-baseline="text-before-edge">${escapeXml(meta.summary)}</text>
    </g>
  `;
}

function renderPromoBoardSvg({ themes }) {
  const orderedThemes = orderThemesForPreview(themes);
  const darkThemes = orderedThemes.filter((theme) => theme.isDark);
  const lightThemes = orderedThemes.filter((theme) => !theme.isDark);
  const defaultThemeMeta = orderedThemes.find((theme) => theme.isDefaultTheme) || orderedThemes[0];
  const emberTheme = orderedThemes.find((theme) => theme.schemeId === "ember") || defaultThemeMeta;
  const mossTheme = orderedThemes.find((theme) => theme.schemeId === "moss") || orderedThemes.find((theme) => theme !== emberTheme) || defaultThemeMeta;
  const gradientId = "promo-board-bg";
  const warmGlowId = "promo-board-glow-warm";
  const mossGlowId = "promo-board-glow-moss";
  const darkLabel = PREVIEW.familyLabels?.dark || "DARK STARTING POINTS";
  const lightLabel = PREVIEW.familyLabels?.light || "LIGHT STARTING POINTS";
  const cardWidth = 748;
  const cardHeight = 286;
  const leftX = 40;
  const rightX = leftX + cardWidth + 24;
  const topRowY = 206;
  const bottomRowY = 536;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
      <defs>
        <linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#17130f" />
          <stop offset="55%" stop-color="#241b15" />
          <stop offset="100%" stop-color="#2b221c" />
        </linearGradient>
        <radialGradient id="${warmGlowId}" cx="0.16" cy="0.12" r="0.74">
          <stop offset="0%" stop-color="${withAlpha(roleColor(emberTheme?.theme || defaultThemeMeta.theme, "keyword"), 0.28)}" />
          <stop offset="42%" stop-color="${withAlpha(roleColor(emberTheme?.theme || defaultThemeMeta.theme, "function"), 0.12)}" />
          <stop offset="100%" stop-color="${withAlpha("#000000", 0)}" />
        </radialGradient>
        <radialGradient id="${mossGlowId}" cx="0.84" cy="0.16" r="0.64">
          <stop offset="0%" stop-color="${withAlpha(roleColor(mossTheme?.theme || defaultThemeMeta.theme, "function"), 0.24)}" />
          <stop offset="48%" stop-color="${withAlpha(roleColor(mossTheme?.theme || defaultThemeMeta.theme, "type"), 0.1)}" />
          <stop offset="100%" stop-color="${withAlpha("#000000", 0)}" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="url(#${gradientId})" />
      <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="url(#${warmGlowId})" />
      <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="url(#${mossGlowId})" />
      <text x="56" y="58" fill="#efe4d0" font-size="18" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" letter-spacing="0.08em" dominant-baseline="text-before-edge">${escapeXml((PREVIEW.badgeLabel || PRODUCT.name).toUpperCase())}</text>
      <text x="56" y="88" fill="#f2e7d2" font-size="46" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">${escapeXml(PREVIEW.headline)}</text>
      <text x="56" y="136" fill="#bfa88d" font-size="19" font-family="'Segoe UI', 'Noto Sans', sans-serif" dominant-baseline="text-before-edge">${escapeXml(PREVIEW.subheadline)}</text>
      <text x="56" y="172" fill="${roleColor(emberTheme?.theme || defaultThemeMeta.theme, "keyword")}" font-size="12" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" letter-spacing="0.16em" dominant-baseline="text-before-edge">${escapeXml(darkLabel)}</text>
      ${darkThemes[0] ? renderSkeletonPreviewCard({ meta: darkThemes[0], x: leftX, y: topRowY, width: cardWidth, height: cardHeight }) : ""}
      ${darkThemes[1] ? renderSkeletonPreviewCard({ meta: darkThemes[1], x: rightX, y: topRowY, width: cardWidth, height: cardHeight }) : ""}
      <text x="56" y="502" fill="${roleColor(mossTheme?.theme || defaultThemeMeta.theme, "function")}" font-size="12" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" letter-spacing="0.16em" dominant-baseline="text-before-edge">${escapeXml(lightLabel)}</text>
      ${lightThemes[0] ? renderSkeletonPreviewCard({ meta: lightThemes[0], x: leftX, y: bottomRowY, width: cardWidth, height: cardHeight }) : ""}
      ${lightThemes[1] ? renderSkeletonPreviewCard({ meta: lightThemes[1], x: rightX, y: bottomRowY, width: cardWidth, height: cardHeight }) : ""}
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

  const themes = FEATURED_THEME_META.map((meta) => ({ ...meta, theme: readJson(meta.file) }));
  const missingThemeIds = FEATURED_THEME_META
    .map((meta) => meta.id)
    .filter((id) => !themes.some((meta) => meta.id === id));
  if (missingThemeIds.length > 0) {
    throw new Error(`Theme metadata is incomplete: ${missingThemeIds.join(", ")}`);
  }

  const contrastSvg = renderContrastSvg({ themes });
  const previewFlavorMeta = FLAVOR_IDS.map((schemeId) => ({
    id: schemeId,
    name: FLAVORS_BY_ID[schemeId].name,
    headline: FLAVORS_BY_ID[schemeId].headline,
    summary: FLAVORS_BY_ID[schemeId].summary,
  }));

  const promoSpecSha256 = sha256(JSON.stringify({
    renderer: PREVIEW_RENDERER,
    product: {
      id: PRODUCT.id,
      name: PRODUCT.name,
      displayName: PRODUCT.displayName,
      summary: PRODUCT.summary,
    },
    flavors: previewFlavorMeta,
    featuredThemes: themes.map((meta) => ({
      id: meta.id,
      schemeId: meta.schemeId,
      variantId: meta.variantId,
      name: meta.name,
      summary: meta.summary,
    })),
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
        flavors: previewFlavorMeta,
        featuredThemes: themes.map((meta) => ({
          id: meta.id,
          schemeId: meta.schemeId,
          variantId: meta.variantId,
          name: meta.name,
          shortName: meta.shortName,
          summary: meta.summary,
          file: toPosixPath(meta.file),
          theme: meta.theme,
        })),
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
