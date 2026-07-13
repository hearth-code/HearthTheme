import { oklchHueDeg } from '../../scripts/color-utils.mjs'

const SAMPLE_LINES = [
  [['import', 'keyword'], [' { forge, ', 'operator'], ['type', 'keyword'], [' Lane ', 'type'], ['} ', 'operator'], ['from', 'keyword'], [' "hearth"', 'string']],
  [['', null]],
  [['// each lane keeps a perceptual gap', 'comment']],
  [['// so syntax never blurs together', 'comment']],
  [['export function', 'keyword'], [' theme', 'fn'], ['(', 'operator'], ['seed', 'variable'], [': ', 'operator'], ['number', 'type'], ['): ', 'operator'], ['Lane', 'type'], ['[] {', 'operator']],
  [['  const', 'keyword'], [' moss ', 'variable'], ['= ', 'operator'], ['forge', 'fn'], ['(', 'operator'], ['seed', 'variable'], [')', 'operator']],
  [['    .', 'operator'], ['blend', 'method'], ['({ ', 'operator'], ['warm', 'property'], [': ', 'operator'], ['0.7', 'number'], [', ', 'operator'], ['oxide', 'property'], [': ', 'operator'], ['3', 'number'], [' })', 'operator']],
  [['  return', 'keyword'], [' moss', 'variable'], ['.', 'operator'], ['lanes', 'property']],
  [['    .', 'operator'], ['filter', 'method'], ['((', 'operator'], ['l', 'variable'], [') => ', 'operator'], ['l', 'variable'], ['.', 'operator'], ['contrast', 'property'], [' >= ', 'operator'], ['4.5', 'number'], [')', 'operator']],
  [['}', 'operator']],
  [['', null]],
  [['export default', 'keyword'], [' theme', 'fn'], ['(', 'operator'], ['42', 'number'], [')', 'operator']],
]

const RIBBON_ROLES = ['keyword', 'fn', 'method', 'property', 'type', 'number', 'string', 'variable', 'operator', 'comment']
const MONO = 'Menlo, Monaco, Consolas, monospace'
const SANS = 'Noto Sans, Segoe UI, system-ui, sans-serif'

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function toHexByte(value) {
  return Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0')
}

function normalizeHex(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase()
  return null
}

function hexToRgb(hex) {
  const normalized = normalizeHex(hex)
  if (!normalized) return null
  const raw = normalized.slice(1)
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
  }
}

function rgbToHsl({ r, g, b }) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2

  if (max === min) return { h: 0, s: 0, l }

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === rn) {
    h = (gn - bn) / d + (gn < bn ? 6 : 0)
  } else if (max === gn) {
    h = (bn - rn) / d + 2
  } else {
    h = (rn - gn) / d + 4
  }
  return { h: h * 60, s, l }
}

function hueToRgb(p, q, t) {
  let next = t
  if (next < 0) next += 1
  if (next > 1) next -= 1
  if (next < 1 / 6) return p + (q - p) * 6 * next
  if (next < 1 / 2) return q
  if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6
  return p
}

function hslToHex({ h, s, l }) {
  const hn = (((h % 360) + 360) % 360) / 360
  let r
  let g
  let b

  if (s === 0) {
    r = l
    g = l
    b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hueToRgb(p, q, hn + 1 / 3)
    g = hueToRgb(p, q, hn)
    b = hueToRgb(p, q, hn - 1 / 3)
  }

  return `#${toHexByte(r * 255)}${toHexByte(g * 255)}${toHexByte(b * 255)}`
}

function shiftHexToSparkControl(hex, hue, saturationPercent) {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const hsl = rgbToHsl(rgb)
  return hslToHex({
    h: Number(hue),
    s: clamp(hsl.s * (Number(saturationPercent) / 100), 0.02, 0.98),
    l: hsl.l,
  })
}

