import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";

const WIDTH = 1600;
const HEIGHT = 900;
const OUTPUT_DIR = join("extension", "images");
const WEBSITE_OUTPUT_DIR = join("public", "previews");
const MANIFEST_PATH = join("reports", "preview-manifest.json");
const PREVIEW_RENDERER = "promo-color-board-v4";

const THEME_META = [
  {
    id: "dark",
    name: "Hearth Dark",
    file: join("themes", "hearth-dark.json"),
  },
  {
    id: "darkSoft",
    name: "Hearth Dark Soft",
    file: join("themes", "hearth-dark-soft.json"),
  },
  {
    id: "light",
    name: "Hearth Light",
    file: join("themes", "hearth-light.json"),
  },
  {
    id: "lightSoft",
    name: "Hearth Light Soft",
    file: join("themes", "hearth-light-soft.json"),
  },
];
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
  for (const entry of theme.tokenColors || []) {
    const entryScopes = Array.isArray(entry.scope) ? entry.scope : [entry.scope];
    if (!entryScopes.some((scope) => expected.includes(scope))) continue;
    return normalizeStyleEntry(entry.settings, fallbackColor, fallbackFontStyle);
  }

  return {
    color: fallbackColor,
    fontStyle: fallbackFontStyle,
  };
}

function getSemanticStyle(theme, key, fallbackColor, fallbackFontStyle = "") {
  return normalizeStyleEntry(theme.semanticTokenColors?.[key], fallbackColor, fallbackFontStyle);
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
      const fallback = getTokenStyle(theme, ["entity.name.function", "support.function", "meta.function-call.generic"], editorStyle.color);
      return getSemanticStyle(theme, "function", fallback.color, fallback.fontStyle);
    }
    case "method": {
      const fallback = getTokenStyle(theme, [
        "meta.function-call entity.name.function",
        "meta.method-call entity.name.function",
        "meta.function-call.ts entity.name.function.ts",
        "meta.method-call.ts entity.name.function.ts",
      ], editorStyle.color);
      return getSemanticStyle(theme, "method", fallback.color, fallback.fontStyle);
    }
    case "function.defaultLibrary": {
      const fallback = resolvePreviewStyle(theme, "method");
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
      const fallback = getTokenStyle(theme, [
        "entity.name.function.member",
        "variable.other.property",
        "variable.other.member",
        "meta.property-name",
        "support.type.property-name",
      ], editorStyle.color);
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

function renderPromoHeroVariant({ theme, heading, variantId, x, y, width, height }) {
  const bg = themeColor(theme, "editor.background", "#211d1a");
  const fg = themeColor(theme, "editor.foreground", "#d3c9b8");
  const muted = themeColor(theme, "sideBarTitle.foreground", "#877a65");
  const border = themeColor(theme, "tab.border", "#373027");
  const accent = themeColor(theme, "tab.activeBorder", "#cf8740");
  const sidebar = themeColor(theme, "sideBar.background", bg);
  const panel = themeColor(theme, "panel.background", sidebar);
  const status = themeColor(theme, "statusBar.background", accent);
  const canvas = themeColor(theme, "editor.background", bg);
  const isLight = variantId.startsWith("light");
  const keyword = PROMO_ROLE_SWATCHES[0];
  const fn = PROMO_ROLE_SWATCHES[1];
  const string = PROMO_ROLE_SWATCHES[2];
  const cardBg = mixHex(bg, isLight ? "#ffffff" : "#000000", isLight ? 0.045 : 0.065);
  const cardBorder = mixHex(border, fg, isLight ? 0.18 : 0.1);
  const plateBg = mixHex(bg, isLight ? "#ffffff" : fg, isLight ? 0.11 : 0.055);
  const plateBorder = mixHex(border, fg, isLight ? 0.26 : 0.14);
  const surfaceText = isLight ? mixHex(bg, "#000000", 0.36) : mixHex(fg, "#ffffff", 0.2);

  const pad = 24;
  const contentY = y + 68;
  const contentH = height - 92;
  const stageX = x + pad;
  const stageY = contentY;
  const stageW = 232;
  const stageH = contentH;
  const gridX = stageX + stageW + 18;
  const gridY = contentY;
  const gridW = width - (gridX - x) - pad;
  const keywordH = 82;
  const lowerGap = 12;
  const lowerY = gridY + keywordH + lowerGap;
  const lowerH = contentH - keywordH - lowerGap;
  const lowerW = (gridW - 12) / 2;

  const renderRoleTile = ({ role, tileX, tileY, tileW, tileH, sample }) => {
    const swatchColor = roleColor(theme, role);
    const tileFill = mixHex(bg, swatchColor, isLight ? 0.14 : variantId.includes("Soft") ? 0.16 : 0.18);
    const tileBorder = mixHex(swatchColor, cardBg, isLight ? 0.4 : 0.3);
    return `
      <g>
        <rect x="${tileX}" y="${tileY}" width="${tileW}" height="${tileH}" rx="18" fill="${tileFill}" stroke="${tileBorder}" stroke-width="1.2" />
        <rect x="${tileX + 16}" y="${tileY + 14}" width="22" height="6" rx="3" fill="${swatchColor}" />
        <text x="${tileX + 16}" y="${tileY + tileH - 38}" fill="${swatchColor}" font-size="${tileW > 300 ? 18 : 16.5}" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" dominant-baseline="text-before-edge">${escapeXml(sample)}</text>
      </g>
    `;
  };

  return `
    <g>
      <rect x="${x + 8}" y="${y + 12}" width="${width}" height="${height}" rx="28" fill="${withAlpha("#000000", 0.14)}" />
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="26" fill="${cardBg}" stroke="${cardBorder}" stroke-width="1.2" />
      <text x="${x + pad}" y="${y + 28}" fill="${fg}" font-size="20" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">${escapeXml(heading)}</text>

      <g>
        <rect x="${stageX}" y="${stageY}" width="${stageW}" height="${stageH}" rx="22" fill="${plateBg}" stroke="${plateBorder}" stroke-width="1.2" />
        <rect x="${stageX + 14}" y="${stageY + 14}" width="74" height="${stageH - 28}" rx="18" fill="${canvas}" />
        <rect x="${stageX + 102}" y="${stageY + 14}" width="${stageW - 116}" height="118" rx="16" fill="${panel}" />
        <rect x="${stageX + 102}" y="${stageY + stageH - 46}" width="${stageW - 116}" height="32" rx="16" fill="${status}" />
        <rect x="${stageX + 120}" y="${stageY + 34}" width="${stageW - 152}" height="4" rx="2" fill="${surfaceText}" />
        <rect x="${stageX + 120}" y="${stageY + 50}" width="${stageW - 172}" height="4" rx="2" fill="${surfaceText}" />
      </g>

      ${renderRoleTile({
        role: keyword.role,
        tileX: gridX,
        tileY: gridY,
        tileW: gridW,
        tileH: keywordH,
        sample: keyword.sample,
      })}
      ${renderRoleTile({
        role: fn.role,
        tileX: gridX,
        tileY: lowerY,
        tileW: lowerW,
        tileH: lowerH,
        sample: fn.sample,
      })}
      ${renderRoleTile({
        role: string.role,
        tileX: gridX + lowerW + 12,
        tileY: lowerY,
        tileW: lowerW,
        tileH: lowerH,
        sample: string.sample,
      })}
    </g>
  `;
}

function renderPromoBoardSvg({ themes }) {
  const gradientId = "promo-board-bg";
  const cards = [
    { meta: themes.find((theme) => theme.id === "dark"), x: 56, y: 204 },
    { meta: themes.find((theme) => theme.id === "darkSoft"), x: 816, y: 204 },
    { meta: themes.find((theme) => theme.id === "light"), x: 56, y: 544 },
    { meta: themes.find((theme) => theme.id === "lightSoft"), x: 816, y: 544 },
  ];

  const renderedCards = cards
    .filter((entry) => entry.meta)
      .map(({ meta, x, y }) => renderPromoHeroVariant({
      theme: meta.theme,
      heading: meta.name,
      variantId: meta.id,
      x,
      y,
      width: 728,
      height: 300,
    }))
    .join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
      <defs>
        <linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1a1714" />
          <stop offset="100%" stop-color="#2b221c" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="url(#${gradientId})" />
      <rect x="42" y="204" width="1516" height="300" rx="30" fill="#241d18" stroke="${withAlpha("#cf8740", 0.12)}" />
      <rect x="42" y="544" width="1516" height="300" rx="30" fill="#e8dcc8" stroke="${withAlpha("#ccb89a", 0.44)}" />
      <text x="56" y="64" fill="#efe4d0" font-size="18" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">HEARTHCODE</text>
      <text x="56" y="92" fill="#efe4d0" font-size="41" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" dominant-baseline="text-before-edge">Four tuned variants, one warm-neutral voice</text>
      <text x="56" y="138" fill="#b9a68f" font-size="18" font-family="'Segoe UI', 'Noto Sans', sans-serif" dominant-baseline="text-before-edge">Ember reds, mineral blues, moss greens.</text>
      <text x="56" y="176" fill="#a89275" font-size="12" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" letter-spacing="0.12em" dominant-baseline="text-before-edge">DARK FAMILY</text>
      <text x="56" y="516" fill="#8b7556" font-size="12" font-family="'Segoe UI', 'Noto Sans', sans-serif" font-weight="700" letter-spacing="0.12em" dominant-baseline="text-before-edge">LIGHT FAMILY</text>
      ${renderedCards}
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
          theme: meta.theme,
        })),
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

