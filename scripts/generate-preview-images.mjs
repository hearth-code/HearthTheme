import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { createHighlighter } from "shiki";

const WIDTH = 1600;
const HEIGHT = 1000;
const OUTPUT_DIR = join("extension", "images");
const WEBSITE_OUTPUT_DIR = join("public", "previews");
const SAMPLE_PATH = join("fixtures", "preview", "sample.ts");
const LANG = "typescript";

const THEME_META = [
  {
    id: "dark",
    name: "Hearth Dark",
    file: join("themes", "hearth-dark.json"),
    output: join(OUTPUT_DIR, "preview-dark.png"),
    webOutput: join(WEBSITE_OUTPUT_DIR, "preview-dark.png"),
  },
  {
    id: "darkSoft",
    name: "Hearth Dark Soft",
    file: join("themes", "hearth-dark-soft.json"),
    output: join(OUTPUT_DIR, "preview-dark-soft.png"),
    webOutput: join(WEBSITE_OUTPUT_DIR, "preview-dark-soft.png"),
  },
  {
    id: "light",
    name: "Hearth Light",
    file: join("themes", "hearth-light.json"),
    output: join(OUTPUT_DIR, "preview-light.png"),
    webOutput: join(WEBSITE_OUTPUT_DIR, "preview-light.png"),
  },
  {
    id: "lightSoft",
    name: "Hearth Light Soft",
    file: join("themes", "hearth-light-soft.json"),
    output: join(OUTPUT_DIR, "preview-light-soft.png"),
    webOutput: join(WEBSITE_OUTPUT_DIR, "preview-light-soft.png"),
  },
];
const CONTRAST_OUTPUT = join(OUTPUT_DIR, "preview-contrast.png");
const CONTRAST_WEB_OUTPUT = join(WEBSITE_OUTPUT_DIR, "preview-contrast.png");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
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
  const raw = normalized.slice(1);
  return [
    Number.parseInt(raw.slice(0, 2), 16),
    Number.parseInt(raw.slice(2, 4), 16),
    Number.parseInt(raw.slice(4, 6), 16),
  ];
}

