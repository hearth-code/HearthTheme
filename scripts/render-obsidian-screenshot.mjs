// Renders the Obsidian community-theme screenshot directly from the generated
// theme.css, so the promo image always reflects the active scheme's real
// Obsidian variables. Both exports use one oversized application frame with a
// clean Moss Light / Moss Dark mode cut, keeping the real Markdown proof as the
// dominant subject instead of turning the modes into separate poster cards.

// Bump when the layout/markup changes so the screenshot is re-rasterized even
// if the theme colors are unchanged. The hash of (this version + the SVG markup)
// is what the generator stores to decide whether to skip re-rendering.
export const RENDERER_VERSION = 'obsidian-functional-markdown-v7'

const CANVAS_W = 512
const CANVAS_H = 288
const SUPERSAMPLE = 2
const MODE_CUT_TOP_X = 370
const MODE_CUT_BOTTOM_X = 290

const UI_FONT = "-apple-system, 'Segoe UI', 'Noto Sans', 'Helvetica Neue', sans-serif"
const MONO_FONT = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace"

function extractVarBlock(css, selector) {
  const match = css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`))
  if (!match) throw new Error(`render-obsidian-screenshot: missing block for ${selector}`)
  const vars = {}
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/i)
    if (pair) vars[pair[1]] = pair[2].trim()
  }
  return vars
}

// librsvg (sharp) does not understand modern space-separated rgb(r g b / a),
// so normalize those to rgba(); hex and other forms pass through untouched.
function cssColor(value) {
  const v = String(value || '').trim()
  const m = v.match(/^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*([\d.]+)\s*\)$/i)
  if (m) return `rgba(${m[1]},${m[2]},${m[3]},${m[4]})`
  return v
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function text(x, y, content, { fill, size = 11, weight = 400, font = UI_FONT, italic = false, spacing, decoration }) {
  const attrs = [
    `x="${x}"`,
    `y="${y}"`,
    `fill="${fill}"`,
    `font-family="${font}"`,
    `font-size="${size}"`,
    `font-weight="${weight}"`,
  ]
  if (italic) attrs.push('font-style="italic"')
  if (spacing) attrs.push(`letter-spacing="${spacing}"`)
  if (decoration) attrs.push(`text-decoration="${decoration}"`)
  return `<text ${attrs.join(' ')} xml:space="preserve">${escapeXml(content)}</text>`
}

// tspan run helper for inline multi-color text (code lines / inline links)
function runs(x, y, parts, { size = 11, font = UI_FONT, weight = 400 }) {
  const spans = parts
    .map((part) => {
      const a = [`fill="${part.fill}"`]
      if (part.weight) a.push(`font-weight="${part.weight}"`)
      if (part.italic) a.push('font-style="italic"')
      if (part.underline) a.push('text-decoration="underline"')
      return `<tspan ${a.join(' ')}>${escapeXml(part.t)}</tspan>`
    })
    .join('')
  return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}" xml:space="preserve">${spans}</text>`
}

function checkbox(x, y, { checked, fill, stroke, marker, label }) {
  const box = `<rect x="${x}" y="${y}" width="10" height="10" rx="2.4" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`
  if (label) {
    return `${box}${text(x + 5, y + 7.5, label, { fill: marker, size: 7.2, weight: 700, font: UI_FONT })}`.replace(
      `x="${x + 5}"`,
      `x="${x + 5}" text-anchor="middle"`
    )
  }
  if (!checked) return box
  return `${box}<path d="M${x + 2.6} ${y + 5.2} L${x + 4.4} ${y + 7} L${x + 7.8} ${y + 3.1}" fill="none" stroke="${marker}" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/>`
}

