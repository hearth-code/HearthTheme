import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { getThemeMetaListForSchemeId, loadColorProductManifest, loadColorProductPreviewConfig, loadColorSchemeManifestById, loadRoleAdapters } from "./color-system.mjs";
import { BRAND_SYSTEM, escapeXml, mixHex, normalizeHex, withAlpha } from "./marketing/brand-system.mjs";
import { indexMarketingAssets, loadMarketingAssetSpec } from "./marketing/asset-spec.mjs";
import { assertSemanticRiftLayout, buildSemanticRiftLayout, buildTornPaperGeometry, renderDistressedText, renderFieldGuideFooter, renderFieldGuideGrid, renderFieldGuideHeader, renderMaterialTexture, renderRegistrationMarks, renderTornPaperSeam } from "./marketing/template-components.mjs";

const MARKETING_SPEC = loadMarketingAssetSpec();
const MARKETING_ASSETS = indexMarketingAssets(MARKETING_SPEC);
const WIDTH = MARKETING_SPEC.formats["readme-wide"].width;
const HEIGHT = MARKETING_SPEC.formats["readme-wide"].height;
const OUTPUT_DIR = join("extension", "images");
const WEBSITE_OUTPUT_DIR = join("public", "previews");
const MARKETING_OUTPUT_DIR = join("docs", "marketing");
const MANIFEST_PATH = join("reports", "preview-manifest.json");
const PREVIEW_RENDERER = MARKETING_SPEC.renderer;
const GENERATOR_SOURCE_SHA256 = createHash("sha256").update(readFileSync(new URL(import.meta.url))).digest("hex");
const BRAND_SYSTEM_SOURCE_SHA256 = createHash("sha256").update(readFileSync(new URL("./marketing/brand-system.mjs", import.meta.url))).digest("hex");
const TEMPLATE_COMPONENTS_SOURCE_SHA256 = createHash("sha256").update(readFileSync(new URL("./marketing/template-components.mjs", import.meta.url))).digest("hex");
const ASSET_SPEC_SOURCE_SHA256 = createHash("sha256").update(readFileSync(new URL("../products/hearthcode/marketing-assets.json", import.meta.url))).digest("hex");

const PRODUCT = loadColorProductManifest();
const PREVIEW = loadColorProductPreviewConfig();
function assetOutputs(id) {
  const asset = MARKETING_ASSETS[id];
  if (!asset) throw new Error(`Missing marketing asset spec: ${id}`);
  return asset.outputs;
}

const CONTRAST_OUTPUTS = assetOutputs("family-readme");
const EDITOR_HERO_OUTPUTS = assetOutputs("editor-marketplace");
const FORGE_WORKFLOW_OUTPUTS = assetOutputs("forge-marketplace");
const DIRECTION_ATLAS_OUTPUTS = assetOutputs("direction-atlas");
const PLATFORM_COVERAGE_OUTPUTS = assetOutputs("platform-coverage");
const MOSS_SURFACES_OUTPUTS = assetOutputs("moss-surfaces");
const GITHUB_SOCIAL_OUTPUTS = assetOutputs("github-social");
const OG_OUTPUTS = assetOutputs("site-og");
const FAMILY_SQUARE_OUTPUTS = assetOutputs("family-square");
const FAMILY_PORTRAIT_OUTPUTS = assetOutputs("family-portrait");
const FAMILY_STORY_OUTPUTS = assetOutputs("family-story");
const EMBER_SQUARE_OUTPUTS = assetOutputs("ember-square");
const MOSS_SQUARE_OUTPUTS = assetOutputs("moss-square");
const ZED_PLATFORM_OUTPUTS = assetOutputs("zed-platform");
const TERMINAL_PLATFORM_OUTPUTS = assetOutputs("terminal-platform");
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
const FLAVOR_PREVIEW_COPY = PREVIEW.marketing?.directions || {};

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

function renderRiftSample({ meta, x, y, layout }) {
  const foreground = requiredThemeColor(meta, "editor.foreground");
  const lines = buildFamilySampleLines(meta);
  const { fontSize, lineHeight, labelSize, swatchOffset, swatchStep, swatchWidth, swatchHeight } = layout.sample;
  const tokenColors = ["keyword", "function", "type", "string", "property", "operator"]
    .map((role) => requiredRoleColor(meta, role));
  const label = `${meta.flavor.name} ${meta.climateLabel}`.toUpperCase();
  return `
    <g>
      <text x="${x}" y="${y}" fill="${foreground}" font-size="${labelSize}" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="800" letter-spacing="0.15em" dominant-baseline="text-before-edge">${escapeXml(label)}</text>
      ${lines.map((segments, index) => renderCodeLine({
        theme: meta.theme,
        segments,
        x,
        y: y + labelSize + 15 * layout.scale + index * lineHeight,
        fontSize,
      })).join("")}
      ${tokenColors.map((color, index) => `<rect x="${x + index * swatchStep}" y="${y + swatchOffset}" width="${swatchWidth}" height="${swatchHeight}" fill="${color}" />`).join("")}
    </g>
  `;
}

