import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { createHighlighter } from "shiki";

const WIDTH = 1600;
const HEIGHT = 1000;
const OUTPUT_DIR = join("extension", "images");
const WEBSITE_OUTPUT_DIR = join("public", "previews");
const MANIFEST_PATH = join("reports", "preview-manifest.json");
const SAMPLE_PATH = join("fixtures", "preview", "sample.tsx");
const LANG = "tsx";

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
const CONTRAST_OUTPUTS = [
  join(OUTPUT_DIR, "preview-contrast-v2.png"),
  join(OUTPUT_DIR, "preview-contrast.png"),
];
const CONTRAST_WEB_OUTPUTS = [
  join(WEBSITE_OUTPUT_DIR, "preview-contrast-v2.png"),
  join(WEBSITE_OUTPUT_DIR, "preview-contrast.png"),
];
const VARIANT_SCENE_LABEL = {
  dark: "daily default · mixed lighting",
  darkSoft: "night focus · low stimulation",
  light: "daylight docs · office flow",
  lightSoft: "long daytime · gentler contrast",
};

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
  maxLines = 20,
}) {
  const headerHeight = 60;
  const contentX = x + 30;
  const contentY = y + headerHeight + 18;
  const fontSize = 23;
  const lineHeight = 34;
  const clipY = y + headerHeight + 6;
  const clipHeight = height - headerHeight - 12;

  const visibleLines = lines.slice(0, maxLines);
  const renderedLines = visibleLines
    .map((line, index) => renderTokenLine(line, contentX, contentY + index * lineHeight, fontSize))
    .join("");

  const statText = stats.filter(Boolean).join("  |  ");

  return `
    <g>
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="20" fill="${bg}" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" />
      <line x1="${x}" y1="${y + headerHeight}" x2="${x + width}" y2="${y + headerHeight}" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" />
      <text x="${x + 24}" y="${y + 17}" fill="${fg}" font-family="'Noto Sans', 'Segoe UI', sans-serif" font-size="20" font-weight="700">${escapeXml(title)}</text>
      <text x="${x + 24}" y="${y + 39}" fill="${fg}" opacity="0.72" font-family="'Noto Sans', 'Segoe UI', sans-serif" font-size="15">${escapeXml(statText)}</text>
      <defs>
        <clipPath id="${clipId}">
          <rect x="${x + 12}" y="${clipY}" width="${width - 24}" height="${clipHeight}" rx="10" />
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

function renderSingleThemeSvg({ theme, highlighted, heading, variantId }) {
  const bg = normalizeHex(theme.colors?.["editor.background"]) ?? "#23201c";
  const fg = normalizeHex(theme.colors?.["editor.foreground"]) ?? "#d3c9b8";
  const sceneLabel = VARIANT_SCENE_LABEL[variantId] ?? "semantic-role parity fixture";
  const block = renderCodeBlock({
    lines: highlighted.tokens,
    x: 64,
    y: 126,
    width: WIDTH - 128,
    height: HEIGHT - 188,
    bg,
    fg,
    title: heading,
    stats: [
      sceneLabel,
      "semantic-role parity fixture",
    ],
    clipId: `clip-single-${theme.name.toLowerCase().replaceAll(/\s+/g, "-")}`,
    maxLines: 21,
  });

  return renderCanvasShell({
    heading: `HearthCode — ${heading}`,
    subheading: "Generated from fixtures/preview/sample.tsx via Shiki",
    body: block,
    surface: "#14110e",
    glow: theme.name.startsWith("Hearth Light") ? "#58442c" : "#2a2219",
  });
}

function renderContrastSvg({ cards }) {
  const cardWidth = cards.length > 3 ? 372 : 470;
  const cardHeight = 792;
  const gap = cards.length > 3 ? 20 : 35;
  const totalWidth = cards.length * cardWidth + Math.max(cards.length - 1, 0) * gap;
  const startX = Math.max(36, Math.floor((WIDTH - totalWidth) / 2));
  const y = 146;

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
          card.sceneLabel,
          "same fixture",
        ],
        clipId: `clip-contrast-${index}-${card.id}`,
        maxLines: 16,
      });
    })
    .join("");

  return renderCanvasShell({
    heading: "HearthCode — Cross-variant semantic snapshot",
    subheading: "One fixture rendered across all variants",
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
  mkdirSync(dirname(MANIFEST_PATH), { recursive: true });

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
      variantId: darkMeta.id,
    });

    const darkSoftSvg = renderSingleThemeSvg({
      theme: darkSoftMeta.theme,
      highlighted: highlightedMap.get(darkSoftMeta.name),
      heading: darkSoftMeta.name,
      variantId: darkSoftMeta.id,
    });

    const lightSvg = renderSingleThemeSvg({
      theme: lightMeta.theme,
      highlighted: highlightedMap.get(lightMeta.name),
      heading: lightMeta.name,
      variantId: lightMeta.id,
    });

    const lightSoftSvg = renderSingleThemeSvg({
      theme: lightSoftMeta.theme,
      highlighted: highlightedMap.get(lightSoftMeta.name),
      heading: lightSoftMeta.name,
      variantId: lightSoftMeta.id,
    });

    const contrastSvg = renderContrastSvg({
      cards: [darkMeta, darkSoftMeta, lightMeta, lightSoftMeta].map((meta) => {
        return {
          id: meta.id,
          name: meta.name,
          highlighted: highlightedMap.get(meta.name),
          bg: normalizeHex(meta.theme.colors?.["editor.background"]) ?? "#23201c",
          fg: normalizeHex(meta.theme.colors?.["editor.foreground"]) ?? "#d3c9b8",
          sceneLabel: VARIANT_SCENE_LABEL[meta.id] ?? "semantic-role parity",
        };
      }),
    });

    const manifest = {
      schemaVersion: 1,
      generator: "scripts/generate-preview-images.mjs",
      samplePath: toPosixPath(SAMPLE_PATH),
      language: LANG,
      canvas: { width: WIDTH, height: HEIGHT },
      themeImages: [
        { id: darkMeta.id, svgSha256: sha256(darkSvg), output: toPosixPath(darkMeta.output), webOutput: toPosixPath(darkMeta.webOutput) },
        { id: darkSoftMeta.id, svgSha256: sha256(darkSoftSvg), output: toPosixPath(darkSoftMeta.output), webOutput: toPosixPath(darkSoftMeta.webOutput) },
        { id: lightMeta.id, svgSha256: sha256(lightSvg), output: toPosixPath(lightMeta.output), webOutput: toPosixPath(lightMeta.webOutput) },
        { id: lightSoftMeta.id, svgSha256: sha256(lightSoftSvg), output: toPosixPath(lightSoftMeta.output), webOutput: toPosixPath(lightSoftMeta.webOutput) },
      ],
      contrastImage: {
        svgSha256: sha256(contrastSvg),
        outputs: CONTRAST_OUTPUTS.map(toPosixPath),
        webOutputs: CONTRAST_WEB_OUTPUTS.map(toPosixPath),
      },
    };

    await writePng(darkSvg, darkMeta.output);
    await writePng(darkSvg, darkMeta.webOutput);
    await writePng(darkSoftSvg, darkSoftMeta.output);
    await writePng(darkSoftSvg, darkSoftMeta.webOutput);
    await writePng(lightSvg, lightMeta.output);
    await writePng(lightSvg, lightMeta.webOutput);
    await writePng(lightSoftSvg, lightSoftMeta.output);
    await writePng(lightSoftSvg, lightSoftMeta.webOutput);
    for (const output of CONTRAST_OUTPUTS) {
      await writePng(contrastSvg, output);
    }
    for (const output of CONTRAST_WEB_OUTPUTS) {
      await writePng(contrastSvg, output);
    }
    const manifestChanged = writeJsonIfChanged(MANIFEST_PATH, manifest);
    console.log(`${manifestChanged ? "✓ updated" : "- unchanged"} ${MANIFEST_PATH}`);
  } finally {
    await highlighter.dispose();
  }
}

run().catch((error) => {
  console.error(`✗ failed to generate preview images: ${error.message}`);
  process.exit(1);
});