// Renders the full note frame for one mode. Geometry is identical across modes;
// only the resolved colors differ, keeping Dark and Light directly comparable.
function renderFrame(vars) {
  const c = (name, fallback) => cssColor(vars[name] || fallback || '#000000')

  const bgPrimary = c('--background-primary')
  const bgSecondary = c('--background-secondary')
  const bgPrimaryAlt = c('--background-primary-alt')
  const border = c('--background-modifier-border')
  const textNormal = c('--text-normal')
  const textMuted = c('--text-muted')
  const textFaint = c('--text-faint')
  // Read the source (a hex), not --text-accent which now references it via var().
  const accent = c('--interactive-accent')
  const h1 = c('--h1-color')
  const h2 = c('--h2-color')
  const codeBg = c('--hearth-md-code-surface', c('--code-background', bgPrimaryAlt))
  const codeEdge = c('--hearth-md-code-border', border)
  const kw = c('--code-keyword')
  const fn = c('--code-function')
  const str = c('--code-string')
  const val = c('--code-value')
  const comment = c('--code-comment')
  const property = c('--code-property', textNormal)
  const marker = c('--hearth-md-list-level-1', textFaint)
  const markerNested = c('--hearth-md-list-level-2', textFaint)
  const markerThird = c('--hearth-md-list-level-3', textFaint)
  const checkboxBg = c('--hearth-task-background', bgPrimaryAlt)
  const checkboxBorder = c('--checkbox-border-color', border)
  const checkboxFill = c('--hearth-task-done', accent)
  const checkboxMarker = c('--checkbox-marker-color', bgPrimary)
  const inlineCode = c('--hearth-md-inline-code', val)
  const tagColor = c('--tag-color', accent)
  const tagBg = c('--tag-background', codeBg)
  const taskProgress = c('--hearth-task-progress', accent)
  const taskProgressText = c('--hearth-task-progress-text', textNormal)
  const taskQuestion = c('--hearth-task-question', accent)
  const taskQuestionText = c('--hearth-task-question-text', textNormal)
  const taskImportant = c('--hearth-task-important', accent)
  const taskImportantText = c('--hearth-task-important-text', textNormal)
  const calloutRgb = (name) => String(vars[name] || vars['--callout-default'] || '128, 128, 128')
  const calloutText = (name) => `rgb(${calloutRgb(name)})`
  const calloutBg = (name) => `rgba(${calloutRgb(name)},0.11)`
  const calloutBorder = (name) => `rgba(${calloutRgb(name)},0.58)`

  const SIDEBAR_W = 120
  const TAB_H = 26
  const cx = SIDEBAR_W + 18 // content left padding

  const els = []

  // window surfaces
  els.push(`<rect x="0" y="0" width="${CANVAS_W}" height="${CANVAS_H}" fill="${bgPrimary}"/>`)
  els.push(`<rect x="0" y="0" width="${SIDEBAR_W}" height="${CANVAS_H}" fill="${bgSecondary}"/>`)
  els.push(`<rect x="${SIDEBAR_W}" y="0" width="${CANVAS_W - SIDEBAR_W}" height="${TAB_H}" fill="${bgSecondary}"/>`)
  els.push(`<rect x="${SIDEBAR_W}" y="0" width="0.75" height="${CANVAS_H}" fill="${border}"/>`)
  els.push(`<rect x="${SIDEBAR_W}" y="${TAB_H}" width="${CANVAS_W - SIDEBAR_W}" height="0.75" fill="${border}"/>`)

  // sidebar: vault label + file list
  els.push(text(14, 20, 'HEARTHCODE', { fill: textFaint, size: 8, weight: 700, spacing: '1.2' }))
  const files = [
    { name: 'Hearth & Home.md', active: true },
    { name: 'Daily', muted: true },
    { name: 'Projects', muted: true },
    { name: 'Reading list.md' },
    { name: 'Ideas.md' },
  ]
  let fy = 44
  for (const f of files) {
    if (f.active) {
      els.push(`<rect x="6" y="${fy - 11}" width="108" height="18" rx="4" fill="${bgPrimaryAlt}"/>`)
    }
    els.push(`<circle cx="15" cy="${fy - 2}" r="1.6" fill="${f.active ? accent : textFaint}"/>`)
    els.push(
      text(24, fy, f.name, {
        fill: f.active ? textNormal : f.muted ? textMuted : textMuted,
        size: 9.5,
        weight: f.active ? 600 : 400,
      }),
    )
    fy += 22
  }

  // tab
  els.push(`<rect x="${SIDEBAR_W + 8}" y="5" width="118" height="${TAB_H - 6}" rx="5" fill="${bgPrimary}"/>`)
  els.push(text(SIDEBAR_W + 20, 18, 'Hearth & Home.md', { fill: textNormal, size: 9.5, weight: 500 }))

  // content
  els.push(text(cx, 51, 'Functional Markdown', { fill: h1, size: 17, weight: 700 }))
  // feature strip: bold / italic / inline code / tag — the inline surfaces this
  // round tuned to read identically across edit and reading views.
  els.push(text(cx, 70, 'Bold', { fill: textNormal, size: 10.5, weight: 700 }))
  els.push(text(cx + 31, 70, 'italic', { fill: textNormal, size: 10.5, italic: true }))
  els.push(`<rect x="${cx + 67}" y="60" width="33" height="13" rx="4" fill="${codeBg}" stroke="${codeEdge}" stroke-width="0.6"/>`)
  els.push(text(cx + 72, 69.5, 'code', { fill: inlineCode, size: 9, font: MONO_FONT }))
  els.push(`<rect x="${cx + 106}" y="60" width="36" height="13" rx="6" fill="${tagBg}" stroke="${border}" stroke-width="0.6"/>`)
  els.push(text(cx + 111, 69.5, '#tag', { fill: tagColor, size: 9 }))

  els.push(text(cx, 92, 'Task states', { fill: h2, size: 12.5, weight: 700 }))
  els.push(checkbox(cx, 104, { checked: false, fill: checkboxBg, stroke: checkboxBorder, marker: checkboxMarker }))
  els.push(text(cx + 17, 113, 'Open task', { fill: textNormal, size: 9.5 }))
  els.push(checkbox(cx, 121, { checked: true, fill: checkboxFill, stroke: checkboxFill, marker: checkboxMarker }))
  els.push(text(cx + 17, 130, 'Done task', { fill: textMuted, size: 9.5, decoration: 'line-through' }))
  // Honest rendering: the theme tints native checkboxes + sets per-state text
  // color; it does NOT draw /?! glyphs inside the box. Alternate states are
  // unchecked, so they show a native (empty) box + colored text — exactly what
  // HearthCode actually ships.
  els.push(checkbox(cx + 110, 104, { checked: false, fill: checkboxBg, stroke: checkboxBorder, marker: checkboxMarker }))
  els.push(text(cx + 127, 113, 'In progress', { fill: taskProgressText, size: 9.5 }))
  els.push(checkbox(cx + 110, 121, { checked: false, fill: checkboxBg, stroke: checkboxBorder, marker: checkboxMarker }))
  els.push(text(cx + 127, 130, 'Question', { fill: taskQuestionText, size: 9.5 }))
  els.push(checkbox(cx + 220, 104, { checked: false, fill: checkboxBg, stroke: checkboxBorder, marker: checkboxMarker }))
  els.push(text(cx + 237, 113, 'Important', { fill: taskImportantText, size: 9.5 }))

  els.push(text(cx, 153, 'List hierarchy', { fill: h2, size: 12.5, weight: 700 }))
  els.push(`<circle cx="${cx + 5}" cy="169" r="1.9" fill="${marker}"/>`)
  els.push(text(cx + 17, 173, 'Level one marker', { fill: textNormal, size: 9.5 }))
  els.push(`<circle cx="${cx + 24}" cy="185" r="2.2" fill="transparent" stroke="${markerNested}" stroke-width="1"/>`)
  els.push(text(cx + 36, 189, 'Level two marker', { fill: textMuted, size: 9.2 }))
  els.push(`<rect x="${cx + 43}" y="202" width="7" height="1.7" rx="0.8" fill="${markerThird}"/>`)
  els.push(text(cx + 56, 206, 'Level three marker', { fill: textMuted, size: 9.2 }))

  const calloutX = cx + 205
  const callouts = [
    { y: 148, key: '--callout-info', label: 'Info', body: 'reference' },
    { y: 180, key: '--callout-success', label: 'Success', body: 'done' },
    { y: 212, key: '--callout-warning', label: 'Warning', body: 'check' },
    { y: 244, key: '--callout-error', label: 'Danger', body: 'risk' },
  ]
  for (const item of callouts) {
    els.push(`<rect x="${calloutX}" y="${item.y}" width="130" height="24" rx="6" fill="${calloutBg(item.key)}" stroke="${calloutBorder(item.key)}" stroke-width="0.75"/>`)
    els.push(`<rect x="${calloutX}" y="${item.y}" width="3" height="24" rx="1.5" fill="${calloutText(item.key)}"/>`)
    els.push(text(calloutX + 12, item.y + 10, item.label, { fill: calloutText(item.key), size: 8.4, weight: 700 }))
    els.push(text(calloutX + 12, item.y + 20, item.body, { fill: textMuted, size: 7.8 }))
  }

  // code block
  const codeX = cx
  const codeY = 221
  // Leave a quiet gutter before the callout rail so the Dark/Light mode cut
  // can cross the frame without clipping code or live copy.
  const codeW = 160
  const codeH = 46
  els.push(`<rect x="${codeX}" y="${codeY}" width="${codeW}" height="${codeH}" rx="7" fill="${codeBg}" stroke="${codeEdge}" stroke-width="0.75"/>`)
  const lx = codeX + 11
  let ly = codeY + 16
  const codeLines = [
    [
      { t: 'type ', fill: kw, weight: 600 },
      { t: 'State', fill: fn },
      { t: ' = ', fill: property },
      { t: '"clear"', fill: str },
    ],
    [
      { t: '// flat code surface', fill: comment },
    ],
  ]
  for (const parts of codeLines) {
    els.push(runs(lx, ly, parts, { size: 9.4, font: MONO_FONT }))
    ly += 15
  }

  return els.join('')
}