function renderSemanticRiftSvg({ themes, width = WIDTH, height = HEIGHT }) {
  const layout = buildSemanticRiftLayout({ width, height });
  assertSemanticRiftLayout(layout);
  const { scale, splitY } = layout;
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
  const emberLightFg = requiredThemeColor(emberLight, "editor.foreground");
  const mossLightFg = requiredThemeColor(mossLight, "editor.foreground");
  const emberAccent = requiredRoleColor(emberDark, "keyword");
  const mossAccent = requiredRoleColor(mossDark, "function");
  const headline = PREVIEW.marketing?.familyHeadline || "EMBER / MOSS";
  const subheadline = PREVIEW.marketing?.familySubheadline || "FOUR THEMES. ONE COLOR LANGUAGE.";
  const [emberWord = "EMBER", mossWord = "MOSS"] = headline.split("/").map((word) => word.trim());
  const subheadlineMatch = subheadline.match(/^(.+?\.)\s+(.+)$/);
  const subheadlineLeft = subheadlineMatch?.[1] || subheadline;
  const subheadlineRight = subheadlineMatch?.[2] || "";
  const leftX = layout.title.emberX;
  const rightX = layout.sample.rightX;
  const darkSampleY = layout.sample.darkY;
  const lightSampleY = layout.sample.lightY;
  const headlineY = layout.title.y;
  const headlineSize = layout.title.fontSize;
  const mossX = layout.title.mossX;
  const tearGeometry = buildTornPaperGeometry({
    controlPoints: layout.tearControlPoints,
    seed: 83,
    segmentLength: 13 * scale,
    jitter: 6 * scale,
    paperWidth: 14 * scale,
    widthVariation: 0.84,
  });
  const pointsString = (points) => points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const emberMask = `0,0 ${pointsString(tearGeometry.sideB)} 0,${height}`;
  const mossMask = `${pointsString([tearGeometry.sideA[0], { x: width, y: 0 }, { x: width, y: height }, ...[...tearGeometry.sideA].reverse()])}`;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <clipPath id="rift-dark-field"><rect width="${width}" height="${splitY}" /></clipPath>
        <clipPath id="rift-light-field"><rect y="${splitY}" width="${width}" height="${height - splitY}" /></clipPath>
      </defs>
      <rect width="${width}" height="${splitY}" fill="${mossDarkBg}" />
      <rect y="${splitY}" width="${width}" height="${height - splitY}" fill="${mossLightBg}" />
      <polygon points="${emberMask}" fill="${emberDarkBg}" clip-path="url(#rift-dark-field)" />
      <polygon points="${emberMask}" fill="${emberLightBg}" clip-path="url(#rift-light-field)" />

      <g clip-path="url(#rift-dark-field)">
        ${renderMaterialTexture({ id: "rift-ember-dark", ink: emberDarkFg, width, height, points: emberMask, seed: 11, intensity: BRAND_SYSTEM.material.posterTexture * 0.55 })}
        ${renderMaterialTexture({ id: "rift-moss-dark", ink: mossDarkFg, width, height, points: mossMask, seed: 23, intensity: BRAND_SYSTEM.material.posterTexture * 0.55 })}
      </g>
      <g clip-path="url(#rift-light-field)">
        ${renderMaterialTexture({ id: "rift-ember-light", ink: emberLightFg, width, height, points: emberMask, seed: 37, intensity: BRAND_SYSTEM.material.posterTexture * 0.55 })}
        ${renderMaterialTexture({ id: "rift-moss-light", ink: mossLightFg, width, height, points: mossMask, seed: 41, intensity: BRAND_SYSTEM.material.posterTexture * 0.55 })}
      </g>

      <line x1="0" y1="${splitY}" x2="${width}" y2="${splitY}" stroke="${mossDarkFg}" stroke-opacity="0.22" stroke-width="${Math.max(1, scale)}" />
      ${renderTornPaperSeam({
        id: "family-rift",
        geometry: tearGeometry,
        paper: emberDarkFg,
        warmInk: emberAccent,
        coolInk: mossAccent,
        shadowInk: emberDarkBg,
        seed: 89,
        intensity: BRAND_SYSTEM.material.tornRift * 0.86,
      })}

      <text x="${leftX}" y="${30 * scale}" fill="${emberDarkFg}" font-size="${20 * scale}" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-weight="800" letter-spacing="0.2em" dominant-baseline="text-before-edge">${escapeXml((PREVIEW.badgeLabel || PRODUCT.name).toUpperCase())}</text>
      ${renderDistressedText({ id: "rift-title-ember", text: emberWord, x: leftX, y: headlineY, fill: emberAccent, wear: emberDarkBg, fontSize: headlineSize, fontFamily: BRAND_SYSTEM.typography.displayCondensed, letterSpacing: "-0.025em", seed: 13, intensity: BRAND_SYSTEM.material.typeWear * 0.42 })}
      ${renderDistressedText({ id: "rift-title-moss", text: mossWord, x: mossX, y: headlineY, fill: mossAccent, wear: mossDarkBg, fontSize: headlineSize, fontFamily: BRAND_SYSTEM.typography.displayCondensed, letterSpacing: "-0.025em", seed: 29, intensity: BRAND_SYSTEM.material.typeWear * 0.42 })}
      <text x="${layout.subheading.leftX}" y="${layout.subheading.y}" fill="${emberDarkFg}" font-size="${layout.subheading.fontSize}" font-family="${BRAND_SYSTEM.typography.displayCondensed}" font-weight="800" letter-spacing="0.035em" dominant-baseline="text-before-edge">${escapeXml(subheadlineLeft)}</text>
      <text x="${layout.subheading.rightX}" y="${layout.subheading.y}" fill="${mossDarkFg}" font-size="${layout.subheading.fontSize}" font-family="${BRAND_SYSTEM.typography.displayCondensed}" font-weight="800" letter-spacing="0.035em" dominant-baseline="text-before-edge">${escapeXml(subheadlineRight)}</text>

      ${renderRiftSample({ meta: emberDark, x: layout.sample.leftX, y: darkSampleY, layout })}
      ${renderRiftSample({ meta: mossDark, x: rightX, y: darkSampleY, layout })}
      ${renderRiftSample({ meta: emberLight, x: layout.sample.leftX, y: lightSampleY, layout })}
      ${renderRiftSample({ meta: mossLight, x: rightX, y: lightSampleY, layout })}
    </svg>
  `;
}

function getFamilyThemeSet(themes) {
  return {
    emberDark: getPreviewTheme(themes, "ember", "dark"),
    mossDark: getPreviewTheme(themes, "moss", "dark"),
    emberLight: getPreviewTheme(themes, "ember", "light"),
    mossLight: getPreviewTheme(themes, "moss", "light"),
  };
}

function renderFamilyLockup({
  emberDark,
  mossDark,
  width,
  inset,
  kickerY,
  titleY,
  titleSize,
  subheadingY,
  subheadingSize,
  kicker = BRAND_SYSTEM.copy.familyKicker,
  kickerSize = Math.max(15, Math.round(width * 0.015)),
  subheadline = PREVIEW.marketing?.familySubheadline || "FOUR THEMES. ONE COLOR LANGUAGE.",
}) {
  const foreground = requiredThemeColor(emberDark, "editor.foreground");
  const emberSurface = requiredThemeColor(emberDark, "editor.background");
  const mossSurface = requiredThemeColor(mossDark, "editor.background");
  const emberAccent = requiredRoleColor(emberDark, "keyword");
  const mossAccent = requiredRoleColor(mossDark, "function");
  const headline = PREVIEW.marketing?.familyHeadline || "EMBER / MOSS";
  const [emberWord = "EMBER", mossWord = "MOSS"] = headline.split("/").map((word) => word.trim());

  return `
    <text x="${inset}" y="${kickerY}" fill="${foreground}" font-size="${kickerSize}" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.2em" dominant-baseline="text-before-edge">${escapeXml(kicker)}</text>
    ${renderDistressedText({ id: `family-lockup-ember-${width}`, text: emberWord, x: inset, y: titleY, fill: emberAccent, wear: emberSurface, fontSize: titleSize, seed: 47, intensity: BRAND_SYSTEM.material.typeWear })}
    ${renderDistressedText({ id: `family-lockup-moss-${width}`, text: mossWord, x: width - inset, y: titleY, fill: mossAccent, wear: mossSurface, fontSize: titleSize, textAnchor: "end", seed: 59, intensity: BRAND_SYSTEM.material.typeWear })}
    <text x="${inset}" y="${subheadingY}" fill="${foreground}" font-size="${subheadingSize}" font-family="${BRAND_SYSTEM.typography.ui}" font-weight="800" letter-spacing="0.02em" dominant-baseline="text-before-edge">${escapeXml(subheadline)}</text>
  `;
}

function renderFamilySpecimenCard({
  meta,
  x,
  y,
  width,
  height,
  modeLabel,
  title,
  titleSize = 34,
  codeFontSize = 23,
  lineHeight = 40,
  showSurface = true,
  showSwatches = true,
  pairLabel = "PAIRED MODE",
}) {
  const background = requiredThemeColor(meta, "editor.background");
  const foreground = requiredThemeColor(meta, "editor.foreground");
  const accent = requiredRoleColor(meta, meta.schemeId === "moss" ? "function" : "keyword");
  const muted = mixHex(foreground, background, 0.48);
  const lines = buildFamilySampleLines(meta);
  const frameX = x + 28;
  const frameY = y + 112;
  const frameWidth = width - 56;
  const frameHeight = height - 176;
  const codeY = frameY + Math.max(24, Math.round((frameHeight - lineHeight * lines.length) / 2));
  const swatches = ["keyword", "function", "type", "string", "property", "operator"]
    .map((role) => requiredRoleColor(meta, role));

  return `
    <g>
      ${showSurface ? `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${background}" />` : ""}
      <rect x="${frameX}" y="${frameY}" width="${frameWidth}" height="${frameHeight}" fill="${mixHex(background, foreground, meta.isDark ? 0.018 : 0.025)}" stroke="${withAlpha(foreground, 0.16)}" />
      ${renderMaterialTexture({ id: `specimen-${meta.id}-${x}-${y}`, ink: foreground, x, y, width, height, seed: Math.round(x + y + width), intensity: BRAND_SYSTEM.material.proofTexture })}
      <rect x="${x}" y="${y}" width="10" height="${height}" fill="${accent}" />
      <text x="${x + 30}" y="${y + 22}" fill="${accent}" font-size="13" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.16em" dominant-baseline="text-before-edge">${escapeXml(modeLabel)}</text>
      <text x="${x + 30}" y="${y + 48}" fill="${foreground}" font-size="${titleSize}" font-family="${BRAND_SYSTEM.typography.display}" font-weight="800" dominant-baseline="text-before-edge">${escapeXml(title)}</text>
      ${lines.map((segments, index) => renderCodeLine({
        theme: meta.theme,
        segments,
        x: frameX + 24,
        y: codeY + index * lineHeight,
        fontSize: codeFontSize,
      })).join("")}
      ${showSwatches
        ? swatches.map((color, index) => `<rect x="${x + 30 + index * 54}" y="${y + height - 34}" width="40" height="9" fill="${color}" />`).join("")
        : pairLabel
          ? `<text x="${x + width - 30}" y="${y + height - 36}" text-anchor="end" fill="${muted}" font-size="12" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="700" letter-spacing="0.12em">${escapeXml(pairLabel)}</text>`
          : ""}
    </g>
  `;
}

function renderEditorialSquareSvg({ themes, width, height }) {
  const {
    emberDark,
    mossDark,
    emberLight,
    mossLight,
  } = getFamilyThemeSet(themes);
  const emberDarkBg = requiredThemeColor(emberDark, "editor.background");
  const mossDarkBg = requiredThemeColor(mossDark, "editor.background");
  const emberLightBg = requiredThemeColor(emberLight, "editor.background");
  const mossLightBg = requiredThemeColor(mossLight, "editor.background");
  const emberDarkFg = requiredThemeColor(emberDark, "editor.foreground");
  const mossDarkFg = requiredThemeColor(mossDark, "editor.foreground");
  const emberLightFg = requiredThemeColor(emberLight, "editor.foreground");
  const mossLightFg = requiredThemeColor(mossLight, "editor.foreground");
  const inset = 64;
  const splitY = Math.round(height * 0.65);
  const seamTopX = Math.round(width * 0.54);
  const seamMidX = Math.round(width * 0.51);
  const seamBottomX = Math.round(width * 0.48);
  const emberDarkMask = `0,0 ${seamTopX},0 ${seamMidX},${splitY} 0,${splitY}`;
  const mossDarkMask = `${seamTopX},0 ${width},0 ${width},${splitY} ${seamMidX},${splitY}`;
  const emberLightMask = `0,${splitY} ${seamMidX},${splitY} ${seamBottomX},${height} 0,${height}`;
  const mossLightMask = `${seamMidX},${splitY} ${width},${splitY} ${width},${height} ${seamBottomX},${height}`;
  const tearGeometry = buildTornPaperGeometry({
    controlPoints: [
      { x: seamTopX, y: 0 },
      { x: seamMidX, y: splitY },
      { x: seamBottomX, y: height },
    ],
    seed: 173,
    segmentLength: 16,
    jitter: 6,
    paperWidth: 14,
    widthVariation: 0.7,
  });
  const emberLines = buildFamilySampleLines(emberLight);
  const mossLines = buildFamilySampleLines(mossLight);
  const renderRoleRail = (meta, x, y, railWidth) => ["keyword", "function", "type", "string", "property", "operator"]
    .map((role, index) => `<rect x="${x + index * (railWidth + 12)}" y="${y}" width="${railWidth}" height="12" fill="${requiredRoleColor(meta, role)}" />`)
    .join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <polygon points="${emberDarkMask}" fill="${emberDarkBg}" />
      <polygon points="${mossDarkMask}" fill="${mossDarkBg}" />
      <polygon points="${emberLightMask}" fill="${emberLightBg}" />
      <polygon points="${mossLightMask}" fill="${mossLightBg}" />
      ${renderMaterialTexture({ id: "square-ember-dark", ink: emberDarkFg, width, height: splitY, points: emberDarkMask, seed: 67, intensity: 0.52 })}
      ${renderMaterialTexture({ id: "square-moss-dark", ink: mossDarkFg, width, height: splitY, points: mossDarkMask, seed: 71, intensity: 0.52 })}
      ${renderMaterialTexture({ id: "square-ember-light", ink: emberLightFg, width, height, points: emberLightMask, seed: 73, intensity: 0.46 })}
      ${renderMaterialTexture({ id: "square-moss-light", ink: mossLightFg, width, height, points: mossLightMask, seed: 79, intensity: 0.46 })}
      ${renderTornPaperSeam({ id: "square-family-seam", geometry: tearGeometry, paper: emberDarkFg, warmInk: requiredRoleColor(emberDark, "keyword"), coolInk: requiredRoleColor(mossDark, "function"), shadowInk: emberDarkBg, seed: 179, intensity: 0.56 })}

      <text x="${inset}" y="38" fill="${emberDarkFg}" font-size="16" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.2em" dominant-baseline="text-before-edge">HEARTHCODE · FOUR CALIBRATED THEMES</text>
      ${renderDistressedText({ id: "square-ember-title", text: "EMBER", x: inset, y: 88, fill: requiredRoleColor(emberDark, "keyword"), wear: emberDarkBg, fontSize: 154, fontFamily: BRAND_SYSTEM.typography.displayCondensed, letterSpacing: "-0.03em", seed: 181, intensity: 0.42 })}
      ${renderDistressedText({ id: "square-moss-title", text: "MOSS", x: width - inset, y: 88, fill: requiredRoleColor(mossDark, "function"), wear: mossDarkBg, fontSize: 154, fontFamily: BRAND_SYSTEM.typography.displayCondensed, letterSpacing: "-0.03em", textAnchor: "end", seed: 191, intensity: 0.42 })}
      <text x="${inset}" y="294" fill="${emberDarkFg}" font-size="53" font-family="${BRAND_SYSTEM.typography.displayCondensed}" font-weight="850" letter-spacing="0.015em" dominant-baseline="text-before-edge">WARMTH OR</text>
      <text x="${Math.round(width * 0.58)}" y="294" fill="${mossDarkFg}" font-size="53" font-family="${BRAND_SYSTEM.typography.displayCondensed}" font-weight="850" letter-spacing="0.015em" dominant-baseline="text-before-edge">STRUCTURE.</text>
      <text x="${inset}" y="360" fill="${emberDarkFg}" font-size="66" font-family="${BRAND_SYSTEM.typography.displayCondensed}" font-weight="900" letter-spacing="0.012em" dominant-baseline="text-before-edge">MEANING</text>
      <text x="${Math.round(width * 0.58)}" y="360" fill="${mossDarkFg}" font-size="66" font-family="${BRAND_SYSTEM.typography.displayCondensed}" font-weight="900" letter-spacing="0.012em" dominant-baseline="text-before-edge">STAYS CLEAR.</text>
      <text x="${inset}" y="500" fill="${mixHex(emberDarkFg, emberDarkBg, 0.38)}" font-size="13" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.15em" dominant-baseline="text-before-edge">EMBER DARK · WARM CONTROL FLOW</text>
      <text x="${Math.round(width * 0.58)}" y="500" fill="${mixHex(mossDarkFg, mossDarkBg, 0.38)}" font-size="13" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.15em" dominant-baseline="text-before-edge">MOSS DARK · DRY STRUCTURE</text>
      ${renderRoleRail(emberDark, inset, 542, 60)}
      ${renderRoleRail(mossDark, Math.round(width * 0.58), 542, 48)}

      <text x="${inset}" y="${splitY + 42}" fill="${mixHex(emberLightFg, emberLightBg, 0.38)}" font-size="13" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.15em" dominant-baseline="text-before-edge">EMBER LIGHT</text>
      <text x="${Math.round(width * 0.58)}" y="${splitY + 42}" fill="${mixHex(mossLightFg, mossLightBg, 0.38)}" font-size="13" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.15em" dominant-baseline="text-before-edge">MOSS LIGHT</text>
      ${emberLines.slice(0, 4).map((segments, index) => renderCodeLine({ theme: emberLight.theme, segments, x: inset, y: splitY + 88 + index * 48, fontSize: 25 })).join("")}
      ${mossLines.slice(0, 4).map((segments, index) => renderCodeLine({ theme: mossLight.theme, segments, x: Math.round(width * 0.58), y: splitY + 88 + index * 48, fontSize: 25 })).join("")}
      <text x="${inset}" y="${height - 38}" fill="${emberLightFg}" font-size="12" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.12em">DARK + LIGHT · SAME READING RHYTHM</text>
      <text x="${width - inset}" y="${height - 38}" text-anchor="end" fill="${mossLightFg}" font-size="12" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.12em">${escapeXml(BRAND_SYSTEM.copy.site)}</text>
    </svg>
  `;
}

