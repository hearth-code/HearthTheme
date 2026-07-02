import {
  computeGlobalSeparationStats,
  constraintMargin,
  globalSeparationConstraintSatisfied,
  solveChromaCeilingColor,
  solveConstrainedColor,
  solveCriticalPairFloors,
  solveGlobalSeparationConstraint,
  solveGlobalSeparationJoint,
  solveHueLaneColor,
  solveNearForegroundColor,
  solveReadabilityColor,
} from './color-system/solve.mjs'
import {
  buildCriticalPairFloorsFrom,
  buildGlobalSeparationConstraintFrom,
} from './color-system/quality-contract-core.mjs'
import {
  clamp,
  contrastRatio,
  deltaE,
  hexHue,
  hexToRgb,
  hexToRgba,
  hueDistance,
  isHueInBand,
  labToLch,
  labToXyz,
  lchToLab,
  mixHex,
  nearestHueOnBand,
  normalizeHex,
  rgbToHsl,
  rgbToXyz,
  rgbaToHex,
  xyzToLab,
  xyzToRgb,
} from './color-utils.mjs'

let ACTIVE_RUNTIME = null
let COLOR_LANGUAGE_MODEL = null
let COLOR_SCHEME = null
let VARIANT_SPEC = null
let SEMANTIC_PALETTE = null
let READABILITY_ROLE_DEFS = []
let ROLE_ID_BY_SCOPE = new Map()
let COLOR_SYSTEM_TUNING = null
let COLOR_SYSTEM_SCHEME_ID = null
let COLOR_SYSTEM_ACTIVE_SCHEME_DIR = null
let COLOR_SYSTEM_SEMANTIC_PATH = null
let RAW_DARK_VARIANT = null
let ROLE_LANE_MODE = 'warm-balanced'
let LIGHT_CALIBRATION_STRENGTH_BY_VARIANT = {}
let LIGHT_SEMANTIC_ANCHOR_STRENGTH_BY_VARIANT = {}

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

let DARK_THEME_SOURCE_PATH = null
let DARK_VARIANT_META = null
let DARK_THEME_OUTPUT_PATH = null
let TEMPLATE_DARK_PATH = null
let VARIANT_CONFIG = []

const REF_BG_KEY = 'editor.background'
const REF_FG_KEY = 'editor.foreground'

let LIGHT_POLARITY_ROLE_OPTIMIZATION = {}
let SOFT_ROLE_CHROMA_BUDGET = {}
let LIGHT_READABILITY_CALIBRATION = {}
let GLOBAL_SEPARATION_TARGET_BY_VARIANT = {}
let GLOBAL_SEPARATION_TOLERANCE_BY_VARIANT = {}
let VARIANT_BOOST_PROFILE = {}
let LIGHT_COOL_ROLE_SOFTEN = {}
let GLOBAL_SEPARATION_ROLE_PROFILE = {}
let LIGHT_POLARITY_SEARCH_PROFILE = {}
let GLOBAL_SEPARATION_DEFICIT_PROFILE = {}
let LIGHT_READABILITY_SEARCH_PROFILE = {}
let TELEMETRY_PROFILE = {}
let ROLE_LANE_PROFILE = {}
let INTERACTION_STATE_BUDGET = {}
let INTERACTION_STATE_CONSTRAINTS = []
let ROLE_LANE_COOL_HUE_BAND_BY_VARIANT = {}
let ROLE_LANE_WARM_HUE_BAND_BY_VARIANT = {}
let ROLE_LANE_NEAR_FG_BY_VARIANT = {}
let ROLE_LANE_WARM_GAMUT_GUARD = null
let ROLE_LANE_WARM_EXPOSURE_PROFILE = null
let DEFAULT_LIGHT_CALIBRATION = {}
let LIGHT_ROLE_CALIBRATION = {}
let GLOBAL_SEPARATION_DEFAULT_MAX_BOOST_ROUNDS = 6
const CHROMA_CEILING_TOLERANCE = 0.1
let WARM_ROLE_FREQUENCY_CACHE = null

function reportConstraintFailure(message, warnings, enforce) {
  if (enforce) throw new Error(message)
  warnings?.push(message)
  return false
}

function runConstraintStep(label, warnings, enforce, callback) {
  try {
    callback()
    return true
  } catch (error) {
    if (enforce) throw error
    const message = error instanceof Error ? error.message : String(error)
    warnings.push(`${label}: ${message}`)
    return false
  }
}

export function createThemeVariantRuntime({
  model,
  colorScheme,
  variantSpec,
  roleDefs,
  tuning,
  schemeId,
  activeSchemeDir = null,
  semanticPath = 'color-system/semantic.json',
  referenceDocs = null,
  syncReferenceFiles = null,
  readJsonFile = null,
  writeJsonFile = null,
  existsPath = null,
} = {}) {
  return {
    model,
    colorScheme,
    variantSpec,
    roleDefs,
    tuning,
    schemeId,
    activeSchemeDir,
    semanticPath,
    referenceDocs,
    syncReferenceFiles,
    readJsonFile,
    writeJsonFile,
    existsPath,
  }
}

function requireRuntimeValue(runtime, key) {
  const value = runtime?.[key]
  if (value == null) {
    throw new Error(`generate-theme-variants: missing runtime value "${key}"`)
  }
  return value
}

