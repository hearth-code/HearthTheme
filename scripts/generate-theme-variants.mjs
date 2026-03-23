import { existsSync, readFileSync, writeFileSync } from 'fs'
import { pathToFileURL } from 'url'
import { loadColorSystemTuning, loadColorSystemVariants, loadRoleAdapters, loadSemanticPalette } from './color-system.mjs'

const VARIANT_SPEC = loadColorSystemVariants()
const SEMANTIC_PALETTE = loadSemanticPalette()
const READABILITY_ROLE_DEFS = loadRoleAdapters()
const COLOR_SYSTEM_TUNING = loadColorSystemTuning()

const DARK_THEME_SOURCE_PATH = VARIANT_SPEC.baseSourcePath
const DARK_THEME_OUTPUT_PATH = VARIANT_SPEC.variants.find((variant) => variant.id === 'dark')?.outputPath ?? 'themes/hearth-dark.json'
const TEMPLATE_DARK_PATH = VARIANT_SPEC.baseTemplatePath
const VARIANT_CONFIG = VARIANT_SPEC.variants
  .filter((variant) => variant.mode !== 'source')
  .map((variant) => ({
    id: variant.id,
    name: variant.name,
    type: variant.type,
    templatePath: variant.templatePath,
    outputPath: variant.outputPath,
  }))

const REF_BG_KEY = 'editor.background'
const REF_FG_KEY = 'editor.foreground'

const LIGHT_ROLE_CALIBRATION = {
  comment: {
    bgPow: 0.98,
    wBg: 0.58,
    wFg: 0.26,
    wDrift: 0.16,
    minContrast: 2.2,
    minL: 44,
    maxL: 84,
    minScale: 0.82,
    maxScale: 1.3,
    minFgContrast: 2.8,
  },
  keyword: {
    bgPow: 0.7,
    wBg: 0.24,
    wFg: 0.5,
    wDrift: 0.26,
    minContrast: 3.3,
    minL: 34,
    maxL: 78,
    minScale: 0.86,
    maxScale: 1.9,
    targetL: 48,
    wL: 0.18,
    minFgContrast: 2.2,
  },
  operator: {
    bgPow: 0.9,
    wBg: 0.46,
    wFg: 0.38,
    wDrift: 0.16,
    minContrast: 3.3,
    minL: 30,
    maxL: 72,
    minScale: 0.8,
    maxScale: 1.35,
    minFgContrast: 2.0,
  },
  function: {
    bgPow: 0.62,
    wBg: 0.2,
    wFg: 0.54,
    wDrift: 0.26,
    minContrast: 3.4,
    minL: 32,
    maxL: 74,
    minScale: 0.9,
    maxScale: 2.0,
    targetL: 45,
    wL: 0.22,
    minFgContrast: 2.4,
  },
  method: {
    bgPow: 0.52,
    wBg: 0.14,
    wFg: 0.58,
    wDrift: 0.28,
    minContrast: 3.2,
    minL: 38,
    maxL: 84,
    minScale: 1.0,
    maxScale: 2.35,
    targetL: 53,
    wL: 0.26,
    minFgContrast: 2.7,
  },
  property: {
    bgPow: 0.64,
    wBg: 0.2,
    wFg: 0.54,
    wDrift: 0.26,
    minContrast: 3.3,
    minL: 34,
    maxL: 80,
    minScale: 0.92,
    maxScale: 2.0,
    targetL: 48,
    wL: 0.2,
    minFgContrast: 2.4,
  },
  string: {
    bgPow: 0.66,
    wBg: 0.2,
    wFg: 0.54,
    wDrift: 0.26,
    minContrast: 3.3,
    minL: 34,
    maxL: 78,
    minScale: 0.92,
    maxScale: 1.9,
    targetL: 47,
    wL: 0.2,
    minFgContrast: 2.3,
  },
  number: {
    bgPow: 0.66,
    wBg: 0.22,
    wFg: 0.52,
    wDrift: 0.26,
    minContrast: 3.4,
    minL: 34,
    maxL: 78,
    minScale: 0.9,
    maxScale: 2.0,
    targetL: 50,
    wL: 0.2,
    minFgContrast: 2.3,
  },
  type: {
    bgPow: 0.64,
    wBg: 0.2,
    wFg: 0.54,
    wDrift: 0.26,
    minContrast: 3.4,
    minL: 34,
    maxL: 80,
    minScale: 0.94,
    maxScale: 2.0,
    targetL: 49,
    wL: 0.2,
    minFgContrast: 2.3,
  },
  variable: {
    bgPow: 0.9,
    wBg: 0.44,
    wFg: 0.34,
    wDrift: 0.22,
    minContrast: 5.0,
    minL: 20,
    maxL: 56,
    minScale: 0.8,
    maxScale: 1.5,
    targetL: 36,
    wL: 0.14,
    minFgContrast: 1.25,
  },
  parameter: {
    bgPow: 0.88,
    wBg: 0.42,
    wFg: 0.36,
    wDrift: 0.22,
    minContrast: 4.8,
    minL: 22,
    maxL: 60,
    minScale: 0.82,
    maxScale: 1.5,
    targetL: 38,
    wL: 0.14,
    minFgContrast: 1.3,
  },
}

const DEFAULT_LIGHT_CALIBRATION = {
  bgPow: 0.74,
  fgPow: 1.0,
  wBg: 0.24,
  wFg: 0.50,
  wDrift: 0.26,
  minContrast: 3.2,
  minL: 30,
  maxL: 80,
  minScale: 0.88,
  maxScale: 2.0,
  targetL: 48,
  wL: 0.18,
  minFgContrast: 2.1,
}

const GLOBAL_SEPARATION_TARGET_DEFAULTS = {
  default: { median: 1.05, p25: 0.86, p10: 0.65 },
  light: { median: 1.28, p25: 1.03, p10: 0.75 },
  lightSoft: { median: 1.0, p25: 0.82, p10: 0.56 },
}
const GLOBAL_SEPARATION_TARGET_BY_VARIANT = {
  ...GLOBAL_SEPARATION_TARGET_DEFAULTS,
  ...(COLOR_SYSTEM_TUNING.globalSeparationTargetByVariant || {}),
}
const GLOBAL_SEPARATION_MAX_BOOST_ROUNDS = 6
const VARIANT_BOOST_PROFILE = {
  default: {
    maxNeededFactor: 1.45,
    maxBoostRounds: 3,
    roleBoostScale: 1,
    lightnessLiftScale: 1,
    maxChroma: null,
  },
  light: {
    maxNeededFactor: 1.55,
    maxBoostRounds: 6,
    roleBoostScale: 0.86,
    lightnessLiftScale: 1,
    maxChroma: null,
  },
  lightSoft: {
    maxNeededFactor: 1.16,
    maxBoostRounds: 4,
    roleBoostScale: 0.42,
    lightnessLiftScale: 0.35,
    maxChroma: 58,
  },
}

