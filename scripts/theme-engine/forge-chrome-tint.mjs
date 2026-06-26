// Chrome-follows-accent tint for Theme Forge. The VS Code chrome (status bar,
// side/activity/title bars, editor surface) is seeded from fixed literals that do
// not derive from the foundation, so the whole-palette rotation never reaches it.
// This pass nudges the STRUCTURAL chrome colors toward the picked hue at a capped
// saturation while preserving each color's lightness (so contrast is preserved),
// and leaves FUNCTIONAL colors (terminal ANSI, errors, git, diff) untouched.
//
// Pure colour math, no fs — safe to bundle into the browser worker. With no tint
// the inputs are returned unchanged, so default Forge output stays byte-identical.

const NEUTRAL_SAT_FLOOR = 0.06
const NEUTRAL_SAT_CAP = 0.2

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function parseHex(hex) {
  if (typeof hex !== 'string') return null
  const m = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(hex.trim())
  if (!m) return null
  const raw = m[1]
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
    alpha: m[2] ? m[2].toLowerCase() : '',
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
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0)
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
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

function toByte(value) {
  return Math.round(clamp(value, 0, 1) * 255)
    .toString(16)
    .padStart(2, '0')
}

function hslToHex({ h, s, l }, alpha) {
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
  return `#${toByte(r)}${toByte(g)}${toByte(b)}${alpha || ''}`
}

const CONTRAST_FLOOR = 4.5

function channelLuminance(value) {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function relLuminance(hex) {
  const rgb = parseHex(hex)
  if (!rgb) return 0
  return 0.2126 * channelLuminance(rgb.r) + 0.7152 * channelLuminance(rgb.g) + 0.0722 * channelLuminance(rgb.b)
}

function contrast(a, b) {
  const la = relLuminance(a)
  const lb = relLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

// Set the hue to the target, hold lightness, and bring saturation into a small
// band — enough to read as tinted, capped so it stays tasteful.
function tintHex(hex, hue) {
  const rgb = parseHex(hex)
  if (!rgb) return hex
  const hsl = rgbToHsl(rgb)
  const s = clamp(Math.max(hsl.s, NEUTRAL_SAT_FLOOR), 0, NEUTRAL_SAT_CAP)
  return hslToHex({ h: Number(hue), s, l: hsl.l }, rgb.alpha)
}

// Tint a background, then guarantee it still reads against its paired foreground:
// preserving HSL lightness does NOT preserve WCAG luminance across hues (a blue
// and a gold at the same lightness differ a lot), so nudge the lightness away
// from the foreground until contrast clears the floor.
function tintBackgroundAgainst(hex, fgHex, hue) {
  let tinted = tintHex(hex, hue)
  if (!fgHex || contrast(tinted, fgHex) >= CONTRAST_FLOOR) return tinted
  const rgb = parseHex(tinted)
  if (!rgb) return tinted
  const hsl = rgbToHsl(rgb)
  const direction = relLuminance(tinted) >= relLuminance(fgHex) ? 1 : -1
  for (let i = 0; i < 100 && contrast(tinted, fgHex) < CONTRAST_FLOOR; i += 1) {
    hsl.l = clamp(hsl.l + direction * 0.01, 0, 1)
    tinted = hslToHex(hsl, rgb.alpha)
  }
  return tinted
}

// Workbench keys are tinted when they name a structural surface (background or
// border) and are NOT a functional color that must keep its own hue.
const FUNCTIONAL_KEY = /terminal|error|warning|info\b|git|diff|merge|debug|chart|success|added|removed|modified|deleted|find|testing|problems/i
const STRUCTURAL_KEY = /background|border/i

export function shouldTintWorkbenchKey(key) {
  return STRUCTURAL_KEY.test(key) && !FUNCTIONAL_KEY.test(key)
}

// Preview (web token) chrome surfaces the SVG draws, excluding syntax/functional.
export const PREVIEW_TINT_TOKENS = [
  'bg',
  'lineBg',
  'shellRaised',
  'shellBand',
  'sidebar',
  'border',
  'status',
  'selection',
  'navActiveFill',
  'navInactiveFill',
  'guide',
  'guideActive',
  'whitespace',
  'cursor',
]

export function tintWorkbenchColors(colors, hue) {
  if (hue == null || !colors || typeof colors !== 'object') return colors
  const next = { ...colors }
  for (const key of Object.keys(next)) {
    if (!shouldTintWorkbenchKey(key)) continue
    // A background gets contrast-checked against its sibling foreground; borders
    // and other surfaces have no text to read, so they tint plainly.
    const fgKey = key.replace(/\.background$/, '.foreground')
    const fg = fgKey !== key ? colors[fgKey] : null
    next[key] = fg ? tintBackgroundAgainst(next[key], fg, hue) : tintHex(next[key], hue)
  }
  return next
}

// Preview tokens the SVG pairs with an ink color (the status bar uses onStatus).
const PREVIEW_FG_FOR = { status: 'onStatus' }

export function tintPreviewTokens(tokens, hue) {
  if (hue == null || !tokens || typeof tokens !== 'object') return tokens
  const next = { ...tokens }
  for (const key of PREVIEW_TINT_TOKENS) {
    if (!(key in next)) continue
    const fg = PREVIEW_FG_FOR[key] ? tokens[PREVIEW_FG_FOR[key]] : null
    next[key] = fg ? tintBackgroundAgainst(next[key], fg, hue) : tintHex(next[key], hue)
  }
  return next
}