function renderObsidianModeCutMarkup(dark, light, id) {
  const darkFaint = cssColor(dark['--text-faint'] || '#888')
  const lightFaint = cssColor(light['--text-faint'] || '#888')
  const clipId = `${id}-dark-clip`
  return [
    `<g id="${id}">`,
    `<defs><clipPath id="${clipId}"><polygon points="${MODE_CUT_TOP_X},0 ${CANVAS_W},0 ${CANVAS_W},${CANVAS_H} ${MODE_CUT_BOTTOM_X},${CANVAS_H}"/></clipPath></defs>`,
    `<g id="${id}-light">${renderFrame(light)}</g>`,
    `<g id="${id}-dark" clip-path="url(#${clipId})">${renderFrame(dark)}</g>`,
    text(14, CANVAS_H - 12, 'LIGHT', { fill: lightFaint, size: 8, weight: 700, spacing: '1.5' }),
    `<text x="${CANVAS_W - 14}" y="18" text-anchor="end" fill="${darkFaint}" font-family="${UI_FONT}" font-size="8" font-weight="700" letter-spacing="1.5">DARK</text>`,
    '</g>',
  ].join('')
}

export function buildObsidianScreenshotSvg(themeCss) {
  const dark = extractVarBlock(themeCss, '\\.theme-dark')
  const light = extractVarBlock(themeCss, '\\.theme-light')
  const w = CANVAS_W * SUPERSAMPLE
  const h = CANVAS_H * SUPERSAMPLE

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">`,
    renderObsidianModeCutMarkup(dark, light, 'obsidian-community-mode-cut'),
    '</svg>',
  ].join('')
}