const LIGHT_COOL_ROLE_SOFTEN = {
  light: {
    factorByRole: {
      function: 0.92,
      method: 0.91,
      property: 0.94,
      type: 0.95,
    },
    maxChromaByRole: {
      function: 54,
      method: 51,
      property: 49,
      type: 45,
    },
  },
  lightSoft: {
    factorByRole: {
      function: 0.89,
      method: 0.88,
      property: 0.92,
      type: 0.93,
    },
    maxChromaByRole: {
      function: 50,
      method: 47,
      property: 45,
      type: 41,
    },
  },
}
const GLOBAL_SEPARATION_BASELINE_DELTA_E = 8

const LIGHT_POLARITY_ROLE_OPTIMIZATION = COLOR_SYSTEM_TUNING.lightPolarityRoleOptimization
const SOFT_ROLE_CHROMA_BUDGET = COLOR_SYSTEM_TUNING.softRoleChromaBudget

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, data) {
  const next = `${JSON.stringify(data, null, 4)}\n`
  if (existsSync(path)) {
    const prev = readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
    if (prev === next) return false
  }
  writeFileSync(path, next)
  return true
}

function normalizeHex(hex) {
  if (typeof hex !== 'string') return null
  const value = hex.trim().toLowerCase()
  if (/^#[0-9a-f]{3}$/.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
  }
  if (/^#[0-9a-f]{4}$/.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}${value[4]}${value[4]}`
  }
  if (/^#[0-9a-f]{6}$/.test(value) || /^#[0-9a-f]{8}$/.test(value)) {
    return value
  }
  return null
}

function hexToRgba(hex) {
  const normalized = normalizeHex(hex)
  if (!normalized) return null

  const raw = normalized.slice(1)
  if (raw.length === 6) {
    return {
      r: Number.parseInt(raw.slice(0, 2), 16),
      g: Number.parseInt(raw.slice(2, 4), 16),
      b: Number.parseInt(raw.slice(4, 6), 16),
      a: 255,
      hasAlpha: false,
    }
  }

  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
    a: Number.parseInt(raw.slice(6, 8), 16),
    hasAlpha: true,
  }
}

function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max)
}

function toHexByte(value) {
  return Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0')
}

function rgbaToHex({ r, g, b, a = 255, hasAlpha = false }) {
  const rgb = `${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`
  if (!hasAlpha) return `#${rgb}`
  return `#${rgb}${toHexByte(a)}`
}

function hexToRgb(hex) {
  const rgba = hexToRgba(hex)
  if (!rgba) return null
  return [rgba.r, rgba.g, rgba.b]
}

function toLinear(channel) {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function fromLinear(channel) {
  const c = clamp(channel, 0, 1)
  const value = c <= 0.0031308 ? 12.92 * c : 1.055 * (c ** (1 / 2.4)) - 0.055
  return value * 255
}

function rgbToXyz([r, g, b]) {
  const rl = toLinear(r)
  const gl = toLinear(g)
  const bl = toLinear(b)
  return [
    rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375,
    rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175,
    rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041,
  ]
}

function xyzToLab([x, y, z]) {
  const xr = x / 0.95047
  const yr = y / 1.0
  const zr = z / 1.08883

  const f = (t) => (t > 0.008856 ? t ** (1 / 3) : 7.787 * t + 16 / 116)
  const fx = f(xr)
  const fy = f(yr)
  const fz = f(zr)

  return [
    116 * fy - 16,
    500 * (fx - fy),
    200 * (fy - fz),
  ]
}

function labToXyz([l, a, b]) {
  const fy = (l + 16) / 116
  const fx = a / 500 + fy
  const fz = fy - b / 200

  const fInv = (t) => {
    const t3 = t ** 3
    return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787
  }

  const xr = fInv(fx)
  const yr = fInv(fy)
  const zr = fInv(fz)

  return [xr * 0.95047, yr * 1.0, zr * 1.08883]
}

function xyzToRgb([x, y, z]) {
  const rl = x * 3.2404542 + y * -1.5371385 + z * -0.4985314
  const gl = x * -0.969266 + y * 1.8760108 + z * 0.041556
  const bl = x * 0.0556434 + y * -0.2040259 + z * 1.0572252
  return [
    fromLinear(rl),
    fromLinear(gl),
    fromLinear(bl),
  ]
}

function luminance(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const [r, g, b] = rgb.map(toLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(a, b) {
  const l1 = luminance(a)
  const l2 = luminance(b)
  if (l1 == null || l2 == null) return null
  const hi = Math.max(l1, l2)
  const lo = Math.min(l1, l2)
  return (hi + 0.05) / (lo + 0.05)
}

function deltaE(hexA, hexB) {
  const rgbA = hexToRgb(hexA)
  const rgbB = hexToRgb(hexB)
  if (!rgbA || !rgbB) return null
  const [l1, a1, b1] = xyzToLab(rgbToXyz(rgbA))
  const [l2, a2, b2] = xyzToLab(rgbToXyz(rgbB))
  return Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2)
}

function rgbToHsl([r, g, b]) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255

  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min

  let h = 0
  const l = (max + min) / 2
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))

  if (delta !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6)
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2)
    else h = 60 * ((rn - gn) / delta + 4)
  }
  if (h < 0) h += 360

  return { h, s, l }
}

function hueDistance(a, b) {
  const diff = Math.abs(a - b)
  return Math.min(diff, 360 - diff)
}

function circularMean(angles) {
  if (!angles || angles.length === 0) return null
  const sum = angles.reduce(
    (acc, angle) => {
      const radians = (angle * Math.PI) / 180
      return {
        x: acc.x + Math.cos(radians),
        y: acc.y + Math.sin(radians),
      }
    },
    { x: 0, y: 0 }
  )
  if (sum.x === 0 && sum.y === 0) return null
  let mean = (Math.atan2(sum.y, sum.x) * 180) / Math.PI
  if (mean < 0) mean += 360
  return mean
}

function hexHue(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  return rgbToHsl(rgb).h
}

function labToLch([l, a, b]) {
  const c = Math.sqrt(a ** 2 + b ** 2)
  let h = Math.atan2(b, a) * (180 / Math.PI)
  if (h < 0) h += 360
  return [l, c, h]
}

function lchToLab([l, c, h]) {
  const radians = (h * Math.PI) / 180
  return [l, c * Math.cos(radians), c * Math.sin(radians)]
}

function labToHex(lab) {
  const [r, g, b] = xyzToRgb(labToXyz(lab))
  return rgbaToHex({ r, g, b, hasAlpha: false })
}

