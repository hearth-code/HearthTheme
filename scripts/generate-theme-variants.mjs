import { existsSync, readFileSync, writeFileSync } from 'fs'
import { pathToFileURL } from 'url'
import { COLOR_SYSTEM_SEMANTIC_PATH, loadColorSchemeManifest, loadColorSystemTuning, loadColorSystemVariants, loadRoleAdapters } from './color-system.mjs'
import { buildColorLanguageModel } from './color-system/build.mjs'
import { syncVscodeChromeReferenceFiles } from './color-system/vscode-chrome.mjs'
import {
  clamp,
  contrastRatio,
  deltaE,
  hexToRgb,
  hexToRgba,
  hueDistance,
  isHueInBand,
  labToXyz,
  mixHex,
  nearestHueOnBand,
  normalizeHex,
  rgbToHsl,
  rgbToXyz,
  rgbaToHex,
  xyzToLab,
  xyzToRgb,
} from './color-utils.mjs'

const COLOR_LANGUAGE_MODEL = buildColorLanguageModel()
const COLOR_SCHEME = loadColorSchemeManifest()
const VARIANT_SPEC = loadColorSystemVariants()
const SEMANTIC_PALETTE = COLOR_LANGUAGE_MODEL.semanticPalette
const READABILITY_ROLE_DEFS = loadRoleAdapters()
const COLOR_SYSTEM_TUNING = loadColorSystemTuning()
const RAW_DARK_VARIANT = VARIANT_SPEC.variants.find((variant) => variant.id === 'dark') || null

function splitWordmark(name) {
  const full = String(name || '').trim()
  if (!full) {
    return {
      primary: '',
      secondary: '',
    }
  }

  const parts = full
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length >= 2) {
    return {
      primary: parts.slice(0, -1).join(' '),
      secondary: parts.slice(-1).join(' '),
    }
  }

  return {
    primary: full,
    secondary: '',
  }
}

function getVariantDisplayName(variant) {
  const wordmark = splitWordmark(COLOR_SCHEME.name)
  const prefix = wordmark.primary || COLOR_SCHEME.name
  const climateLabel = String(variant?.climateLabel || '').trim() || String(variant?.name || '').trim()
  return [prefix, climateLabel].filter(Boolean).join(' ')
}

const DARK_THEME_SOURCE_PATH = VARIANT_SPEC.baseSourcePath
const DARK_VARIANT_META = RAW_DARK_VARIANT
  ? {
      ...RAW_DARK_VARIANT,
      name: getVariantDisplayName(RAW_DARK_VARIANT),
    }
  : null
const DARK_THEME_OUTPUT_PATH = DARK_VARIANT_META?.outputPath
const TEMPLATE_DARK_PATH = VARIANT_SPEC.baseTemplatePath
const VARIANT_CONFIG = VARIANT_SPEC.variants
  .filter((variant) => variant.mode !== 'source')
  .map((variant) => ({
    id: variant.id,
    name: getVariantDisplayName(variant),
    type: variant.type,
    templatePath: variant.templatePath,
    outputPath: variant.outputPath,
  }))

if (!DARK_THEME_OUTPUT_PATH || !DARK_VARIANT_META) {
  throw new Error('variants.json must register a dark outputPath')
}

const REF_BG_KEY = 'editor.background'
const REF_FG_KEY = 'editor.foreground'

