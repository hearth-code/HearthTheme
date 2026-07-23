import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { getThemeMetaListForSchemeId, loadColorProductManifest, loadColorProductPreviewConfig, loadColorSchemeManifestById, loadRoleAdapters } from "./color-system.mjs";

const WIDTH = 1600;
const HEIGHT = 900;
const OUTPUT_DIR = join("extension", "images");
const WEBSITE_OUTPUT_DIR = join("public", "previews");
const MARKETING_OUTPUT_DIR = join("docs", "marketing");
const MANIFEST_PATH = join("reports", "preview-manifest.json");
const PREVIEW_RENDERER = "semantic-rift-v2";
const GENERATOR_SOURCE_SHA256 = createHash("sha256").update(readFileSync(new URL(import.meta.url))).digest("hex");

const PRODUCT = loadColorProductManifest();
const PREVIEW = loadColorProductPreviewConfig();
const CONTRAST_OUTPUTS = [
  join(OUTPUT_DIR, "family-overview.png"),
  join(WEBSITE_OUTPUT_DIR, "family-overview.png"),
];
const EDITOR_HERO_OUTPUTS = [
  join(OUTPUT_DIR, "editor-moss-dark-light.png"),
];
const FORGE_WORKFLOW_OUTPUTS = [
  join(OUTPUT_DIR, "theme-forge-workflow.png"),
];
const DIRECTION_ATLAS_OUTPUTS = [join(MARKETING_OUTPUT_DIR, "direction-atlas.png")];
const PLATFORM_COVERAGE_OUTPUTS = [join(MARKETING_OUTPUT_DIR, "platform-coverage.png")];
const MOSS_SURFACES_OUTPUTS = [join(MARKETING_OUTPUT_DIR, "moss-surfaces.png")];
const OG_OUTPUTS = [join("public", "og-hearth.png")];
const LEGACY_PREVIEW_OUTPUTS = [
  join(OUTPUT_DIR, "preview-contrast-v2.png"),
  join(WEBSITE_OUTPUT_DIR, "preview-contrast-v2.png"),
  join(OUTPUT_DIR, "preview-editor-hero.png"),
  join(OUTPUT_DIR, "preview-forge-workflow.png"),
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
  join(WEBSITE_OUTPUT_DIR, "preview-editor-hero.png"),
  join(WEBSITE_OUTPUT_DIR, "preview-forge-workflow.png"),
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

function requiredThemeColor(meta, key) {
  const color = normalizeHex(meta.theme?.colors?.[key]);
  if (!color) {
    throw new Error(`Preview color contract: ${meta.id} is missing theme color "${key}"`);
  }
  return color;
}

function requiredRoleColor(meta, role) {
  const color = normalizeHex(roleColor(meta.theme, role));
  if (!color) {
    throw new Error(`Preview color contract: ${meta.id} is missing syntax role "${role}"`);
  }
  return color;
}

function buildMarketingColorContract(themes) {
  return {
    policy: "theme-source-only-v1",
    structuralColorRule: "Signature fields and swatches use unmodified shipped theme tokens; structural overlays use only alpha or mixes of those tokens.",
    themes: Object.fromEntries(themes.map((meta) => [meta.id, {
      source: toPosixPath(meta.file),
      sourceSha256: meta.sourceSha256,
      colors: {
        surface: requiredThemeColor(meta, "editor.background"),
        foreground: requiredThemeColor(meta, "editor.foreground"),
        keyword: requiredRoleColor(meta, "keyword"),
        function: requiredRoleColor(meta, "function"),
        type: requiredRoleColor(meta, "type"),
        string: requiredRoleColor(meta, "string"),
        property: requiredRoleColor(meta, "property"),
        operator: requiredRoleColor(meta, "operator"),
      },
    }])),
  };
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
  const previewFlavorIds = [...new Set(["ember", "moss", ...FLAVOR_IDS])];
  const flavorOrder = new Map(previewFlavorIds.map((schemeId, index) => [schemeId, index]));
  const variantOrder = new Map([
    ["dark", 0],
    ["light", 1],
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

function buildFamilySampleLines(meta) {
  const lines = [
    [{ role: "keyword", text: "const " }, { role: "variable.readonly", text: "theme" }, { role: "operator", text: " = " }, { role: "punctuation", text: "{" }],
    [{ role: "plain", text: "  " }, { role: "property", text: "direction" }, { role: "operator", text: ": " }, { role: "string", text: `"${meta.schemeId}"` }, { role: "punctuation", text: "," }],
    [{ role: "plain", text: "  " }, { role: "property", text: "mode" }, { role: "operator", text: ": " }, { role: "string", text: `"${meta.variantId}"` }, { role: "punctuation", text: "," }],
    [{ role: "punctuation", text: "} " }, { role: "keyword", text: "as const" }, { role: "punctuation", text: ";" }],
  ];
  const expected = (PREVIEW.samples?.family?.lines || []).map((line) => line
    .replaceAll("{direction}", meta.schemeId)
    .replaceAll("{mode}", meta.variantId));
  const actual = lines.map((segments) => segments.map((segment) => segment.text).join(""));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Preview sample contract: generated family sample for ${meta.id} does not match products/hearthcode/preview.json`);
  }
  return lines;
}

function buildEditorSampleLines(meta) {
  const lines = [
    [{ role: "keyword", text: "type " }, { role: "type", text: "ThemePreview" }, { role: "operator", text: " = " }, { role: "punctuation", text: "{" }],
    [{ role: "plain", text: "  " }, { role: "property", text: "direction" }, { role: "operator", text: ": " }, { role: "string", text: '"ember"' }, { role: "operator", text: " | " }, { role: "string", text: '"moss"' }, { role: "punctuation", text: ";" }],
    [{ role: "plain", text: "  " }, { role: "property", text: "mode" }, { role: "operator", text: ": " }, { role: "string", text: '"dark"' }, { role: "operator", text: " | " }, { role: "string", text: '"light"' }, { role: "punctuation", text: ";" }],
    [{ role: "punctuation", text: "};" }],
    [{ role: "keyword", text: "const " }, { role: "variable.readonly", text: "theme" }, { role: "operator", text: ": " }, { role: "type", text: "ThemePreview" }, { role: "operator", text: " = " }, { role: "punctuation", text: "{" }],
    [{ role: "plain", text: "  " }, { role: "property", text: "direction" }, { role: "operator", text: ": " }, { role: "string", text: '"moss"' }, { role: "punctuation", text: "," }],
    [{ role: "plain", text: "  " }, { role: "property", text: "mode" }, { role: "operator", text: ": " }, { role: "string", text: `"${meta.variantId}"` }, { role: "punctuation", text: "," }],
    [{ role: "punctuation", text: "};" }],
  ];
  const expected = (PREVIEW.samples?.editors?.lines || []).map((line) => line.replaceAll("{mode}", meta.variantId));
  const actual = lines.map((segments) => segments.map((segment) => segment.text).join(""));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Preview sample contract: generated editor sample for ${meta.id} does not match products/hearthcode/preview.json`);
  }
  return lines;
}

function renderRiftSample({ meta, x, y, scale }) {
  const foreground = requiredThemeColor(meta, "editor.foreground");
  const lines = buildFamilySampleLines(meta);
  const fontSize = 18 * scale;
  const lineHeight = 27 * scale;
  const tokenColors = ["keyword", "function", "type", "string", "property", "operator"]
    .map((role) => requiredRoleColor(meta, role));
  const label = `${meta.flavor.name} ${meta.climateLabel}`.toUpperCase();
  return `
    <g>
      <text x="${x}" y="${y}" fill="${foreground}" font-size="${13 * scale}" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="800" letter-spacing="0.15em" dominant-baseline="text-before-edge">${escapeXml(label)}</text>
      ${lines.map((segments, index) => renderCodeLine({
        theme: meta.theme,
        segments,
        x,
        y: y + 28 * scale + index * lineHeight,
        fontSize,
      })).join("")}
      ${tokenColors.map((color, index) => `<rect x="${x + index * 38 * scale}" y="${y + 142 * scale}" width="${29 * scale}" height="${7 * scale}" fill="${color}" />`).join("")}
    </g>
  `;
}

function renderSemanticRiftSvg({ themes, width = WIDTH, height = HEIGHT }) {
  const scale = Math.min(width / WIDTH, height / HEIGHT);
  const emberDark = getPreviewTheme(themes, "ember", "dark");
  const mossDark = getPreviewTheme(themes, "moss", "dark");
  const emberLight = getPreviewTheme(themes, "ember", "light");
  const mossLight = getPreviewTheme(themes, "moss", "light");
  const emberDarkBg = requiredThemeColor(emberDark, "editor.background");
  const mossDarkBg = requiredThemeColor(mossDark, "editor.background");
  const emberLightBg = requiredThemeColor(emberLight, "editor.background");
  const mossLightBg = requiredThemeColor(mossLight, "editor.background");
  const emberDarkFg = requiredThemeColor(emberDark, "editor.foreground");
  const mossDarkFg = requiredThemeColor(mossDark, "editor.foreground");
  const emberAccent = requiredRoleColor(emberDark, "keyword");
  const mossAccent = requiredRoleColor(mossDark, "function");
  const splitY = Math.round(height * 0.58);
  const riftTopX = Math.round(width * 0.82);
  const riftMidX = Math.round(width * 0.56);
  const riftBottomX = Math.round(width * 0.38);
  const headline = PREVIEW.marketing?.familyHeadline || "EMBER / MOSS";
  const subheadline = PREVIEW.marketing?.familySubheadline || "FOUR THEMES. ONE COLOR LANGUAGE.";
  const [emberWord = "EMBER", mossWord = "MOSS"] = headline.split("/").map((word) => word.trim());
  const leftX = 56 * scale;
  const rightX = width - 470 * scale;
  const darkSampleY = 330 * scale;
  const lightSampleY = height - 222 * scale;
  const headlineY = 80 * scale;
  const headlineSize = 128 * scale;
  const slashX = 500 * scale;
  const mossX = 608 * scale;
  const riftPoints = `${riftTopX},0 ${riftMidX},${splitY} ${riftBottomX},${height}`;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${splitY}" fill="${mossDarkBg}" />
      <polygon points="0,0 ${riftTopX},0 ${riftMidX},${splitY} 0,${splitY}" fill="${emberDarkBg}" />
      <rect y="${splitY}" width="${width}" height="${height - splitY}" fill="${mossLightBg}" />
      <polygon points="0,${splitY} ${riftMidX},${splitY} ${riftBottomX},${height} 0,${height}" fill="${emberLightBg}" />

      <g opacity="0.16">
        ${Array.from({ length: 16 }, (_, index) => `<line x1="0" y1="${index * 58 * scale}" x2="${width}" y2="${index * 58 * scale}" stroke="${index * 58 * scale < splitY ? mossDarkFg : requiredThemeColor(mossLight, "editor.foreground")}" stroke-width="1" />`).join("")}
      </g>
      <polyline points="${riftPoints}" fill="none" stroke="${mossDarkFg}" stroke-width="${14 * scale}" />
      <polyline points="${riftPoints}" fill="none" stroke="${emberAccent}" stroke-width="${4 * scale}" stroke-dasharray="${18 * scale} ${10 * scale}" />

      <text x="${leftX}" y="${30 * scale}" fill="${emberDarkFg}" font-size="${20 * scale}" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="800" letter-spacing="0.2em" dominant-baseline="text-before-edge">${escapeXml((PREVIEW.badgeLabel || PRODUCT.name).toUpperCase())}</text>
      <text x="${leftX}" y="${headlineY}" fill="${emberAccent}" font-size="${headlineSize}" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="850" letter-spacing="-0.035em" dominant-baseline="text-before-edge">${escapeXml(emberWord)}</text>
      <text x="${slashX}" y="${headlineY}" fill="${emberDarkFg}" font-size="${headlineSize}" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="760" dominant-baseline="text-before-edge">/</text>
      <text x="${mossX}" y="${headlineY}" fill="${mossAccent}" font-size="${headlineSize}" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="850" letter-spacing="-0.035em" dominant-baseline="text-before-edge">${escapeXml(mossWord)}</text>
      <text x="${leftX}" y="${230 * scale}" fill="${emberDarkFg}" font-size="${38 * scale}" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="800" letter-spacing="0.025em" dominant-baseline="text-before-edge">${escapeXml(subheadline)}</text>

      ${renderRiftSample({ meta: emberDark, x: leftX, y: darkSampleY, scale })}
      ${renderRiftSample({ meta: mossDark, x: rightX, y: darkSampleY + 12 * scale, scale })}
      ${renderRiftSample({ meta: emberLight, x: leftX, y: lightSampleY, scale })}
      ${renderRiftSample({ meta: mossLight, x: rightX, y: lightSampleY, scale })}
    </svg>
  `;
}

function renderContrastSvg({ themes }) {
  return renderSemanticRiftSvg({ themes });
}

function renderNumberedCodeBlock({ theme, lines, x, y, fontSize = 19, lineHeight = 34 }) {
  const bg = themeColor(theme, "editor.background", "#211d1a");
  const fg = themeColor(theme, "editor.foreground", "#d3c9b8");
  const gutter = mixHex(fg, bg, 0.64);

  return lines.map((segments, index) => {
    if (segments.length === 0) return "";
    const lineY = y + index * lineHeight;
    return `
      <text x="${x}" y="${lineY + 2}" fill="${gutter}" font-size="${fontSize - 4}" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" dominant-baseline="text-before-edge">${index + 1}</text>
      ${renderCodeLine({ theme, segments, x: x + 42, y: lineY, fontSize })}
    `;
  }).join("");
}

function renderEditorHeroSvg({ themes }) {
  const ordered = orderThemesForPreview(themes);
  const mossDark = ordered.find((theme) => theme.schemeId === "moss" && theme.isDark) || ordered.find((theme) => theme.isDark) || ordered[0];
  const mossLight = ordered.find((theme) => theme.schemeId === "moss" && !theme.isDark) || ordered.find((theme) => !theme.isDark) || ordered[0];
  const darkBg = themeColor(mossDark.theme, "editor.background", "#1b1d1a");
  const darkFg = themeColor(mossDark.theme, "editor.foreground", "#d2bea2");
  const darkSide = themeColor(mossDark.theme, "sideBar.background", "#191815");
  const darkTitle = themeColor(mossDark.theme, "titleBar.activeBackground", darkSide);
  const darkTabs = themeColor(mossDark.theme, "editorGroupHeader.tabsBackground", darkSide);
  const darkStatus = themeColor(mossDark.theme, "statusBar.background", "#b37f16");
  const darkStatusFg = themeColor(mossDark.theme, "statusBar.foreground", "#191815");
  const lightBg = themeColor(mossLight.theme, "editor.background", "#e7e5d8");
  const lightFg = themeColor(mossLight.theme, "editor.foreground", "#342d28");
  const lightTitle = themeColor(mossLight.theme, "titleBar.activeBackground", "#d4d1c4");
  const lightTabs = themeColor(mossLight.theme, "editorGroupHeader.tabsBackground", lightTitle);
  const lightStatus = themeColor(mossLight.theme, "statusBar.background", "#bb7c12");
  const lightStatusFg = themeColor(mossLight.theme, "statusBar.foreground", "#241d16");
  const seam = themeColor(mossDark.theme, "focusBorder", themeColor(mossDark.theme, "button.background", "#cb9322"));
  const darkMuted = mixHex(darkFg, darkBg, 0.52);
  const lightMuted = mixHex(lightFg, lightBg, 0.52);
  const darkLines = buildEditorSampleLines(mossDark);
  const lightLines = buildEditorSampleLines(mossLight);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
      <defs>
        <clipPath id="moss-hero-frame">
          <rect x="24" y="24" width="1552" height="852" rx="22" />
        </clipPath>
      </defs>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="${mixHex(darkBg, "#000000", 0.08)}" />
      <rect x="34" y="40" width="1552" height="852" rx="22" fill="${withAlpha("#000000", 0.2)}" />
      <g clip-path="url(#moss-hero-frame)">
        <rect x="24" y="24" width="1552" height="852" fill="${darkBg}" />
        <polygon points="910,24 1576,24 1576,876 700,876" fill="${lightBg}" />

        <rect x="24" y="24" width="1552" height="54" fill="${darkTitle}" />
        <polygon points="910,24 1576,24 1576,78 897,78" fill="${lightTitle}" />
        <circle cx="46" cy="51" r="5" fill="${roleColor(mossDark.theme, "keyword")}" />
        <circle cx="64" cy="51" r="5" fill="${roleColor(mossDark.theme, "string")}" />
        <circle cx="82" cy="51" r="5" fill="${roleColor(mossDark.theme, "function")}" />
        <text x="108" y="39" fill="${darkFg}" font-size="15" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="800" letter-spacing="0.16em" dominant-baseline="text-before-edge">HEARTHCODE MOSS</text>
        <text x="842" y="39" text-anchor="end" fill="${darkMuted}" font-size="13" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="800" letter-spacing="0.12em" dominant-baseline="text-before-edge">DARK</text>
        <text x="1524" y="39" text-anchor="end" fill="${lightMuted}" font-size="13" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="800" letter-spacing="0.12em" dominant-baseline="text-before-edge">LIGHT</text>

        <rect x="24" y="78" width="336" height="758" fill="${darkSide}" />
        <rect x="24" y="78" width="48" height="758" fill="${mixHex(darkSide, "#000000", 0.1)}" />
        <text x="96" y="108" fill="${darkMuted}" font-size="12" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="800" letter-spacing="0.12em" dominant-baseline="text-before-edge">EXPLORER</text>
        <text x="96" y="158" fill="${darkMuted}" font-size="13" font-family="'Segoe UI', 'Noto Sans', sans-serif" dominant-baseline="text-before-edge">src</text>
        <text x="116" y="194" fill="${darkMuted}" font-size="13" font-family="'Segoe UI', 'Noto Sans', sans-serif" dominant-baseline="text-before-edge">components</text>
        <rect x="88" y="224" width="240" height="38" rx="7" fill="${themeColor(mossDark.theme, "list.activeSelectionBackground", mixHex(darkSide, darkFg, 0.08))}" />
        <circle cx="105" cy="243" r="4" fill="${roleColor(mossDark.theme, "function")}" />
        <text x="122" y="232" fill="${darkFg}" font-size="14" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">theme.ts</text>
        <text x="116" y="282" fill="${darkMuted}" font-size="13" font-family="'Segoe UI', 'Noto Sans', sans-serif" dominant-baseline="text-before-edge">tokens.ts</text>
        <text x="96" y="326" fill="${darkMuted}" font-size="13" font-family="'Segoe UI', 'Noto Sans', sans-serif" dominant-baseline="text-before-edge">README.md</text>

        <rect x="360" y="78" width="550" height="50" fill="${darkTabs}" />
        <rect x="360" y="78" width="156" height="50" fill="${darkBg}" />
        <text x="382" y="95" fill="${darkFg}" font-size="13" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">theme.ts</text>
        <polygon points="897,78 1576,78 1576,128 885,128" fill="${lightTabs}" />
        <rect x="970" y="78" width="156" height="50" fill="${lightBg}" />
        <text x="992" y="95" fill="${lightFg}" font-size="13" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">theme.ts</text>

        ${renderNumberedCodeBlock({ theme: mossDark.theme, lines: darkLines, x: 390, y: 164, fontSize: 19, lineHeight: 36 })}
        ${renderNumberedCodeBlock({ theme: mossLight.theme, lines: lightLines, x: 988, y: 164, fontSize: 18, lineHeight: 38 })}

        <rect x="24" y="836" width="1552" height="40" fill="${darkStatus}" />
        <polygon points="710,836 1576,836 1576,876 700,876" fill="${lightStatus}" />
        <text x="48" y="849" fill="${darkStatusFg}" font-size="12" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="800" dominant-baseline="text-before-edge">main  ✓  TypeScript</text>
        <text x="1524" y="849" text-anchor="end" fill="${lightStatusFg}" font-size="12" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="800" dominant-baseline="text-before-edge">Ln 6, Col 4</text>
      </g>
      <path d="M 910 24 L 700 876" fill="none" stroke="${seam}" stroke-width="3" opacity="0.72" />
    </svg>
  `;
}

function renderForgeWorkflowSvg({ themes }) {
  const ordered = orderThemesForPreview(themes);
  const mossDark = ordered.find((theme) => theme.schemeId === "moss" && theme.isDark) || ordered[0];
  const mossLight = ordered.find((theme) => theme.schemeId === "moss" && !theme.isDark) || ordered.find((theme) => !theme.isDark) || ordered[0];
  const emberDark = ordered.find((theme) => theme.schemeId === "ember" && theme.isDark) || mossDark;
  const darkTheme = mossDark.theme;
  const lightTheme = mossLight.theme;
  const emberTheme = emberDark.theme;
  const bg = themeColor(darkTheme, "editor.background", "#1b1d1a");
  const fg = themeColor(darkTheme, "editor.foreground", "#d2bea2");
  const chrome = themeColor(darkTheme, "titleBar.activeBackground", "#191815");
  const panel = themeColor(darkTheme, "sideBar.background", "#191815");
  const border = themeColor(darkTheme, "widget.border", mixHex(bg, fg, 0.18));
  const muted = themeColor(darkTheme, "descriptionForeground", mixHex(fg, bg, 0.48));
  const inputBg = themeColor(darkTheme, "input.background", mixHex(bg, fg, 0.06));
  const button = themeColor(darkTheme, "button.background", "#cb9322");
  const buttonFg = themeColor(darkTheme, "button.foreground", "#191815");
  const secondaryButton = themeColor(darkTheme, "button.secondaryBackground", mixHex(bg, fg, 0.16));
  const secondaryButtonFg = themeColor(darkTheme, "button.secondaryForeground", fg);
  const emberAccent = themeColor(emberTheme, "button.background", roleColor(emberTheme, "keyword"));
  const seed = requiredRoleColor(mossDark, "function");
  const forgeSteps = PREVIEW.samples?.forge?.lines || [];
  if (forgeSteps.length !== 5) {
    throw new Error("Preview sample contract: products/hearthcode/preview.json must define the five Theme Forge workflow steps");
  }
  const previewLines = [
    [{ role: "comment", text: "// both modes rebuild together" }],
    [{ role: "keyword", text: "const " }, { role: "variable.readonly", text: "palette" }, { role: "plain", text: " = " }, { role: "function", text: "forgeTheme" }, { role: "plain", text: "({" }],
    [{ role: "plain", text: "  " }, { role: "property", text: "direction" }, { role: "plain", text: ": " }, { role: "string", text: '"moss"' }, { role: "plain", text: "," }],
    [{ role: "plain", text: "  " }, { role: "property", text: "seed" }, { role: "plain", text: ": " }, { role: "string", text: `"${seed}"` }, { role: "plain", text: "," }],
    [{ role: "plain", text: "});" }],
  ];
  const renderPreviewLines = (theme, x) => previewLines.map((segments, index) =>
    renderCodeLine({ theme, segments, x, y: 370 + index * 38, fontSize: 17 })
  ).join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
      <rect width="${WIDTH}" height="${HEIGHT}" fill="${bg}" />
      <rect x="0" y="0" width="${WIDTH}" height="54" fill="${chrome}" />
      <circle cx="24" cy="27" r="5" fill="${roleColor(darkTheme, "keyword")}" />
      <circle cx="42" cy="27" r="5" fill="${roleColor(darkTheme, "string")}" />
      <circle cx="60" cy="27" r="5" fill="${roleColor(darkTheme, "function")}" />
      <text x="800" y="17" text-anchor="middle" fill="${muted}" font-size="14" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">HearthCode Theme Forge</text>

      <rect x="52" y="82" width="1496" height="752" rx="12" fill="${panel}" stroke="${border}" stroke-width="1.2" />
      <text x="96" y="112" fill="${fg}" font-size="32" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="750" dominant-baseline="text-before-edge">Theme Forge</text>
      <text x="96" y="154" fill="${muted}" font-size="15" font-family="'Segoe UI', 'Noto Sans', sans-serif" dominant-baseline="text-before-edge">Choose a base direction and seed color. Forge rebuilds and verifies Dark and Light together.</text>

      <text x="96" y="218" fill="${button}" font-size="12" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="800" letter-spacing="0.14em" dominant-baseline="text-before-edge">1 · ${escapeXml(forgeSteps[0].toUpperCase())}</text>
      <rect x="96" y="250" width="244" height="62" rx="6" fill="${withAlpha(button, 0.12)}" stroke="${button}" stroke-width="1.5" />
      <circle cx="122" cy="281" r="9" fill="none" stroke="${button}" stroke-width="2" />
      <circle cx="122" cy="281" r="4" fill="${button}" />
      <text x="146" y="266" fill="${fg}" font-size="18" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="750" dominant-baseline="text-before-edge">Moss</text>
      <text x="146" y="289" fill="${muted}" font-size="12" font-family="'Segoe UI', 'Noto Sans', sans-serif" dominant-baseline="text-before-edge">dry + structural</text>

      <rect x="356" y="250" width="244" height="62" rx="6" fill="${withAlpha(emberAccent, 0.08)}" stroke="${withAlpha(emberAccent, 0.78)}" stroke-width="1.2" />
      <circle cx="382" cy="281" r="9" fill="none" stroke="${emberAccent}" stroke-width="2" />
      <text x="406" y="266" fill="${fg}" font-size="18" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="750" dominant-baseline="text-before-edge">Ember</text>
      <text x="406" y="289" fill="${emberAccent}" font-size="12" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="650" dominant-baseline="text-before-edge">warm + soft</text>

      <text x="96" y="350" fill="${button}" font-size="12" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="800" letter-spacing="0.14em" dominant-baseline="text-before-edge">2 · ${escapeXml(forgeSteps[1].toUpperCase())}</text>
      <rect x="96" y="382" width="72" height="52" rx="6" fill="${inputBg}" stroke="${border}" />
      <rect x="106" y="392" width="52" height="32" rx="4" fill="${seed}" />
      <rect x="182" y="382" width="202" height="52" rx="6" fill="${inputBg}" stroke="${border}" />
      <text x="204" y="398" fill="${fg}" font-size="16" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="700" dominant-baseline="text-before-edge">${seed}</text>
      <text x="404" y="399" fill="${muted}" font-size="13" font-family="'Segoe UI', 'Noto Sans', sans-serif" dominant-baseline="text-before-edge">FROM MOSS DARK · FUNCTION TOKEN</text>
      <text x="96" y="452" fill="${muted}" font-size="13" font-family="'Segoe UI', 'Noto Sans', sans-serif" dominant-baseline="text-before-edge">Role lightness stays calibrated; saturation remains inside the audited range.</text>

      <text x="96" y="514" fill="${button}" font-size="12" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="800" letter-spacing="0.14em" dominant-baseline="text-before-edge">4–5 · ${escapeXml(forgeSteps[3].toUpperCase())} / ${escapeXml(forgeSteps[4].toUpperCase())}</text>
      <rect x="96" y="548" width="170" height="44" rx="5" fill="${button}" />
      <text x="181" y="561" text-anchor="middle" fill="${buttonFg}" font-size="14" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="800" dominant-baseline="text-before-edge">${escapeXml(forgeSteps[3])}</text>
      <rect x="278" y="548" width="128" height="44" rx="5" fill="${secondaryButton}" />
      <text x="342" y="561" text-anchor="middle" fill="${secondaryButtonFg}" font-size="14" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">Reset color</text>
      <rect x="418" y="548" width="212" height="44" rx="5" fill="transparent" stroke="${border}" />
      <text x="524" y="561" text-anchor="middle" fill="${fg}" font-size="14" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">${escapeXml(forgeSteps[4])}</text>
      <text x="96" y="612" fill="${muted}" font-size="13" font-family="'Segoe UI', 'Noto Sans', sans-serif" dominant-baseline="text-before-edge">Ready — pick a color, then Apply</text>
      <rect x="96" y="658" width="534" height="112" rx="7" fill="${withAlpha(button, 0.08)}" stroke="${withAlpha(button, 0.42)}" />
      <rect x="96" y="658" width="4" height="112" rx="2" fill="${button}" />
      <text x="120" y="680" fill="${fg}" font-size="15" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="750" dominant-baseline="text-before-edge">One reversible change</text>
      <text x="120" y="711" fill="${muted}" font-size="13" font-family="'Segoe UI', 'Noto Sans', sans-serif" dominant-baseline="text-before-edge">Theme-scoped overrides apply live to both modes.</text>
      <text x="120" y="738" fill="${muted}" font-size="13" font-family="'Segoe UI', 'Noto Sans', sans-serif" dominant-baseline="text-before-edge">Restore removes exactly what Forge wrote.</text>

      <text x="690" y="218" fill="${button}" font-size="12" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="800" letter-spacing="0.14em" dominant-baseline="text-before-edge">3 · ${escapeXml(forgeSteps[2].toUpperCase())}</text>
      <rect x="690" y="250" width="400" height="470" rx="8" fill="${themeColor(darkTheme, "editor.background", bg)}" stroke="${border}" />
      <rect x="1090" y="250" width="400" height="470" rx="8" fill="${themeColor(lightTheme, "editor.background", "#e7e5d8")}" stroke="${border}" />
      <rect x="690" y="250" width="400" height="52" rx="8" fill="${themeColor(darkTheme, "editorGroupHeader.tabsBackground", chrome)}" />
      <rect x="1090" y="250" width="400" height="52" rx="8" fill="${themeColor(lightTheme, "editorGroupHeader.tabsBackground", "#d4d1c4")}" />
      <text x="720" y="268" fill="${themeColor(darkTheme, "editor.foreground", fg)}" font-size="13" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="800" letter-spacing="0.12em" dominant-baseline="text-before-edge">MOSS DARK</text>
      <text x="1120" y="268" fill="${themeColor(lightTheme, "editor.foreground", "#342d28")}" font-size="13" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="800" letter-spacing="0.12em" dominant-baseline="text-before-edge">MOSS LIGHT</text>
      ${renderPreviewLines(darkTheme, 720)}
      ${renderPreviewLines(lightTheme, 1120)}
      <rect x="690" y="678" width="400" height="42" fill="${themeColor(darkTheme, "statusBar.background", button)}" />
      <rect x="1090" y="678" width="400" height="42" fill="${themeColor(lightTheme, "statusBar.background", button)}" />
      <text x="714" y="692" fill="${themeColor(darkTheme, "statusBar.foreground", buttonFg)}" font-size="12" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">Moss · Dark</text>
      <text x="1114" y="692" fill="${themeColor(lightTheme, "statusBar.foreground", buttonFg)}" font-size="12" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">Moss · Light</text>
      <text x="690" y="750" fill="${muted}" font-size="13" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" letter-spacing="0.08em" dominant-baseline="text-before-edge">ROLE SEPARATION · AA-CHECKED CHROME · FUNCTIONAL COLORS PRESERVED</text>
    </svg>
  `;
}

function renderFieldGuideGrid({ width = WIDTH, height = HEIGHT, color = "#d3c9b8", opacity = 0.055, step = 40 }) {
  const vertical = Array.from({ length: Math.ceil(width / step) + 1 }, (_, index) => {
    const x = index * step;
    return `<line x1="${x}" y1="0" x2="${x}" y2="${height}" />`;
  }).join("");
  const horizontal = Array.from({ length: Math.ceil(height / step) + 1 }, (_, index) => {
    const y = index * step;
    return `<line x1="0" y1="${y}" x2="${width}" y2="${y}" />`;
  }).join("");
  return `<g stroke="${color}" stroke-width="1" opacity="${opacity}">${vertical}${horizontal}</g>`;
}

function renderRegistrationMarks({ width = WIDTH, height = HEIGHT, color = "#d3c9b8" }) {
  const inset = 24;
  const size = 18;
  return `
    <g fill="none" stroke="${color}" stroke-width="1.2" opacity="0.46">
      <path d="M ${inset} ${inset + size} V ${inset} H ${inset + size}" />
      <path d="M ${width - inset - size} ${inset} H ${width - inset} V ${inset + size}" />
      <path d="M ${inset} ${height - inset - size} V ${height - inset} H ${inset + size}" />
      <path d="M ${width - inset - size} ${height - inset} H ${width - inset} V ${height - inset - size}" />
    </g>
  `;
}

function getPreviewTheme(themes, schemeId, variantId) {
  return themes.find((theme) => theme.schemeId === schemeId && theme.variantId === variantId)
    || themes.find((theme) => theme.schemeId === schemeId)
    || themes[0];
}

function renderDirectionSpecimen({ darkMeta, lightMeta, x, width, index }) {
  const darkTheme = darkMeta.theme;
  const lightTheme = lightMeta.theme;
  const copy = getFlavorPreviewCopy(darkMeta.schemeId);
  const darkBg = themeColor(darkTheme, "editor.background", "#1b1d1a");
  const darkFg = themeColor(darkTheme, "editor.foreground", "#d3c9b8");
  const lightBg = themeColor(lightTheme, "editor.background", "#e7e5d8");
  const lightFg = themeColor(lightTheme, "editor.foreground", "#342d28");
  const darkMuted = mixHex(darkFg, darkBg, 0.5);
  const lightMuted = mixHex(lightFg, lightBg, 0.48);
  const keyword = roleColor(darkTheme, "keyword");
  const callable = roleColor(darkTheme, "function");
  const string = roleColor(darkTheme, "string");
  const type = roleColor(darkTheme, "type");
  const accent = darkMeta.schemeId === "moss" ? callable : keyword;
  const y = 228;
  const height = 608;
  const dividerY = y + 398;
  const darkLines = [
    [{ role: "comment", text: copy.comment }],
    [{ role: "keyword", text: "const " }, { role: "variable", text: copy.sampleVariable }, { role: "plain", text: " = " }, { role: "function", text: copy.sampleFunction }, { role: "plain", text: "({" }],
    [{ role: "plain", text: "  " }, { role: "property", text: "direction" }, { role: "plain", text: ": " }, { role: "string", text: `"${darkMeta.schemeId}"` }, { role: "plain", text: "," }],
    [{ role: "plain", text: "  " }, { role: "property", text: "mode" }, { role: "plain", text: ": " }, { role: "string", text: '"dark"' }],
    [{ role: "plain", text: "});" }],
  ];
  const lightLines = [
    [{ role: "keyword", text: "type " }, { role: "type", text: "Surface" }, { role: "plain", text: " = {" }],
    [{ role: "plain", text: "  " }, { role: "property", text: "paper" }, { role: "plain", text: ": " }, { role: "string", text: '"light"' }, { role: "plain", text: ";" }],
    [{ role: "plain", text: "};" }],
  ];
  const chips = copy.chips.slice(0, 3).map((chip, chipIndex) => {
    const chipWidth = Math.max(112, chip.length * 7 + 24);
    const chipX = x + 28 + chipIndex * 174;
    return `
      <rect x="${chipX}" y="${y + 92}" width="${chipWidth}" height="28" fill="${withAlpha(accent, chipIndex === 0 ? 0.2 : 0.08)}" stroke="${withAlpha(accent, 0.34)}" />
      <text x="${chipX + 12}" y="${y + 99}" fill="${chipIndex === 0 ? accent : darkFg}" font-size="12" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">${escapeXml(chip)}</text>
    `;
  }).join("");

  return `
    <g>
      <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${darkBg}" stroke="${withAlpha(darkFg, 0.24)}" stroke-width="1.2" />
      <rect x="${x}" y="${dividerY}" width="${width}" height="${height - 398}" fill="${lightBg}" />
      <rect x="${x}" y="${y}" width="8" height="${height}" fill="${accent}" />
      <text x="${x + 28}" y="${y + 24}" fill="${accent}" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="800" letter-spacing="0.18em" dominant-baseline="text-before-edge">0${index} / ${escapeXml(darkMeta.flavor.name.toUpperCase())}</text>
      <text x="${x + 28}" y="${y + 49}" fill="${darkFg}" font-size="35" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="750" dominant-baseline="text-before-edge">${escapeXml(darkMeta.flavor.name)}</text>
      <text x="${x + width - 28}" y="${y + 58}" text-anchor="end" fill="${darkMuted}" font-size="13" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="700" letter-spacing="0.12em" dominant-baseline="text-before-edge">DARK FIELD</text>
      ${chips}
      <rect x="${x + 28}" y="${y + 146}" width="${width - 56}" height="218" fill="${mixHex(darkBg, "#000000", 0.08)}" stroke="${withAlpha(darkFg, 0.09)}" />
      ${renderNumberedCodeBlock({ theme: darkTheme, lines: darkLines, x: x + 50, y: y + 170, fontSize: 17, lineHeight: 35 })}

      <text x="${x + 28}" y="${dividerY + 22}" fill="${lightMuted}" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="800" letter-spacing="0.16em" dominant-baseline="text-before-edge">LIGHT FIELD / ${escapeXml(lightMeta.summary.toUpperCase())}</text>
      <rect x="${x + 28}" y="${dividerY + 56}" width="${width - 56}" height="108" fill="${mixHex(lightBg, lightFg, 0.035)}" stroke="${withAlpha(lightFg, 0.12)}" />
      ${renderNumberedCodeBlock({ theme: lightTheme, lines: lightLines, x: x + 50, y: dividerY + 72, fontSize: 15.5, lineHeight: 27 })}
      <g transform="translate(${x + width - 184} ${dividerY + 172})">
        <rect width="28" height="8" fill="${keyword}" />
        <rect x="38" width="28" height="8" fill="${callable}" />
        <rect x="76" width="28" height="8" fill="${type}" />
        <rect x="114" width="28" height="8" fill="${string}" />
      </g>
    </g>
  `;
}

function renderDirectionAtlasSvg({ themes }) {
  const emberDark = getPreviewTheme(themes, "ember", "dark");
  const emberLight = getPreviewTheme(themes, "ember", "light");
  const mossDark = getPreviewTheme(themes, "moss", "dark");
  const mossLight = getPreviewTheme(themes, "moss", "light");
  const bg = mixHex(themeColor(mossDark.theme, "editor.background", "#191a17"), "#000000", 0.06);
  const fg = themeColor(mossDark.theme, "editor.foreground", "#d3c9b8");
  const muted = mixHex(fg, bg, 0.5);
  const heading = PREVIEW.marketing?.directionHeadline || "Warmth or structure. Choose your material.";
  const subheading = PREVIEW.marketing?.directionSubheadline || "Two distinct atmospheres, built from one semantic color language.";

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
      <rect width="${WIDTH}" height="${HEIGHT}" fill="${bg}" />
      ${renderFieldGuideGrid({ color: fg })}
      <rect x="0" y="0" width="18" height="${HEIGHT}" fill="${roleColor(emberDark.theme, "keyword")}" />
      <rect x="18" y="0" width="10" height="${HEIGHT}" fill="${roleColor(mossDark.theme, "function")}" />
      ${renderRegistrationMarks({ color: fg })}
      <text x="56" y="48" fill="${muted}" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="800" letter-spacing="0.2em" dominant-baseline="text-before-edge">HEARTHCODE / COLOR FIELD GUIDE 01</text>
      <text x="56" y="80" fill="${fg}" font-size="45" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="750" dominant-baseline="text-before-edge">${escapeXml(heading)}</text>
      <text x="56" y="138" fill="${muted}" font-size="18" font-family="'Segoe UI', 'Noto Sans', sans-serif" dominant-baseline="text-before-edge">${escapeXml(subheading)}</text>
      <line x1="56" y1="190" x2="1544" y2="190" stroke="${withAlpha(fg, 0.28)}" />
      ${renderDirectionSpecimen({ darkMeta: emberDark, lightMeta: emberLight, x: 56, width: 724, index: 1 })}
      ${renderDirectionSpecimen({ darkMeta: mossDark, lightMeta: mossLight, x: 820, width: 724, index: 2 })}
      <text x="56" y="866" fill="${muted}" font-size="11" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="700" letter-spacing="0.14em" dominant-baseline="text-before-edge">TWO DIRECTIONS · TWO MODES · ONE SEMANTIC SYSTEM</text>
      <text x="1544" y="866" text-anchor="end" fill="${muted}" font-size="11" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="700" letter-spacing="0.14em" dominant-baseline="text-before-edge">theme.hearthcode.dev</text>
    </svg>
  `;
}

function renderAvailabilityCell({ available, x, y, accent, fg, muted }) {
  if (!available) {
    return `<text x="${x}" y="${y + 4}" fill="${muted}" font-size="18" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" dominant-baseline="text-before-edge">—</text>`;
  }
  return `
    <g>
      <rect x="${x}" y="${y}" width="82" height="28" fill="${withAlpha(accent, 0.14)}" stroke="${withAlpha(accent, 0.42)}" />
      <circle cx="${x + 14}" cy="${y + 14}" r="4" fill="${accent}" />
      <text x="${x + 26}" y="${y + 7}" fill="${fg}" font-size="11" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="800" letter-spacing="0.1em" dominant-baseline="text-before-edge">DARK</text>
      <rect x="${x + 92}" y="${y}" width="86" height="28" fill="${withAlpha(accent, 0.07)}" stroke="${withAlpha(accent, 0.28)}" />
      <circle cx="${x + 106}" cy="${y + 14}" r="4" fill="${withAlpha(accent, 0.78)}" />
      <text x="${x + 118}" y="${y + 7}" fill="${fg}" font-size="11" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="800" letter-spacing="0.1em" dominant-baseline="text-before-edge">LIGHT</text>
    </g>
  `;
}

function renderPlatformCoverageSvg({ themes }) {
  const emberDark = getPreviewTheme(themes, "ember", "dark");
  const mossDark = getPreviewTheme(themes, "moss", "dark");
  const bg = mixHex(themeColor(mossDark.theme, "editor.background", "#191a17"), "#000000", 0.08);
  const fg = themeColor(mossDark.theme, "editor.foreground", "#d3c9b8");
  const muted = mixHex(fg, bg, 0.52);
  const emberAccent = roleColor(emberDark.theme, "keyword");
  const mossAccent = roleColor(mossDark.theme, "function");
  const coverage = PRODUCT.channelAvailability || {};
  const platformRows = [
    { id: "vscode", label: "VS CODE", route: "MARKETPLACE" },
    { id: "openvsx", label: "VSX EDITORS", route: "OPEN VSX" },
    { id: "zed", label: "ZED", route: "ZED EXTENSIONS" },
    { id: "terminal", label: "TERMINALS", route: "GITHUB PACKS" },
    { id: "obsidian", label: "OBSIDIAN", route: "COMMUNITY THEMES" },
  ];
  const capabilityLabels = {
    "theme-forge": "THEME FORGE",
    "five-formats": "5 FORMATS",
    "style-settings": "STYLE SETTINGS",
  };
  const rows = platformRows.map((platform, index) => {
    const entry = coverage[platform.id] || { schemeIds: [], capabilityIds: [] };
    const rowY = 302 + index * 94;
    const capability = (entry.capabilityIds || []).map((id) => capabilityLabels[id] || id.toUpperCase()).join(" · ") || "—";
    return `
      <g>
        <line x1="56" y1="${rowY + 62}" x2="1544" y2="${rowY + 62}" stroke="${withAlpha(fg, 0.16)}" />
        <text x="72" y="${rowY}" fill="${fg}" font-size="23" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="750" dominant-baseline="text-before-edge">${platform.label}</text>
        <text x="72" y="${rowY + 34}" fill="${muted}" font-size="11" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="700" letter-spacing="0.12em" dominant-baseline="text-before-edge">${platform.route}</text>
        ${renderAvailabilityCell({ available: entry.schemeIds.includes("ember"), x: 500, y: rowY + 5, accent: emberAccent, fg, muted })}
        ${renderAvailabilityCell({ available: entry.schemeIds.includes("moss"), x: 820, y: rowY + 5, accent: mossAccent, fg, muted })}
        <text x="1160" y="${rowY + 11}" fill="${capability === "—" ? muted : fg}" font-size="13" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="${capability === "—" ? 500 : 800}" letter-spacing="0.1em" dominant-baseline="text-before-edge">${escapeXml(capability)}</text>
      </g>
    `;
  }).join("");
  const heading = PREVIEW.marketing?.platformHeadline || "One system. Accurate on every surface.";
  const subheading = PREVIEW.marketing?.platformSubheadline || "Every channel shows only the directions and modes it actually ships.";

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
      <rect width="${WIDTH}" height="${HEIGHT}" fill="${bg}" />
      ${renderFieldGuideGrid({ color: fg })}
      <rect x="0" y="0" width="${WIDTH}" height="16" fill="${emberAccent}" />
      <rect x="760" y="0" width="840" height="16" fill="${mossAccent}" />
      ${renderRegistrationMarks({ color: fg })}
      <text x="56" y="48" fill="${muted}" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="800" letter-spacing="0.2em" dominant-baseline="text-before-edge">HEARTHCODE / COLOR FIELD GUIDE 02</text>
      <text x="56" y="80" fill="${fg}" font-size="45" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="750" dominant-baseline="text-before-edge">${escapeXml(heading)}</text>
      <text x="56" y="138" fill="${muted}" font-size="18" font-family="'Segoe UI', 'Noto Sans', sans-serif" dominant-baseline="text-before-edge">${escapeXml(subheading)}</text>
      <line x1="56" y1="196" x2="1544" y2="196" stroke="${withAlpha(fg, 0.28)}" />
      <text x="72" y="226" fill="${muted}" font-size="11" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="800" letter-spacing="0.15em" dominant-baseline="text-before-edge">SURFACE / INSTALL ROUTE</text>
      <text x="500" y="226" fill="${emberAccent}" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="800" letter-spacing="0.16em" dominant-baseline="text-before-edge">EMBER</text>
      <text x="820" y="226" fill="${mossAccent}" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="800" letter-spacing="0.16em" dominant-baseline="text-before-edge">MOSS</text>
      <text x="1160" y="226" fill="${muted}" font-size="11" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="800" letter-spacing="0.15em" dominant-baseline="text-before-edge">CHANNEL CAPABILITY</text>
      ${rows}
      <text x="56" y="846" fill="${muted}" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="700" letter-spacing="0.1em" dominant-baseline="text-before-edge">AMBER IS AN OBSIDIAN ACCENT PRESET — NOT A THEME DIRECTION.</text>
      <text x="1544" y="846" text-anchor="end" fill="${muted}" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="700" letter-spacing="0.1em" dominant-baseline="text-before-edge">SOURCE: products/hearthcode/product.json</text>
    </svg>
  `;
}

function renderMossSurfacesSvg({ themes }) {
  const mossDark = getPreviewTheme(themes, "moss", "dark");
  const mossLight = getPreviewTheme(themes, "moss", "light");
  const darkTheme = mossDark.theme;
  const lightTheme = mossLight.theme;
  const bg = mixHex(themeColor(darkTheme, "editor.background", "#191a17"), "#000000", 0.06);
  const fg = themeColor(darkTheme, "editor.foreground", "#d3c9b8");
  const muted = mixHex(fg, bg, 0.52);
  const accent = roleColor(darkTheme, "function");
  const yellow = roleColor(darkTheme, "keyword");
  const blue = roleColor(darkTheme, "type");
  const string = roleColor(darkTheme, "string");
  const terminalGreen = themeColor(darkTheme, "terminal.ansiGreen", accent);
  const terminalYellow = themeColor(darkTheme, "terminal.ansiYellow", yellow);
  const terminalBlue = themeColor(darkTheme, "terminal.ansiBlue", blue);
  const lightBg = themeColor(lightTheme, "editor.background", "#e7e5d8");
  const lightFg = themeColor(lightTheme, "editor.foreground", "#342d28");
  const lightMuted = mixHex(lightFg, lightBg, 0.5);
  const codeLines = buildFamilySampleLines(mossDark);
  const noteLines = PREVIEW.samples?.obsidian?.lines || [];
  const terminalLines = PREVIEW.samples?.terminal?.lines || [];
  if (noteLines.length !== 4 || terminalLines.length !== 4) {
    throw new Error("Preview sample contract: Obsidian and terminal samples must each define four lines");
  }
  const heading = PREVIEW.marketing?.mossSurfaceHeadline || "Moss follows the work, not the app.";
  const subheading = PREVIEW.marketing?.mossSurfaceSubheadline || "The same hierarchy moves through code, notes, and terminal output.";

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
      <rect width="${WIDTH}" height="${HEIGHT}" fill="${bg}" />
      ${renderFieldGuideGrid({ color: fg })}
      ${renderRegistrationMarks({ color: fg })}
      <rect x="0" y="0" width="28" height="${HEIGHT}" fill="${accent}" />
      <text x="56" y="48" fill="${muted}" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="800" letter-spacing="0.2em" dominant-baseline="text-before-edge">HEARTHCODE / COLOR FIELD GUIDE 03 / MOSS</text>
      <text x="56" y="80" fill="${fg}" font-size="45" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="750" dominant-baseline="text-before-edge">${escapeXml(heading)}</text>
      <text x="56" y="138" fill="${muted}" font-size="18" font-family="'Segoe UI', 'Noto Sans', sans-serif" dominant-baseline="text-before-edge">${escapeXml(subheading)}</text>
      <line x1="56" y1="196" x2="1544" y2="196" stroke="${withAlpha(fg, 0.28)}" />

      <g>
        <text x="56" y="226" fill="${accent}" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="800" letter-spacing="0.16em" dominant-baseline="text-before-edge">01 / CODE</text>
        <rect x="56" y="258" width="622" height="500" fill="${themeColor(darkTheme, "editor.background", bg)}" stroke="${withAlpha(fg, 0.24)}" />
        <rect x="56" y="258" width="622" height="52" fill="${themeColor(darkTheme, "editorGroupHeader.tabsBackground", bg)}" />
        <circle cx="82" cy="284" r="5" fill="${yellow}" />
        <circle cx="100" cy="284" r="5" fill="${string}" />
        <circle cx="118" cy="284" r="5" fill="${accent}" />
        <text x="146" y="274" fill="${fg}" font-size="13" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">workspace.ts</text>
        ${renderNumberedCodeBlock({ theme: darkTheme, lines: codeLines, x: 92, y: 362, fontSize: 18, lineHeight: 43 })}
        <rect x="56" y="714" width="622" height="44" fill="${themeColor(darkTheme, "statusBar.background", yellow)}" />
        <text x="82" y="728" fill="${themeColor(darkTheme, "statusBar.foreground", bg)}" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="800" dominant-baseline="text-before-edge">MOSS DARK · SEMANTIC TOKENS</text>
      </g>

      <g>
        <text x="718" y="226" fill="${blue}" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="800" letter-spacing="0.16em" dominant-baseline="text-before-edge">02 / NOTES</text>
        <rect x="718" y="258" width="414" height="500" fill="${lightBg}" stroke="${withAlpha(lightFg, 0.24)}" />
        <text x="748" y="292" fill="${lightMuted}" font-size="11" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="800" letter-spacing="0.14em" dominant-baseline="text-before-edge">MARKDOWN · SOURCE SAMPLE</text>
        <text x="748" y="340" fill="${lightFg}" font-size="21" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="750" dominant-baseline="text-before-edge">${escapeXml(noteLines[0])}</text>
        <rect x="748" y="400" width="354" height="82" fill="${withAlpha(blue, 0.09)}" stroke="${withAlpha(blue, 0.5)}" />
        <rect x="748" y="400" width="7" height="82" fill="${blue}" />
        <text x="774" y="420" fill="${blue}" font-size="13" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="750" dominant-baseline="text-before-edge">${escapeXml(noteLines[1])}</text>
        <text x="748" y="526" fill="${lightFg}" font-size="13" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" dominant-baseline="text-before-edge">${escapeXml(noteLines[2])}</text>
        <text x="748" y="566" fill="${lightMuted}" font-size="13" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" dominant-baseline="text-before-edge">${escapeXml(noteLines[3])}</text>
        <text x="748" y="690" fill="${lightMuted}" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="700" letter-spacing="0.1em" dominant-baseline="text-before-edge">OBSIDIAN · MOSS LIGHT</text>
      </g>

      <g>
        <text x="1172" y="226" fill="${terminalGreen}" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="800" letter-spacing="0.16em" dominant-baseline="text-before-edge">03 / TERMINAL</text>
        <rect x="1172" y="258" width="372" height="500" fill="${mixHex(bg, "#000000", 0.12)}" stroke="${withAlpha(fg, 0.24)}" />
        <rect x="1172" y="258" width="372" height="46" fill="${mixHex(bg, fg, 0.035)}" />
        <circle cx="1196" cy="281" r="5" fill="${terminalYellow}" />
        <circle cx="1214" cy="281" r="5" fill="${terminalBlue}" />
        <circle cx="1232" cy="281" r="5" fill="${terminalGreen}" />
        <text x="1200" y="342" fill="${terminalYellow}" font-size="14" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="800" dominant-baseline="text-before-edge">${escapeXml(terminalLines[0])}</text>
        <text x="1200" y="408" fill="${terminalGreen}" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="700" dominant-baseline="text-before-edge">${escapeXml(terminalLines[1])}</text>
        <text x="1200" y="452" fill="${terminalBlue}" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="700" dominant-baseline="text-before-edge">${escapeXml(terminalLines[2])}</text>
        <text x="1200" y="496" fill="${terminalGreen}" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="700" dominant-baseline="text-before-edge">${escapeXml(terminalLines[3])}</text>
        <line x1="1200" y1="574" x2="1516" y2="574" stroke="${withAlpha(fg, 0.12)}" />
        <text x="1200" y="604" fill="${muted}" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="700" dominant-baseline="text-before-edge">WARP · KITTY · ALACRITTY</text>
        <text x="1200" y="630" fill="${muted}" font-size="12" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="700" dominant-baseline="text-before-edge">ITERM2 · WINDOWS TERMINAL</text>
      </g>

      <line x1="56" y1="804" x2="1544" y2="804" stroke="${withAlpha(fg, 0.22)}" />
      <text x="56" y="834" fill="${fg}" font-size="17" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">Same roles, same hierarchy.</text>
      <text x="302" y="836" fill="${muted}" font-size="15" font-family="'Segoe UI', 'Noto Sans', sans-serif" dominant-baseline="text-before-edge">The surface changes; the meaning does not.</text>
      <text x="1544" y="836" text-anchor="end" fill="${muted}" font-size="11" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="700" letter-spacing="0.12em" dominant-baseline="text-before-edge">GENERATED SEMANTIC PREVIEW · NOT APP SCREENSHOTS</text>
    </svg>
  `;
}

function renderOgSvg({ themes }) {
  return renderSemanticRiftSvg({ themes, width: 1200, height: 630 });
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
  mkdirSync(MARKETING_OUTPUT_DIR, { recursive: true });
  mkdirSync(dirname(MANIFEST_PATH), { recursive: true });

  const themes = FEATURED_THEME_META.map((meta) => {
    const source = readFileSync(meta.file);
    return {
      ...meta,
      sourceSha256: sha256(source),
      theme: JSON.parse(source.toString("utf8")),
    };
  });
  const missingThemeIds = FEATURED_THEME_META
    .map((meta) => meta.id)
    .filter((id) => !themes.some((meta) => meta.id === id));
  if (missingThemeIds.length > 0) {
    throw new Error(`Theme metadata is incomplete: ${missingThemeIds.join(", ")}`);
  }
  const colorFidelity = buildMarketingColorContract(themes);

  const contrastSvg = renderContrastSvg({ themes });
  const editorHeroSvg = renderEditorHeroSvg({ themes });
  const forgeWorkflowSvg = renderForgeWorkflowSvg({ themes });
  const directionAtlasSvg = renderDirectionAtlasSvg({ themes });
  const platformCoverageSvg = renderPlatformCoverageSvg({ themes });
  const mossSurfacesSvg = renderMossSurfacesSvg({ themes });
  const ogSvg = renderOgSvg({ themes });
  const previewFlavorMeta = FLAVOR_IDS.map((schemeId) => ({
    id: schemeId,
    name: FLAVORS_BY_ID[schemeId].name,
    headline: FLAVORS_BY_ID[schemeId].headline,
    summary: FLAVORS_BY_ID[schemeId].summary,
  }));

  const promoSpecSha256 = sha256(JSON.stringify({
    renderer: PREVIEW_RENDERER,
    generatorSourceSha256: GENERATOR_SOURCE_SHA256,
    product: {
      id: PRODUCT.id,
      name: PRODUCT.name,
      displayName: PRODUCT.displayName,
      summary: PRODUCT.summary,
      channels: PRODUCT.channels,
      channelAvailability: PRODUCT.channelAvailability,
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
    schemaVersion: 5,
    generator: "scripts/generate-preview-images.mjs",
    renderer: PREVIEW_RENDERER,
    generatorSourceSha256: GENERATOR_SOURCE_SHA256,
    promoSpecSha256,
    colorFidelity,
    canvas: { width: WIDTH, height: HEIGHT },
    editorHero: {
      inputSha256: sha256(JSON.stringify({ renderer: PREVIEW_RENDERER, generatorSourceSha256: GENERATOR_SOURCE_SHA256, themes, samples: PREVIEW.samples?.editors, asset: "editor-hero" })),
      outputs: EDITOR_HERO_OUTPUTS.map(toPosixPath),
    },
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
    forgeWorkflow: {
      inputSha256: sha256(JSON.stringify({ renderer: PREVIEW_RENDERER, generatorSourceSha256: GENERATOR_SOURCE_SHA256, themes, samples: PREVIEW.samples?.forge, asset: "forge-workflow" })),
      outputs: FORGE_WORKFLOW_OUTPUTS.map(toPosixPath),
    },
    directionAtlas: {
      inputSha256: sha256(JSON.stringify({ renderer: PREVIEW_RENDERER, generatorSourceSha256: GENERATOR_SOURCE_SHA256, themes, preview: PREVIEW.marketing, asset: "direction-atlas" })),
      outputs: DIRECTION_ATLAS_OUTPUTS.map(toPosixPath),
    },
    platformCoverage: {
      inputSha256: sha256(JSON.stringify({ renderer: PREVIEW_RENDERER, generatorSourceSha256: GENERATOR_SOURCE_SHA256, channelAvailability: PRODUCT.channelAvailability, preview: PREVIEW.marketing, asset: "platform-coverage" })),
      outputs: PLATFORM_COVERAGE_OUTPUTS.map(toPosixPath),
    },
    mossSurfaces: {
      inputSha256: sha256(JSON.stringify({ renderer: PREVIEW_RENDERER, generatorSourceSha256: GENERATOR_SOURCE_SHA256, themes: themes.filter((theme) => theme.schemeId === "moss"), preview: PREVIEW.marketing, samples: PREVIEW.samples, asset: "moss-surfaces" })),
      outputs: MOSS_SURFACES_OUTPUTS.map(toPosixPath),
    },
    socialCard: {
      inputSha256: sha256(JSON.stringify({ renderer: PREVIEW_RENDERER, generatorSourceSha256: GENERATOR_SOURCE_SHA256, themes, preview: PREVIEW, channelAvailability: PRODUCT.channelAvailability, asset: "og" })),
      canvas: { width: 1200, height: 630 },
      outputs: OG_OUTPUTS.map(toPosixPath),
    },
  };

  for (const legacyOutput of LEGACY_PREVIEW_OUTPUTS) {
    if (removeFileIfExists(legacyOutput)) {
      console.log(`- removed stale ${legacyOutput}`);
    }
  }

  // PNG bytes vary across sharp/libvips builds, so rendering is keyed off the
  // deterministic input manifest: skip when inputs are unchanged and outputs
  // exist, so checks stay clean on machines with a different sharp build.
  const forceRender = process.argv.includes("--force");
  const previousManifest = existsSync(MANIFEST_PATH) ? readJson(MANIFEST_PATH) : null;
  const manifestUnchanged = previousManifest != null
    && JSON.stringify(previousManifest) === JSON.stringify(manifest);
  const previewOutputs = [
    ...EDITOR_HERO_OUTPUTS,
    ...CONTRAST_OUTPUTS,
    ...FORGE_WORKFLOW_OUTPUTS,
    ...DIRECTION_ATLAS_OUTPUTS,
    ...PLATFORM_COVERAGE_OUTPUTS,
    ...MOSS_SURFACES_OUTPUTS,
    ...OG_OUTPUTS,
  ];
  const outputsPresent = previewOutputs.every((output) => existsSync(output));

  if (!forceRender && manifestUnchanged && outputsPresent) {
    for (const output of previewOutputs) {
      console.log(`- unchanged ${output}`);
    }
    console.log(`- unchanged ${MANIFEST_PATH}`);
    return;
  }

  for (const [svg, outputs] of [
    [editorHeroSvg, EDITOR_HERO_OUTPUTS],
    [contrastSvg, CONTRAST_OUTPUTS],
    [forgeWorkflowSvg, FORGE_WORKFLOW_OUTPUTS],
    [directionAtlasSvg, DIRECTION_ATLAS_OUTPUTS],
    [platformCoverageSvg, PLATFORM_COVERAGE_OUTPUTS],
    [mossSurfacesSvg, MOSS_SURFACES_OUTPUTS],
    [ogSvg, OG_OUTPUTS],
  ]) {
    for (const output of outputs) {
      await writePng(svg, output);
    }
  }

  const manifestChanged = writeJsonIfChanged(MANIFEST_PATH, manifest);
  console.log(`${manifestChanged ? "✓ updated" : "- unchanged"} ${MANIFEST_PATH}`);
}

run().catch((error) => {
  console.error(`✗ failed to generate preview images: ${error.message}`);
  process.exit(1);
});