function scopeSignature(entry) {
  if (!entry?.scope) return ''
  const scopes = Array.isArray(entry.scope) ? entry.scope : [entry.scope]
  return scopes.map((scope) => String(scope).trim()).filter(Boolean).sort().join(' | ')
}

function buildScopeBuckets(entries) {
  const buckets = new Map()
  for (const entry of entries || []) {
    const signature = scopeSignature(entry)
    if (!buckets.has(signature)) buckets.set(signature, [])
    buckets.get(signature).push(entry)
  }
  return buckets
}

function takeFromBucket(buckets, signature) {
  const bucket = buckets.get(signature)
  if (!bucket || bucket.length === 0) return null
  return bucket.shift()
}

function resolveHexValue(value) {
  return normalizeHex(typeof value === 'string' ? value : null)
}

function resolveSemanticForeground(value) {
  if (typeof value === 'string') return resolveHexValue(value)
  if (value && typeof value === 'object') return resolveHexValue(value.foreground)
  return null
}

function applyLabDelta(currentHex, baseDarkHex, baseVariantHex) {
  const current = hexToRgba(currentHex)
  const baseDark = hexToRgba(baseDarkHex)
  const baseVariant = hexToRgba(baseVariantHex)
  if (!current || !baseDark || !baseVariant) {
    return resolveHexValue(baseVariantHex) ?? resolveHexValue(currentHex) ?? currentHex
  }

  if (
    current.r === baseDark.r &&
    current.g === baseDark.g &&
    current.b === baseDark.b &&
    current.a === baseDark.a &&
    current.hasAlpha === baseDark.hasAlpha
  ) {
    return rgbaToHex({
      r: baseVariant.r,
      g: baseVariant.g,
      b: baseVariant.b,
      a: baseVariant.a,
      hasAlpha: baseVariant.hasAlpha,
    })
  }

  const currentLab = xyzToLab(rgbToXyz([current.r, current.g, current.b]))
  const darkLab = xyzToLab(rgbToXyz([baseDark.r, baseDark.g, baseDark.b]))
  const variantLab = xyzToLab(rgbToXyz([baseVariant.r, baseVariant.g, baseVariant.b]))

  const outLab = [
    currentLab[0] + (variantLab[0] - darkLab[0]),
    currentLab[1] + (variantLab[1] - darkLab[1]),
    currentLab[2] + (variantLab[2] - darkLab[2]),
  ]

  const [r, g, b] = xyzToRgb(labToXyz(outLab))
  const hasAlpha = current.hasAlpha || baseDark.hasAlpha || baseVariant.hasAlpha
  const alphaDelta = baseVariant.a - baseDark.a
  const a = clamp(current.a + alphaDelta, 0, 255)

  return rgbaToHex({ r, g, b, a, hasAlpha })
}

function transformColors(currentDark, baselineDark, baselineVariant, warnings, variantId) {
  const output = {}
  const fallbackDark = resolveHexValue(baselineDark.colors?.[REF_BG_KEY])
  const fallbackVariant = resolveHexValue(baselineVariant.colors?.[REF_BG_KEY])

  for (const [key, value] of Object.entries(currentDark.colors || {})) {
    const currentHex = resolveHexValue(value)
    if (!currentHex) {
      output[key] = value
      continue
    }

    const baseDarkHex = resolveHexValue(baselineDark.colors?.[key]) ?? fallbackDark
    const baseVariantHex = resolveHexValue(baselineVariant.colors?.[key]) ?? fallbackVariant

    if (!baseDarkHex || !baseVariantHex) {
      output[key] = currentHex
      warnings.push(`${variantId}: fallback copy for color "${key}" (template delta unavailable)`)
      continue
    }

    output[key] = applyLabDelta(currentHex, baseDarkHex, baseVariantHex)
  }

  return output
}

function transformTokenColors(currentDark, baselineDark, baselineVariant, warnings, variantId) {
  const darkBuckets = buildScopeBuckets(baselineDark.tokenColors)
  const variantBuckets = buildScopeBuckets(baselineVariant.tokenColors)
  const fallbackDark = resolveHexValue(baselineDark.colors?.[REF_FG_KEY])
  const fallbackVariant = resolveHexValue(baselineVariant.colors?.[REF_FG_KEY])

  return (currentDark.tokenColors || []).map((entry, index) => {
    const outEntry = {
      ...entry,
      settings: entry.settings ? { ...entry.settings } : undefined,
    }

    const currentHex = resolveHexValue(entry?.settings?.foreground)
    if (!currentHex) return outEntry

    const signature = scopeSignature(entry)
    const darkTemplateEntry = takeFromBucket(darkBuckets, signature)
    const variantTemplateEntry = takeFromBucket(variantBuckets, signature)

    const baseDarkHex = resolveHexValue(darkTemplateEntry?.settings?.foreground) ?? fallbackDark
    const baseVariantHex = resolveHexValue(variantTemplateEntry?.settings?.foreground) ?? fallbackVariant

    if (!baseDarkHex || !baseVariantHex) {
      warnings.push(`${variantId}: fallback copy for token scope[${index}] "${signature}"`)
      outEntry.settings.foreground = currentHex
      return outEntry
    }

    outEntry.settings.foreground = applyLabDelta(currentHex, baseDarkHex, baseVariantHex)
    return outEntry
  })
}

function transformSemanticTokenColors(currentDark, baselineDark, baselineVariant, warnings, variantId) {
  const output = {}
  const currentSem = currentDark.semanticTokenColors || {}
  const baselineDarkSem = baselineDark.semanticTokenColors || {}
  const baselineVariantSem = baselineVariant.semanticTokenColors || {}
  const fallbackDark = resolveHexValue(baselineDark.colors?.[REF_FG_KEY])
  const fallbackVariant = resolveHexValue(baselineVariant.colors?.[REF_FG_KEY])

  for (const [key, value] of Object.entries(currentSem)) {
    const baseDark = baselineDarkSem[key]
    const baseVariant = baselineVariantSem[key]

    if (typeof value === 'string') {
      const currentHex = resolveHexValue(value)
      const baseDarkHex = resolveSemanticForeground(baseDark) ?? fallbackDark
      const baseVariantHex = resolveSemanticForeground(baseVariant) ?? fallbackVariant
      if (!currentHex || !baseDarkHex || !baseVariantHex) {
        warnings.push(`${variantId}: fallback copy for semantic "${key}"`)
        output[key] = value
      } else {
        output[key] = applyLabDelta(currentHex, baseDarkHex, baseVariantHex)
      }
      continue
    }

    if (!value || typeof value !== 'object') {
      output[key] = value
      continue
    }

    const next = { ...value }
    const currentHex = resolveHexValue(value.foreground)
    if (!currentHex) {
      output[key] = next
      continue
    }

    const baseDarkHex = resolveSemanticForeground(baseDark) ?? fallbackDark
    const baseVariantHex = resolveSemanticForeground(baseVariant) ?? fallbackVariant
    if (!baseDarkHex || !baseVariantHex) {
      warnings.push(`${variantId}: fallback copy for semantic "${key}.foreground"`)
      next.foreground = currentHex
    } else {
      next.foreground = applyLabDelta(currentHex, baseDarkHex, baseVariantHex)
    }

    output[key] = next
  }

  return output
}