export function buildObsidianHeroSvg(themeCss) {
  const dark = extractVarBlock(themeCss, '\\.theme-dark')
  const light = extractVarBlock(themeCss, '\\.theme-light')
  const background = cssColor(dark['--background-secondary'] || '#151713')
  const border = cssColor(dark['--background-modifier-border'] || '#343630')
  const subjectX = 24
  const subjectY = 24
  const subjectWidth = 1552
  const subjectHeight = 852

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">',
    `<rect width="1600" height="900" fill="${background}"/>`,
    `<rect x="34" y="40" width="${subjectWidth}" height="${subjectHeight}" rx="14" fill="${background}" opacity="0.58"/>`,
    `<g id="obsidian-hero-subject"><rect x="${subjectX - 1}" y="${subjectY - 1}" width="${subjectWidth + 2}" height="${subjectHeight + 2}" rx="12" fill="none" stroke="${border}" stroke-width="2"/><svg x="${subjectX}" y="${subjectY}" width="${subjectWidth}" height="${subjectHeight}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">${renderObsidianModeCutMarkup(dark, light, 'obsidian-hero-mode-cut')}</svg></g>`,
    '</svg>',
  ].flat().join('')
}

export async function renderObsidianScreenshotBuffer(themeCss) {
  const sharp = (await import('sharp')).default
  const svg = buildObsidianScreenshotSvg(themeCss)
  return sharp(Buffer.from(svg)).resize(CANVAS_W, CANVAS_H).png().toBuffer()
}

// README-scale render with one oversized mode-cut application proof. Vector
// text stays crisp at any size, so the marketing hero tracks the active scheme
// without manual app screenshots per release.
export async function renderObsidianHeroBuffer(themeCss, { width = 1600 } = {}) {
  const sharp = (await import('sharp')).default
  const svg = buildObsidianHeroSvg(themeCss)
  return sharp(Buffer.from(svg)).resize(width).png().toBuffer()
}