const LIGHT_POLARITY_ROLE_OPTIMIZATION = COLOR_SYSTEM_TUNING.lightPolarityRoleOptimization
const SOFT_ROLE_CHROMA_BUDGET = COLOR_SYSTEM_TUNING.softRoleChromaBudget
const LIGHT_READABILITY_CALIBRATION = COLOR_SYSTEM_TUNING.lightReadabilityCalibration
const GLOBAL_SEPARATION_TARGET_BY_VARIANT = COLOR_SYSTEM_TUNING.globalSeparationTargetByVariant
const GLOBAL_SEPARATION_TOLERANCE_BY_VARIANT = COLOR_SYSTEM_TUNING.globalSeparationToleranceByVariant || {}
const VARIANT_BOOST_PROFILE = COLOR_SYSTEM_TUNING.globalSeparationBoostProfileByVariant
const LIGHT_COOL_ROLE_SOFTEN = COLOR_SYSTEM_TUNING.lightCoolRoleSoften
const GLOBAL_SEPARATION_ROLE_PROFILE = COLOR_SYSTEM_TUNING.globalSeparationRoleProfile
const LIGHT_POLARITY_SEARCH_PROFILE = COLOR_SYSTEM_TUNING.lightPolaritySearchProfile
const GLOBAL_SEPARATION_DEFICIT_PROFILE = COLOR_SYSTEM_TUNING.globalSeparationDeficitProfile
const LIGHT_READABILITY_SEARCH_PROFILE = COLOR_SYSTEM_TUNING.lightReadabilitySearchProfile
const TELEMETRY_PROFILE = COLOR_SYSTEM_TUNING.telemetryProfile
const ROLE_SIGNAL_PROFILE = COLOR_SYSTEM_TUNING.roleSignalProfile || {}
const INTERACTION_STATE_BUDGET = COLOR_SYSTEM_TUNING.interactionStateBudget || {}
const ROLE_SIGNAL_COOL_HUE_BAND_BY_VARIANT = ROLE_SIGNAL_PROFILE.coolHueBandByVariant || {}
const ROLE_SIGNAL_WARM_HUE_BAND_BY_VARIANT = ROLE_SIGNAL_PROFILE.warmHueBandByVariant || {}
const ROLE_SIGNAL_NEAR_FG_BY_VARIANT = ROLE_SIGNAL_PROFILE.nearForegroundDeltaEByVariant || {}
const ROLE_SIGNAL_WARM_GAMUT_GUARD = ROLE_SIGNAL_PROFILE.warmGamutGuard || null
const ROLE_SIGNAL_WARM_EXPOSURE_PROFILE = ROLE_SIGNAL_PROFILE.warmExposureProfile || null
const DEFAULT_LIGHT_CALIBRATION = LIGHT_READABILITY_CALIBRATION.default || {}
const LIGHT_ROLE_CALIBRATION = LIGHT_READABILITY_CALIBRATION.byRole || {}
const GLOBAL_SEPARATION_MAX_BOOST_ROUNDS = VARIANT_BOOST_PROFILE.default?.maxBoostRounds ?? 6
let WARM_ROLE_FREQUENCY_CACHE = null

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