function toLinear(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  if (l1 == null || l2 == null) return null;
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

function fixed(value) {
  return Number(value).toFixed(1);
}

function tokenColor(theme, scopes) {
  const entries = Array.isArray(theme.tokenColors) ? theme.tokenColors : [];
  for (const entry of entries) {
    const entryScopes = Array.isArray(entry.scope) ? entry.scope : [entry.scope];
    if (!entryScopes.some((scope) => scopes.includes(scope))) continue;
    const color = normalizeHex(entry.settings?.foreground);
    if (color) return color;
  }
  return null;
}

function themeMetrics(theme) {
  const bg = normalizeHex(theme.colors?.["editor.background"]);
  const fg = normalizeHex(theme.colors?.["editor.foreground"]);
  const comment = tokenColor(theme, ["comment", "punctuation.definition.comment"]);
  return {
    fgBg: bg && fg ? contrastRatio(fg, bg) : null,
    commentBg: bg && comment ? contrastRatio(comment, bg) : null,
  };
}

function renderTokenLine(tokens, x, y, fontSize) {
  const segments = tokens
    .map((token) => {
      const color = normalizeHex(token.color) ?? "#d3c9b8";
      return `<tspan fill="${color}">${escapeXml(token.content)}</tspan>`;
    })
    .join("");

  return `<text x="${x}" y="${y}" xml:space="preserve" font-size="${fontSize}" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" dominant-baseline="text-before-edge">${segments}</text>`;
}

function renderCodeBlock({
  lines,
  x,
  y,
  width,
  height,
  bg,
  fg,
  title,
  stats,
  clipId,
  maxLines = 16,
}) {
  const headerHeight = 66;
  const contentX = x + 38;
  const contentY = y + headerHeight + 24;
  const fontSize = 27;
  const lineHeight = 44;
  const clipY = y + headerHeight + 8;
  const clipHeight = height - headerHeight - 16;

  const visibleLines = lines.slice(0, maxLines);
  const renderedLines = visibleLines
    .map((line, index) => renderTokenLine(line, contentX, contentY + index * lineHeight, fontSize))
    .join("");

  const statText = stats.filter(Boolean).join("  |  ");

  return `
    <g>
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="22" fill="${bg}" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" />
      <line x1="${x}" y1="${y + headerHeight}" x2="${x + width}" y2="${y + headerHeight}" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" />
      <text x="${x + 28}" y="${y + 20}" fill="${fg}" font-family="'Noto Sans', 'Segoe UI', sans-serif" font-size="22" font-weight="700">${escapeXml(title)}</text>
      <text x="${x + 28}" y="${y + 47}" fill="${fg}" opacity="0.72" font-family="'Noto Sans', 'Segoe UI', sans-serif" font-size="16">${escapeXml(statText)}</text>
      <defs>
        <clipPath id="${clipId}">
          <rect x="${x + 16}" y="${clipY}" width="${width - 32}" height="${clipHeight}" rx="12" />
        </clipPath>
      </defs>
      <g clip-path="url(#${clipId})">
        ${renderedLines}
      </g>
    </g>
  `;
}

function renderCanvasShell({ heading, subheading, body, surface = "#12100d", glow = "#2a2219" }) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
      <defs>
        <linearGradient id="bg-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${surface}" />
          <stop offset="100%" stop-color="${glow}" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="url(#bg-gradient)" />
      <text x="90" y="72" fill="#f2dec0" font-family="'Noto Sans', 'Segoe UI', sans-serif" font-size="40" font-weight="800">${escapeXml(heading)}</text>
      <text x="90" y="106" fill="#cfb38b" font-family="'Noto Sans', 'Segoe UI', sans-serif" font-size="20">${escapeXml(subheading)}</text>
      ${body}
    </svg>
  `;
}

function renderSingleThemeSvg({ theme, highlighted, heading }) {
  const bg = normalizeHex(theme.colors?.["editor.background"]) ?? "#23201c";
  const fg = normalizeHex(theme.colors?.["editor.foreground"]) ?? "#d3c9b8";
  const metrics = themeMetrics(theme);
  const block = renderCodeBlock({
    lines: highlighted.tokens,
    x: 88,
    y: 138,
    width: WIDTH - 176,
    height: HEIGHT - 220,
    bg,
    fg,
    title: heading,
    stats: [
      metrics.fgBg == null ? null : `fg/bg contrast ${fixed(metrics.fgBg)}`,
      metrics.commentBg == null ? null : `comment/bg ${fixed(metrics.commentBg)}`,
      "fixture-driven render",
    ],
    clipId: `clip-single-${theme.name.toLowerCase().replaceAll(/\s+/g, "-")}`,
    maxLines: 16,
  });

  return renderCanvasShell({
    heading: `HearthCode — ${heading}`,
    subheading: "Generated from fixtures/preview/sample.ts via Shiki",
    body: block,
    surface: "#14110e",
    glow: theme.name.startsWith("Hearth Light") ? "#58442c" : "#2a2219",
  });
}

function renderContrastSvg({ cards }) {
  const cardWidth = cards.length > 3 ? 360 : 470;
  const cardHeight = 760;
  const gap = cards.length > 3 ? 24 : 35;
  const totalWidth = cards.length * cardWidth + Math.max(cards.length - 1, 0) * gap;
  const startX = Math.max(36, Math.floor((WIDTH - totalWidth) / 2));
  const y = 160;

  const body = cards
    .map((card, index) => {
      const x = startX + index * (cardWidth + gap);
      return renderCodeBlock({
        lines: card.highlighted.tokens,
        x,
        y,
        width: cardWidth,
        height: cardHeight,
        bg: card.bg,
        fg: card.fg,
        title: card.name,
        stats: [
          card.fgBg == null ? null : `fg/bg ${fixed(card.fgBg)}`,
          card.commentBg == null ? null : `comment/bg ${fixed(card.commentBg)}`,
        ],
        clipId: `clip-contrast-${index}-${card.id}`,
        maxLines: 12,
      });
    })
    .join("");

  return renderCanvasShell({
    heading: "HearthCode — Long-session comfort tuning",
    subheading: "Same fixture, cross-variant semantic parity snapshot",
    body,
    surface: "#100f0c",
    glow: "#3a2f23",
  });
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

  const sourceCode = readFileSync(SAMPLE_PATH, "utf8").trimEnd();
  const themes = THEME_META.map((meta) => ({ ...meta, theme: readJson(meta.file) }));
  const highlighter = await createHighlighter({
    langs: [LANG],
    themes: themes.map((meta) => meta.theme),
  });

  try {
    const highlightedMap = new Map();
    for (const meta of themes) {
      const highlighted = highlighter.codeToTokens(sourceCode, {
        lang: LANG,
        theme: meta.name,
      });
      highlightedMap.set(meta.name, highlighted);
    }

    const darkMeta = themes.find((meta) => meta.id === "dark");
    const lightMeta = themes.find((meta) => meta.id === "light");
    const darkSoftMeta = themes.find((meta) => meta.id === "darkSoft");
    const lightSoftMeta = themes.find((meta) => meta.id === "lightSoft");

    if (!darkMeta || !lightMeta || !darkSoftMeta || !lightSoftMeta) {
      throw new Error("Theme metadata is incomplete.");
    }

    const darkSvg = renderSingleThemeSvg({
      theme: darkMeta.theme,
      highlighted: highlightedMap.get(darkMeta.name),
      heading: darkMeta.name,
    });

    const darkSoftSvg = renderSingleThemeSvg({
      theme: darkSoftMeta.theme,
      highlighted: highlightedMap.get(darkSoftMeta.name),
      heading: darkSoftMeta.name,
    });

    const lightSvg = renderSingleThemeSvg({
      theme: lightMeta.theme,
      highlighted: highlightedMap.get(lightMeta.name),
      heading: lightMeta.name,
    });

    const lightSoftSvg = renderSingleThemeSvg({
      theme: lightSoftMeta.theme,
      highlighted: highlightedMap.get(lightSoftMeta.name),
      heading: lightSoftMeta.name,
    });

    const contrastSvg = renderContrastSvg({
      cards: [darkMeta, darkSoftMeta, lightMeta, lightSoftMeta].map((meta) => {
        const metrics = themeMetrics(meta.theme);
        return {
          id: meta.id,
          name: meta.name,
          highlighted: highlightedMap.get(meta.name),
          bg: normalizeHex(meta.theme.colors?.["editor.background"]) ?? "#23201c",
          fg: normalizeHex(meta.theme.colors?.["editor.foreground"]) ?? "#d3c9b8",
          fgBg: metrics.fgBg,
          commentBg: metrics.commentBg,
        };
      }),
    });

    await writePng(darkSvg, darkMeta.output);
    await writePng(darkSvg, darkMeta.webOutput);
    await writePng(darkSoftSvg, darkSoftMeta.output);
    await writePng(darkSoftSvg, darkSoftMeta.webOutput);
    await writePng(lightSvg, lightMeta.output);
    await writePng(lightSvg, lightMeta.webOutput);
    await writePng(lightSoftSvg, lightSoftMeta.output);
    await writePng(lightSoftSvg, lightSoftMeta.webOutput);
    await writePng(contrastSvg, CONTRAST_OUTPUT);
    await writePng(contrastSvg, CONTRAST_WEB_OUTPUT);
  } finally {
    await highlighter.dispose();
  }
}

run().catch((error) => {
  console.error(`✗ failed to generate preview images: ${error.message}`);
  process.exit(1);
});