function activateThemeVariantRuntime(runtime) {
  ACTIVE_RUNTIME = runtime
  COLOR_LANGUAGE_MODEL = requireRuntimeValue(runtime, 'model')
  COLOR_SCHEME = requireRuntimeValue(runtime, 'colorScheme')
  VARIANT_SPEC = requireRuntimeValue(runtime, 'variantSpec')
  SEMANTIC_PALETTE = COLOR_LANGUAGE_MODEL.semanticPalette
  READABILITY_ROLE_DEFS = requireRuntimeValue(runtime, 'roleDefs')
  ROLE_ID_BY_SCOPE = new Map(
    READABILITY_ROLE_DEFS.flatMap((roleDef) => (roleDef.scopes || []).map((scope) => [scope, roleDef.id]))
  )
  COLOR_SYSTEM_TUNING = requireRuntimeValue(runtime, 'tuning')
  COLOR_SYSTEM_SCHEME_ID = requireRuntimeValue(runtime, 'schemeId')
  COLOR_SYSTEM_ACTIVE_SCHEME_DIR = runtime.activeSchemeDir ?? `color-system/schemes/${COLOR_SYSTEM_SCHEME_ID}`
  COLOR_SYSTEM_SEMANTIC_PATH = runtime.semanticPath
  RAW_DARK_VARIANT = VARIANT_SPEC.variants.find((variant) => variant.id === 'dark') || null
  ROLE_LANE_MODE = String(COLOR_SCHEME?.constraints?.roleLaneMode || 'warm-balanced').trim().toLowerCase()
  LIGHT_CALIBRATION_STRENGTH_BY_VARIANT = COLOR_SCHEME?.constraints?.lightReadabilityCalibrationStrengthByVariant || {}
  LIGHT_SEMANTIC_ANCHOR_STRENGTH_BY_VARIANT = COLOR_SCHEME?.constraints?.lightSemanticAnchorStrengthByVariant || {}

  DARK_THEME_SOURCE_PATH = VARIANT_SPEC.baseSourcePath
  DARK_VARIANT_META = RAW_DARK_VARIANT
    ? {
        ...RAW_DARK_VARIANT,
        name: getVariantDisplayName(RAW_DARK_VARIANT),
      }
    : null
  DARK_THEME_OUTPUT_PATH = DARK_VARIANT_META?.outputPath
  TEMPLATE_DARK_PATH = VARIANT_SPEC.baseTemplatePath
  VARIANT_CONFIG = VARIANT_SPEC.variants
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

  LIGHT_POLARITY_ROLE_OPTIMIZATION = COLOR_SYSTEM_TUNING.lightPolarityRoleOptimization
  SOFT_ROLE_CHROMA_BUDGET = COLOR_SYSTEM_TUNING.softRoleChromaBudget
  LIGHT_READABILITY_CALIBRATION = COLOR_SYSTEM_TUNING.lightReadabilityCalibration
  GLOBAL_SEPARATION_TARGET_BY_VARIANT = COLOR_SYSTEM_TUNING.globalSeparationTargetByVariant
  GLOBAL_SEPARATION_TOLERANCE_BY_VARIANT = COLOR_SYSTEM_TUNING.globalSeparationToleranceByVariant || {}
  VARIANT_BOOST_PROFILE = COLOR_SYSTEM_TUNING.globalSeparationBoostProfileByVariant
  LIGHT_COOL_ROLE_SOFTEN = COLOR_SYSTEM_TUNING.lightCoolRoleSoften
  GLOBAL_SEPARATION_ROLE_PROFILE = COLOR_SYSTEM_TUNING.globalSeparationRoleProfile
  LIGHT_POLARITY_SEARCH_PROFILE = COLOR_SYSTEM_TUNING.lightPolaritySearchProfile
  GLOBAL_SEPARATION_DEFICIT_PROFILE = COLOR_SYSTEM_TUNING.globalSeparationDeficitProfile
  LIGHT_READABILITY_SEARCH_PROFILE = COLOR_SYSTEM_TUNING.lightReadabilitySearchProfile
  TELEMETRY_PROFILE = COLOR_SYSTEM_TUNING.telemetryProfile
  ROLE_LANE_PROFILE = COLOR_SYSTEM_TUNING.roleLaneProfile || {}
  INTERACTION_STATE_BUDGET = COLOR_SYSTEM_TUNING.interactionStateBudget || {}
  INTERACTION_STATE_CONSTRAINTS = COLOR_SYSTEM_TUNING.interactionStateConstraints || []
  ROLE_LANE_COOL_HUE_BAND_BY_VARIANT = ROLE_LANE_PROFILE.coolHueBandByVariant || {}
  ROLE_LANE_WARM_HUE_BAND_BY_VARIANT = ROLE_LANE_PROFILE.warmHueBandByVariant || {}
  ROLE_LANE_NEAR_FG_BY_VARIANT = ROLE_LANE_PROFILE.nearForegroundDeltaEByVariant || {}
  ROLE_LANE_WARM_GAMUT_GUARD = ROLE_LANE_PROFILE.warmGamutGuard || null
  ROLE_LANE_WARM_EXPOSURE_PROFILE = ROLE_LANE_PROFILE.warmExposureProfile || null
  DEFAULT_LIGHT_CALIBRATION = LIGHT_READABILITY_CALIBRATION.default || {}
  LIGHT_ROLE_CALIBRATION = LIGHT_READABILITY_CALIBRATION.byRole || {}
  GLOBAL_SEPARATION_DEFAULT_MAX_BOOST_ROUNDS = VARIANT_BOOST_PROFILE.default?.maxBoostRounds ?? 6
  PAIR_SEPARATION_GATES = COLOR_SYSTEM_TUNING.pairSeparationGates || {}
  CRITICAL_PAIR_DELTAE_BY_VARIANT = ROLE_LANE_PROFILE.criticalPairDeltaEByVariant || {}
  SCHEME_CONTRACT_CRITICAL_PAIRS_CACHE = null
  WARM_ROLE_FREQUENCY_CACHE = null
}

function clearThemeVariantRuntime() {
  ACTIVE_RUNTIME = null
}

export function withThemeVariantRuntime(runtime, callback) {
  const previous = ACTIVE_RUNTIME
  activateThemeVariantRuntime(runtime)
  try {
    return callback()
  } finally {
    if (previous) {
      activateThemeVariantRuntime(previous)
    } else {
      clearThemeVariantRuntime()
    }
  }
}

function getRuntime() {
  if (!ACTIVE_RUNTIME) {
    throw new Error('generate-theme-variants: runtime context is required')
  }
  return ACTIVE_RUNTIME
}

function readJson(path) {
  const reader = getRuntime().readJsonFile
  if (typeof reader !== 'function') {
    throw new Error(`No readJsonFile runtime hook is available for ${path}`)
  }
  return reader(path)
}

function writeJson(path, data) {
  const writer = getRuntime().writeJsonFile
  if (typeof writer !== 'function') {
    throw new Error(`No writeJsonFile runtime hook is available for ${path}`)
  }
  return writer(path, data)
}

