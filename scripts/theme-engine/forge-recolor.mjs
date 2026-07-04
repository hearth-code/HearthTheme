// Theme Forge recolor: "one primary color moves the whole theme", with the
// SYNTAX roles spread evenly around the wheel for maximum, regular separation.
//
// Moss deliberately clusters its syntax hues in ~half the wheel (keyword/string/
// variable within ~25°, function/property 2° apart), distinguishing roles by
// lightness/chroma — calm, but it reads as "a few hues" once recolored. So:
//   • Chrome (workbench surfaces) turns toward the picked hue as one tint.
//   • Syntax colors keep each color's OK lightness + chroma but get their hues
//     RE-SPACED evenly around the full wheel (keyword anchored at the picked
//     hue), so every role becomes a distinct, regularly-spaced color.
// All hue work is in OKLab (perceptually uniform; an equal turn preserves ΔE and
// looks even at every hue). Functional colors (terminal/errors/git) are left
// alone, and an identity transform returns the theme untouched (default = Moss).

import {
  contrastRatio,
  hexToRgb,
  luminance,
  mixHex,
  normalizeHex,
  oklchHueDeg,
  rgbToOklab,
  rotateHexOklch,
} from '../color-utils.mjs'

export const CHROME_CONTRAST_FLOOR = 4.5
// Below this OK chroma a color is treated as neutral (grays/near-foreground inks)
// and left in place — spreading a gray's hue does nothing and would just add noise.
const NEUTRAL_CHROMA = 0.04

const FUNCTIONAL_KEY = /terminal|error|warning|info\b|git|diff|merge|debug|chart|success|added|removed|modified|deleted|find|testing|problems/i

// Exported so the quality pass knows whether the chrome was actually recolored:
// recolorChrome's contrast promise only covers chrome it touched — identity leaves
// the shipped chrome (already covered by its own audited contract) untouched.
export const isIdentityTransform = ({ hueDelta = 0, chromaScale = 1 } = {}) => hueDelta === 0 && chromaScale === 1

const isIdentity = isIdentityTransform

function okChroma(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  const [, a, b] = rgbToOklab(rgb)
  return Math.hypot(a, b)
}

function enforceBgContrast(bgHex, fgHex) {
  if (!fgHex || contrastRatio(bgHex, fgHex) >= CHROME_CONTRAST_FLOOR) return bgHex
  const toward = luminance(bgHex) >= luminance(fgHex) ? '#ffffff' : '#000000'
  let out = bgHex
  for (let t = 0.05; t <= 0.85 && contrastRatio(out, fgHex) < CHROME_CONTRAST_FLOOR; t += 0.05) {
    out = mixHex(bgHex, toward, t)
  }
  return out
}

// Verification twin of recolorChrome's enforcement rule: every non-functional
// background↔foreground sibling pair must hold the chrome contrast floor. Returns
// the violations (empty == verified) so the Forge quality report can fail closed
// on the exact rule the recolor promises.
export function collectChromeContrastIssues(theme) {
  const issues = []
  const colors = theme?.colors || {}
  for (const [key, value] of Object.entries(colors)) {
    if (!key.endsWith('.background') || FUNCTIONAL_KEY.test(key) || typeof value !== 'string') continue
    const fgKey = key.replace(/\.background$/, '.foreground')
    const fg = colors[fgKey]
    if (typeof fg !== 'string') continue
    const ratio = contrastRatio(value, fg)
    if (ratio < CHROME_CONTRAST_FLOOR) {
      issues.push({ background: key, foreground: fgKey, contrast: Number(ratio.toFixed(2)), min: CHROME_CONTRAST_FLOOR })
    }
  }
  return issues
}