// Color-picker helpers: a picked color contributes its hue (full range) and
// saturation (callers clamp to the safe band); its lightness is ignored because
// the calibrated palette keeps each role's lightness.
export function hexToHueSaturation(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return { hue: 120, saturation: 100 }
  const hsl = rgbToHsl(rgb)
  return { hue: Math.round(((hsl.h % 360) + 360) % 360), saturation: Math.round(hsl.s * 100) }
}

// A representative swatch color for a hue + saturation, at mid lightness, used to
// seed the color picker.
export function hueSaturationToHex(hue, saturation) {
  return hslToHex({ h: Number(hue), s: clamp(Number(saturation) / 100, 0.02, 0.98), l: 0.5 })
}

// The recolor turns hue in OKLCH, so the Forge delta MUST be measured in OKLCH
// too (mixing hue spaces sends green → purple). The transform: turn every color
// by the OKLCH-hue gap between the picked color and the theme's primary (spark)
// color, and scale chroma by the picked saturation. Single source of truth for
// the UIs and tests.
export function forgeTransform(pickedHex, sparkHex, saturationPercent = 100) {
  const picked = oklchHueDeg(pickedHex)
  const spark = oklchHueDeg(sparkHex)
  const hueDelta = picked == null || spark == null ? 0 : picked - spark
  // `primaryHue` anchors the even syntax-hue spread; `hueDelta` tints the chrome.
  return { hueDelta, chromaScale: clamp(Number(saturationPercent) / 100, 0.5, 1.2), primaryHue: picked }
}

// The hero comparison layers consume these four properties as one atomic
// surface state. Keeping the mapping here prevents motion cleanup from
// accidentally dropping only the light half of the preview.
export function forgeSurfaceVars(tokens) {
  return {
    '--pick-surface': tokens?.dark?.bg || '',
    '--pick-ink': tokens?.dark?.fg || '',
    '--compare-surface': tokens?.light?.bg || '',
    '--compare-ink': tokens?.light?.fg || '',
  }
}

export function getDefaultSparkHue(foundation) {
  const baseDark = foundation?.families?.spark?.tones?.base?.dark
  const rgb = hexToRgb(baseDark)
  if (!rgb) return 120
  return Math.round(rgbToHsl(rgb).h)
}

export function buildSparkFoundationOverride(foundation, { hue, saturation }) {
  const next = structuredClone(foundation)
  const spark = next?.families?.spark
  if (!spark?.tones || typeof spark.tones !== 'object') {
    throw new Error('Theme Forge source is missing foundation.families.spark.tones')
  }

  for (const tone of Object.values(spark.tones)) {
    if (!tone || typeof tone !== 'object') continue
    for (const variantId of Object.keys(tone)) {
      tone[variantId] = shiftHexToSparkControl(tone[variantId], hue, saturation)
    }
  }

  return next
}