function resolveColorLanguageModel({ model = null } = {}) {
  if (model) return model
  return COLOR_LANGUAGE_MODEL
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

function getScopeMatchDetail(entryScopes, scopes) {
  if (!entryScopes?.length || !scopes?.length) {
    return {
      count: 0,
      ratio: 0,
    }
  }

  const matches = entryScopes.filter((scope) => scopes.includes(scope)).length
  return {
    count: matches,
    ratio: matches > 0 ? matches / entryScopes.length : 0,
  }
}

function getBestMatchingTokenEntry(theme, scopes) {
  if (!theme || !scopes || scopes.length === 0) return null

  let bestEntry = null
  let bestRatio = -1
  let bestCount = -1
  let bestScopeLength = Number.POSITIVE_INFINITY

  for (const entry of theme.tokenColors || []) {
    const entryScopes = toScopes(entry)
    const detail = getScopeMatchDetail(entryScopes, scopes)
    if (detail.count === 0) continue

    const isBetter =
      detail.ratio > bestRatio ||
      (detail.ratio === bestRatio && detail.count > bestCount) ||
      (detail.ratio === bestRatio && detail.count === bestCount && entryScopes.length < bestScopeLength)

    if (!isBetter) continue

    bestEntry = entry
    bestRatio = detail.ratio
    bestCount = detail.count
    bestScopeLength = entryScopes.length
  }

  return bestEntry
}

function getTokenColorByScopes(theme, scopes) {
  const entry = getBestMatchingTokenEntry(theme, scopes)
  return resolveHexValue(entry?.settings?.foreground)
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

export function setSemanticColor(theme, semanticKey, nextHex) {
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

export function applyRoleColorToTokenEntries(theme, scopes, nextHex) {
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

function applySemanticPalette(theme, variantId, warnings, semanticPalette = SEMANTIC_PALETTE) {
  if (!theme || !variantId) return
  for (const roleDef of READABILITY_ROLE_DEFS) {
    const roleId = roleDef.id
    if (!roleId) continue
    const color = semanticPalette[roleId]?.[variantId]
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

function applyLightSemanticAnchor(theme, variantId, warnings, semanticPalette = SEMANTIC_PALETTE) {
  if (!theme || !variantId) return
  const rawStrength = LIGHT_SEMANTIC_ANCHOR_STRENGTH_BY_VARIANT?.[variantId]
  const anchorStrength = rawStrength == null ? 0 : clamp(Number(rawStrength), 0, 1)
  if (anchorStrength <= 0) return

  for (const roleDef of READABILITY_ROLE_DEFS) {
    const roleId = roleDef.id
    if (!roleId) continue

    const target = semanticPalette[roleId]?.[variantId]
    const current = getRoleColorFromTheme(theme, roleDef)
    if (!target || !current) continue

    const nextColor = anchorStrength >= 1 ? target : mixHex(current, target, anchorStrength)
    if (!nextColor || normalizeHex(nextColor) === normalizeHex(current)) continue

    applyRoleColorToTokenEntries(theme, roleDef.scopes || [], nextColor)
    for (const semanticKey of roleDef.semanticKeys || []) {
      setSemanticColor(theme, semanticKey, nextColor)
    }

    const drift = deltaE(current, nextColor) ?? 0
    warnings.push(`telemetry: ${variantId}: light semantic anchor nudged ${roleId} by deltaE ${drift.toFixed(1)}`)
  }
}

function getRoleDefById(roleId) {
  return READABILITY_ROLE_DEFS.find((role) => role.id === roleId) ?? null
}

export function getRoleColorFromTheme(theme, roleDef) {
  if (!theme || !roleDef) return null
  return getTokenColorByScopes(theme, roleDef.scopes || []) ?? getSemanticColorByKeys(theme, roleDef.semanticKeys || [])
}

function normalizeRoleScopedTokenEntries(theme) {
  if (!theme || !Array.isArray(theme.tokenColors)) return theme

  theme.tokenColors = theme.tokenColors.flatMap((entry) => {
    const entryScopes = toScopes(entry)
    if (entryScopes.length <= 1) return [entry]

    const groups = []
    const groupMap = new Map()

    for (const scope of entryScopes) {
      const roleId = ROLE_ID_BY_SCOPE.get(scope) || null
      const groupKey = roleId ? `role:${roleId}` : '__unmapped__'
      let group = groupMap.get(groupKey)
      if (!group) {
        group = {
          scopes: [],
        }
        groupMap.set(groupKey, group)
        groups.push(group)
      }
      group.scopes.push(scope)
    }

    if (groups.length <= 1) return [entry]

    return groups.map((group) => ({
      ...entry,
      scope: group.scopes.length === 1 ? group.scopes[0] : group.scopes,
      settings: entry.settings ? { ...entry.settings } : entry.settings,
    }))
  })

  return theme
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

function applyRoleChromaCeiling(theme, variantId, warnings) {
  const budgets = SOFT_ROLE_CHROMA_BUDGET[variantId]
  if (!budgets) return

  for (const [roleId, tuning] of Object.entries(budgets)) {
    if (tuning?.maxChroma == null) continue
    const roleDef = getRoleDefById(roleId)
    if (!roleDef) continue

    const current = getRoleColorFromTheme(theme, roleDef)
    if (!current) continue

    // Declared as a hard chroma ceiling: only an over-cap colour is pulled down to
    // the cap (preserving hue + lightness). The earlier soft budget additionally
    // desaturated and lifted every role unconditionally; that aesthetic shaping is
    // dropped here, which is the source of this phase's ember-light rebaseline.
    const result = solveChromaCeilingColor({ anchor: current, maxChroma: tuning.maxChroma })
    if (!result.adjusted) continue

    const next = result.color
    applyRoleColorToTokenEntries(theme, roleDef.scopes || [], next)
    for (const semanticKey of roleDef.semanticKeys || []) {
      setSemanticColor(theme, semanticKey, next)
    }

    const drift = deltaE(current, next) ?? 0
    warnings.push(`telemetry: ${variantId}: chroma ceiling adjusted ${roleId} by deltaE ${drift.toFixed(1)}`)
  }
}

function assertRoleChromaCeiling(theme, variantId, warnings = null, { enforce = true } = {}) {
  const budgets = SOFT_ROLE_CHROMA_BUDGET[variantId]
  if (!budgets) return

  for (const [roleId, tuning] of Object.entries(budgets)) {
    if (tuning?.maxChroma == null) continue
    const roleDef = getRoleDefById(roleId)
    if (!roleDef) continue

    const current = getRoleColorFromTheme(theme, roleDef)
    if (!current) continue

    const margin = constraintMargin(current, { kind: 'maxChroma', max: tuning.maxChroma })
    if (margin < -CHROMA_CEILING_TOLERANCE) {
      reportConstraintFailure(
        `${variantId}: role ${roleId} violates declared maxChroma ${tuning.maxChroma} ` +
          `by ${Math.abs(margin).toFixed(2)} after final calibration`,
        warnings,
        enforce,
      )
    }
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

    // The hand-tuned repair is now expressed as declared constraints on the role
    // colour: stay inside the lane (hueInBand), clear the canvas (minContrast),
    // and don't drift too far from the authored seed (maxDeltaE). The engine
    // rotates hue + trades lightness/chroma to the least-drift satisfying tone.
    const constraints = [
      { kind: 'hueInBand', hueMin: band.hueMin, hueMax: band.hueMax },
      { kind: 'minContrast', bg: bgColor, ratio: band.minBgContrast },
    ]
    if (band.maxDeltaEFromSeed != null) {
      constraints.push({ kind: 'maxDeltaE', from: current, max: band.maxDeltaEFromSeed })
    }

    try {
      const result = solveHueLaneColor({ anchor: current, constraints })
      if (!result.adjusted) continue

      const bestHex = result.color
      applyRoleColorToTokenEntries(theme, roleDef.scopes || [], bestHex)
      for (const semanticKey of roleDef.semanticKeys || []) {
        setSemanticColor(theme, semanticKey, bestHex)
      }

      const nextHue = hexHue(bestHex)
      warnings.push(
        `telemetry: ${variantId}: role lane ${label} adjusted ${roleId} hue ${(seedHue ?? 0).toFixed(1)} -> ${(nextHue ?? 0).toFixed(1)}`
      )
    } catch (error) {
      throw new Error(
        `${variantId}: role lane ${label} could not adjust ${roleId} into hue range ${band.hueMin}-${band.hueMax}: ${error.message}`,
        { cause: error },
      )
    }
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
  const profile = ROLE_LANE_WARM_EXPOSURE_PROFILE
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
  const profile = ROLE_LANE_WARM_EXPOSURE_PROFILE
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
  const guard = ROLE_LANE_WARM_GAMUT_GUARD
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

  const roleProfiles = resolveVariantRoleProfile(ROLE_LANE_NEAR_FG_BY_VARIANT, variantId)
  for (const [roleId, profile] of Object.entries(roleProfiles)) {
    if (!profile || typeof profile !== 'object') continue
    const roleDef = getRoleDefById(roleId)
    if (!roleDef) continue

    const current = getRoleColorFromTheme(theme, roleDef)
    if (!current) continue

    const currentDelta = deltaE(current, fgColor)
    if (currentDelta == null) continue
    const minDeltaE = profile.minDeltaE ?? 0
    const maxDeltaE = profile.maxDeltaE ?? 200
    const minBgContrast = profile.minBgContrast ?? 1

    // The hand-tuned repair is now declared as a separation lane: stay perceptually
    // far enough from the foreground (minSeparation), not so far it floats off
    // (maxSeparation), and clear the canvas (minContrast). The engine searches
    // toward or away from the foreground depending on which bound is violated.
    try {
      const result = solveNearForegroundColor({
        anchor: current,
        fg: fgColor,
        bg: bgColor,
        minDeltaE,
        maxDeltaE,
        minBgContrast,
        targetDeltaE: profile.targetDeltaE,
      })
      if (!result.adjusted) continue

      const bestHex = result.color
      applyRoleColorToTokenEntries(theme, roleDef.scopes || [], bestHex)
      for (const semanticKey of roleDef.semanticKeys || []) {
        setSemanticColor(theme, semanticKey, bestHex)
      }

      const nextDelta = deltaE(bestHex, fgColor) ?? 0
      warnings.push(
        `telemetry: ${variantId}: role lane near-foreground adjusted ${roleId} deltaE-to-fg ${currentDelta.toFixed(1)} -> ${nextDelta.toFixed(1)}`
      )
    } catch (error) {
      throw new Error(
        `${variantId}: role lane near-foreground budget could not adjust ${roleId} into deltaE ${minDeltaE}-${maxDeltaE}: ${error.message}`,
        { cause: error },
      )
    }
  }
}

function applyRoleLaneProfile(theme, variantId, warnings) {
  if (ROLE_LANE_MODE === 'material-editorial') {
    enforceNearForegroundBudget(theme, variantId, warnings)
    return
  }

  if (ROLE_LANE_MODE === 'contrast-forward' || ROLE_LANE_MODE === 'earthy-groove') {
    enforceRoleHueBand(theme, variantId, warnings, ROLE_LANE_COOL_HUE_BAND_BY_VARIANT, 'cool band')
    enforceNearForegroundBudget(theme, variantId, warnings)
    return
  }

  enforceRoleHueBand(theme, variantId, warnings, ROLE_LANE_COOL_HUE_BAND_BY_VARIANT, 'cool band')
  enforceRoleHueBand(theme, variantId, warnings, ROLE_LANE_WARM_HUE_BAND_BY_VARIANT, 'warm band')
  applyWarmRoleExposureBalance(theme, variantId, warnings)
  enforceRoleHueBand(theme, variantId, warnings, ROLE_LANE_WARM_HUE_BAND_BY_VARIANT, 'warm band')
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

function resolveInteractionConstraintRatio(declaration, budget) {
  if (typeof declaration.ratio === 'number') return declaration.ratio
  const budgetKey = String(declaration.ratioBudget || '').trim()
  if (!budgetKey) {
    throw new Error(`interaction constraint ${declaration.token}: missing ratio or ratioBudget`)
  }
  const ratio = budget?.[budgetKey]
  if (ratio == null) return null
  if (typeof ratio !== 'number' || !Number.isFinite(ratio)) {
    throw new Error(`interaction constraint ${declaration.token}: budget ${budgetKey} must be a finite number`)
  }
  return ratio
}

function normalizeInteractionConstraintDeclaration(declaration, index) {
  if (!declaration || typeof declaration !== 'object' || Array.isArray(declaration)) {
    throw new Error(`interactionStateConstraints[${index}] must be an object`)
  }
  const token = String(declaration.token || '').trim()
  const kind = String(declaration.kind || '').trim()
  const against = String(declaration.against || '').trim()
  if (!token) throw new Error(`interactionStateConstraints[${index}]: token is required`)
  if (!kind) throw new Error(`interactionStateConstraints[${index}]: kind is required`)
  if (!against) throw new Error(`interactionStateConstraints[${index}]: against is required`)
  return {
    ...declaration,
    token,
    kind,
    against,
  }
}

export function buildInteractionStateConstraints(theme, variantId) {
  getRuntime()
  const budget = getInteractionStateBudget(variantId)
  if (!budget || Object.keys(budget).length === 0) return []
  if (!Array.isArray(INTERACTION_STATE_CONSTRAINTS)) {
    throw new Error('interactionStateConstraints must be an array')
  }

  const declarations = []
  for (let i = 0; i < INTERACTION_STATE_CONSTRAINTS.length; i += 1) {
    const declaration = normalizeInteractionConstraintDeclaration(INTERACTION_STATE_CONSTRAINTS[i], i)
    const ratio = resolveInteractionConstraintRatio(declaration, budget)
    if (ratio == null) continue

    const anchor = resolveHexValue(theme?.colors?.[declaration.token])
    const bg = resolveHexValue(theme?.colors?.[declaration.against])
    if (!anchor || !bg) continue

    declarations.push({
      token: declaration.token,
      against: declaration.against,
      anchor,
      constraints: [
        {
          kind: declaration.kind,
          bg,
          ratio,
        },
      ],
    })
  }
  return declarations
}

export function solveInteractionStateConstraint(theme, variantId, warnings, declaration) {
  getRuntime()
  const [constraint] = declaration.constraints || []
  if (!constraint) return

  const before = constraintMargin(declaration.anchor, constraint) + constraint.ratio
  const result = solveConstrainedColor({
    anchor: declaration.anchor,
    constraints: declaration.constraints,
  })
  const after = constraintMargin(result.color, constraint) + constraint.ratio
  const margin = constraintMargin(result.color, constraint)

  if (margin < -1e-9) {
    throw new Error(
      `${variantId}: interaction state ${declaration.token} failed ${constraint.kind} ` +
        `${after.toFixed(3)} < ${constraint.ratio.toFixed(2)} against ${declaration.against}`
    )
  }

  theme.colors[declaration.token] = result.color
  warnings.push(
    `telemetry: ${variantId}: interaction constraint ${declaration.token} ${constraint.kind} ` +
      `${before.toFixed(3)} -> ${after.toFixed(3)} (target >= ${constraint.ratio.toFixed(2)}, ` +
      `margin ${margin.toFixed(3)}, ${result.adjusted ? 'adjusted' : 'satisfied'})`
  )
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

function applyInteractionStateBudget(theme, variantId, warnings, { enforce = true } = {}) {
  const budget = getInteractionStateBudget(variantId)
  if (!budget || Object.keys(budget).length === 0) return

  const bgColor = resolveHexValue(theme?.colors?.[REF_BG_KEY])
  const fgColor = resolveHexValue(theme?.colors?.[REF_FG_KEY])
  if (!bgColor || !fgColor) return

  for (const declaration of buildInteractionStateConstraints(theme, variantId)) {
    runConstraintStep(
      `${variantId}: interaction state ${declaration.token}`,
      warnings,
      enforce,
      () => solveInteractionStateConstraint(theme, variantId, warnings, declaration),
    )
  }
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
  const entryScopes = toScopes(entry)
  let bestRoleId = null
  let bestRatio = -1
  let bestCount = -1
  let bestScopeLength = Number.POSITIVE_INFINITY

  for (const roleDef of READABILITY_ROLE_DEFS) {
    const detail = getScopeMatchDetail(entryScopes, roleDef.scopes || [])
    if (detail.count === 0) continue

    const isBetter =
      detail.ratio > bestRatio ||
      (detail.ratio === bestRatio && detail.count > bestCount) ||
      (detail.ratio === bestRatio && detail.count === bestCount && entryScopes.length < bestScopeLength)

    if (!isBetter) continue

    bestRoleId = roleDef.id
    bestRatio = detail.ratio
    bestCount = detail.count
    bestScopeLength = entryScopes.length
  }
  return bestRoleId
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

function getVariantBoostProfile(variantId) {
  return VARIANT_BOOST_PROFILE[variantId] ?? VARIANT_BOOST_PROFILE.default
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

export function buildGlobalSeparationConstraint(variantId) {
  getRuntime()
  return buildGlobalSeparationConstraintFrom({ tuning: COLOR_SYSTEM_TUNING, variantId })
}

function buildGlobalSeparationTokenEntries(theme, darkTheme) {
  return (theme?.tokenColors || [])
    .map((entry, index) => {
      const color = resolveHexValue(entry?.settings?.foreground)
      if (!color) return null
      return {
        index,
        color,
        baselineColor: resolveHexValue(darkTheme?.tokenColors?.[index]?.settings?.foreground),
        roleId: resolveRoleIdForTokenEntry(entry),
      }
    })
    .filter(Boolean)
}

function buildGlobalSeparationSemanticEntries(theme) {
  return Object.entries(theme?.semanticTokenColors || {})
    .map(([semanticKey, value]) => {
      const color = resolveSemanticForeground(value)
      if (!color) return null
      return {
        semanticKey,
        color,
        roleId: resolveRoleIdForSemanticKey(semanticKey),
      }
    })
    .filter(Boolean)
}

function applyGlobalSeparationSolution(theme, solution) {
  for (const entry of solution.tokenEntries || []) {
    const tokenEntry = theme?.tokenColors?.[entry.index]
    if (!tokenEntry?.settings?.foreground) continue
    tokenEntry.settings = {
      ...tokenEntry.settings,
      foreground: entry.color,
    }
  }

  for (const entry of solution.semanticEntries || []) {
    setSemanticColor(theme, entry.semanticKey, entry.color)
  }
}

function solveGlobalSeparationForTheme(theme, darkTheme, variantId, warnings, constraint) {
  if (!constraint) return computeGlobalSeparationRatio(theme, darkTheme)

  const solution = solveGlobalSeparationConstraint({
    tokenEntries: buildGlobalSeparationTokenEntries(theme, darkTheme),
    semanticEntries: buildGlobalSeparationSemanticEntries(theme),
    constraint,
    roleProfile: GLOBAL_SEPARATION_ROLE_PROFILE,
    boostProfile: getVariantBoostProfile(variantId),
    defaultMaxBoostRounds: GLOBAL_SEPARATION_DEFAULT_MAX_BOOST_ROUNDS,
    deficitProfile: GLOBAL_SEPARATION_DEFICIT_PROFILE,
  })
  applyGlobalSeparationSolution(theme, solution)

  for (const entry of solution.telemetry || []) {
    warnings.push(
      `telemetry: ${variantId}: global separation boosted median ${entry.before.medianRatio.toFixed(2)} -> ${entry.after.medianRatio.toFixed(2)}, p25 ${(entry.before.p25Ratio ?? 0).toFixed(2)} -> ${(entry.after.p25Ratio ?? 0).toFixed(2)}`
    )
  }

  return solution.stats
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

export function computeGlobalSeparationRatio(theme, darkTheme) {
  getRuntime()
  return computeGlobalSeparationStats(buildGlobalSeparationTokenEntries(theme, darkTheme), {
    baselineDeltaE: GLOBAL_SEPARATION_ROLE_PROFILE?.baselineDeltaE ?? 8,
  })
}

function calibrateTokenEntriesForLight(theme, darkTheme, warnings, variantId, bg, fg, darkBg, darkFg) {
  const rawStrength = LIGHT_CALIBRATION_STRENGTH_BY_VARIANT?.[variantId]
  const calibrationStrength = rawStrength == null ? 1 : clamp(Number(rawStrength), 0, 1)
  if (calibrationStrength <= 0) return

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

    const calibrated = solveReadabilityColor({
      anchor: variantColor,
      bg,
      fg,
      targetBgContrast,
      targetFgContrast,
      options: profile,
      search: LIGHT_READABILITY_SEARCH_PROFILE,
    }).color
    const nextColor = calibrationStrength >= 1 ? calibrated : mixHex(variantColor, calibrated, calibrationStrength)

    if (variantEntry?.settings?.foreground) {
      variantEntry.settings = {
        ...variantEntry.settings,
        foreground: nextColor,
      }
    }

    const drift = deltaE(variantColor, nextColor)
    if (drift != null && drift > TELEMETRY_PROFILE.readabilityDriftWarningDeltaE) {
      warnings.push(`${variantId}: full-matrix calibration adjusted token[${i}] by deltaE ${drift.toFixed(1)}`)
    }
  }
}

function calibrateSemanticEntriesForLight(theme, darkTheme, warnings, variantId, bg, fg, darkBg, darkFg) {
  const rawStrength = LIGHT_CALIBRATION_STRENGTH_BY_VARIANT?.[variantId]
  const calibrationStrength = rawStrength == null ? 1 : clamp(Number(rawStrength), 0, 1)
  if (calibrationStrength <= 0) return

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

    const calibrated = solveReadabilityColor({
      anchor: variantColor,
      bg,
      fg,
      targetBgContrast,
      targetFgContrast,
      options: profile,
      search: LIGHT_READABILITY_SEARCH_PROFILE,
    }).color
    const nextColor = calibrationStrength >= 1 ? calibrated : mixHex(variantColor, calibrated, calibrationStrength)

    setSemanticColor(theme, semanticKey, nextColor)

    const drift = deltaE(variantColor, nextColor)
    if (drift != null && drift > TELEMETRY_PROFILE.readabilityDriftWarningDeltaE) {
      warnings.push(`${variantId}: full-matrix calibration adjusted semantic "${semanticKey}" by deltaE ${drift.toFixed(1)}`)
    }
  }
}

function calibrateLightReadability(theme, darkTheme, warnings, variantId) {
  const bg = resolveHexValue(theme?.colors?.[REF_BG_KEY])
  const fg = resolveHexValue(theme?.colors?.[REF_FG_KEY])
  const darkBg = resolveHexValue(darkTheme?.colors?.[REF_BG_KEY])
  const darkFg = resolveHexValue(darkTheme?.colors?.[REF_FG_KEY])

  if (!bg || !fg || !darkBg || !darkFg) return theme

  calibrateTokenEntriesForLight(theme, darkTheme, warnings, variantId, bg, fg, darkBg, darkFg)
  calibrateSemanticEntriesForLight(theme, darkTheme, warnings, variantId, bg, fg, darkBg, darkFg)

  const globalSeparationConstraint = buildGlobalSeparationConstraint(variantId)
  let separation = solveGlobalSeparationForTheme(theme, darkTheme, variantId, warnings, globalSeparationConstraint)
  softenCoolRolesForLight(theme, variantId)
  separation = computeGlobalSeparationRatio(theme, darkTheme)

  if (globalSeparationConstraint && !globalSeparationConstraintSatisfied(separation, globalSeparationConstraint)) {
    const { target } = globalSeparationConstraint
    warnings.push(
      `${variantId}: global separation median ${(separation.medianRatio ?? 0).toFixed(2)} (target ${target.median.toFixed(2)}), p25 ${(separation.p25Ratio ?? 0).toFixed(2)} (target ${target.p25.toFixed(2)}), p10 ${(separation.p10Ratio ?? 0).toFixed(2)} (target ${target.p10.toFixed(2)})`
    )
  }

  return theme
}

// Track B joint optimizer runs on the light variant of these schemes; every other
// variant/scheme keeps the `boost` heuristic, byte-identical. Both moss-light and
// ember-light reach the declared target at the shared drift cap (chroma+lightness
// only, no hue rotation), each verified by assertGlobalSeparationTarget.
const GLOBAL_SEPARATION_JOINT_SCHEMES = new Set(['moss', 'ember'])
const GLOBAL_SEPARATION_JOINT_DRIFT_CAP = 6
export const GLOBAL_SEPARATION_READABILITY_MIN_BG_CONTRAST = 3.0

function resolveGlobalSeparationStrategy(variantId) {
  if (variantId === 'light' && GLOBAL_SEPARATION_JOINT_SCHEMES.has(COLOR_SYSTEM_SCHEME_ID)) return 'joint'
  return 'boost'
}

let PAIR_SEPARATION_GATES = {}
let CRITICAL_PAIR_DELTAE_BY_VARIANT = {}

let SCHEME_CONTRACT_CRITICAL_PAIRS_CACHE = null
function getSchemeContractCriticalPairs() {
  if (SCHEME_CONTRACT_CRITICAL_PAIRS_CACHE) return SCHEME_CONTRACT_CRITICAL_PAIRS_CACHE
  const path = `${COLOR_SYSTEM_ACTIVE_SCHEME_DIR}/color-contract.json`
  const exists = getRuntime().existsPath
  const pairs = typeof exists === 'function' && exists(path) ? (readJson(path)?.criticalPairs || []) : []
  return (SCHEME_CONTRACT_CRITICAL_PAIRS_CACHE = pairs)
}

// Every minimum role-pair separation the audits enforce on light role colors,
// derived by the SHARED quality-contract core (the same derivation theme-audit and
// the Forge worker consume — the merge itself can no longer drift between them).
// The joint optimizer keeps each move above all of these so both audits stay clean
// re-assertions rather than fail-loud backstops.
export function buildCriticalPairFloors(variantId) {
  getRuntime()
  return buildCriticalPairFloorsFrom({
    criticalPairDeltaEByVariant: CRITICAL_PAIR_DELTAE_BY_VARIANT,
    pairSeparationGates: PAIR_SEPARATION_GATES,
    contractCriticalPairs: getSchemeContractCriticalPairs(),
    schemeId: COLOR_SYSTEM_SCHEME_ID,
    variantId,
  })
}

// The per-token invariants a joint candidate must already satisfy so the downstream
// re-assertions (chroma ceiling + role lane) stay no-ops: the role's chroma ceiling,
// its near-foreground separation lane, and a canvas-contrast floor. Built from the
// SAME tuning the downstream passes read, so a constraint-clean candidate is a fixed
// point of those passes.
function buildJointRoleConstraints(roleId, variantId, bg, fg) {
  const constraints = [{ kind: 'minContrast', bg, ratio: GLOBAL_SEPARATION_READABILITY_MIN_BG_CONTRAST }]

  const maxChroma = SOFT_ROLE_CHROMA_BUDGET?.[variantId]?.[roleId]?.maxChroma
  if (maxChroma != null) constraints.push({ kind: 'maxChroma', max: maxChroma })

  const nearFg = resolveVariantRoleProfile(ROLE_LANE_NEAR_FG_BY_VARIANT, variantId)?.[roleId]
  if (nearFg && typeof nearFg === 'object') {
    if (nearFg.minDeltaE != null) constraints.push({ kind: 'minSeparation', from: fg, min: nearFg.minDeltaE })
    if (nearFg.maxDeltaE != null) constraints.push({ kind: 'maxSeparation', from: fg, max: nearFg.maxDeltaE })
    if (nearFg.minBgContrast != null) constraints.push({ kind: 'minContrast', bg, ratio: nearFg.minBgContrast })
  }
  return constraints
}

function applyGlobalSeparationJoint(theme, darkTheme, variantId, warnings) {
  const constraint = buildGlobalSeparationConstraint(variantId)
  if (!constraint) return
  const bg = resolveHexValue(theme?.colors?.[REF_BG_KEY])
  const fg = resolveHexValue(theme?.colors?.[REF_FG_KEY])
  if (!bg || !fg) return

  const tokenEntries = buildGlobalSeparationTokenEntries(theme, darkTheme).map((entry) => ({
    color: entry.color,
    baselineColor: entry.baselineColor,
    unitId: entry.roleId,
  }))

  const units = []
  for (const roleDef of READABILITY_ROLE_DEFS) {
    const roleId = roleDef.id
    if (!roleId) continue
    const color = getRoleColorFromTheme(theme, roleDef)
    if (!color) continue
    units.push({ id: roleId, color, constraints: buildJointRoleConstraints(roleId, variantId, bg, fg) })
  }

  // Critical-pair floors the audit enforces. Index them by unit, and capture current
  // colours of any floor role that is not itself a movable unit (fixed reference).
  const floors = buildCriticalPairFloors(variantId)
  const unitIds = new Set(units.map((unit) => unit.id))
  const pairFloorsByUnit = new Map()
  const externalRoleColors = new Map()
  for (const floor of floors) {
    for (const [roleId, otherId] of [[floor.a, floor.b], [floor.b, floor.a]]) {
      if (!unitIds.has(roleId)) continue
      if (!pairFloorsByUnit.has(roleId)) pairFloorsByUnit.set(roleId, [])
      pairFloorsByUnit.get(roleId).push({ otherId, min: floor.min })
      if (!unitIds.has(otherId) && !externalRoleColors.has(otherId)) {
        const otherDef = getRoleDefById(otherId)
        const otherColor = otherDef ? getRoleColorFromTheme(theme, otherDef) : null
        if (otherColor) externalRoleColors.set(otherId, otherColor)
      }
    }
  }

  // Close any floor the emitted state ALREADY violates (e.g. a raised gate) before
  // the distribution solve: the joint solver only vetoes regressions and assumes
  // floors start satisfied. Closed colours land on the theme and the joint inputs
  // immediately, so the joint pass and the final assertions start from a clean state.
  // Worst-case authored-anchor drift is pair-close + joint (2x the cap), still under
  // the readability drift telemetry threshold.
  const preClose = new Map(units.map((unit) => [unit.id, unit.color]))
  const pairSolution = solveCriticalPairFloors({
    units,
    floors,
    externalRoleColors,
    driftCap: GLOBAL_SEPARATION_JOINT_DRIFT_CAP,
  })
  const closedById = new Map(pairSolution.units.map((unit) => [unit.id, unit.color]))
  for (const unit of pairSolution.units) {
    const before = preClose.get(unit.id)
    if (!unit.color || normalizeHex(unit.color) === normalizeHex(before)) continue
    const roleDef = getRoleDefById(unit.id)
    if (!roleDef) continue
    applyRoleColorToTokenEntries(theme, roleDef.scopes || [], unit.color)
    for (const semanticKey of roleDef.semanticKeys || []) setSemanticColor(theme, semanticKey, unit.color)
    warnings.push(
      `telemetry: ${variantId}: critical-pair close moved ${unit.id} by deltaE ${(deltaE(before, unit.color) ?? 0).toFixed(1)}`
    )
  }
  for (const entry of tokenEntries) {
    const closed = closedById.get(entry.unitId)
    if (closed) entry.color = closed
  }

  const solution = solveGlobalSeparationJoint({
    tokenEntries,
    units: pairSolution.units,
    constraint,
    driftCap: GLOBAL_SEPARATION_JOINT_DRIFT_CAP,
    pairFloorsByUnit,
    externalRoleColors,
  })

  const byId = new Map(pairSolution.units.map((unit) => [unit.id, unit.color]))
  for (const unit of solution.units) {
    const before = byId.get(unit.id)
    if (!unit.color || normalizeHex(unit.color) === normalizeHex(before)) continue
    const roleDef = getRoleDefById(unit.id)
    if (!roleDef) continue
    applyRoleColorToTokenEntries(theme, roleDef.scopes || [], unit.color)
    for (const semanticKey of roleDef.semanticKeys || []) setSemanticColor(theme, semanticKey, unit.color)
    const drift = deltaE(before, unit.color) ?? 0
    warnings.push(`telemetry: ${variantId}: joint separation moved ${unit.id} by deltaE ${drift.toFixed(1)}`)
  }

  const s = solution.stats
  warnings.push(
    `telemetry: ${variantId}: joint separation median ${(s.medianRatio ?? 0).toFixed(2)}, p25 ${(s.p25Ratio ?? 0).toFixed(2)}, p10 ${(s.p10Ratio ?? 0).toFixed(2)} in ${solution.moves.length} move(s)`
  )
}

// Fail loud: the EMITTED theme must meet the declared globalSeparation target. Never
// silently ship a below-target distribution (the failure mode the joint path removes).
// Fail loud: every declared critical-pair floor must hold on the EMITTED theme. The
// theme-audit re-checks the same floors offline; this gate keeps a violation from
// ever being written in the first place (e.g. a raised gate the solvers cannot close).
// Preview mode (enforce=false) downgrades to a warning like every other constraint step.
export function assertCriticalPairFloors(theme, variantId, { enforce = true, warnings = null } = {}) {
  getRuntime()
  const failures = []
  for (const { a, b, min } of buildCriticalPairFloors(variantId)) {
    const defA = getRoleDefById(a)
    const defB = getRoleDefById(b)
    const colorA = defA ? getRoleColorFromTheme(theme, defA) : null
    const colorB = defB ? getRoleColorFromTheme(theme, defB) : null
    if (!colorA || !colorB) continue
    const d = deltaE(colorA, colorB)
    if (d != null && d < min - 1e-9) failures.push(`${a}/${b} deltaE ${d.toFixed(1)} < ${min}`)
  }
  if (failures.length > 0) {
    reportConstraintFailure(
      `${variantId}: emitted critical-pair floors unsatisfied — ${failures.join('; ')}`,
      warnings,
      enforce,
    )
  }
}

export function assertGlobalSeparationTarget(theme, darkTheme, variantId, { enforce = true, warnings = null } = {}) {
  getRuntime()
  const constraint = buildGlobalSeparationConstraint(variantId)
  if (!constraint) return
  const stats = computeGlobalSeparationRatio(theme, darkTheme)
  // Fail closed on a degenerate distribution: globalSeparationConstraintSatisfied is
  // fail-open when there are no measurable pairs, so a broken token/baseline mapping
  // would otherwise slip past this hard gate silently.
  if (!stats.pairCount) {
    reportConstraintFailure(
      `${variantId}: emitted globalSeparation has no measurable token pairs — degenerate token/baseline mapping`,
      warnings,
      enforce,
    )
    return
  }
  if (globalSeparationConstraintSatisfied(stats, constraint)) return
  const { target } = constraint
  reportConstraintFailure(
    `${variantId}: emitted globalSeparation misses target — ` +
      `median ${(stats.medianRatio ?? 0).toFixed(3)} (>= ${target.median}), ` +
      `p25 ${(stats.p25Ratio ?? 0).toFixed(3)} (>= ${target.p25}), ` +
      `p10 ${(stats.p10Ratio ?? 0).toFixed(3)} (>= ${target.p10})`,
    warnings,
    enforce,
  )
}

function validateTemplateAvailability(path) {
  const exists = getRuntime().existsPath
  if (typeof exists !== 'function') {
    throw new Error(`No existsPath runtime hook is available for ${path}`)
  }
  if (!exists(path)) {
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

function buildVariantTheme(currentDark, baselineDark, baselineVariant, variantMeta, warnings, {
  semanticPalette = SEMANTIC_PALETTE,
  enforce = true,
} = {}) {
  const generated = {
    ...currentDark,
    name: variantMeta.name,
    type: variantMeta.type,
    colors: transformColors(currentDark, baselineDark, baselineVariant, warnings, variantMeta.id),
    tokenColors: transformTokenColors(currentDark, baselineDark, baselineVariant, warnings, variantMeta.id),
    semanticTokenColors: transformSemanticTokenColors(currentDark, baselineDark, baselineVariant, warnings, variantMeta.id),
  }

  if (variantMeta.type === 'light') {
    runConstraintStep(
      `${variantMeta.id}: light readability calibration`,
      warnings,
      enforce,
      () => calibrateLightReadability(generated, currentDark, warnings, variantMeta.id),
    )
  }

  applySemanticPalette(generated, variantMeta.id, warnings, semanticPalette)
  if (variantMeta.type === 'light') {
    applyLightPolarityCompensation(generated, variantMeta.id, warnings)
  }
  applyRoleChromaCeiling(generated, variantMeta.id, warnings)
  if (variantMeta.type === 'light' && variantMeta.id.toLowerCase().includes('soft')) {
    // Soft chroma budgets can reintroduce low-separation cases; run a final polarity guard pass.
    applyLightPolarityCompensation(generated, variantMeta.id, warnings)
  }
  if (variantMeta.type === 'light') {
    applyLightSemanticAnchor(generated, variantMeta.id, warnings, semanticPalette)
  }
  runConstraintStep(
    `${variantMeta.id}: role lane profile`,
    warnings,
    enforce,
    () => applyRoleLaneProfile(generated, variantMeta.id, warnings),
  )
  applyRoleChromaCeiling(generated, variantMeta.id, warnings)
  assertRoleChromaCeiling(generated, variantMeta.id, warnings, { enforce })

  // Track B: the joint separation optimizer runs LAST, on the emitted colours. Its
  // candidates are pre-filtered through each role's per-token constraints, so the
  // chroma-ceiling + role-lane re-assertions below stay no-ops; the final target
  // assertion fails loud if the emitted distribution still misses.
  if (variantMeta.type === 'light' && resolveGlobalSeparationStrategy(variantMeta.id) === 'joint') {
    runConstraintStep(
      `${variantMeta.id}: global separation joint optimizer`,
      warnings,
      enforce,
      () => applyGlobalSeparationJoint(generated, currentDark, variantMeta.id, warnings),
    )
    runConstraintStep(
      `${variantMeta.id}: post-joint role lane profile`,
      warnings,
      enforce,
      () => applyRoleLaneProfile(generated, variantMeta.id, warnings),
    )
    applyRoleChromaCeiling(generated, variantMeta.id, warnings)
    assertRoleChromaCeiling(generated, variantMeta.id, warnings, { enforce })
    assertGlobalSeparationTarget(generated, currentDark, variantMeta.id, { enforce, warnings })
    assertCriticalPairFloors(generated, variantMeta.id, { enforce, warnings })
  }

  applyInteractionStateBudget(generated, variantMeta.id, warnings, { enforce })

  return generated
}

// Build the calibrated VS Code theme objects in memory (no file writes), keyed by
// variant id, alongside their output paths and any warnings. Exported as a seam so
// the engine can consume the theme objects directly instead of re-reading the
// committed JSON from disk. Migration step 1 toward engine-owned VS Code themes
// (see docs/theme-engine-extraction-plan.md §11). `generateThemeVariants` now just
// writes what this returns, so output stays byte-identical.
export function buildVscodeThemes({
  runtime = null,
  model = null,
  colorScheme = null,
  variantSpec = null,
  roleDefs = null,
  tuning = null,
  schemeId = null,
  activeSchemeDir = null,
  semanticPath = 'color-system/semantic.json',
  referenceDocs = null,
  syncReferenceFiles = null,
  readJsonFile = null,
  existsPath = null,
  writeReferenceFiles = true,
  writeReferenceJson = undefined,
  enforce = true,
  log = console.log,
} = {}) {
  const themeRuntime = runtime ?? createThemeVariantRuntime({
    model,
    colorScheme,
    variantSpec,
    roleDefs,
    tuning,
    schemeId,
    activeSchemeDir,
    semanticPath,
    referenceDocs,
    syncReferenceFiles,
    readJsonFile,
    existsPath,
  })
  return withThemeVariantRuntime(themeRuntime, () => {
  const colorLanguageModel = resolveColorLanguageModel({ model: themeRuntime.model })
  // Consume the reference docs straight from sync's in-memory return instead of
  // reading them back off disk (byte-identical: the returned doc is what was just
  // written). Falls back to the on-disk read if a path isn't in the map. This
  // removes the calibration's disk-read round-trip — a step toward running it
  // in-memory / in the browser. The files are still written for committed refs.
  const refs = themeRuntime.referenceDocs ?? (
    typeof themeRuntime.syncReferenceFiles === 'function'
      ? themeRuntime.syncReferenceFiles(colorLanguageModel, VARIANT_SPEC, {
          write: writeReferenceFiles,
          ...(writeReferenceJson ? { writeJson: writeReferenceJson } : {}),
          log,
        })
      : null
  )
  const readRef = (path) => (refs && refs[path] ? structuredClone(refs[path]) : readJson(path))
  validateTemplateAvailability(DARK_THEME_SOURCE_PATH)
  validateTemplateAvailability(TEMPLATE_DARK_PATH)

  const currentDark = normalizeRoleScopedTokenEntries(readRef(DARK_THEME_SOURCE_PATH))
  const baselineDark = normalizeRoleScopedTokenEntries(readRef(TEMPLATE_DARK_PATH))
  const warnings = []

  warnTemplateDrift(currentDark, baselineDark, warnings)
  applySemanticPalette(currentDark, 'dark', warnings, colorLanguageModel.semanticPalette)
  applyRoleChromaCeiling(currentDark, 'dark', warnings)
  runConstraintStep(
    'dark: role lane profile',
    warnings,
    enforce,
    () => applyRoleLaneProfile(currentDark, 'dark', warnings),
  )
  applyRoleChromaCeiling(currentDark, 'dark', warnings)
  assertRoleChromaCeiling(currentDark, 'dark', warnings, { enforce })
  applyInteractionStateBudget(currentDark, 'dark', warnings, { enforce })
  currentDark.name = DARK_VARIANT_META.name
  currentDark.type = DARK_VARIANT_META.type

  const themes = { [DARK_VARIANT_META.id]: currentDark }
  const outputPaths = { [DARK_VARIANT_META.id]: DARK_THEME_OUTPUT_PATH }
  for (const variantMeta of VARIANT_CONFIG) {
    validateTemplateAvailability(variantMeta.templatePath)
    const baselineVariant = normalizeRoleScopedTokenEntries(readRef(variantMeta.templatePath))
    themes[variantMeta.id] = buildVariantTheme(currentDark, baselineDark, baselineVariant, variantMeta, warnings, {
      semanticPalette: colorLanguageModel.semanticPalette,
      enforce,
    })
    outputPaths[variantMeta.id] = variantMeta.outputPath
  }

  return { themes, outputPaths, warnings }
  })
}

// `writeThemes:false` keeps the shared side effects (base-dark.source/templates via
// buildVscodeThemes, and the semantic snapshot) but does NOT write the theme JSONs —
// so sync-themes can let the engine (compile + vscodeEmitter) own the active scheme's
// theme writes. The ember subprocess + standalone use the default (writeThemes:true).
// Returns the built theme objects either way (plan §11 step 4).
export function generateThemeVariants({
  runtime = null,
  model = null,
  colorScheme = null,
  variantSpec = null,
  roleDefs = null,
  tuning = null,
  schemeId = null,
  activeSchemeDir = null,
  semanticPath = 'color-system/semantic.json',
  referenceDocs = null,
  syncReferenceFiles = null,
  readJsonFile = null,
  existsPath = null,
  writeThemes = true,
  writeReferenceFiles = true,
  writeSemanticSnapshot = true,
  preview = false,
  writeJsonFile = writeJson,
  writeReferenceJson = undefined,
  enforce = true,
  log = console.log,
} = {}) {
  const themeRuntime = runtime ?? createThemeVariantRuntime({
    model,
    colorScheme,
    variantSpec,
    roleDefs,
    tuning,
    schemeId,
    activeSchemeDir,
    semanticPath,
    referenceDocs,
    syncReferenceFiles,
    readJsonFile,
    writeJsonFile,
    existsPath,
  })
  return withThemeVariantRuntime(themeRuntime, () => {
  const colorLanguageModel = resolveColorLanguageModel({ model: themeRuntime.model })
  const shouldWriteThemes = preview ? false : writeThemes
  const shouldWriteReferenceFiles = preview ? false : writeReferenceFiles
  const shouldWriteSemanticSnapshot = preview ? false : writeSemanticSnapshot
  const emitLog = typeof log === 'function' ? log : () => {}
  const { themes, outputPaths, warnings } = buildVscodeThemes({
    runtime: themeRuntime,
    writeReferenceFiles: shouldWriteReferenceFiles,
    writeReferenceJson,
    enforce,
    log: emitLog,
  })

  const semanticSnapshotChanged = shouldWriteSemanticSnapshot
    ? writeJsonFile(COLOR_SYSTEM_SEMANTIC_PATH, colorLanguageModel.semanticSnapshot)
    : false
  emitLog(
    `${shouldWriteSemanticSnapshot ? (semanticSnapshotChanged ? '鉁?generated' : '- unchanged') : '- preview'} ${COLOR_SYSTEM_SEMANTIC_PATH} from ${colorLanguageModel.sources.foundation}`
  )

  if (shouldWriteThemes) {
    for (const [variantId, theme] of Object.entries(themes)) {
      const changed = writeJsonFile(outputPaths[variantId], theme)
      emitLog(
        `${changed ? '鉁?generated' : '- unchanged'} ${outputPaths[variantId]} from ${DARK_THEME_SOURCE_PATH}`
      )
    }
  }

  if (warnings.length > 0) {
    const telemetry = warnings.filter((message) => message.startsWith('telemetry: '))
    const realWarnings = warnings.filter((message) => !message.startsWith('telemetry: '))

    if (realWarnings.length > 0) {
      emitLog('\n[WARN] Variant generator fallbacks:')
      for (const warning of realWarnings) {
        emitLog(`  - ${warning}`)
      }
    }

    if (telemetry.length > 0) {
      emitLog('\n[INFO] Variant tuning telemetry:')
      for (const message of telemetry) {
        emitLog(`  - ${message.replace(/^telemetry:\s*/, '')}`)
      }
    }
  }

  return { themes, outputPaths, warnings }
  })
}