// Recolor the editor chrome (workbench surfaces) toward the picked hue as one
// tint, holding lightness, and re-assert text contrast on background↔foreground.
export function recolorChrome(theme, transform = {}) {
  if (!theme || isIdentity(transform)) return theme
  const colors = {}
  for (const [key, value] of Object.entries(theme.colors || {})) {
    colors[key] =
      FUNCTIONAL_KEY.test(key) || typeof value !== 'string'
        ? value
        : rotateHexOklch(value, transform.hueDelta, transform.chromaScale ?? 1)
  }
  for (const key of Object.keys(colors)) {
    if (!key.endsWith('.background')) continue
    const fgKey = key.replace(/\.background$/, '.foreground')
    if (colors[fgKey]) colors[key] = enforceBgContrast(colors[key], colors[fgKey])
  }
  return { ...theme, colors }
}

function keywordColor(theme) {
  const entry = theme.semanticTokenColors?.keyword
  const fromSemantic = typeof entry === 'string' ? entry : entry?.foreground
  if (fromSemantic) return normalizeHex(fromSemantic)
  const rule = (theme.tokenColors || []).find((r) => JSON.stringify(r.scope).includes('keyword'))
  return rule?.settings?.foreground ? normalizeHex(rule.settings.foreground) : null
}

// Re-space the syntax palette evenly around the wheel. Each DISTINCT chromatic
// color becomes a regularly-spaced hue (keeping its lightness + chroma); the
// keyword color is anchored at `primaryHueDeg`. Identical-by-design colors share
// one slot (so they stay identical). Neutrals and functional tokens are untouched.
export function spreadThemeHues(theme, primaryHueDeg) {
  if (!theme || primaryHueDeg == null) return theme

  const chromatic = new Map() // normHex -> hue (spread evenly)
  const neutral = new Map() // normHex -> hue (faint-tinted toward primary)
  const consider = (hex) => {
    if (typeof hex !== 'string') return
    const norm = normalizeHex(hex)
    if (!norm || chromatic.has(norm) || neutral.has(norm)) return
    if (okChroma(norm) >= NEUTRAL_CHROMA) chromatic.set(norm, oklchHueDeg(norm))
    else neutral.set(norm, oklchHueDeg(norm))
  }
  for (const rule of theme.tokenColors || []) consider(rule?.settings?.foreground)
  for (const value of Object.values(theme.semanticTokenColors || {})) {
    consider(typeof value === 'string' ? value : value?.foreground)
  }

  const ordered = [...chromatic.entries()].map(([hex, hue]) => ({ hex, hue })).sort((a, b) => a.hue - b.hue)
  const n = ordered.length
  if (n === 0) return theme

  const anchorHex = keywordColor(theme)
  let anchor = ordered.findIndex((c) => c.hex === anchorHex)
  if (anchor < 0) anchor = 0

  const remap = new Map()
  for (let i = 0; i < n; i += 1) {
    const targetHue = (((primaryHueDeg + (i - anchor) * (360 / n)) % 360) + 360) % 360
    remap.set(ordered[i].hex, rotateHexOklch(ordered[i].hex, targetHue - ordered[i].hue, 1))
  }
  // Near-neutral inks (variables, namespaces) keep their low chroma but take a
  // faint tint toward the primary so they belong to the theme instead of staying
  // warm Moss.
  for (const [hex, hue] of neutral) remap.set(hex, rotateHexOklch(hex, primaryHueDeg - hue, 1))
  const map = (hex) => {
    if (typeof hex !== 'string') return hex
    const norm = normalizeHex(hex)
    return norm && remap.has(norm) ? remap.get(norm) : hex
  }

  const tokenColors = (theme.tokenColors || []).map((rule) => {
    const fg = rule?.settings?.foreground
    return typeof fg === 'string' ? { ...rule, settings: { ...rule.settings, foreground: map(fg) } } : rule
  })
  const semanticTokenColors = {}
  for (const [selector, value] of Object.entries(theme.semanticTokenColors || {})) {
    if (typeof value === 'string') semanticTokenColors[selector] = map(value)
    else if (value && typeof value === 'object' && typeof value.foreground === 'string') {
      semanticTokenColors[selector] = { ...value, foreground: map(value.foreground) }
    } else semanticTokenColors[selector] = value
  }

  return { ...theme, tokenColors, semanticTokenColors }
}