function renderStackedDirectionsSvg({ themes, width, height }) {
  const {
    emberDark,
    mossDark,
    emberLight,
    mossLight,
  } = getFamilyThemeSet(themes);
  const emberDarkBg = requiredThemeColor(emberDark, "editor.background");
  const mossDarkBg = requiredThemeColor(mossDark, "editor.background");
  const emberLightBg = requiredThemeColor(emberLight, "editor.background");
  const mossLightBg = requiredThemeColor(mossLight, "editor.background");
  const emberDarkFg = requiredThemeColor(emberDark, "editor.foreground");
  const mossDarkFg = requiredThemeColor(mossDark, "editor.foreground");
  const emberLightFg = requiredThemeColor(emberLight, "editor.foreground");
  const mossLightFg = requiredThemeColor(mossLight, "editor.foreground");
  const inset = 60;
  const lightY = Math.round(height * 0.77);
  const lightSplit = Math.round(width * 0.48);
  const diagonalLeftY = Math.round(height * 0.49);
  const diagonalRightY = Math.round(height * 0.38);
  const emberMask = `0,0 ${width},0 ${width},${diagonalRightY} 0,${diagonalLeftY}`;
  const mossMask = `0,${diagonalLeftY} ${width},${diagonalRightY} ${width},${lightY} 0,${lightY}`;
  const tearGeometry = buildTornPaperGeometry({
    controlPoints: [{ x: 0, y: diagonalLeftY }, { x: width, y: diagonalRightY }],
    seed: 193,
    segmentLength: 18,
    jitter: 6,
    paperWidth: 13,
    widthVariation: 0.72,
  });
  const emberLines = buildFamilySampleLines(emberLight);
  const mossLines = buildFamilySampleLines(mossLight);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${lightY}" fill="${mossDarkBg}" />
      <polygon points="${emberMask}" fill="${emberDarkBg}" />
      <polygon points="${mossMask}" fill="${mossDarkBg}" />
      <rect y="${lightY}" width="${lightSplit}" height="${height - lightY}" fill="${emberLightBg}" />
      <rect x="${lightSplit}" y="${lightY}" width="${width - lightSplit}" height="${height - lightY}" fill="${mossLightBg}" />
      ${renderMaterialTexture({ id: "portrait-ember", ink: emberDarkFg, width, height: lightY, points: emberMask, seed: 83, intensity: 0.5 })}
      ${renderMaterialTexture({ id: "portrait-moss", ink: mossDarkFg, width, height: lightY, points: mossMask, seed: 89, intensity: 0.5 })}
      ${renderMaterialTexture({ id: "portrait-ember-light", ink: emberLightFg, y: lightY, width: lightSplit, height: height - lightY, seed: 97, intensity: 0.42 })}
      ${renderMaterialTexture({ id: "portrait-moss-light", ink: mossLightFg, x: lightSplit, y: lightY, width: width - lightSplit, height: height - lightY, seed: 101, intensity: 0.42 })}
      ${renderTornPaperSeam({ id: "portrait-family-seam", geometry: tearGeometry, paper: emberDarkFg, warmInk: requiredRoleColor(emberDark, "keyword"), coolInk: requiredRoleColor(mossDark, "function"), shadowInk: emberDarkBg, seed: 199, intensity: 0.54 })}

      <text x="${inset}" y="38" fill="${emberDarkFg}" font-size="15" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.2em" dominant-baseline="text-before-edge">HEARTHCODE · SEMANTIC MATERIALS</text>
      ${renderDistressedText({ id: "portrait-ember-title", text: "EMBER", x: inset, y: 88, fill: requiredRoleColor(emberDark, "keyword"), wear: emberDarkBg, fontSize: 176, fontFamily: BRAND_SYSTEM.typography.displayCondensed, letterSpacing: "-0.035em", seed: 211, intensity: 0.42 })}
      <text x="${inset}" y="294" fill="${emberDarkFg}" font-size="46" font-family="${BRAND_SYSTEM.typography.displayCondensed}" font-weight="850" letter-spacing="0.015em" dominant-baseline="text-before-edge">WARMTH OR STRUCTURE.</text>
      <text x="${inset}" y="352" fill="${emberDarkFg}" font-size="58" font-family="${BRAND_SYSTEM.typography.displayCondensed}" font-weight="900" letter-spacing="0.01em" dominant-baseline="text-before-edge">MEANING STAYS CLEAR.</text>
      ${renderDistressedText({ id: "portrait-moss-title", text: "MOSS", x: width - inset, y: 626, fill: requiredRoleColor(mossDark, "function"), wear: mossDarkBg, fontSize: 190, fontFamily: BRAND_SYSTEM.typography.displayCondensed, letterSpacing: "-0.035em", textAnchor: "end", seed: 223, intensity: 0.42 })}
      <text x="${inset}" y="860" fill="${mossDarkFg}" font-size="18" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.13em" dominant-baseline="text-before-edge">DIFFERENT MATERIAL. SAME READING RHYTHM.</text>
      ${["keyword", "function", "type", "string", "property", "operator"].map((role, index) => `<rect x="${inset + index * 145}" y="916" width="118" height="14" fill="${requiredRoleColor(mossDark, role)}" />`).join("")}

      <text x="${inset}" y="${lightY + 34}" fill="${mixHex(emberLightFg, emberLightBg, 0.36)}" font-size="12" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.15em" dominant-baseline="text-before-edge">EMBER LIGHT</text>
      <text x="${lightSplit + 34}" y="${lightY + 34}" fill="${mixHex(mossLightFg, mossLightBg, 0.36)}" font-size="12" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.15em" dominant-baseline="text-before-edge">MOSS LIGHT</text>
      ${emberLines.map((segments, index) => renderCodeLine({ theme: emberLight.theme, segments, x: inset, y: lightY + 76 + index * 42, fontSize: 21 })).join("")}
      ${mossLines.map((segments, index) => renderCodeLine({ theme: mossLight.theme, segments, x: lightSplit + 34, y: lightY + 76 + index * 42, fontSize: 21 })).join("")}
      <text x="${inset}" y="${height - 38}" fill="${emberLightFg}" font-size="12" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.12em">DARK + LIGHT</text>
      <text x="${width - inset}" y="${height - 38}" text-anchor="end" fill="${mossLightFg}" font-size="12" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.12em">${escapeXml(BRAND_SYSTEM.copy.site)}</text>
    </svg>
  `;
}

function renderCampaignStorySvg({ themes, width, height }) {
  const {
    emberDark,
    mossDark,
    emberLight,
    mossLight,
  } = getFamilyThemeSet(themes);
  const emberDarkBg = requiredThemeColor(emberDark, "editor.background");
  const mossDarkBg = requiredThemeColor(mossDark, "editor.background");
  const emberDarkFg = requiredThemeColor(emberDark, "editor.foreground");
  const mossDarkFg = requiredThemeColor(mossDark, "editor.foreground");
  const emberLightBg = requiredThemeColor(emberLight, "editor.background");
  const mossLightBg = requiredThemeColor(mossLight, "editor.background");
  const emberLightFg = requiredThemeColor(emberLight, "editor.foreground");
  const mossLightFg = requiredThemeColor(mossLight, "editor.foreground");
  const emberAccent = requiredRoleColor(emberDark, "keyword");
  const mossAccent = requiredRoleColor(mossDark, "function");
  const inset = 72;
  const lightY = Math.round(height * 0.735);
  const diagonalLeftY = Math.round(height * 0.38);
  const diagonalRightY = Math.round(height * 0.31);
  const emberMask = `0,0 ${width},0 ${width},${diagonalRightY} 0,${diagonalLeftY}`;
  const mossMask = `0,${diagonalLeftY} ${width},${diagonalRightY} ${width},${lightY} 0,${lightY}`;
  const lightSplit = Math.round(width * 0.5);
  const tearGeometry = buildTornPaperGeometry({
    controlPoints: [{ x: 0, y: diagonalLeftY }, { x: width, y: diagonalRightY }],
    seed: 227,
    segmentLength: 18,
    jitter: 7,
    paperWidth: 14,
    widthVariation: 0.74,
  });
  const emberLines = buildFamilySampleLines(emberLight);
  const mossLines = buildFamilySampleLines(mossLight);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${lightY}" fill="${mossDarkBg}" />
      <polygon points="${emberMask}" fill="${emberDarkBg}" />
      <polygon points="${mossMask}" fill="${mossDarkBg}" />
      <rect y="${lightY}" width="${lightSplit}" height="${height - lightY}" fill="${emberLightBg}" />
      <rect x="${lightSplit}" y="${lightY}" width="${width - lightSplit}" height="${height - lightY}" fill="${mossLightBg}" />
      ${renderMaterialTexture({ id: "story-ember", ink: emberDarkFg, width, height: lightY, points: emberMask, seed: 107, intensity: 0.5 })}
      ${renderMaterialTexture({ id: "story-moss", ink: mossDarkFg, width, height: lightY, points: mossMask, seed: 109, intensity: 0.5 })}
      ${renderMaterialTexture({ id: "story-ember-light", ink: emberLightFg, y: lightY, width: lightSplit, height: height - lightY, seed: 113, intensity: 0.42 })}
      ${renderMaterialTexture({ id: "story-moss-light", ink: mossLightFg, x: lightSplit, y: lightY, width: width - lightSplit, height: height - lightY, seed: 127, intensity: 0.42 })}
      ${renderTornPaperSeam({ id: "story-family-seam", geometry: tearGeometry, paper: emberDarkFg, warmInk: emberAccent, coolInk: mossAccent, shadowInk: emberDarkBg, seed: 229, intensity: 0.58 })}

      <text x="${inset}" y="56" fill="${emberDarkFg}" font-size="16" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.2em" dominant-baseline="text-before-edge">HEARTHCODE · FOUR CALIBRATED THEMES</text>
      ${renderDistressedText({ id: "story-title-ember", text: "EMBER", x: inset, y: 124, fill: emberAccent, wear: emberDarkBg, fontSize: 210, fontFamily: BRAND_SYSTEM.typography.displayCondensed, letterSpacing: "-0.04em", seed: 233, intensity: 0.42 })}
      <text x="${inset}" y="376" fill="${emberDarkFg}" font-size="52" font-family="${BRAND_SYSTEM.typography.displayCondensed}" font-weight="850" letter-spacing="0.015em" dominant-baseline="text-before-edge">WARMTH OR STRUCTURE.</text>
      <text x="${inset}" y="438" fill="${emberDarkFg}" font-size="64" font-family="${BRAND_SYSTEM.typography.displayCondensed}" font-weight="900" letter-spacing="0.01em" dominant-baseline="text-before-edge">MEANING STAYS CLEAR.</text>

      ${renderDistressedText({ id: "story-title-moss", text: "MOSS", x: width - inset, y: 712, fill: mossAccent, wear: mossDarkBg, fontSize: 230, fontFamily: BRAND_SYSTEM.typography.displayCondensed, letterSpacing: "-0.04em", textAnchor: "end", seed: 239, intensity: 0.42 })}
      <text x="${inset}" y="996" fill="${mossDarkFg}" font-size="23" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.13em" dominant-baseline="text-before-edge">DIFFERENT MATERIAL.</text>
      <text x="${inset}" y="1042" fill="${mossDarkFg}" font-size="23" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.13em" dominant-baseline="text-before-edge">SAME READING RHYTHM.</text>
      ${["keyword", "function", "type", "string", "property", "operator"].map((role, index) => `<rect x="${inset + index * 150}" y="1124" width="120" height="15" fill="${requiredRoleColor(mossDark, role)}" />`).join("")}

      <text x="${inset}" y="${lightY + 46}" fill="${mixHex(emberLightFg, emberLightBg, 0.36)}" font-size="13" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.15em" dominant-baseline="text-before-edge">EMBER LIGHT</text>
      <text x="${lightSplit + 36}" y="${lightY + 46}" fill="${mixHex(mossLightFg, mossLightBg, 0.36)}" font-size="13" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.15em" dominant-baseline="text-before-edge">MOSS LIGHT</text>
      ${emberLines.map((segments, index) => renderCodeLine({ theme: emberLight.theme, segments, x: inset, y: lightY + 94 + index * 51, fontSize: 24 })).join("")}
      ${mossLines.map((segments, index) => renderCodeLine({ theme: mossLight.theme, segments, x: lightSplit + 36, y: lightY + 94 + index * 51, fontSize: 24 })).join("")}
      <text x="${inset}" y="${height - 54}" fill="${emberLightFg}" font-size="13" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.12em">DARK + LIGHT · SOURCE-TRUE COLOR</text>
      <text x="${width - inset}" y="${height - 54}" text-anchor="end" fill="${mossLightFg}" font-size="13" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.12em">${escapeXml(BRAND_SYSTEM.copy.site)}</text>
    </svg>
  `;
}