function toScopes(entry) {
  if (!entry?.scope) return []
  return Array.isArray(entry.scope) ? entry.scope : [entry.scope]
}

function entryHasAnyScope(entry, scopes) {
  if (!scopes || scopes.length === 0) return false
  const entryScopes = toScopes(entry)
  return scopes.some((scope) => entryScopes.includes(scope))
}

function getTokenColorByScopes(theme, scopes) {
  if (!theme || !scopes || scopes.length === 0) return null
  for (const entry of theme.tokenColors || []) {
    if (!entryHasAnyScope(entry, scopes)) continue
    const color = resolveHexValue(entry?.settings?.foreground)
    if (color) return color
  }
  return null
}

function getSemanticColorByKeys(theme, semanticKeys) {
  if (!theme || !semanticKeys || semanticKeys.length === 0) return null
  for (const key of semanticKeys) {
    const value = theme.semanticTokenColors?.[key]
    const color = resolveSemanticForeground(value)
    if (color) return color
  }
  return null
}

function setSemanticColor(theme, semanticKey, nextHex) {
  if (!theme?.semanticTokenColors || !semanticKey || !nextHex) return
  const current = theme.semanticTokenColors[semanticKey]
  if (typeof current === 'string') {
    theme.semanticTokenColors[semanticKey] = nextHex
    return
  }
  if (current && typeof current === 'object' && current.foreground) {
    theme.semanticTokenColors[semanticKey] = {
      ...current,
      foreground: nextHex,
    }
  }
}

function applyRoleColorToTokenEntries(theme, scopes, nextHex) {
  if (!theme || !scopes || scopes.length === 0 || !nextHex) return
  for (const entry of theme.tokenColors || []) {
    if (!entryHasAnyScope(entry, scopes)) continue
    if (!entry.settings?.foreground) continue
    entry.settings = {
      ...entry.settings,
      foreground: nextHex,
    }
  }
}

function applySemanticPalette(theme, variantId, warnings) {
  if (!theme || !variantId) return
  for (const roleDef of READABILITY_ROLE_DEFS) {
    const roleId = roleDef.id
    if (!roleId) continue
    const color = SEMANTIC_PALETTE[roleId]?.[variantId]
    if (!color) {
      warnings.push(`${variantId}: semantic palette missing role "${roleId}"`)
      continue
    }
    applyRoleColorToTokenEntries(theme, roleDef.scopes || [], color)
    for (const semanticKey of roleDef.semanticKeys || []) {
      setSemanticColor(theme, semanticKey, color)
    }
  }
}

function getRoleDefById(roleId) {
  return READABILITY_ROLE_DEFS.find((role) => role.id === roleId) ?? null
}

function getRoleColorFromTheme(theme, roleDef) {
  if (!theme || !roleDef) return null
  return getTokenColorByScopes(theme, roleDef.scopes || []) ?? getSemanticColorByKeys(theme, roleDef.semanticKeys || [])
}

function evaluatePolarityCandidate(hex, bgColor, seedColor, anchorColors, guardColors, profile) {
  const contrast = contrastRatio(hex, bgColor)
  if (contrast == null || contrast < profile.minContrast) return null

  const bgHue = hexHue(bgColor)
  const candidateHue = hexHue(hex)
  if (bgHue == null || candidateHue == null) return null

  const bgHueDistance = hueDistance(candidateHue, bgHue)
  const anchorDeltaEValues = anchorColors
    .map((anchor) => deltaE(hex, anchor))
    .filter((value) => value != null)
  const minAnchorDeltaE = anchorDeltaEValues.length > 0 ? Math.min(...anchorDeltaEValues) : profile.minAnchorDeltaE
  const guardDeltaEValues = guardColors
    .map((guard) => deltaE(hex, guard))
    .filter((value) => value != null)
  const minGuardDeltaE = guardDeltaEValues.length > 0 ? Math.min(...guardDeltaEValues) : null
  const driftFromSeed = deltaE(hex, seedColor) ?? 0

  if (driftFromSeed > profile.maxDeltaEFromSeed) return null
  if (profile.minGuardDeltaE != null && minGuardDeltaE != null && minGuardDeltaE < profile.minGuardDeltaE) return null

  const bgScore = Math.min(bgHueDistance / profile.targetBgHueDistance, 1.4)
  const anchorScore = Math.min(minAnchorDeltaE / profile.minAnchorDeltaE, 1.4)
  const contrastScore = Math.min(contrast / profile.minContrast, 1.4)
  const driftPenalty = driftFromSeed / profile.maxDeltaEFromSeed
  const preferredHue = profile.preferredHue ?? null
  const preferredDistanceTarget = profile.targetPreferredHueDistance ?? null
  let preferredScore = 0
  if (preferredHue != null && preferredDistanceTarget) {
    const distance = hueDistance(candidateHue, preferredHue)
    preferredScore = 1 - Math.min(distance / preferredDistanceTarget, 1.4)
  }

  const score = bgScore * 0.42 + anchorScore * 0.32 + contrastScore * 0.18 + preferredScore * 0.08 - driftPenalty * 0.26
  return {
    score,
    contrast,
    bgHueDistance,
    minAnchorDeltaE,
    minGuardDeltaE,
    driftFromSeed,
  }
}