function esc(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function lineText(line) {
  return line.map(([text]) => text).join('')
}

function variantTokens(maps, variantId) {
  return {
    ...(maps?.tokenSets?.[variantId] || {}),
    ...(maps?.web?.[variantId] || {}),
  }
}

function token(tokensByVariant, variantId, key) {
  const tokens = tokensByVariant[variantId] || {}
  if (key === 'fn') return tokens.fn || tokens.function || '#8fc06b'
  return tokens[key] || '#8f897e'
}

function renderPane({ tokensByVariant, variantId, x, y, width, height, label, qualityLabel, showDots }) {
  const tokens = tokensByVariant[variantId] || {}
  const barH = 40
  const statusH = 30
  const gutterW = 42
  const baseY = y + barH + 30
  const lineHeight = 25.5
  const fontSize = 14
  const charW = 8.4
  const activeIdx = 5
  const codeX = x + gutterW + 12
  let svg = ''
  const add = (line) => { svg += `${line}\n` }
  const tk = (role) => token(tokensByVariant, variantId, role)

  add(`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${tokens.bg || '#111410'}"/>`)
  add(`<rect x="${x}" y="${y}" width="${width}" height="${barH}" fill="${tokens.shellBand || tokens.shellRaised || '#1b2119'}"/>`)

  let tabX = x + 20
  if (showDots) {
    add(`<circle cx="${x + 22}" cy="${y + 20}" r="5.5" fill="${tokens.terminalRed || '#cf7d6a'}"/>`)
    add(`<circle cx="${x + 40}" cy="${y + 20}" r="5.5" fill="${tokens.terminalYellow || '#c5aa62'}"/>`)
    add(`<circle cx="${x + 58}" cy="${y + 20}" r="5.5" fill="${tokens.terminalGreen || '#8aa66a'}"/>`)
    tabX = x + 80
  }

  add(`<rect x="${tabX}" y="${y + 8}" width="128" height="${barH - 8}" rx="7" fill="${tokens.bg || '#111410'}"/>`)
  add(`<circle cx="${tabX + 16}" cy="${y + 21}" r="3.5" fill="${tk('fn')}"/>`)
  add(`<text x="${tabX + 28}" y="${y + 25}" font-size="12.5" font-family="${MONO}" fill="${tokens.fg || '#e5dfd4'}">palette.ts</text>`)
  add(`<rect x="${x}" y="${y + barH}" width="${gutterW}" height="${height - barH}" fill="${tokens.lineBg || '#202720'}" fill-opacity="0.45"/>`)
  add(`<rect x="${x}" y="${baseY + activeIdx * lineHeight - 17}" width="${width}" height="${lineHeight}" fill="${tokens.lineBg || '#202720'}"/>`)

  SAMPLE_LINES.forEach((line, index) => {
    const ly = baseY + index * lineHeight
    add(`<text x="${x + gutterW - 10}" y="${ly}" text-anchor="end" font-size="11.5" font-family="${MONO}" fill="${index === activeIdx ? (tokens.guideInk || tokens.fg || '#e5dfd4') : (tokens.lineNo || '#756f66')}">${index + 1}</text>`)
    let inline = ''
    for (const [text, role] of line) {
      inline += `<tspan fill="${role ? tk(role) : (tokens.variable || '#c8bfae')}">${esc(text)}</tspan>`
    }
    add(`<text x="${codeX}" y="${ly}" xml:space="preserve" font-size="${fontSize}" font-family="${MONO}">${inline}</text>`)
  })

  const cursorX = codeX + lineText(SAMPLE_LINES[activeIdx]).length * charW
  add(`<rect x="${cursorX.toFixed(1)}" y="${baseY + activeIdx * lineHeight - 13}" width="2" height="18" fill="${tokens.cursor || tk('keyword')}"/>`)
  add(`<rect x="${x}" y="${y + height - statusH}" width="${width}" height="${statusH}" fill="${tokens.status || tk('keyword')}"/>`)
  add(`<text x="${x + 16}" y="${y + height - 10}" font-size="12" font-weight="600" font-family="${MONO}" fill="${tokens.onStatus || tokens.onAccent || '#141414'}">Forge - ${esc(label)}</text>`)
  add(`<text x="${x + width - 16}" y="${y + height - 10}" text-anchor="end" font-size="12" font-family="${MONO}" fill="${tokens.onStatus || tokens.onAccent || '#141414'}" opacity="0.9">${esc(qualityLabel)}</text>`)

  return svg
}

function renderRibbon({ tokensByVariant, variantId, x, y, width }) {
  const segment = width / RIBBON_ROLES.length
  return RIBBON_ROLES.map((role, index) => {
    const edge = index === 0 || index === RIBBON_ROLES.length - 1
    return `<rect x="${(x + index * segment).toFixed(1)}" y="${y}" width="${(segment - 4).toFixed(1)}" height="8" rx="${edge ? 3 : 1}" fill="${token(tokensByVariant, variantId, role)}"/>`
  }).join('\n')
}

export function renderThemeForgeSplitSvg({ maps, labels = {}, title = 'Theme Forge', qualityLabel = 'CONTRACT OK' }) {
  const tokensByVariant = {
    dark: variantTokens(maps, 'dark'),
    light: variantTokens(maps, 'light'),
  }
  const width = 1240
  const height = 620
  const x = 80
  const y = 92
  const paneWidth = 1080
  const paneHeight = 430
  const centerX = x + paneWidth / 2
  const ribbonY = y + paneHeight + 26
  let svg = ''
  const add = (line) => { svg += `${line}\n` }

  add(`<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" font-family="${SANS}" role="img" aria-label="${esc(title)}">`)
  add(`<defs>
  <linearGradient id="forgeBg" x1="0" y1="0" x2="0.5" y2="1"><stop offset="0%" stop-color="${tokensByVariant.dark.bg || '#0d0e10'}"/><stop offset="100%" stop-color="${tokensByVariant.light.shellBand || '#e5decc'}"/></linearGradient>
  <filter id="forgeWinShadow" x="-15%" y="-15%" width="130%" height="150%"><feDropShadow dx="0" dy="20" stdDeviation="34" flood-color="#000000" flood-opacity="0.42"/></filter>
  <clipPath id="forgeWinRound"><rect x="${x}" y="${y}" width="${paneWidth}" height="${paneHeight}" rx="8"/></clipPath>
</defs>`)
  add(`<rect width="${width}" height="${height}" fill="url(#forgeBg)"/>`)
  add(`<rect width="${width}" height="${height}" fill="${tokensByVariant.dark.bg || '#10120f'}" opacity="0.72"/>`)
  add(`<text x="${x}" y="62" font-size="24" font-weight="700" fill="${tokensByVariant.dark.fg || '#ece6da'}">${esc(title)}</text>`)
  add(`<text x="${x + paneWidth}" y="62" text-anchor="end" font-size="13" font-family="${MONO}" fill="${tokensByVariant.dark.shellSubtle || tokensByVariant.dark.lineNo || '#7a7468'}">live model / browser worker</text>`)
  add(`<rect x="${x}" y="${y}" width="${paneWidth}" height="${paneHeight}" rx="8" fill="${tokensByVariant.dark.shellRaised || '#1b1d1a'}" filter="url(#forgeWinShadow)"/>`)
  add(`<g clip-path="url(#forgeWinRound)">`)
  add(renderPane({ tokensByVariant, variantId: 'dark', x, y, width: paneWidth / 2, height: paneHeight, label: labels.dark || 'dark', qualityLabel, showDots: true }))
  add(renderPane({ tokensByVariant, variantId: 'light', x: centerX, y, width: paneWidth / 2, height: paneHeight, label: labels.light || 'light', qualityLabel, showDots: false }))
  add(`</g>`)
  add(`<line x1="${centerX}" y1="${y}" x2="${centerX}" y2="${y + paneHeight}" stroke="${tokensByVariant.dark.border || '#000000'}" stroke-opacity="0.34" stroke-width="1.5"/>`)
  add(`<rect x="${x}" y="${y}" width="${paneWidth}" height="${paneHeight}" rx="8" fill="none" stroke="${tokensByVariant.light.border || '#ffffff'}" stroke-opacity="0.18"/>`)
  add(renderRibbon({ tokensByVariant, variantId: 'dark', x, y: ribbonY, width: paneWidth / 2 - 20 }))
  add(renderRibbon({ tokensByVariant, variantId: 'light', x: centerX + 20, y: ribbonY, width: paneWidth / 2 - 20 }))
  add(`<text x="${width / 2}" y="${ribbonY + 38}" text-anchor="middle" font-size="12" fill="${tokensByVariant.dark.shellMuted || '#8f897e'}">same file / dark and light maps returned by the browser engine</text>`)
  add(`</svg>`)
  return svg
}
