// Renders the Obsidian community-theme screenshot directly from the generated
// theme.css, so the promo image always reflects the active scheme's real
// Obsidian variables. The frame shows one markdown note split on a diagonal:
// dark mode on the upper-left, light mode on the lower-right — communicating
// that the theme ships both modes from a single image.

// Bump when the layout/markup changes so the screenshot is re-rasterized even
// if the theme colors are unchanged. The hash of (this version + the SVG markup)
// is what the generator stores to decide whether to skip re-rendering.
export const RENDERER_VERSION = 'obsidian-note-split-v1'

const CANVAS_W = 512
const CANVAS_H = 288
const SUPERSAMPLE = 2

// Diagonal seam (dark left, light right). Runs through the middle of the
// headings and code block so both modes show dense, representative content.
const SEAM_TOP_X = 262
const SEAM_BOTTOM_X = 212

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

function text(x, y, content, { fill, size = 11, weight = 400, font = UI_FONT, italic = false, spacing }) {
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

// Renders the full note frame for one mode. Geometry is identical across modes;
// only the resolved colors differ, so the diagonal split lines up perfectly.
function renderFrame(vars) {
  const c = (name, fallback) => cssColor(vars[name] || fallback || '#000000')

  const bgPrimary = c('--background-primary')
  const bgSecondary = c('--background-secondary')
  const bgPrimaryAlt = c('--background-primary-alt')
  const border = c('--background-modifier-border')
  const textNormal = c('--text-normal')
  const textMuted = c('--text-muted')
  const textFaint = c('--text-faint')
  const accent = c('--text-accent')
  const h1 = c('--h1-color')
  const h2 = c('--h2-color')
  const codeBg = c('--code-background', bgPrimaryAlt)
  const kw = c('--code-keyword')
  const fn = c('--code-function')
  const str = c('--code-string')
  const val = c('--code-value')
  const comment = c('--code-comment')
  const property = c('--code-property', textNormal)
  const bqBorder = c('--blockquote-border-color', accent)
  const bqColor = c('--blockquote-color', textMuted)

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
  els.push(text(cx, 52, 'Hearth & Home', { fill: h1, size: 18, weight: 700 }))
  els.push(
    runs(cx, 74, [
      { t: 'A calm, low-glare workspace for ', fill: textNormal },
      { t: 'long-form writing', fill: accent, underline: true },
      { t: '.', fill: textNormal },
    ], { size: 11 }),
  )

  els.push(text(cx, 100, 'Today', { fill: h2, size: 13, weight: 700 }))
  const bullets = ['Review the morning notes', 'Draft the weekly summary']
  let by = 118
  for (const b of bullets) {
    els.push(`<circle cx="${cx + 3}" cy="${by - 3}" r="1.6" fill="${textFaint}"/>`)
    els.push(text(cx + 14, by, b, { fill: textNormal, size: 11 }))
    by += 18
  }

  // blockquote
  const bqY = 150
  els.push(`<rect x="${cx}" y="${bqY}" width="3" height="22" rx="1.5" fill="${bqBorder}"/>`)
  els.push(text(cx + 12, bqY + 15, 'Make it warm, keep it readable.', { fill: bqColor, size: 11, italic: true }))

  // code block
  const codeX = cx
  const codeY = 184
  const codeW = CANVAS_W - codeX - 16
  const codeH = 86
  els.push(`<rect x="${codeX}" y="${codeY}" width="${codeW}" height="${codeH}" rx="7" fill="${codeBg}" stroke="${border}" stroke-width="0.75"/>`)
  const lx = codeX + 14
  let ly = codeY + 22
  const codeLines = [
    [{ t: '// warm by default', fill: comment }],
    [
      { t: 'function ', fill: kw, weight: 600 },
      { t: 'greet', fill: fn },
      { t: '(', fill: property },
      { t: 'name', fill: val },
      { t: ') {', fill: property },
    ],
    [
      { t: '  return ', fill: kw, weight: 600 },
      { t: '`Hi ${name}`', fill: str },
    ],
    [{ t: '}', fill: property }],
  ]
  for (const parts of codeLines) {
    els.push(runs(lx, ly, parts, { size: 11, font: MONO_FONT }))
    ly += 17
  }

  return els.join('')
}

export function buildObsidianScreenshotSvg(themeCss) {
  const dark = extractVarBlock(themeCss, '\\.theme-dark')
  const light = extractVarBlock(themeCss, '\\.theme-light')

  const lightFaint = cssColor(light['--text-faint'] || '#888')
  const darkFaint = cssColor(dark['--text-faint'] || '#888')

  const w = CANVAS_W * SUPERSAMPLE
  const h = CANVAS_H * SUPERSAMPLE

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">`,
    '<defs>',
    `<clipPath id="lightHalf"><polygon points="${SEAM_TOP_X},0 ${CANVAS_W},0 ${CANVAS_W},${CANVAS_H} ${SEAM_BOTTOM_X},${CANVAS_H}"/></clipPath>`,
    '</defs>',
    // dark fills the whole canvas
    `<g>${renderFrame(dark)}</g>`,
    // light is clipped to the lower-right diagonal half
    `<g clip-path="url(#lightHalf)">${renderFrame(light)}</g>`,
    // seam
    `<line x1="${SEAM_TOP_X}" y1="0" x2="${SEAM_BOTTOM_X}" y2="${CANVAS_H}" stroke="#8a8378" stroke-width="1.25" stroke-opacity="0.55"/>`,
    // mode labels
    text(14, CANVAS_H - 12, 'DARK', { fill: darkFaint, size: 8, weight: 700, spacing: '1.5' }),
    text(CANVAS_W - 42, 16, 'LIGHT', { fill: lightFaint, size: 8, weight: 700, spacing: '1.5' }),
    '</svg>',
  ].join('')
}

export async function renderObsidianScreenshotBuffer(themeCss) {
  const sharp = (await import('sharp')).default
  const svg = buildObsidianScreenshotSvg(themeCss)
  return sharp(Buffer.from(svg)).resize(CANVAS_W, CANVAS_H).png().toBuffer()
}