function optimizeRoleAgainstLightBackground(theme, roleId, profile, variantId, warnings) {
  const roleDef = getRoleDefById(roleId)
  if (!roleDef) return

  const seedColor = getRoleColorFromTheme(theme, roleDef)
  const bgColor = resolveHexValue(theme?.colors?.[REF_BG_KEY])
  if (!seedColor || !bgColor) return

  const anchorColors = (profile.anchorRoles || [])
    .map((anchorRoleId) => getRoleDefById(anchorRoleId))
    .filter(Boolean)
    .map((anchorRoleDef) => getRoleColorFromTheme(theme, anchorRoleDef))
    .filter(Boolean)
  const guardColors = (profile.guardRoles || [])
    .map((guardRoleId) => getRoleDefById(guardRoleId))
    .filter(Boolean)
    .map((guardRoleDef) => getRoleColorFromTheme(theme, guardRoleDef))
    .filter(Boolean)
  const preferredHueCandidates = (profile.preferredRoles || [])
    .map((preferredRoleId) => getRoleDefById(preferredRoleId))
    .filter(Boolean)
    .map((preferredRoleDef) => getRoleColorFromTheme(theme, preferredRoleDef))
    .filter(Boolean)
    .map((hex) => hexHue(hex))
    .filter((value) => value != null)
  const preferredHue = circularMean(preferredHueCandidates)
  const bgHue = hexHue(bgColor)
  const seedHue = hexHue(seedColor)
  const seedBgDistanceRaw = bgHue != null && seedHue != null ? hueDistance(seedHue, bgHue) : 0
  const seedAnchorDeltaEValues = anchorColors
    .map((anchor) => deltaE(seedColor, anchor))
    .filter((value) => value != null)
  const seedAnchorDeltaE = seedAnchorDeltaEValues.length > 0 ? Math.min(...seedAnchorDeltaEValues) : profile.minAnchorDeltaE
  const seedGuardDeltaEValues = guardColors
    .map((guard) => deltaE(seedColor, guard))
    .filter((value) => value != null)
  const seedGuardDeltaE = seedGuardDeltaEValues.length > 0 ? Math.min(...seedGuardDeltaEValues) : null
  const scoringProfile = {
    ...profile,
    preferredHue,
  }

  const seedLab = xyzToLab(rgbToXyz(hexToRgb(seedColor)))
  const [seedL, seedC] = labToLch(seedLab)

  const seedMetrics = evaluatePolarityCandidate(seedColor, bgColor, seedColor, anchorColors, guardColors, scoringProfile)
  let bestHex = seedColor
  let bestMetrics = seedMetrics

  for (let hue = 0; hue < 360; hue += 6) {
    for (const chromaScale of [0.88, 1.0, 1.12]) {
      for (const lightnessShift of [-6, -3, 0, 3, 6]) {
        const candidateL = clamp(seedL + lightnessShift, 8, 92)
        const candidateC = clamp(seedC * chromaScale, 4, 88)
        const candidateHex = labToHex(lchToLab([candidateL, candidateC, hue]))
        const metrics = evaluatePolarityCandidate(candidateHex, bgColor, seedColor, anchorColors, guardColors, scoringProfile)
        if (!metrics) continue
        if (!bestMetrics || metrics.score > bestMetrics.score) {
          bestHex = candidateHex
          bestMetrics = metrics
        }
      }
    }
  }

  if (!bestMetrics) return

  const seedBgDistance = seedMetrics?.bgHueDistance ?? seedBgDistanceRaw
  const seedScore = seedMetrics?.score ?? -Infinity
  const bgNeedsRecovery = seedBgDistance < profile.minBgHueDistance
  const anchorNeedsRecovery = seedAnchorDeltaE < profile.minAnchorDeltaE
  const guardNeedsRecovery = profile.minGuardDeltaE != null &&
    seedGuardDeltaE != null &&
    seedGuardDeltaE < profile.minGuardDeltaE
  const mustCompensate = bgNeedsRecovery || anchorNeedsRecovery || guardNeedsRecovery
  const improved = bestMetrics.score > seedScore + 0.04
  const hitHueTarget = bestMetrics.bgHueDistance >= profile.minBgHueDistance
  const hitAnchorTarget = bestMetrics.minAnchorDeltaE >= profile.minAnchorDeltaE
  const hitGuardTarget = profile.minGuardDeltaE == null ||
    bestMetrics.minGuardDeltaE == null ||
    bestMetrics.minGuardDeltaE >= profile.minGuardDeltaE
  const onlyWhenNeeded = profile.applyOnlyWhenCompensationNeeded === true
  const recoveryReasons = []
  if (bgNeedsRecovery) recoveryReasons.push('bg')
  if (anchorNeedsRecovery) recoveryReasons.push('anchor')
  if (guardNeedsRecovery) recoveryReasons.push('guard')
  const recoveryLabel = recoveryReasons.length > 0 ? recoveryReasons.join('+') : 'score'
  if (onlyWhenNeeded && !mustCompensate) return
  if (!mustCompensate && !improved) return
  if (mustCompensate && bestHex !== seedColor && (!hitHueTarget || !hitAnchorTarget || !hitGuardTarget)) return
  if (!mustCompensate && !hitHueTarget && bestHex !== seedColor) return
  if (bestHex === seedColor) return

  applyRoleColorToTokenEntries(theme, roleDef.scopes || [], bestHex)
  for (const semanticKey of roleDef.semanticKeys || []) {
    setSemanticColor(theme, semanticKey, bestHex)
  }

  warnings.push(
    `telemetry: ${variantId}: ${roleId} polarity compensation (${recoveryLabel}) hue-bg ${seedBgDistance.toFixed(1)} -> ${bestMetrics.bgHueDistance.toFixed(1)}, anchor deltaE ${seedAnchorDeltaE.toFixed(1)} -> ${bestMetrics.minAnchorDeltaE.toFixed(1)}, guard deltaE ${(seedGuardDeltaE ?? 0).toFixed(1)} -> ${(bestMetrics.minGuardDeltaE ?? 0).toFixed(1)}`
  )
}

function applyLightPolarityCompensation(theme, variantId, warnings) {
  const roleProfiles = LIGHT_POLARITY_ROLE_OPTIMIZATION[variantId]
  if (!roleProfiles) return

  for (const [roleId, profile] of Object.entries(roleProfiles)) {
    optimizeRoleAgainstLightBackground(theme, roleId, profile, variantId, warnings)
  }
}

function applySoftRoleChromaBudget(theme, variantId, warnings) {
  const budgets = SOFT_ROLE_CHROMA_BUDGET[variantId]
  if (!budgets) return

  for (const [roleId, tuning] of Object.entries(budgets)) {
    const roleDef = getRoleDefById(roleId)
    if (!roleDef) continue

    const current = getRoleColorFromTheme(theme, roleDef)
    if (!current) continue

    const next = scaleColorChroma(
      current,
      tuning.factor ?? 1,
      tuning.lightnessLift ?? 0,
      tuning.maxChroma ?? null
    )
    if (String(next).toLowerCase() === String(current).toLowerCase()) continue

    applyRoleColorToTokenEntries(theme, roleDef.scopes || [], next)
    for (const semanticKey of roleDef.semanticKeys || []) {
      setSemanticColor(theme, semanticKey, next)
    }

    const drift = deltaE(current, next) ?? 0
    warnings.push(`telemetry: ${variantId}: soft chroma budget adjusted ${roleId} by deltaE ${drift.toFixed(1)}`)
  }
}