function renderFamilyAssetSvg({
  themes,
  width = WIDTH,
  height = HEIGHT,
  composition = "semantic-rift-wide",
}) {
  switch (composition) {
    case "semantic-rift-wide":
      return renderSemanticRiftSvg({ themes, width, height });
    case "editorial-square":
      return renderEditorialSquareSvg({ themes, width, height });
    case "stacked-directions":
      return renderStackedDirectionsSvg({ themes, width, height });
    case "campaign-story":
      return renderCampaignStorySvg({ themes, width, height });
    default:
      throw new Error(`Unknown family composition: ${composition}`);
  }
}

function renderContrastSvg({ themes }) {
  const asset = MARKETING_ASSETS["family-readme"];
  return renderFamilyAssetSvg({ themes, composition: asset.composition, ...asset.canvas });
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
  const darkShell = themeColor(mossDark.theme, "sideBar.background", "#191815");
  const darkTitle = themeColor(mossDark.theme, "titleBar.activeBackground", darkShell);
  const darkTabs = themeColor(mossDark.theme, "editorGroupHeader.tabsBackground", darkShell);
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
  const semanticRoles = ["keyword", "function", "type", "string", "property", "operator"];
  const renderSemanticRail = (meta, x, y, foreground) => semanticRoles.map((role, index) => {
    const roleX = x + index * 112;
    return `
      <rect x="${roleX}" y="${y}" width="92" height="8" fill="${requiredRoleColor(meta, role)}" />
      <text x="${roleX}" y="${y + 18}" fill="${foreground}" font-size="10" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="750" letter-spacing="0.08em" dominant-baseline="text-before-edge">${role.toUpperCase()}</text>
    `;
  }).join("");

  const frameX = 18;
  const frameY = 18;
  const frameWidth = WIDTH - frameX * 2;
  const frameHeight = HEIGHT - frameY * 2;
  const splitTopX = 824;
  const splitBottomX = 778;
  const leftCodeX = 68;
  const rightCodeX = 892;
  const codeY = 188;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
      <defs>
        <clipPath id="moss-hero-frame">
          <rect x="${frameX}" y="${frameY}" width="${frameWidth}" height="${frameHeight}" rx="18" />
        </clipPath>
      </defs>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="${mixHex(darkShell, "#000000", 0.12)}" />
      <rect x="26" y="32" width="${frameWidth}" height="${frameHeight}" rx="18" fill="${withAlpha("#000000", 0.24)}" />
      <g clip-path="url(#moss-hero-frame)">
        <rect x="${frameX}" y="${frameY}" width="${frameWidth}" height="${frameHeight}" fill="${darkBg}" />
        <polygon points="${splitTopX},${frameY} ${WIDTH - frameX},${frameY} ${WIDTH - frameX},${HEIGHT - frameY} ${splitBottomX},${HEIGHT - frameY}" fill="${lightBg}" />

        <rect x="${frameX}" y="${frameY}" width="${frameWidth}" height="54" fill="${darkTitle}" />
        <polygon points="${splitTopX},${frameY} ${WIDTH - frameX},${frameY} ${WIDTH - frameX},72 ${splitTopX - 3},72" fill="${lightTitle}" />
        <circle cx="42" cy="45" r="5" fill="${roleColor(mossDark.theme, "keyword")}" />
        <circle cx="60" cy="45" r="5" fill="${roleColor(mossDark.theme, "string")}" />
        <circle cx="78" cy="45" r="5" fill="${roleColor(mossDark.theme, "function")}" />
        <text x="106" y="32" fill="${darkFg}" font-size="15" font-family="${BRAND_SYSTEM.typography.ui}" font-weight="800" letter-spacing="0.15em" dominant-baseline="text-before-edge">HEARTHCODE MOSS</text>
        <text x="790" y="33" text-anchor="end" fill="${darkMuted}" font-size="12" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.12em" dominant-baseline="text-before-edge">DARK</text>
        <text x="1548" y="33" text-anchor="end" fill="${lightMuted}" font-size="12" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.12em" dominant-baseline="text-before-edge">LIGHT</text>

        <rect x="${frameX}" y="72" width="${splitTopX - frameX}" height="54" fill="${darkTabs}" />
        <rect x="42" y="72" width="208" height="54" fill="${darkBg}" />
        <text x="68" y="91" fill="${darkFg}" font-size="14" font-family="${BRAND_SYSTEM.typography.ui}" font-weight="700" dominant-baseline="text-before-edge">semantic-theme.ts</text>
        <polygon points="${splitTopX - 3},72 ${WIDTH - frameX},72 ${WIDTH - frameX},126 ${splitTopX - 6},126" fill="${lightTabs}" />
        <rect x="866" y="72" width="208" height="54" fill="${lightBg}" />
        <text x="892" y="91" fill="${lightFg}" font-size="14" font-family="${BRAND_SYSTEM.typography.ui}" font-weight="700" dominant-baseline="text-before-edge">semantic-theme.ts</text>

        <text x="${leftCodeX}" y="150" fill="${darkMuted}" font-size="12" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.16em" dominant-baseline="text-before-edge">MOSS DARK · STRUCTURED WITHOUT GLARE</text>
        <text x="${rightCodeX}" y="150" fill="${lightMuted}" font-size="12" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.16em" dominant-baseline="text-before-edge">MOSS LIGHT · THE SAME READING RHYTHM</text>
        ${renderNumberedCodeBlock({ theme: mossDark.theme, lines: darkLines, x: leftCodeX, y: codeY, fontSize: 26, lineHeight: 58 })}
        ${renderNumberedCodeBlock({ theme: mossLight.theme, lines: lightLines, x: rightCodeX, y: codeY, fontSize: 26, lineHeight: 58 })}

        ${renderSemanticRail(mossDark, leftCodeX, 700, darkMuted)}
        ${renderSemanticRail(mossLight, rightCodeX, 700, lightMuted)}

        <rect x="${frameX}" y="840" width="${splitBottomX - frameX}" height="42" fill="${darkStatus}" />
        <polygon points="${splitBottomX},840 ${WIDTH - frameX},840 ${WIDTH - frameX},882 ${splitBottomX},882" fill="${lightStatus}" />
        <text x="42" y="853" fill="${darkStatusFg}" font-size="12" font-family="${BRAND_SYSTEM.typography.ui}" font-weight="800" dominant-baseline="text-before-edge">main  ✓  TypeScript</text>
        <text x="1548" y="853" text-anchor="end" fill="${lightStatusFg}" font-size="12" font-family="${BRAND_SYSTEM.typography.ui}" font-weight="800" dominant-baseline="text-before-edge">Dark + Light · paired roles</text>
      </g>
      <path d="M ${splitTopX} ${frameY} L ${splitBottomX} ${HEIGHT - frameY}" fill="none" stroke="${seam}" stroke-width="2" opacity="0.52" />
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
  const renderPreviewLines = (theme, x, y) => previewLines.map((segments, index) =>
    renderCodeLine({ theme, segments, x, y: y + index * 48, fontSize: 23 })
  ).join("");
  const darkFg = requiredThemeColor(mossDark, "editor.foreground");
  const lightFg = requiredThemeColor(mossLight, "editor.foreground");
  const lightBg = requiredThemeColor(mossLight, "editor.background");
  const railRoles = ["keyword", "function", "type", "string", "property", "operator"];
  const controlX = 52;
  const controlY = 154;
  const controlWidth = 316;
  const outputX = 404;
  const outputY = 154;
  const outputWidth = 1144;
  const paneGap = 14;
  const paneWidth = (outputWidth - paneGap) / 2;
  const paneHeight = 594;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
      <rect width="${WIDTH}" height="${HEIGHT}" fill="${mixHex(bg, "#000000", 0.08)}" />
      <rect x="18" y="18" width="1564" height="864" rx="16" fill="${panel}" stroke="${border}" stroke-width="1.2" />
      <rect x="18" y="18" width="1564" height="58" rx="16" fill="${chrome}" />
      <rect x="18" y="60" width="1564" height="16" fill="${chrome}" />
      <circle cx="42" cy="47" r="5" fill="${roleColor(darkTheme, "keyword")}" />
      <circle cx="60" cy="47" r="5" fill="${roleColor(darkTheme, "string")}" />
      <circle cx="78" cy="47" r="5" fill="${seed}" />
      <text x="106" y="36" fill="${fg}" font-size="14" font-family="${BRAND_SYSTEM.typography.ui}" font-weight="800" letter-spacing="0.13em" dominant-baseline="text-before-edge">HEARTHCODE THEME FORGE</text>
      <text x="1548" y="36" text-anchor="end" fill="${muted}" font-size="12" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.12em" dominant-baseline="text-before-edge">LIVE · THEME-SCOPED · REVERSIBLE</text>

      <text x="${controlX}" y="94" fill="${fg}" font-size="44" font-family="${BRAND_SYSTEM.typography.displayCondensed}" font-weight="900" letter-spacing="0.015em" dominant-baseline="text-before-edge">YOUR COLOR. SAME SAFEGUARDS.</text>
      <text x="1548" y="110" text-anchor="end" fill="${muted}" font-size="14" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.12em" dominant-baseline="text-before-edge">${escapeXml(forgeSteps[2].toUpperCase())} · BOTH MODES REBUILD TOGETHER</text>

      <rect x="${controlX}" y="${controlY}" width="${controlWidth}" height="${paneHeight}" rx="10" fill="${mixHex(panel, fg, 0.025)}" stroke="${border}" />
      <text x="${controlX + 24}" y="${controlY + 26}" fill="${button}" font-size="12" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.15em" dominant-baseline="text-before-edge">1 · ${escapeXml(forgeSteps[0].toUpperCase())}</text>
      <rect x="${controlX + 24}" y="${controlY + 62}" width="126" height="54" rx="6" fill="${withAlpha(button, 0.12)}" stroke="${button}" />
      <circle cx="${controlX + 46}" cy="${controlY + 89}" r="7" fill="${button}" />
      <text x="${controlX + 64}" y="${controlY + 76}" fill="${fg}" font-size="17" font-family="${BRAND_SYSTEM.typography.ui}" font-weight="800" dominant-baseline="text-before-edge">Moss</text>
      <rect x="${controlX + 162}" y="${controlY + 62}" width="126" height="54" rx="6" fill="${withAlpha(emberAccent, 0.06)}" stroke="${withAlpha(emberAccent, 0.62)}" />
      <circle cx="${controlX + 184}" cy="${controlY + 89}" r="7" fill="none" stroke="${emberAccent}" stroke-width="2" />
      <text x="${controlX + 202}" y="${controlY + 76}" fill="${fg}" font-size="17" font-family="${BRAND_SYSTEM.typography.ui}" font-weight="800" dominant-baseline="text-before-edge">Ember</text>

      <text x="${controlX + 24}" y="${controlY + 150}" fill="${button}" font-size="12" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.15em" dominant-baseline="text-before-edge">2 · ${escapeXml(forgeSteps[1].toUpperCase())}</text>
      <rect x="${controlX + 24}" y="${controlY + 186}" width="60" height="52" rx="6" fill="${inputBg}" stroke="${border}" />
      <rect x="${controlX + 34}" y="${controlY + 196}" width="40" height="32" rx="4" fill="${seed}" />
      <rect x="${controlX + 96}" y="${controlY + 186}" width="192" height="52" rx="6" fill="${inputBg}" stroke="${border}" />
      <text x="${controlX + 118}" y="${controlY + 202}" fill="${fg}" font-size="16" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" dominant-baseline="text-before-edge">${seed}</text>
      <text x="${controlX + 24}" y="${controlY + 254}" fill="${muted}" font-size="12" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="700" letter-spacing="0.08em" dominant-baseline="text-before-edge">MOSS FUNCTION TOKEN · SOURCE TRUE</text>

      <text x="${controlX + 24}" y="${controlY + 314}" fill="${button}" font-size="12" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.15em" dominant-baseline="text-before-edge">4–5 · APPLY / RESTORE</text>
      <rect x="${controlX + 24}" y="${controlY + 350}" width="126" height="48" rx="6" fill="${button}" />
      <text x="${controlX + 87}" y="${controlY + 365}" text-anchor="middle" fill="${buttonFg}" font-size="14" font-family="${BRAND_SYSTEM.typography.ui}" font-weight="800" dominant-baseline="text-before-edge">${escapeXml(forgeSteps[3])}</text>
      <rect x="${controlX + 162}" y="${controlY + 350}" width="126" height="48" rx="6" fill="transparent" stroke="${border}" />
      <text x="${controlX + 225}" y="${controlY + 365}" text-anchor="middle" fill="${fg}" font-size="13" font-family="${BRAND_SYSTEM.typography.ui}" font-weight="800" dominant-baseline="text-before-edge">Restore</text>
      <line x1="${controlX + 24}" y1="${controlY + 438}" x2="${controlX + controlWidth - 24}" y2="${controlY + 438}" stroke="${withAlpha(fg, 0.18)}" />
      <text x="${controlX + 24}" y="${controlY + 466}" fill="${fg}" font-size="16" font-family="${BRAND_SYSTEM.typography.ui}" font-weight="800" dominant-baseline="text-before-edge">One reversible change</text>
      <text x="${controlX + 24}" y="${controlY + 500}" fill="${muted}" font-size="13" font-family="${BRAND_SYSTEM.typography.ui}" dominant-baseline="text-before-edge">Applies to this direction’s</text>
      <text x="${controlX + 24}" y="${controlY + 524}" fill="${muted}" font-size="13" font-family="${BRAND_SYSTEM.typography.ui}" dominant-baseline="text-before-edge">Dark and Light. Restore removes</text>
      <text x="${controlX + 24}" y="${controlY + 548}" fill="${muted}" font-size="13" font-family="${BRAND_SYSTEM.typography.ui}" dominant-baseline="text-before-edge">exactly what Forge wrote.</text>

      <path d="M ${controlX + controlWidth + 8} ${controlY + 292} L ${outputX - 12} ${controlY + 292}" stroke="${seed}" stroke-width="3" />
      <path d="M ${outputX - 20} ${controlY + 284} L ${outputX - 12} ${controlY + 292} L ${outputX - 20} ${controlY + 300}" fill="none" stroke="${seed}" stroke-width="3" />

      <rect x="${outputX}" y="${outputY}" width="${paneWidth}" height="${paneHeight}" rx="10" fill="${bg}" stroke="${border}" />
      <rect x="${outputX + paneWidth + paneGap}" y="${outputY}" width="${paneWidth}" height="${paneHeight}" rx="10" fill="${lightBg}" stroke="${border}" />
      <rect x="${outputX}" y="${outputY}" width="${paneWidth}" height="58" rx="10" fill="${themeColor(darkTheme, "editorGroupHeader.tabsBackground", chrome)}" />
      <rect x="${outputX}" y="${outputY + 42}" width="${paneWidth}" height="16" fill="${themeColor(darkTheme, "editorGroupHeader.tabsBackground", chrome)}" />
      <rect x="${outputX + paneWidth + paneGap}" y="${outputY}" width="${paneWidth}" height="58" rx="10" fill="${themeColor(lightTheme, "editorGroupHeader.tabsBackground", "#d4d1c4")}" />
      <rect x="${outputX + paneWidth + paneGap}" y="${outputY + 42}" width="${paneWidth}" height="16" fill="${themeColor(lightTheme, "editorGroupHeader.tabsBackground", "#d4d1c4")}" />
      <text x="${outputX + 28}" y="${outputY + 21}" fill="${darkFg}" font-size="13" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.13em" dominant-baseline="text-before-edge">MOSS DARK · FORGED</text>
      <text x="${outputX + paneWidth + paneGap + 28}" y="${outputY + 21}" fill="${lightFg}" font-size="13" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.13em" dominant-baseline="text-before-edge">MOSS LIGHT · FORGED</text>
      ${renderPreviewLines(darkTheme, outputX + 34, outputY + 112)}
      ${renderPreviewLines(lightTheme, outputX + paneWidth + paneGap + 34, outputY + 112)}
      ${railRoles.map((role, index) => `<rect x="${outputX + 34 + index * 84}" y="${outputY + 416}" width="68" height="11" fill="${requiredRoleColor(mossDark, role)}" />`).join("")}
      ${railRoles.map((role, index) => `<rect x="${outputX + paneWidth + paneGap + 34 + index * 84}" y="${outputY + 416}" width="68" height="11" fill="${requiredRoleColor(mossLight, role)}" />`).join("")}
      <text x="${outputX + 34}" y="${outputY + 460}" fill="${mixHex(darkFg, bg, 0.46)}" font-size="12" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.1em" dominant-baseline="text-before-edge">ROLE ORDER PRESERVED</text>
      <text x="${outputX + paneWidth + paneGap + 34}" y="${outputY + 460}" fill="${mixHex(lightFg, lightBg, 0.46)}" font-size="12" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.1em" dominant-baseline="text-before-edge">SAME READING RHYTHM</text>
      <rect x="${outputX}" y="${outputY + paneHeight - 58}" width="${paneWidth}" height="58" fill="${themeColor(darkTheme, "statusBar.background", button)}" />
      <rect x="${outputX + paneWidth + paneGap}" y="${outputY + paneHeight - 58}" width="${paneWidth}" height="58" fill="${themeColor(lightTheme, "statusBar.background", button)}" />
      <text x="${outputX + 28}" y="${outputY + paneHeight - 39}" fill="${themeColor(darkTheme, "statusBar.foreground", buttonFg)}" font-size="13" font-family="${BRAND_SYSTEM.typography.ui}" font-weight="800" dominant-baseline="text-before-edge">Moss · Dark · verified</text>
      <text x="${outputX + paneWidth + paneGap + 28}" y="${outputY + paneHeight - 39}" fill="${themeColor(lightTheme, "statusBar.foreground", buttonFg)}" font-size="13" font-family="${BRAND_SYSTEM.typography.ui}" font-weight="800" dominant-baseline="text-before-edge">Moss · Light · verified</text>

      <rect x="${outputX}" y="782" width="232" height="46" rx="5" fill="${withAlpha(seed, 0.08)}" stroke="${withAlpha(seed, 0.35)}" />
      <text x="${outputX + 116}" y="797" text-anchor="middle" fill="${fg}" font-size="12" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.1em" dominant-baseline="text-before-edge">ROLE SEPARATION</text>
      <rect x="${outputX + 246}" y="782" width="232" height="46" rx="5" fill="${withAlpha(seed, 0.08)}" stroke="${withAlpha(seed, 0.35)}" />
      <text x="${outputX + 362}" y="797" text-anchor="middle" fill="${fg}" font-size="12" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.1em" dominant-baseline="text-before-edge">AA-CHECKED CHROME</text>
      <rect x="${outputX + 492}" y="782" width="232" height="46" rx="5" fill="${withAlpha(seed, 0.08)}" stroke="${withAlpha(seed, 0.35)}" />
      <text x="${outputX + 608}" y="797" text-anchor="middle" fill="${fg}" font-size="12" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.1em" dominant-baseline="text-before-edge">FUNCTIONAL COLORS</text>
      <rect x="${outputX + 738}" y="782" width="232" height="46" rx="5" fill="${withAlpha(seed, 0.08)}" stroke="${withAlpha(seed, 0.35)}" />
      <text x="${outputX + 854}" y="797" text-anchor="middle" fill="${fg}" font-size="12" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.1em" dominant-baseline="text-before-edge">RESTORABLE</text>
    </svg>
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
      ${renderMaterialTexture({ id: `atlas-${darkMeta.schemeId}-dark`, ink: darkFg, x, y, width, height: dividerY - y, seed: 109 + index, intensity: BRAND_SYSTEM.material.proofTexture })}
      ${renderMaterialTexture({ id: `atlas-${darkMeta.schemeId}-light`, ink: lightFg, x, y: dividerY, width, height: y + height - dividerY, seed: 113 + index, intensity: BRAND_SYSTEM.material.proofTexture })}
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
      ${renderMaterialTexture({ id: "atlas-field", ink: fg, width: WIDTH, height: HEIGHT, seed: 127, intensity: BRAND_SYSTEM.material.posterTexture })}
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

function renderDirectionCardSvg({ themes, schemeId, width, height }) {
  const darkMeta = getPreviewTheme(themes, schemeId, "dark");
  const lightMeta = getPreviewTheme(themes, schemeId, "light");
  const darkTheme = darkMeta.theme;
  const lightTheme = lightMeta.theme;
  const darkBg = themeColor(darkTheme, "editor.background", "#191a17");
  const darkFg = themeColor(darkTheme, "editor.foreground", "#d3c9b8");
  const lightBg = themeColor(lightTheme, "editor.background", "#e7e5d8");
  const lightFg = themeColor(lightTheme, "editor.foreground", "#342d28");
  const accent = roleColor(darkTheme, schemeId === "moss" ? "function" : "keyword");
  const muted = mixHex(darkFg, darkBg, 0.5);
  const inset = 64;
  const splitLeftY = Math.round(height * 0.66);
  const splitRightY = Math.round(height * 0.56);
  const lightMask = `0,${splitLeftY} ${width},${splitRightY} ${width},${height} 0,${height}`;
  const codeLines = buildFamilySampleLines(darkMeta);
  const lightLines = buildFamilySampleLines(lightMeta);
  const promise = schemeId === "ember" ? "WARMTH WITHOUT MUD." : "STRUCTURE WITHOUT NOISE.";
  const descriptor = schemeId === "ember" ? "WARM PAPER · COOL CALLABLE ANCHORS" : "DRY PAPER · CLEAR SEMANTIC LANES";
  const titleSize = schemeId === "ember" ? 190 : 218;
  const swatches = ["keyword", "function", "type", "string", "property", "operator"].map((role) => roleColor(darkTheme, role));

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="${darkBg}" />
      <polygon points="${lightMask}" fill="${lightBg}" />
      ${renderMaterialTexture({ id: `direction-${schemeId}-dark`, ink: darkFg, width, height: splitLeftY, seed: 101, intensity: 0.5 })}
      ${renderMaterialTexture({ id: `direction-${schemeId}-light`, ink: lightFg, width, height, points: lightMask, seed: 103, intensity: 0.44 })}
      <rect x="0" y="0" width="18" height="${height}" fill="${accent}" />

      <text x="${inset}" y="46" fill="${muted}" font-size="14" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.2em" dominant-baseline="text-before-edge">HEARTHCODE · ${schemeId.toUpperCase()} · DARK + LIGHT</text>
      ${renderDistressedText({ id: `direction-title-${schemeId}`, text: darkMeta.flavor.name.toUpperCase(), x: inset, y: 92, fill: accent, wear: darkBg, fontSize: titleSize, fontFamily: BRAND_SYSTEM.typography.displayCondensed, letterSpacing: "-0.035em", seed: 107, intensity: 0.42 })}
      <text x="${inset}" y="310" fill="${darkFg}" font-size="58" font-family="${BRAND_SYSTEM.typography.displayCondensed}" font-weight="900" letter-spacing="0.012em" dominant-baseline="text-before-edge">${promise}</text>
      <text x="${inset}" y="382" fill="${muted}" font-size="14" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.14em" dominant-baseline="text-before-edge">${descriptor}</text>
      ${swatches.map((color, index) => `<rect x="${inset + index * 112}" y="424" width="88" height="13" fill="${color}" />`).join("")}

      <text x="${inset}" y="478" fill="${accent}" font-size="13" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.16em" dominant-baseline="text-before-edge">DARK / SHIPPED SYNTAX</text>
      ${codeLines.map((segments, index) => renderCodeLine({ theme: darkTheme, segments, x: inset, y: 526 + index * 50, fontSize: 27 })).join("")}

      <text x="${inset}" y="${Math.max(splitLeftY, splitRightY) + 52}" fill="${mixHex(lightFg, lightBg, 0.4)}" font-size="13" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.16em" dominant-baseline="text-before-edge">LIGHT / SAME ROLE ORDER</text>
      ${lightLines.map((segments, index) => renderCodeLine({ theme: lightTheme, segments, x: inset, y: Math.max(splitLeftY, splitRightY) + 104 + index * 50, fontSize: 27 })).join("")}
      <text x="${inset}" y="${height - 48}" fill="${lightFg}" font-size="13" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.12em">DIFFERENT SURFACE · SAME MEANING</text>
      <text x="${width - inset}" y="${height - 48}" text-anchor="end" fill="${mixHex(lightFg, lightBg, 0.4)}" font-size="13" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.12em">${escapeXml(BRAND_SYSTEM.copy.site)}</text>
    </svg>
  `;
}

function renderZedUnifiedProof({ themes, x, y, width, height }) {
  const emberDark = getPreviewTheme(themes, "ember", "dark");
  const mossDark = getPreviewTheme(themes, "moss", "dark");
  const emberLight = getPreviewTheme(themes, "ember", "light");
  const mossLight = getPreviewTheme(themes, "moss", "light");
  const emberDarkBg = requiredThemeColor(emberDark, "editor.background");
  const mossDarkBg = requiredThemeColor(mossDark, "editor.background");
  const emberDarkFg = requiredThemeColor(emberDark, "editor.foreground");
  const mossDarkFg = requiredThemeColor(mossDark, "editor.foreground");
  const emberLightBg = requiredThemeColor(emberLight, "editor.background");
  const mossLightBg = requiredThemeColor(mossLight, "editor.background");
  const emberLightFg = requiredThemeColor(emberLight, "editor.foreground");
  const mossLightFg = requiredThemeColor(mossLight, "editor.foreground");
  const emberAccent = requiredRoleColor(emberDark, "keyword");
  const mossAccent = requiredRoleColor(mossDark, "function");
  const half = width / 2;
  const chromeHeight = 58;
  const lightStripHeight = 188;
  const contentY = y + chromeHeight;
  const contentHeight = height - chromeHeight - lightStripHeight;
  const buildZedSampleLines = (meta) => [
    [{ role: "keyword", text: "type " }, { role: "type", text: "ThemePreview" }, { role: "operator", text: " = " }, { role: "punctuation", text: "{" }],
    [{ role: "plain", text: "  " }, { role: "property", text: "direction" }, { role: "operator", text: ": " }, { role: "string", text: '"ember"' }, { role: "operator", text: " | " }, { role: "string", text: '"moss"' }, { role: "punctuation", text: ";" }],
    [{ role: "plain", text: "  " }, { role: "property", text: "mode" }, { role: "operator", text: ": " }, { role: "string", text: '"dark"' }, { role: "operator", text: " | " }, { role: "string", text: '"light"' }, { role: "punctuation", text: ";" }],
    [{ role: "punctuation", text: "};" }],
    [{ role: "keyword", text: "const " }, { role: "variable.readonly", text: "theme" }, { role: "operator", text: ": " }, { role: "type", text: "ThemePreview" }, { role: "operator", text: " = " }, { role: "punctuation", text: "{" }],
    [{ role: "plain", text: "  " }, { role: "property", text: "direction" }, { role: "operator", text: ": " }, { role: "string", text: `"${meta.schemeId}"` }, { role: "punctuation", text: "," }],
    [{ role: "plain", text: "  " }, { role: "property", text: "mode" }, { role: "operator", text: ": " }, { role: "string", text: `"${meta.variantId}"` }, { role: "punctuation", text: "," }],
  ];
  const emberLines = buildZedSampleLines(emberDark);
  const mossLines = buildZedSampleLines(mossDark);
  const emberLightLines = buildFamilySampleLines(emberLight).slice(0, 3);
  const mossLightLines = buildFamilySampleLines(mossLight).slice(0, 3);
  const railRoles = ["keyword", "function", "type", "string", "property", "operator"];

  return `
    <g>
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="16" fill="${mixHex(emberDarkBg, mossDarkBg, 0.5)}" stroke="${withAlpha(mossDarkFg, 0.3)}" />
      <rect x="${x}" y="${y}" width="${width}" height="${chromeHeight}" rx="16" fill="${mixHex(emberDarkBg, mossDarkBg, 0.42)}" />
      <rect x="${x}" y="${y + chromeHeight - 16}" width="${width}" height="16" fill="${mixHex(emberDarkBg, mossDarkBg, 0.42)}" />
      <rect x="${x}" y="${y}" width="${half}" height="8" fill="${emberAccent}" />
      <rect x="${x + half}" y="${y}" width="${half}" height="8" fill="${mossAccent}" />
      <circle cx="${x + 24}" cy="${y + 31}" r="5" fill="${requiredRoleColor(emberDark, "string")}" />
      <circle cx="${x + 42}" cy="${y + 31}" r="5" fill="${requiredRoleColor(mossDark, "type")}" />
      <text x="${x + 64}" y="${y + 20}" fill="${emberDarkFg}" font-size="14" font-family="${BRAND_SYSTEM.typography.ui}" font-weight="750" dominant-baseline="text-before-edge">hearthcode.ts — Zed</text>
      <text x="${x + width - 24}" y="${y + 20}" text-anchor="end" fill="${mossDarkFg}" font-size="12" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.12em" dominant-baseline="text-before-edge">GENERATED ZED SPECIMEN · 4 THEMES</text>

      <rect x="${x}" y="${contentY}" width="${half}" height="${contentHeight}" fill="${emberDarkBg}" />
      <rect x="${x + half}" y="${contentY}" width="${half}" height="${contentHeight}" fill="${mossDarkBg}" />
      <rect x="${x}" y="${contentY}" width="8" height="${contentHeight}" fill="${emberAccent}" />
      <rect x="${x + half}" y="${contentY}" width="8" height="${contentHeight}" fill="${mossAccent}" />
      <text x="${x + 34}" y="${contentY + 24}" fill="${emberAccent}" font-size="13" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.16em" dominant-baseline="text-before-edge">EMBER DARK · WARMTH WITHOUT MUD</text>
      <text x="${x + half + 34}" y="${contentY + 24}" fill="${mossAccent}" font-size="13" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.16em" dominant-baseline="text-before-edge">MOSS DARK · STRUCTURE WITHOUT NOISE</text>
      ${renderNumberedCodeBlock({ theme: emberDark.theme, lines: emberLines, x: x + 34, y: contentY + 72, fontSize: 25, lineHeight: 49 })}
      ${renderNumberedCodeBlock({ theme: mossDark.theme, lines: mossLines, x: x + half + 34, y: contentY + 72, fontSize: 25, lineHeight: 49 })}
      ${railRoles.map((role, index) => `<rect x="${x + 34 + index * 108}" y="${contentY + contentHeight - 32}" width="88" height="10" fill="${requiredRoleColor(emberDark, role)}" />`).join("")}
      ${railRoles.map((role, index) => `<rect x="${x + half + 34 + index * 108}" y="${contentY + contentHeight - 32}" width="88" height="10" fill="${requiredRoleColor(mossDark, role)}" />`).join("")}

      <rect x="${x}" y="${y + height - lightStripHeight}" width="${half}" height="${lightStripHeight}" fill="${emberLightBg}" />
      <rect x="${x + half}" y="${y + height - lightStripHeight}" width="${half}" height="${lightStripHeight}" fill="${mossLightBg}" />
      <text x="${x + 34}" y="${y + height - lightStripHeight + 22}" fill="${mixHex(emberLightFg, emberLightBg, 0.38)}" font-size="12" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.15em" dominant-baseline="text-before-edge">EMBER LIGHT · PAIRED ROLES</text>
      <text x="${x + half + 34}" y="${y + height - lightStripHeight + 22}" fill="${mixHex(mossLightFg, mossLightBg, 0.38)}" font-size="12" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.15em" dominant-baseline="text-before-edge">MOSS LIGHT · PAIRED ROLES</text>
      ${emberLightLines.map((segments, index) => renderCodeLine({ theme: emberLight.theme, segments, x: x + 34, y: y + height - lightStripHeight + 60 + index * 39, fontSize: 22 })).join("")}
      ${mossLightLines.map((segments, index) => renderCodeLine({ theme: mossLight.theme, segments, x: x + half + 34, y: y + height - lightStripHeight + 60 + index * 39, fontSize: 22 })).join("")}
      <line x1="${x + half}" y1="${y}" x2="${x + half}" y2="${y + height}" stroke="${withAlpha(mossDarkFg, 0.28)}" />
    </g>
  `;
}

function renderTerminalLane({ meta, x, y, width, height, terminalLines }) {
  const theme = meta.theme;
  const bg = requiredThemeColor(meta, "editor.background");
  const fg = requiredThemeColor(meta, "editor.foreground");
  const accent = requiredRoleColor(meta, meta.schemeId === "moss" ? "function" : "keyword");
  const green = themeColor(theme, "terminal.ansiGreen", requiredRoleColor(meta, "function"));
  const blue = themeColor(theme, "terminal.ansiBlue", requiredRoleColor(meta, "type"));
  const yellow = themeColor(theme, "terminal.ansiYellow", requiredRoleColor(meta, "keyword"));
  const red = themeColor(theme, "terminal.ansiRed", requiredRoleColor(meta, "string"));
  const ansi = [red, yellow, green, blue, themeColor(theme, "terminal.ansiMagenta", requiredRoleColor(meta, "property")), themeColor(theme, "terminal.ansiCyan", requiredRoleColor(meta, "type"))];
  return `
    <g>
      <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${bg}" stroke="${withAlpha(fg, 0.18)}" />
      <rect x="${x}" y="${y}" width="8" height="${height}" fill="${accent}" />
      <text x="${x + 32}" y="${y + 26}" fill="${accent}" font-size="13" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.16em" dominant-baseline="text-before-edge">${escapeXml(meta.flavor.name.toUpperCase())} / DARK</text>
      <text x="${x + 32}" y="${y + 70}" fill="${fg}" font-size="28" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" dominant-baseline="text-before-edge">${escapeXml(terminalLines[0] || "$ pnpm run verify")}</text>
      ${(terminalLines.slice(1).map((line, index) => `<text x="${x + 32}" y="${y + 138 + index * 62}" fill="${index === 1 ? blue : green}" font-size="18" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="750" dominant-baseline="text-before-edge">${escapeXml(line)}</text>`).join(""))}
      ${ansi.map((color, index) => `<rect x="${x + 32 + index * 102}" y="${y + height - 36}" width="82" height="10" fill="${color}" />`).join("")}
    </g>
  `;
}

function renderTerminalUnifiedProof({ themes, x, y, width, height }) {
  const emberDark = getPreviewTheme(themes, "ember", "dark");
  const mossDark = getPreviewTheme(themes, "moss", "dark");
  const emberLight = getPreviewTheme(themes, "ember", "light");
  const mossLight = getPreviewTheme(themes, "moss", "light");
  const emberDarkBg = requiredThemeColor(emberDark, "editor.background");
  const mossDarkBg = requiredThemeColor(mossDark, "editor.background");
  const emberDarkFg = requiredThemeColor(emberDark, "editor.foreground");
  const mossDarkFg = requiredThemeColor(mossDark, "editor.foreground");
  const emberAccent = requiredRoleColor(emberDark, "keyword");
  const mossAccent = requiredRoleColor(mossDark, "function");
  const terminalLines = PREVIEW.samples?.terminal?.lines || [];
  const laneGap = 18;
  const laneWidth = (width - 52 - laneGap) / 2;
  const laneY = y + 76;
  const laneHeight = 500;
  const lightY = laneY + laneHeight + 18;
  const lightHeight = 126;
  const formats = ["WARP", "WINDOWS TERMINAL", "KITTY", "ALACRITTY", "ITERM2"];
  const emberLightLines = buildFamilySampleLines(emberLight).slice(0, 2);
  const mossLightLines = buildFamilySampleLines(mossLight).slice(0, 2);

  return `
    <g>
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="16" fill="${mixHex(emberDarkBg, mossDarkBg, 0.5)}" stroke="${withAlpha(mossDarkFg, 0.3)}" />
      <rect x="${x}" y="${y}" width="${width}" height="58" rx="16" fill="${mixHex(emberDarkBg, mossDarkBg, 0.42)}" />
      <rect x="${x}" y="${y + 42}" width="${width}" height="16" fill="${mixHex(emberDarkBg, mossDarkBg, 0.42)}" />
      <rect x="${x}" y="${y}" width="${width / 2}" height="8" fill="${emberAccent}" />
      <rect x="${x + width / 2}" y="${y}" width="${width / 2}" height="8" fill="${mossAccent}" />
      <circle cx="${x + 24}" cy="${y + 31}" r="5" fill="${requiredRoleColor(emberDark, "string")}" />
      <circle cx="${x + 42}" cy="${y + 31}" r="5" fill="${requiredRoleColor(mossDark, "type")}" />
      <text x="${x + 64}" y="${y + 20}" fill="${emberDarkFg}" font-size="14" font-family="${BRAND_SYSTEM.typography.ui}" font-weight="800" letter-spacing="0.1em" dominant-baseline="text-before-edge">HEARTHCODE TERMINAL</text>
      <text x="${x + width - 24}" y="${y + 20}" text-anchor="end" fill="${mossDarkFg}" font-size="12" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.12em" dominant-baseline="text-before-edge">5 FORMATS · 4 THEMES</text>

      ${renderTerminalLane({ meta: emberDark, x: x + 26, y: laneY, width: laneWidth, height: laneHeight, terminalLines })}
      ${renderTerminalLane({ meta: mossDark, x: x + 26 + laneWidth + laneGap, y: laneY, width: laneWidth, height: laneHeight, terminalLines })}

      <rect x="${x + 26}" y="${lightY}" width="${laneWidth}" height="${lightHeight}" fill="${requiredThemeColor(emberLight, "editor.background")}" />
      <rect x="${x + 26 + laneWidth + laneGap}" y="${lightY}" width="${laneWidth}" height="${lightHeight}" fill="${requiredThemeColor(mossLight, "editor.background")}" />
      <text x="${x + 46}" y="${lightY + 18}" fill="${mixHex(requiredThemeColor(emberLight, "editor.foreground"), requiredThemeColor(emberLight, "editor.background"), 0.38)}" font-size="12" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.12em" dominant-baseline="text-before-edge">EMBER LIGHT · PAIRED ANSI</text>
      <text x="${x + 46 + laneWidth + laneGap}" y="${lightY + 18}" fill="${mixHex(requiredThemeColor(mossLight, "editor.foreground"), requiredThemeColor(mossLight, "editor.background"), 0.38)}" font-size="12" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.12em" dominant-baseline="text-before-edge">MOSS LIGHT · PAIRED ANSI</text>
      ${emberLightLines.map((segments, index) => renderCodeLine({ theme: emberLight.theme, segments, x: x + 46, y: lightY + 52 + index * 34, fontSize: 18 })).join("")}
      ${mossLightLines.map((segments, index) => renderCodeLine({ theme: mossLight.theme, segments, x: x + 46 + laneWidth + laneGap, y: lightY + 52 + index * 34, fontSize: 18 })).join("")}
      ${formats.map((format, index) => {
        const chipWidth = index === 1 ? 156 : index === 3 ? 112 : 82;
        const precedingWidth = formats.slice(0, index).reduce((sum, item, itemIndex) => sum + (itemIndex === 1 ? 156 : itemIndex === 3 ? 112 : 82) + 12, 0);
        return `
          <rect x="${x + width - 26 - 562 + precedingWidth}" y="${y + height - 54}" width="${chipWidth}" height="34" fill="${withAlpha(mossAccent, 0.08)}" stroke="${withAlpha(mossAccent, 0.28)}" />
          <text x="${x + width - 26 - 562 + precedingWidth + chipWidth / 2}" y="${y + height - 45}" text-anchor="middle" fill="${mossDarkFg}" font-size="10" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.08em" dominant-baseline="text-before-edge">${format}</text>
        `;
      }).join("")}
      <text x="${x + 26}" y="${y + height - 44}" fill="${emberDarkFg}" font-size="12" font-family="${BRAND_SYSTEM.typography.mono}" font-weight="800" letter-spacing="0.12em" dominant-baseline="text-before-edge">ONE ANSI LANGUAGE · FIVE OUTPUTS</text>
    </g>
  `;
}

function renderChannelProofSvg({ themes, channelId, width = WIDTH, height = HEIGHT }) {
  const mossDark = getPreviewTheme(themes, "moss", "dark");
  const bg = mixHex(themeColor(mossDark.theme, "editor.background", "#191a17"), "#000000", 0.06);
  const panelX = 18;
  const panelY = 18;
  const panelWidth = width - panelX * 2;
  const panelHeight = height - panelY * 2;
  const proof = channelId === "terminal"
    ? renderTerminalUnifiedProof({ themes, x: panelX, y: panelY, width: panelWidth, height: panelHeight })
    : renderZedUnifiedProof({ themes, x: panelX, y: panelY, width: panelWidth, height: panelHeight });

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="${bg}" />
      <rect x="26" y="30" width="${panelWidth}" height="${panelHeight}" rx="16" fill="${withAlpha("#000000", 0.24)}" />
      ${proof}
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
      ${renderMaterialTexture({ id: "coverage-field", ink: fg, width: WIDTH, height: HEIGHT, seed: 173, intensity: BRAND_SYSTEM.material.posterTexture })}
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
      ${renderMaterialTexture({ id: "moss-surfaces-field", ink: fg, width: WIDTH, height: HEIGHT, seed: 179, intensity: BRAND_SYSTEM.material.posterTexture })}
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
  const asset = MARKETING_ASSETS["site-og"];
  return renderFamilyAssetSvg({ themes, composition: asset.composition, ...asset.canvas });
}

function removeFileIfExists(path) {
  if (!existsSync(path)) return false;
  rmSync(path);
  return true;
}

async function writePng(svg, outputPath) {
  mkdirSync(dirname(outputPath), { recursive: true });
  await sharp(Buffer.from(svg))
    // Material texture introduces many nearby tones. Keep true-color PNGs so
    // adaptive palette quantization cannot replace rare source-token swatches.
    .png({ compressionLevel: 9, palette: false })
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
  const githubSocialSvg = renderFamilyAssetSvg({
    themes,
    composition: MARKETING_ASSETS["github-social"].composition,
    ...MARKETING_ASSETS["github-social"].canvas,
  });
  const ogSvg = renderOgSvg({ themes });
  const familySquareSvg = renderFamilyAssetSvg({
    themes,
    composition: MARKETING_ASSETS["family-square"].composition,
    ...MARKETING_ASSETS["family-square"].canvas,
  });
  const familyPortraitSvg = renderFamilyAssetSvg({
    themes,
    composition: MARKETING_ASSETS["family-portrait"].composition,
    ...MARKETING_ASSETS["family-portrait"].canvas,
  });
  const familyStorySvg = renderFamilyAssetSvg({
    themes,
    composition: MARKETING_ASSETS["family-story"].composition,
    ...MARKETING_ASSETS["family-story"].canvas,
  });
  const emberSquareSvg = renderDirectionCardSvg({ themes, schemeId: "ember", ...MARKETING_ASSETS["ember-square"].canvas });
  const mossSquareSvg = renderDirectionCardSvg({ themes, schemeId: "moss", ...MARKETING_ASSETS["moss-square"].canvas });
  const zedPlatformSvg = renderChannelProofSvg({ themes, channelId: "zed", ...MARKETING_ASSETS["zed-platform"].canvas });
  const terminalPlatformSvg = renderChannelProofSvg({ themes, channelId: "terminal", ...MARKETING_ASSETS["terminal-platform"].canvas });
  const previewFlavorMeta = FLAVOR_IDS.map((schemeId) => ({
    id: schemeId,
    name: FLAVORS_BY_ID[schemeId].name,
    headline: FLAVORS_BY_ID[schemeId].headline,
    summary: FLAVORS_BY_ID[schemeId].summary,
  }));

  const promoSpecSha256 = sha256(JSON.stringify({
    renderer: PREVIEW_RENDERER,
    generatorSourceSha256: GENERATOR_SOURCE_SHA256,
    brandSystemSourceSha256: BRAND_SYSTEM_SOURCE_SHA256,
    templateComponentsSourceSha256: TEMPLATE_COMPONENTS_SOURCE_SHA256,
    assetSpecSourceSha256: ASSET_SPEC_SOURCE_SHA256,
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
    schemaVersion: 6,
    generator: "scripts/generate-preview-images.mjs",
    renderer: PREVIEW_RENDERER,
    generatorSourceSha256: GENERATOR_SOURCE_SHA256,
    brandSystem: {
      id: BRAND_SYSTEM.id,
      source: "scripts/marketing/brand-system.mjs",
      sourceSha256: BRAND_SYSTEM_SOURCE_SHA256,
      templateComponentsSource: "scripts/marketing/template-components.mjs",
      templateComponentsSourceSha256: TEMPLATE_COMPONENTS_SOURCE_SHA256,
    },
    assetSpec: {
      source: "products/hearthcode/marketing-assets.json",
      sourceSha256: ASSET_SPEC_SOURCE_SHA256,
    },
    promoSpecSha256,
    colorFidelity,
    canvas: { width: WIDTH, height: HEIGHT },
    formats: MARKETING_SPEC.formats,
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
      canvas: MARKETING_ASSETS["site-og"].canvas,
      outputs: OG_OUTPUTS.map(toPosixPath),
    },
    githubSocial: {
      inputSha256: sha256(JSON.stringify({ promoSpecSha256, asset: MARKETING_ASSETS["github-social"] })),
      canvas: MARKETING_ASSETS["github-social"].canvas,
      outputs: GITHUB_SOCIAL_OUTPUTS.map(toPosixPath),
    },
    familySquare: {
      inputSha256: sha256(JSON.stringify({ promoSpecSha256, asset: MARKETING_ASSETS["family-square"] })),
      canvas: MARKETING_ASSETS["family-square"].canvas,
      outputs: FAMILY_SQUARE_OUTPUTS.map(toPosixPath),
    },
    familyPortrait: {
      inputSha256: sha256(JSON.stringify({ promoSpecSha256, asset: MARKETING_ASSETS["family-portrait"] })),
      canvas: MARKETING_ASSETS["family-portrait"].canvas,
      outputs: FAMILY_PORTRAIT_OUTPUTS.map(toPosixPath),
    },
    familyStory: {
      inputSha256: sha256(JSON.stringify({ promoSpecSha256, asset: MARKETING_ASSETS["family-story"] })),
      canvas: MARKETING_ASSETS["family-story"].canvas,
      outputs: FAMILY_STORY_OUTPUTS.map(toPosixPath),
    },
    emberSquare: {
      inputSha256: sha256(JSON.stringify({ promoSpecSha256, asset: MARKETING_ASSETS["ember-square"] })),
      canvas: MARKETING_ASSETS["ember-square"].canvas,
      outputs: EMBER_SQUARE_OUTPUTS.map(toPosixPath),
    },
    mossSquare: {
      inputSha256: sha256(JSON.stringify({ promoSpecSha256, asset: MARKETING_ASSETS["moss-square"] })),
      canvas: MARKETING_ASSETS["moss-square"].canvas,
      outputs: MOSS_SQUARE_OUTPUTS.map(toPosixPath),
    },
    zedPlatform: {
      inputSha256: sha256(JSON.stringify({ promoSpecSha256, asset: MARKETING_ASSETS["zed-platform"], availability: PRODUCT.channelAvailability?.zed })),
      canvas: MARKETING_ASSETS["zed-platform"].canvas,
      outputs: ZED_PLATFORM_OUTPUTS.map(toPosixPath),
    },
    terminalPlatform: {
      inputSha256: sha256(JSON.stringify({ promoSpecSha256, asset: MARKETING_ASSETS["terminal-platform"], availability: PRODUCT.channelAvailability?.terminal })),
      canvas: MARKETING_ASSETS["terminal-platform"].canvas,
      outputs: TERMINAL_PLATFORM_OUTPUTS.map(toPosixPath),
    },
    managedAssets: MARKETING_SPEC.managedAssets.map((asset) => ({
      ...asset,
      canvas: asset.format ? MARKETING_SPEC.formats[asset.format] : undefined,
      outputs: asset.outputs.map(toPosixPath),
      outputSha256: Object.fromEntries(asset.outputs.map((output) => [
        toPosixPath(output),
        existsSync(output) ? sha256(readFileSync(output)) : null,
      ])),
    })),
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
    ...GITHUB_SOCIAL_OUTPUTS,
    ...OG_OUTPUTS,
    ...FAMILY_SQUARE_OUTPUTS,
    ...FAMILY_PORTRAIT_OUTPUTS,
    ...FAMILY_STORY_OUTPUTS,
    ...EMBER_SQUARE_OUTPUTS,
    ...MOSS_SQUARE_OUTPUTS,
    ...ZED_PLATFORM_OUTPUTS,
    ...TERMINAL_PLATFORM_OUTPUTS,
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
    [githubSocialSvg, GITHUB_SOCIAL_OUTPUTS],
    [ogSvg, OG_OUTPUTS],
    [familySquareSvg, FAMILY_SQUARE_OUTPUTS],
    [familyPortraitSvg, FAMILY_PORTRAIT_OUTPUTS],
    [familyStorySvg, FAMILY_STORY_OUTPUTS],
    [emberSquareSvg, EMBER_SQUARE_OUTPUTS],
    [mossSquareSvg, MOSS_SQUARE_OUTPUTS],
    [zedPlatformSvg, ZED_PLATFORM_OUTPUTS],
    [terminalPlatformSvg, TERMINAL_PLATFORM_OUTPUTS],
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