function resolveVariantRoleProfile(rawProfileMap, variantId) {
  const base = rawProfileMap?.default || {}
  const specific = rawProfileMap?.[variantId] || {}
  return {
    ...base,
    ...specific,
  }
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

  const metricRatioCap = LIGHT_POLARITY_SEARCH_PROFILE.metricRatioCap
  const preferredRatioCap = LIGHT_POLARITY_SEARCH_PROFILE.preferredDistanceRatioCap
  const scoreWeights = LIGHT_POLARITY_SEARCH_PROFILE.scoreWeights
  const bgScore = Math.min(bgHueDistance / profile.targetBgHueDistance, metricRatioCap)
  const anchorScore = Math.min(minAnchorDeltaE / profile.minAnchorDeltaE, metricRatioCap)
  const contrastScore = Math.min(contrast / profile.minContrast, metricRatioCap)
  const driftPenalty = driftFromSeed / profile.maxDeltaEFromSeed
  const preferredHue = profile.preferredHue ?? null
  const preferredDistanceTarget = profile.targetPreferredHueDistance ?? null
  let preferredScore = 0
  if (preferredHue != null && preferredDistanceTarget) {
    const distance = hueDistance(candidateHue, preferredHue)
    preferredScore = 1 - Math.min(distance / preferredDistanceTarget, preferredRatioCap)
  }

  const score = bgScore * scoreWeights.bg +
    anchorScore * scoreWeights.anchor +
    contrastScore * scoreWeights.contrast +
    preferredScore * scoreWeights.preferred -
    driftPenalty * scoreWeights.driftPenalty
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

  for (let hue = 0; hue < 360; hue += LIGHT_POLARITY_SEARCH_PROFILE.hueStep) {
    for (const chromaScale of LIGHT_POLARITY_SEARCH_PROFILE.chromaScales) {
      for (const lightnessShift of LIGHT_POLARITY_SEARCH_PROFILE.lightnessShifts) {
        const candidateL = clamp(seedL + lightnessShift, LIGHT_POLARITY_SEARCH_PROFILE.candidateMinL, LIGHT_POLARITY_SEARCH_PROFILE.candidateMaxL)
        const candidateC = clamp(seedC * chromaScale, LIGHT_POLARITY_SEARCH_PROFILE.candidateMinC, LIGHT_POLARITY_SEARCH_PROFILE.candidateMaxC)
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
  const improved = bestMetrics.score > seedScore + LIGHT_POLARITY_SEARCH_PROFILE.minImprovement
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

function enforceRoleHueBand(theme, variantId, warnings, bandByVariant, label) {
  const bgColor = resolveHexValue(theme?.colors?.[REF_BG_KEY])
  if (!bgColor) return

  const roleBands = resolveVariantRoleProfile(bandByVariant, variantId)
  for (const [roleId, band] of Object.entries(roleBands)) {
    if (!band || typeof band !== 'object') continue
    const roleDef = getRoleDefById(roleId)
    if (!roleDef) continue

    const current = getRoleColorFromTheme(theme, roleDef)
    if (!current) continue

    const seedHue = hexHue(current)
    if (seedHue == null) continue
    const seedContrast = contrastRatio(current, bgColor) ?? 0
    const inBand = isHueInBand(seedHue, band.hueMin, band.hueMax)
    if (inBand && seedContrast >= band.minBgContrast) continue

    const seedLab = xyzToLab(rgbToXyz(hexToRgb(current)))
    const [seedL, seedC] = labToLch(seedLab)
    const targetHue = nearestHueOnBand(seedHue, band.hueMin, band.hueMax)
    let bestHex = null
    let bestScore = Number.POSITIVE_INFINITY

    for (const lightnessShift of [-8, -4, 0, 4, 8]) {
      for (const chromaScale of [0.82, 0.9, 1, 1.1]) {
        for (const hueShift of [-6, -3, 0, 3, 6]) {
          const candidateHue = ((targetHue + hueShift) % 360 + 360) % 360
          if (!isHueInBand(candidateHue, band.hueMin, band.hueMax)) continue
          const candidateL = clamp(seedL + lightnessShift, 6, 94)
          const candidateC = clamp(seedC * chromaScale, 3, 90)
          const candidateHex = labToHex(lchToLab([candidateL, candidateC, candidateHue]))
          const realizedHue = hexHue(candidateHex)
          if (realizedHue == null || !isHueInBand(realizedHue, band.hueMin, band.hueMax)) continue
          const candidateContrast = contrastRatio(candidateHex, bgColor)
          if (candidateContrast == null || candidateContrast < band.minBgContrast) continue
          const drift = deltaE(candidateHex, current) ?? 0
          if (band.maxDeltaEFromSeed != null && drift > band.maxDeltaEFromSeed) continue

          const score = drift * 0.86 + hueDistance(realizedHue, seedHue) * 0.14
          if (score < bestScore) {
            bestScore = score
            bestHex = candidateHex
          }
        }
      }
    }

    if (!bestHex || String(bestHex).toLowerCase() === String(current).toLowerCase()) {
      warnings.push(`${variantId}: role signal ${label} could not adjust ${roleId} into hue range ${band.hueMin}-${band.hueMax}`)
      continue
    }

    applyRoleColorToTokenEntries(theme, roleDef.scopes || [], bestHex)
    for (const semanticKey of roleDef.semanticKeys || []) {
      setSemanticColor(theme, semanticKey, bestHex)
    }

    const nextHue = hexHue(bestHex)
    warnings.push(
      `telemetry: ${variantId}: role signal ${label} adjusted ${roleId} hue ${(seedHue ?? 0).toFixed(1)} -> ${(nextHue ?? 0).toFixed(1)}`
    )
  }
}

function computeWarmRoleFrequencyMap(profile) {
  if (!profile) return {}
  if (WARM_ROLE_FREQUENCY_CACHE) return WARM_ROLE_FREQUENCY_CACHE

  const mix = profile.languageMixWeights || {}
  const byLanguage = profile.roleFrequencyByLanguage || {}
  const weighted = {}
  let total = 0

  for (const [langId, weight] of Object.entries(mix)) {
    if (!(weight > 0)) continue
    const freqMap = byLanguage[langId] || {}
    total += weight
    for (const [roleId, freq] of Object.entries(freqMap)) {
      if (!(freq >= 0)) continue
      weighted[roleId] = (weighted[roleId] || 0) + freq * weight
    }
  }

  if (total > 0) {
    for (const roleId of Object.keys(weighted)) {
      weighted[roleId] = weighted[roleId] / total
    }
  }
  WARM_ROLE_FREQUENCY_CACHE = weighted
  return weighted
}

function resolveWarmExposureVariantProfile(variantId) {
  const profile = ROLE_SIGNAL_WARM_EXPOSURE_PROFILE
  if (!profile) return null
  const base = profile.variantTuning?.default || null
  if (!base) return null
  const override = profile.variantTuning?.[variantId] || {}
  return {
    ...base,
    ...override,
    maxChromaByRole: {
      ...(base.maxChromaByRole || {}),
      ...(override.maxChromaByRole || {}),
    },
  }
}

function applyWarmRoleExposureBalance(theme, variantId, warnings) {
  const profile = ROLE_SIGNAL_WARM_EXPOSURE_PROFILE
  if (!profile) return
  const variantProfile = resolveWarmExposureVariantProfile(variantId)
  if (!variantProfile) return

  const roleFrequency = computeWarmRoleFrequencyMap(profile)
  const roleSaliency = profile.saliencyByRole || {}
  const maxFrequency = Math.max(1e-6, ...Object.values(roleFrequency).filter((value) => Number.isFinite(value)))
  const maxSaliency = Math.max(1e-6, ...Object.values(roleSaliency).filter((value) => Number.isFinite(value)))

  for (const roleDef of READABILITY_ROLE_DEFS) {
    const roleId = roleDef.id
    if (!roleId) continue
    const current = getRoleColorFromTheme(theme, roleDef)
    if (!current) continue

    const frequency = roleFrequency[roleId] ?? 0
    const saliency = roleSaliency[roleId] ?? 1
    const frequencyNorm = clamp(frequency / maxFrequency, 0, 1)
    const saliencyNorm = clamp(saliency / maxSaliency, 0, 1.2)

    const chromaFactor = clamp(
      variantProfile.baseChromaFactor +
      saliencyNorm * variantProfile.saliencyWeight -
      frequencyNorm * variantProfile.frequencyWeight,
      variantProfile.minChromaFactor,
      variantProfile.maxChromaFactor
    )
    const lightnessLift = clamp(
      variantProfile.baseLightnessLift +
      (0.5 - frequencyNorm) * variantProfile.frequencyLightnessShift +
      (saliencyNorm - 0.5) * variantProfile.saliencyLightnessShift,
      variantProfile.minLightnessLift,
      variantProfile.maxLightnessLift
    )
    const maxChroma = variantProfile.maxChromaByRole?.[roleId] ?? null
    const next = scaleColorChroma(current, chromaFactor, lightnessLift, maxChroma)
    if (String(next).toLowerCase() === String(current).toLowerCase()) continue

    applyRoleColorToTokenEntries(theme, roleDef.scopes || [], next)
    for (const semanticKey of roleDef.semanticKeys || []) {
      setSemanticColor(theme, semanticKey, next)
    }

    const drift = deltaE(current, next) ?? 0
    warnings.push(
      `telemetry: ${variantId}: warm exposure tuned ${roleId} (freq=${frequency.toFixed(3)}, saliency=${saliency.toFixed(2)}) deltaE ${drift.toFixed(1)}`
    )
  }
}

function enforceWarmGamutGuard(theme, variantId, warnings) {
  const guard = ROLE_SIGNAL_WARM_GAMUT_GUARD
  if (!guard) return

  for (const roleId of guard.roles || []) {
    const roleDef = getRoleDefById(roleId)
    if (!roleDef) continue
    const current = getRoleColorFromTheme(theme, roleDef)
    if (!current) continue

    const rgb = hexToRgb(current)
    if (!rgb) continue
    const hsl = rgbToHsl(rgb)
    if (!hsl) continue
    if (hsl.s < (guard.minSaturation ?? 0) || !isHueInBand(hsl.h, guard.forbiddenHueMin, guard.forbiddenHueMax)) continue

    const seedLab = xyzToLab(rgbToXyz(rgb))
    const [seedL, seedC, seedHue] = labToLch(seedLab)
    let bestHex = null
    let bestScore = Number.POSITIVE_INFINITY

    for (const hueShift of [-90, -72, -54, -36, -24, 24, 36, 54, 72, 90, 108, 126, 144]) {
      const candidateHue = ((seedHue + hueShift) % 360 + 360) % 360
      if (isHueInBand(candidateHue, guard.forbiddenHueMin, guard.forbiddenHueMax)) continue
      for (const chromaScale of [0.8, 0.9, 1, 1.1]) {
        for (const lightnessShift of [-6, -3, 0, 3, 6]) {
          const candidateHex = labToHex(lchToLab([
            clamp(seedL + lightnessShift, 6, 94),
            clamp(seedC * chromaScale, 2, 90),
            candidateHue,
          ]))
          const realizedHue = hexHue(candidateHex)
          if (realizedHue == null || isHueInBand(realizedHue, guard.forbiddenHueMin, guard.forbiddenHueMax)) continue
          const drift = deltaE(candidateHex, current) ?? 0
          const score = drift + hueDistance(realizedHue, seedHue) * 0.08
          if (score < bestScore) {
            bestScore = score
            bestHex = candidateHex
          }
        }
      }
    }

    if (!bestHex || String(bestHex).toLowerCase() === String(current).toLowerCase()) {
      warnings.push(`${variantId}: warm gamut guard could not re-map ${roleId} out of ${guard.forbiddenHueMin}-${guard.forbiddenHueMax}`)
      continue
    }

    applyRoleColorToTokenEntries(theme, roleDef.scopes || [], bestHex)
    for (const semanticKey of roleDef.semanticKeys || []) {
      setSemanticColor(theme, semanticKey, bestHex)
    }
    warnings.push(`telemetry: ${variantId}: warm gamut guard remapped ${roleId}`)
  }
}

function enforceNearForegroundBudget(theme, variantId, warnings) {
  const fgColor = resolveHexValue(theme?.colors?.[REF_FG_KEY])
  const bgColor = resolveHexValue(theme?.colors?.[REF_BG_KEY])
  if (!fgColor || !bgColor) return

  const roleProfiles = resolveVariantRoleProfile(ROLE_SIGNAL_NEAR_FG_BY_VARIANT, variantId)
  for (const [roleId, profile] of Object.entries(roleProfiles)) {
    if (!profile || typeof profile !== 'object') continue
    const roleDef = getRoleDefById(roleId)
    if (!roleDef) continue

    const current = getRoleColorFromTheme(theme, roleDef)
    if (!current) continue

    const currentDelta = deltaE(current, fgColor)
    if (currentDelta == null) continue
    const currentContrast = contrastRatio(current, bgColor) ?? 0
    const minDeltaE = profile.minDeltaE ?? 0
    const maxDeltaE = profile.maxDeltaE ?? 200
    const minBgContrast = profile.minBgContrast ?? 1
    const targetDeltaE = profile.targetDeltaE ?? clamp((minDeltaE + maxDeltaE) / 2, minDeltaE, maxDeltaE)

    if (
      currentDelta >= minDeltaE &&
      currentDelta <= maxDeltaE &&
      currentContrast >= minBgContrast
    ) {
      continue
    }

    let bestHex = null
    let bestScore = Number.POSITIVE_INFINITY

    if (currentDelta > maxDeltaE || currentContrast < minBgContrast) {
      for (let step = 1; step <= 24; step += 1) {
        const t = step / 24
        const candidate = mixHex(current, fgColor, t)
        const nextDelta = deltaE(candidate, fgColor)
        if (nextDelta == null || nextDelta < minDeltaE || nextDelta > maxDeltaE) continue
        const nextContrast = contrastRatio(candidate, bgColor)
        if (nextContrast == null || nextContrast < minBgContrast) continue
        const drift = deltaE(candidate, current) ?? 0
        const score = Math.abs(nextDelta - targetDeltaE) + drift * 0.05
        if (score < bestScore) {
          bestScore = score
          bestHex = candidate
        }
      }
    } else if (currentDelta < minDeltaE) {
      const seedLab = xyzToLab(rgbToXyz(hexToRgb(current)))
      const [seedL, seedC, seedHue] = labToLch(seedLab)
      for (const chromaScale of [1.05, 1.12, 1.2, 1.32]) {
        for (const lightnessShift of [-8, -4, 0, 4, 8]) {
          const candidate = labToHex(lchToLab([
            clamp(seedL + lightnessShift, 6, 94),
            clamp(seedC * chromaScale, 2, 92),
            seedHue,
          ]))
          const nextDelta = deltaE(candidate, fgColor)
          if (nextDelta == null || nextDelta < minDeltaE || nextDelta > maxDeltaE) continue
          const nextContrast = contrastRatio(candidate, bgColor)
          if (nextContrast == null || nextContrast < minBgContrast) continue
          const drift = deltaE(candidate, current) ?? 0
          const score = Math.abs(nextDelta - targetDeltaE) + drift * 0.08
          if (score < bestScore) {
            bestScore = score
            bestHex = candidate
          }
        }
      }
    }

    if (!bestHex || String(bestHex).toLowerCase() === String(current).toLowerCase()) {
      warnings.push(`${variantId}: role signal near-foreground budget could not adjust ${roleId} into deltaE ${minDeltaE}-${maxDeltaE}`)
      continue
    }

    applyRoleColorToTokenEntries(theme, roleDef.scopes || [], bestHex)
    for (const semanticKey of roleDef.semanticKeys || []) {
      setSemanticColor(theme, semanticKey, bestHex)
    }

    const nextDelta = deltaE(bestHex, fgColor) ?? 0
    warnings.push(
      `telemetry: ${variantId}: role signal near-foreground adjusted ${roleId} deltaE-to-fg ${currentDelta.toFixed(1)} -> ${nextDelta.toFixed(1)}`
    )
  }
}

function applyRoleSignalProfile(theme, variantId, warnings) {
  enforceRoleHueBand(theme, variantId, warnings, ROLE_SIGNAL_COOL_HUE_BAND_BY_VARIANT, 'cool band')
  enforceRoleHueBand(theme, variantId, warnings, ROLE_SIGNAL_WARM_HUE_BAND_BY_VARIANT, 'warm band')
  applyWarmRoleExposureBalance(theme, variantId, warnings)
  enforceRoleHueBand(theme, variantId, warnings, ROLE_SIGNAL_WARM_HUE_BAND_BY_VARIANT, 'warm band')
  enforceWarmGamutGuard(theme, variantId, warnings)
  enforceNearForegroundBudget(theme, variantId, warnings)
  enforceWarmGamutGuard(theme, variantId, warnings)
}

function getInteractionStateBudget(variantId) {
  return {
    ...(INTERACTION_STATE_BUDGET.default || {}),
    ...(INTERACTION_STATE_BUDGET[variantId] || {}),
  }
}

function blendStateColorOverBackground(colorHex, bgHex) {
  const state = hexToRgba(colorHex)
  const bg = hexToRgba(bgHex)
  if (!state || !bg) return colorHex
  if (!state.hasAlpha) {
    return rgbaToHex({ r: state.r, g: state.g, b: state.b, hasAlpha: false })
  }
  const alpha = state.a / 255
  return rgbaToHex({
    r: state.r * alpha + bg.r * (1 - alpha),
    g: state.g * alpha + bg.g * (1 - alpha),
    b: state.b * alpha + bg.b * (1 - alpha),
    hasAlpha: false,
  })
}

function contrastAgainstEditorBackground(colorHex, bgHex) {
  const blended = blendStateColorOverBackground(colorHex, bgHex)
  return contrastRatio(blended, bgHex)
}

function enforceInteractionStateContrast(theme, variantId, warnings, key, minContrast, bgColor, fgColor) {
  if (typeof minContrast !== 'number') return
  const current = resolveHexValue(theme?.colors?.[key])
  if (!current || !bgColor || !fgColor) return

  const before = contrastAgainstEditorBackground(current, bgColor)
  if (before == null || before >= minContrast) return

  let low = 0
  let high = 1
  let next = current
  let solved = false
  for (let i = 0; i < 24; i += 1) {
    const t = (low + high) / 2
    const candidate = mixHex(current, fgColor, t)
    const ratio = contrastAgainstEditorBackground(candidate, bgColor)
    if (ratio != null && ratio >= minContrast) {
      solved = true
      next = candidate
      high = t
    } else {
      low = t
    }
  }

  const finalRatio = contrastAgainstEditorBackground(next, bgColor)
  theme.colors[key] = next
  if (finalRatio != null && before != null) {
    warnings.push(
      `telemetry: ${variantId}: interaction state ${key} contrast ${before.toFixed(3)} -> ${finalRatio.toFixed(3)} (target >= ${minContrast.toFixed(2)})`
    )
  }
  if (!solved || finalRatio == null || finalRatio < minContrast) {
    warnings.push(`${variantId}: interaction state ${key} contrast tuning could not satisfy target ${minContrast.toFixed(2)}`)
  }
}

function enforceLineNumberActiveDelta(theme, variantId, warnings, minDelta, bgColor, fgColor) {
  if (typeof minDelta !== 'number') return
  const lineNo = resolveHexValue(theme?.colors?.['editorLineNumber.foreground'])
  const lineNoActive = resolveHexValue(theme?.colors?.['editorLineNumber.activeForeground'])
  if (!lineNo || !lineNoActive || !bgColor || !fgColor) return

  const baseContrast = contrastRatio(lineNo, bgColor)
  const beforeActiveContrast = contrastRatio(lineNoActive, bgColor)
  if (baseContrast == null || beforeActiveContrast == null) return

  const beforeDelta = beforeActiveContrast - baseContrast
  if (beforeDelta >= minDelta) return

  let low = 0
  let high = 1
  let next = lineNoActive
  let solved = false
  for (let i = 0; i < 24; i += 1) {
    const t = (low + high) / 2
    const candidate = mixHex(lineNoActive, fgColor, t)
    const contrast = contrastRatio(candidate, bgColor)
    const delta = contrast == null ? null : contrast - baseContrast
    if (delta != null && delta >= minDelta) {
      solved = true
      next = candidate
      high = t
    } else {
      low = t
    }
  }

  theme.colors['editorLineNumber.activeForeground'] = next
  const afterActiveContrast = contrastRatio(next, bgColor)
  const afterDelta = afterActiveContrast == null ? null : afterActiveContrast - baseContrast
  if (afterDelta != null) {
    warnings.push(
      `telemetry: ${variantId}: interaction state editorLineNumber.activeForeground delta ${beforeDelta.toFixed(3)} -> ${afterDelta.toFixed(3)} (target >= ${minDelta.toFixed(2)})`
    )
  }
  if (!solved || afterDelta == null || afterDelta < minDelta) {
    warnings.push(`${variantId}: interaction state line-number active delta tuning could not satisfy target ${minDelta.toFixed(2)}`)
  }
}

function applyInteractionStateBudget(theme, variantId, warnings) {
  const budget = getInteractionStateBudget(variantId)
  if (!budget || Object.keys(budget).length === 0) return

  const bgColor = resolveHexValue(theme?.colors?.[REF_BG_KEY])
  const fgColor = resolveHexValue(theme?.colors?.[REF_FG_KEY])
  if (!bgColor || !fgColor) return

  enforceInteractionStateContrast(
    theme,
    variantId,
    warnings,
    'editor.lineHighlightBackground',
    budget.lineHighlightMinContrast,
    bgColor,
    fgColor
  )
  enforceInteractionStateContrast(
    theme,
    variantId,
    warnings,
    'list.hoverBackground',
    budget.listHoverMinContrast,
    bgColor,
    fgColor
  )
  enforceInteractionStateContrast(
    theme,
    variantId,
    warnings,
    'tab.hoverBackground',
    budget.tabHoverMinContrast,
    bgColor,
    fgColor
  )
  enforceLineNumberActiveDelta(
    theme,
    variantId,
    warnings,
    budget.lineNumberActiveDeltaMin,
    bgColor,
    fgColor
  )
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

function getGlobalSeparationTolerance(variantId) {
  const variantTolerance = GLOBAL_SEPARATION_TOLERANCE_BY_VARIANT[variantId]
  if (typeof variantTolerance === 'number' && Number.isFinite(variantTolerance)) {
    return Math.max(0, variantTolerance)
  }
  const defaultTolerance = GLOBAL_SEPARATION_TOLERANCE_BY_VARIANT.default
  if (typeof defaultTolerance === 'number' && Number.isFinite(defaultTolerance)) {
    return Math.max(0, defaultTolerance)
  }
  return 0
}

function getVariantBoostProfile(variantId) {
  return VARIANT_BOOST_PROFILE[variantId] ?? VARIANT_BOOST_PROFILE.default
}

function meetsGlobalSeparationTarget(stats, target, tolerance = 0) {
  if (!stats || !target) return true
  if (stats.pairCount === 0 || stats.medianRatio == null) return true
  if (target.median != null && stats.medianRatio < (target.median - tolerance)) return false
  if (target.p25 != null && (stats.p25Ratio == null || stats.p25Ratio < (target.p25 - tolerance))) return false
  if (target.p10 != null && (stats.p10Ratio == null || stats.p10Ratio < (target.p10 - tolerance))) return false
  return true
}

function roleSeparationBoostFactor(roleId) {
  const map = GLOBAL_SEPARATION_ROLE_PROFILE?.boostFactorByRole || {}
  if (roleId == null) return map._unmapped ?? map._default ?? 1
  return map[roleId] ?? map._default ?? 1
}

function roleSeparationLightnessLift(roleId) {
  const map = GLOBAL_SEPARATION_ROLE_PROFILE?.lightnessLiftByRole || {}
  if (roleId == null) return map._unmapped ?? map._default ?? 0
  return map[roleId] ?? map._default ?? 0
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

function boostGlobalSeparation(theme, darkTheme, variantId, warnings, target, tolerance, boostProfile, currentStats) {
  const initial = currentStats ?? computeGlobalSeparationRatio(theme, darkTheme)
  if (initial.pairCount === 0 || initial.medianRatio == null) return initial
  if (meetsGlobalSeparationTarget(initial, target, tolerance)) return initial

  const medianDeficit = target?.median ? target.median / Math.max(initial.medianRatio, GLOBAL_SEPARATION_DEFICIT_PROFILE.ratioFloorMedian) : 1
  const p25Deficit = target?.p25 && initial.p25Ratio ? target.p25 / Math.max(initial.p25Ratio, GLOBAL_SEPARATION_DEFICIT_PROFILE.ratioFloorP25) : 1
  const p10Deficit = target?.p10 && initial.p10Ratio ? target.p10 / Math.max(initial.p10Ratio, GLOBAL_SEPARATION_DEFICIT_PROFILE.ratioFloorP10) : 1
  const deficit = Math.max(medianDeficit, p25Deficit, p10Deficit)
  const neededFactor = clamp(deficit, GLOBAL_SEPARATION_DEFICIT_PROFILE.minNeededFactor, boostProfile?.maxNeededFactor ?? 1.45)
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
      if (darkDE < (GLOBAL_SEPARATION_ROLE_PROFILE?.baselineDeltaE ?? 8)) continue
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
    if (drift != null && drift > TELEMETRY_PROFILE.readabilityDriftWarningDeltaE) {
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
    if (drift != null && drift > TELEMETRY_PROFILE.readabilityDriftWarningDeltaE) {
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
  const scaleStep = LIGHT_READABILITY_SEARCH_PROFILE.scaleStep
  const driftDivisor = LIGHT_READABILITY_SEARCH_PROFILE.driftDivisor
  const lightnessPenaltyDivisor = LIGHT_READABILITY_SEARCH_PROFILE.lightnessPenaltyDivisor

  const effectiveBgTarget = Math.max(minContrast, targetBgContrast ** bgPow)
  const effectiveFgTarget = Math.max(minFgContrast, targetFgContrast ** fgPow)

  for (let l = minL; l <= maxL; l += 1) {
    for (let scale = minScale; scale <= maxScale; scale += scaleStep) {
      const candidateLab = [l, baseLab[1] * scale, baseLab[2] * scale]
      const [r, g, b] = xyzToRgb(labToXyz(candidateLab))
      const candidate = rgbaToHex({ r, g, b, hasAlpha: false })
      const candidateBgContrast = contrastRatio(candidate, bgHex)
      const candidateFgContrast = contrastRatio(candidate, fgHex)
      if (!candidateBgContrast || !candidateFgContrast) continue
      if (candidateBgContrast < minContrast) continue

      const bgError = ratioError(candidateBgContrast, effectiveBgTarget)
      const fgError = ratioError(candidateFgContrast, effectiveFgTarget)
      const drift = (deltaE(candidate, baseHex) ?? 0) / driftDivisor
      const lightnessPenalty = targetL == null ? 0 : Math.abs(l - targetL) / lightnessPenaltyDivisor
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
  const tolerance = getGlobalSeparationTolerance(variantId)
  const boostProfile = getVariantBoostProfile(variantId)
  const maxBoostRounds = boostProfile.maxBoostRounds ?? GLOBAL_SEPARATION_MAX_BOOST_ROUNDS
  let separation = computeGlobalSeparationRatio(theme, darkTheme)
  for (let round = 0; round < maxBoostRounds; round += 1) {
    if (meetsGlobalSeparationTarget(separation, target, tolerance)) break
    separation = boostGlobalSeparation(theme, darkTheme, variantId, warnings, target, tolerance, boostProfile, separation)
  }
  softenCoolRolesForLight(theme, variantId)
  separation = computeGlobalSeparationRatio(theme, darkTheme)

  if (!meetsGlobalSeparationTarget(separation, target, tolerance)) {
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
  applyRoleSignalProfile(generated, variantMeta.id, warnings)
  applyInteractionStateBudget(generated, variantMeta.id, warnings)

  return generated
}

export function generateThemeVariants() {
  syncVscodeChromeReferenceFiles(COLOR_LANGUAGE_MODEL, VARIANT_SPEC)
  validateTemplateAvailability(DARK_THEME_SOURCE_PATH)
  validateTemplateAvailability(TEMPLATE_DARK_PATH)

  const currentDark = readJson(DARK_THEME_SOURCE_PATH)
  const baselineDark = readJson(TEMPLATE_DARK_PATH)
  const warnings = []

  const semanticSnapshotChanged = writeJson(COLOR_SYSTEM_SEMANTIC_PATH, COLOR_LANGUAGE_MODEL.semanticSnapshot)
  console.log(
    `${semanticSnapshotChanged ? '✓ generated' : '- unchanged'} ${COLOR_SYSTEM_SEMANTIC_PATH} from ${COLOR_LANGUAGE_MODEL.sources.foundation}`
  )

  warnTemplateDrift(currentDark, baselineDark, warnings)
  applySemanticPalette(currentDark, 'dark', warnings)
  applyRoleSignalProfile(currentDark, 'dark', warnings)
  applyInteractionStateBudget(currentDark, 'dark', warnings)
  currentDark.name = DARK_VARIANT_META.name
  currentDark.type = DARK_VARIANT_META.type
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