function resolveRoleIdForTokenEntry(entry) {
  for (const roleDef of READABILITY_ROLE_DEFS) {
    if (entryHasAnyScope(entry, roleDef.scopes || [])) return roleDef.id
  }
  return null
}

function resolveRoleIdForSemanticKey(semanticKey) {
  for (const roleDef of READABILITY_ROLE_DEFS) {
    if ((roleDef.semanticKeys || []).includes(semanticKey)) return roleDef.id
  }
  return null
}

function getLightCalibrationProfile(roleId) {
  return {
    ...DEFAULT_LIGHT_CALIBRATION,
    ...(roleId ? LIGHT_ROLE_CALIBRATION[roleId] || {} : {}),
  }
}

function median(values) {
  if (!values || values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

function quantile(sortedValues, q) {
  if (!sortedValues || sortedValues.length === 0) return null
  const index = Math.floor(clamp(q, 0, 1) * (sortedValues.length - 1))
  return sortedValues[index]
}

function getGlobalSeparationTarget(variantId) {
  return GLOBAL_SEPARATION_TARGET_BY_VARIANT[variantId] ?? GLOBAL_SEPARATION_TARGET_BY_VARIANT.default
}

function getVariantBoostProfile(variantId) {
  return VARIANT_BOOST_PROFILE[variantId] ?? VARIANT_BOOST_PROFILE.default
}

function meetsGlobalSeparationTarget(stats, target) {
  if (!stats || !target) return true
  if (stats.pairCount === 0 || stats.medianRatio == null) return true
  if (target.median != null && stats.medianRatio < target.median) return false
  if (target.p25 != null && (stats.p25Ratio == null || stats.p25Ratio < target.p25)) return false
  if (target.p10 != null && (stats.p10Ratio == null || stats.p10Ratio < target.p10)) return false
  return true
}

function roleSeparationBoostFactor(roleId) {
  if (roleId == null) return 1.25
  if (roleId === 'comment') return 0.65
  if (roleId === 'operator') return 0.9
  if (roleId === 'variable' || roleId === 'parameter') return 0.75
  if (roleId === 'method') return 1.22
  if (roleId === 'function') return 1.02
  return 1.08
}

function roleSeparationLightnessLift(roleId) {
  if (roleId === 'method') return 3.2
  if (roleId === 'function') return -1.6
  if (roleId === 'property') return 0.8
  if (roleId === 'type') return 0.4
  return 0
}

function scaleColorChroma(hex, chromaFactor, lightnessLift = 0, maxChroma = null) {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const [l, a, b] = xyzToLab(rgbToXyz(rgb))
  let nextA = a * chromaFactor
  let nextB = b * chromaFactor
  if (maxChroma != null) {
    const chroma = Math.sqrt(nextA ** 2 + nextB ** 2)
    if (chroma > maxChroma && chroma > 0) {
      const scale = maxChroma / chroma
      nextA *= scale
      nextB *= scale
    }
  }
  const boosted = [clamp(l + lightnessLift, 0, 100), nextA, nextB]
  const [r, g, blue] = xyzToRgb(labToXyz(boosted))
  return rgbaToHex({ r, g, b: blue, hasAlpha: false })
}

function boostGlobalSeparation(theme, darkTheme, variantId, warnings, target, boostProfile, currentStats) {
  const initial = currentStats ?? computeGlobalSeparationRatio(theme, darkTheme)
  if (initial.pairCount === 0 || initial.medianRatio == null) return initial
  if (meetsGlobalSeparationTarget(initial, target)) return initial

  const medianDeficit = target?.median ? target.median / Math.max(initial.medianRatio, 0.2) : 1
  const p25Deficit = target?.p25 && initial.p25Ratio ? target.p25 / Math.max(initial.p25Ratio, 0.15) : 1
  const p10Deficit = target?.p10 && initial.p10Ratio ? target.p10 / Math.max(initial.p10Ratio, 0.1) : 1
  const deficit = Math.max(medianDeficit, p25Deficit, p10Deficit)
  const neededFactor = clamp(deficit, 1.03, boostProfile?.maxNeededFactor ?? 1.45)
  const roleBoostScale = boostProfile?.roleBoostScale ?? 1
  const lightnessLiftScale = boostProfile?.lightnessLiftScale ?? 1
  const maxChroma = boostProfile?.maxChroma ?? null

  for (const entry of theme.tokenColors || []) {
    const current = resolveHexValue(entry?.settings?.foreground)
    if (!current) continue
    const roleId = resolveRoleIdForTokenEntry(entry)
    const localFactor = 1 + (neededFactor - 1) * roleSeparationBoostFactor(roleId) * roleBoostScale
    const baseLift = roleSeparationLightnessLift(roleId)
    const lift = baseLift * lightnessLiftScale
    entry.settings = {
      ...entry.settings,
      foreground: scaleColorChroma(current, localFactor, lift, maxChroma),
    }
  }

  for (const [semanticKey, value] of Object.entries(theme.semanticTokenColors || {})) {
    const current = resolveSemanticForeground(value)
    if (!current) continue
    const roleId = resolveRoleIdForSemanticKey(semanticKey)
    const localFactor = 1 + (neededFactor - 1) * roleSeparationBoostFactor(roleId) * roleBoostScale
    const baseLift = roleSeparationLightnessLift(roleId)
    const lift = baseLift * lightnessLiftScale
    const boosted = scaleColorChroma(current, localFactor, lift, maxChroma)
    setSemanticColor(theme, semanticKey, boosted)
  }

  const next = computeGlobalSeparationRatio(theme, darkTheme)
  if (next.medianRatio != null) {
    warnings.push(
      `telemetry: ${variantId}: global separation boosted median ${initial.medianRatio.toFixed(2)} -> ${next.medianRatio.toFixed(2)}, p25 ${(initial.p25Ratio ?? 0).toFixed(2)} -> ${(next.p25Ratio ?? 0).toFixed(2)}`
    )
  }
  return next
}

function softenCoolRolesForLight(theme, variantId) {
  const tuning = LIGHT_COOL_ROLE_SOFTEN[variantId]
  if (!tuning) return

  for (const roleId of ['function', 'method', 'property', 'type']) {
    const roleDef = READABILITY_ROLE_DEFS.find((item) => item.id === roleId)
    if (!roleDef) continue

    const current = getTokenColorByScopes(theme, roleDef.scopes || []) ?? getSemanticColorByKeys(theme, roleDef.semanticKeys || [])
    if (!current) continue

    const factor = tuning.factorByRole?.[roleId] ?? 1
    const maxChroma = tuning.maxChromaByRole?.[roleId] ?? null
    const softened = scaleColorChroma(current, factor, 0, maxChroma)

    applyRoleColorToTokenEntries(theme, roleDef.scopes || [], softened)
    for (const semanticKey of roleDef.semanticKeys || []) {
      setSemanticColor(theme, semanticKey, softened)
    }
  }
}

function computeGlobalSeparationRatio(theme, darkTheme) {
  const colors = []
  const tokenCount = Math.min(theme?.tokenColors?.length || 0, darkTheme?.tokenColors?.length || 0)
  for (let i = 0; i < tokenCount; i += 1) {
    const darkColor = resolveHexValue(darkTheme.tokenColors[i]?.settings?.foreground)
    const variantColor = resolveHexValue(theme.tokenColors[i]?.settings?.foreground)
    if (!darkColor || !variantColor) continue
    colors.push({ darkColor, variantColor })
  }

  const ratios = []
  for (let i = 0; i < colors.length; i += 1) {
    for (let j = i + 1; j < colors.length; j += 1) {
      const darkDE = deltaE(colors[i].darkColor, colors[j].darkColor)
      const variantDE = deltaE(colors[i].variantColor, colors[j].variantColor)
      if (!darkDE || !variantDE) continue
      if (darkDE < GLOBAL_SEPARATION_BASELINE_DELTA_E) continue
      ratios.push(variantDE / darkDE)
    }
  }

  const sorted = [...ratios].sort((a, b) => a - b)

  return {
    pairCount: sorted.length,
    medianRatio: median(sorted),
    p10Ratio: quantile(sorted, 0.1),
    p25Ratio: quantile(sorted, 0.25),
    p75Ratio: quantile(sorted, 0.75),
  }
}

function calibrateTokenEntriesForLight(theme, darkTheme, warnings, variantId, bg, fg, darkBg, darkFg) {
  const tokenCount = Math.min(theme?.tokenColors?.length || 0, darkTheme?.tokenColors?.length || 0)
  for (let i = 0; i < tokenCount; i += 1) {
    const darkEntry = darkTheme.tokenColors[i]
    const variantEntry = theme.tokenColors[i]
    const darkColor = resolveHexValue(darkEntry?.settings?.foreground)
    const variantColor = resolveHexValue(variantEntry?.settings?.foreground)
    if (!darkColor || !variantColor) continue

    const roleId = resolveRoleIdForTokenEntry(darkEntry)
    const profile = getLightCalibrationProfile(roleId)
    const targetBgContrast = contrastRatio(darkColor, darkBg)
    const targetFgContrast = contrastRatio(darkColor, darkFg)
    if (!targetBgContrast || !targetFgContrast) continue

    const calibrated = calibrateColorForReadability(
      variantColor,
      bg,
      fg,
      targetBgContrast,
      targetFgContrast,
      profile
    )

    if (variantEntry?.settings?.foreground) {
      variantEntry.settings = {
        ...variantEntry.settings,
        foreground: calibrated,
      }
    }

    const drift = deltaE(variantColor, calibrated)
    if (drift != null && drift > 22) {
      warnings.push(`${variantId}: full-matrix calibration adjusted token[${i}] by deltaE ${drift.toFixed(1)}`)
    }
  }
}

function calibrateSemanticEntriesForLight(theme, darkTheme, warnings, variantId, bg, fg, darkBg, darkFg) {
  const semanticKeys = new Set([
    ...Object.keys(theme?.semanticTokenColors || {}),
    ...Object.keys(darkTheme?.semanticTokenColors || {}),
  ])

  for (const semanticKey of semanticKeys) {
    const darkColor = resolveSemanticForeground(darkTheme?.semanticTokenColors?.[semanticKey])
    const variantColor = resolveSemanticForeground(theme?.semanticTokenColors?.[semanticKey])
    if (!darkColor || !variantColor) continue

    const roleId = resolveRoleIdForSemanticKey(semanticKey)
    const profile = getLightCalibrationProfile(roleId)
    const targetBgContrast = contrastRatio(darkColor, darkBg)
    const targetFgContrast = contrastRatio(darkColor, darkFg)
    if (!targetBgContrast || !targetFgContrast) continue

    const calibrated = calibrateColorForReadability(
      variantColor,
      bg,
      fg,
      targetBgContrast,
      targetFgContrast,
      profile
    )

    setSemanticColor(theme, semanticKey, calibrated)

    const drift = deltaE(variantColor, calibrated)
    if (drift != null && drift > 22) {
      warnings.push(`${variantId}: full-matrix calibration adjusted semantic "${semanticKey}" by deltaE ${drift.toFixed(1)}`)
    }
  }
}

function ratioError(actual, target) {
  if (!actual || !target) return Infinity
  return Math.abs(Math.log(actual) - Math.log(target))
}

function calibrateColorForReadability(baseHex, bgHex, fgHex, targetBgContrast, targetFgContrast, options = {}) {
  const baseRgb = hexToRgb(baseHex)
  if (!baseRgb) return baseHex

  const baseLab = xyzToLab(rgbToXyz(baseRgb))
  let bestHex = baseHex
  let bestScore = Infinity
  const bgPow = options.bgPow ?? 1.0
  const fgPow = options.fgPow ?? 1.0
  const minContrast = options.minContrast ?? 3.0
  const minL = options.minL ?? 4
  const maxL = options.maxL ?? 96
  const minScale = options.minScale ?? 0.72
  const maxScale = options.maxScale ?? 1.7
  const wBg = options.wBg ?? 0.62
  const wFg = options.wFg ?? 0.30
  const wDrift = options.wDrift ?? 0.08
  const targetL = options.targetL ?? null
  const wL = options.wL ?? 0
  const minFgContrast = options.minFgContrast ?? 1.02

  const effectiveBgTarget = Math.max(minContrast, targetBgContrast ** bgPow)
  const effectiveFgTarget = Math.max(minFgContrast, targetFgContrast ** fgPow)

  for (let l = minL; l <= maxL; l += 1) {
    for (let scale = minScale; scale <= maxScale; scale += 0.04) {
      const candidateLab = [l, baseLab[1] * scale, baseLab[2] * scale]
      const [r, g, b] = xyzToRgb(labToXyz(candidateLab))
      const candidate = rgbaToHex({ r, g, b, hasAlpha: false })
      const candidateBgContrast = contrastRatio(candidate, bgHex)
      const candidateFgContrast = contrastRatio(candidate, fgHex)
      if (!candidateBgContrast || !candidateFgContrast) continue
      if (candidateBgContrast < minContrast) continue

      const bgError = ratioError(candidateBgContrast, effectiveBgTarget)
      const fgError = ratioError(candidateFgContrast, effectiveFgTarget)
      const drift = (deltaE(candidate, baseHex) ?? 0) / 48
      const lightnessPenalty = targetL == null ? 0 : Math.abs(l - targetL) / 52
      const score = bgError * wBg + fgError * wFg + drift * wDrift + lightnessPenalty * wL

      if (score < bestScore) {
        bestScore = score
        bestHex = candidate
      }
    }
  }

  return bestHex
}

function calibrateLightReadability(theme, darkTheme, warnings, variantId) {
  const bg = resolveHexValue(theme?.colors?.[REF_BG_KEY])
  const fg = resolveHexValue(theme?.colors?.[REF_FG_KEY])
  const darkBg = resolveHexValue(darkTheme?.colors?.[REF_BG_KEY])
  const darkFg = resolveHexValue(darkTheme?.colors?.[REF_FG_KEY])

  if (!bg || !fg || !darkBg || !darkFg) return theme

  calibrateTokenEntriesForLight(theme, darkTheme, warnings, variantId, bg, fg, darkBg, darkFg)
  calibrateSemanticEntriesForLight(theme, darkTheme, warnings, variantId, bg, fg, darkBg, darkFg)

  const target = getGlobalSeparationTarget(variantId)
  const boostProfile = getVariantBoostProfile(variantId)
  const maxBoostRounds = boostProfile.maxBoostRounds ?? GLOBAL_SEPARATION_MAX_BOOST_ROUNDS
  let separation = computeGlobalSeparationRatio(theme, darkTheme)
  for (let round = 0; round < maxBoostRounds; round += 1) {
    if (meetsGlobalSeparationTarget(separation, target)) break
    separation = boostGlobalSeparation(theme, darkTheme, variantId, warnings, target, boostProfile, separation)
  }
  softenCoolRolesForLight(theme, variantId)
  separation = computeGlobalSeparationRatio(theme, darkTheme)

  if (!meetsGlobalSeparationTarget(separation, target)) {
    warnings.push(
      `${variantId}: global separation median ${(separation.medianRatio ?? 0).toFixed(2)} (target ${target.median.toFixed(2)}), p25 ${(separation.p25Ratio ?? 0).toFixed(2)} (target ${target.p25.toFixed(2)}), p10 ${(separation.p10Ratio ?? 0).toFixed(2)} (target ${target.p10.toFixed(2)})`
    )
  }

  return theme
}

function validateTemplateAvailability(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing template file: ${path}`)
  }
}

function warnTemplateDrift(currentDark, baselineDark, warnings) {
  const currentColorKeys = new Set(Object.keys(currentDark.colors || {}))
  const baseColorKeys = new Set(Object.keys(baselineDark.colors || {}))
  const extraColorKeys = [...currentColorKeys].filter((key) => !baseColorKeys.has(key))
  if (extraColorKeys.length > 0) {
    warnings.push(`template drift: current dark has ${extraColorKeys.length} extra color key(s)`)
  }

  const currentTokenCount = (currentDark.tokenColors || []).length
  const baseTokenCount = (baselineDark.tokenColors || []).length
  if (currentTokenCount !== baseTokenCount) {
    warnings.push(`template drift: tokenColors count current=${currentTokenCount}, template=${baseTokenCount}`)
  }

  const currentSemKeys = new Set(Object.keys(currentDark.semanticTokenColors || {}))
  const baseSemKeys = new Set(Object.keys(baselineDark.semanticTokenColors || {}))
  const extraSemKeys = [...currentSemKeys].filter((key) => !baseSemKeys.has(key))
  if (extraSemKeys.length > 0) {
    warnings.push(`template drift: semanticTokenColors has ${extraSemKeys.length} extra key(s)`)
  }
}

function buildVariantTheme(currentDark, baselineDark, baselineVariant, variantMeta, warnings) {
  const generated = {
    ...currentDark,
    name: variantMeta.name,
    type: variantMeta.type,
    colors: transformColors(currentDark, baselineDark, baselineVariant, warnings, variantMeta.id),
    tokenColors: transformTokenColors(currentDark, baselineDark, baselineVariant, warnings, variantMeta.id),
    semanticTokenColors: transformSemanticTokenColors(currentDark, baselineDark, baselineVariant, warnings, variantMeta.id),
  }

  if (variantMeta.type === 'light') {
    calibrateLightReadability(generated, currentDark, warnings, variantMeta.id)
  }

  applySemanticPalette(generated, variantMeta.id, warnings)
  if (variantMeta.type === 'light') {
    applyLightPolarityCompensation(generated, variantMeta.id, warnings)
  }
  applySoftRoleChromaBudget(generated, variantMeta.id, warnings)
  if (variantMeta.type === 'light' && variantMeta.id.toLowerCase().includes('soft')) {
    // Soft chroma budgets can reintroduce low-separation cases; run a final polarity guard pass.
    applyLightPolarityCompensation(generated, variantMeta.id, warnings)
  }

  return generated
}

export function generateThemeVariants() {
  validateTemplateAvailability(DARK_THEME_SOURCE_PATH)
  validateTemplateAvailability(TEMPLATE_DARK_PATH)

  const currentDark = readJson(DARK_THEME_SOURCE_PATH)
  const baselineDark = readJson(TEMPLATE_DARK_PATH)
  const warnings = []

  warnTemplateDrift(currentDark, baselineDark, warnings)
  applySemanticPalette(currentDark, 'dark', warnings)
  const darkChanged = writeJson(DARK_THEME_OUTPUT_PATH, currentDark)
  console.log(
    `${darkChanged ? '✓ generated' : '- unchanged'} ${DARK_THEME_OUTPUT_PATH} from ${DARK_THEME_SOURCE_PATH}`
  )

  for (const variantMeta of VARIANT_CONFIG) {
    validateTemplateAvailability(variantMeta.templatePath)
    const baselineVariant = readJson(variantMeta.templatePath)
    const generated = buildVariantTheme(currentDark, baselineDark, baselineVariant, variantMeta, warnings)
    const changed = writeJson(variantMeta.outputPath, generated)
    console.log(
      `${changed ? '✓ generated' : '- unchanged'} ${variantMeta.outputPath} from ${DARK_THEME_SOURCE_PATH}`
    )
  }

  if (warnings.length > 0) {
    const telemetry = warnings.filter((message) => message.startsWith('telemetry: '))
    const realWarnings = warnings.filter((message) => !message.startsWith('telemetry: '))

    if (realWarnings.length > 0) {
      console.log('\n[WARN] Variant generator fallbacks:')
      for (const warning of realWarnings) {
        console.log(`  - ${warning}`)
      }
    }

    if (telemetry.length > 0) {
      console.log('\n[INFO] Variant tuning telemetry:')
      for (const message of telemetry) {
        console.log(`  - ${message.replace(/^telemetry:\s*/, '')}`)
      }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    generateThemeVariants()
  } catch (error) {
    console.error(`[FAIL] ${error.message}`)
    process.exit(1)
  }
}
