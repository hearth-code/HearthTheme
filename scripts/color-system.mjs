import { readFileSync } from 'fs'

export const COLOR_SYSTEM_VARIANTS_PATH = 'color-system/variants.json'
export const COLOR_SYSTEM_ADAPTERS_PATH = 'color-system/adapters.json'
export const COLOR_SYSTEM_SEMANTIC_PATH = 'color-system/semantic.json'
export const COLOR_SYSTEM_TUNING_PATH = 'color-system/tuning.json'

const HEX_RE = /^#[0-9a-f]{6}$/i

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function normalizeHex(hex) {
  if (typeof hex !== 'string') return null
  const value = hex.trim().toLowerCase()
  if (!HEX_RE.test(value)) return null
  return value
}

function normalizeNumber(value, label, { min = null, max = null, allowNull = false } = {}) {
  if (value == null) {
    if (allowNull) return null
    throw new Error(`${label} must be a number`)
  }
  const number = Number(value)
  assert(Number.isFinite(number), `${label} must be a finite number`)
  if (min != null) assert(number >= min, `${label} must be >= ${min}`)
  if (max != null) assert(number <= max, `${label} must be <= ${max}`)
  return number
}

function normalizeRoleList(list, roleIds, label) {
  if (list == null) return []
  assert(Array.isArray(list), `${label} must be an array`)
  const values = list.map((item) => String(item || '').trim()).filter(Boolean)
  for (const roleId of values) {
    assert(roleIds.has(roleId), `${label} contains unknown role "${roleId}"`)
  }
  return [...new Set(values)]
}

function normalizeOptionalNumber(value, label, options = {}) {
  if (value === undefined) return undefined
  return normalizeNumber(value, label, { ...options })
}

function normalizeRoleNumberMap(
  mapValue,
  roleIds,
  label,
  { min = null, max = null, allowNull = false, allowPseudoKeys = [] } = {}
) {
  if (mapValue == null) return {}
  assert(mapValue && typeof mapValue === 'object' && !Array.isArray(mapValue), `${label} must be an object`)
  const out = {}
  const pseudo = new Set(allowPseudoKeys)
  for (const [rawKey, rawValue] of Object.entries(mapValue)) {
    const key = String(rawKey || '').trim()
    assert(key, `${label} has invalid role key`)
    if (!roleIds.has(key) && !pseudo.has(key)) {
      throw new Error(`${label} contains unknown role "${key}"`)
    }
    out[key] = normalizeNumber(rawValue, `${label}.${key}`, { min, max, allowNull })
  }
  return out
}

function normalizeNumberArray(
  listValue,
  label,
  { min = null, max = null, allowEmpty = false, requireInteger = false } = {}
) {
  assert(Array.isArray(listValue), `${label} must be an array`)
  const out = listValue.map((item, index) => {
    const value = normalizeNumber(item, `${label}[${index}]`, { min, max })
    if (requireInteger) assert(Number.isInteger(value), `${label}[${index}] must be an integer`)
    return value
  })
  if (!allowEmpty) assert(out.length > 0, `${label} must not be empty`)
  return out
}

function normalizeReadabilityCalibrationProfile(profile, label) {
  assert(profile && typeof profile === 'object' && !Array.isArray(profile), `${label} must be an object`)
  const out = {}

  out.bgPow = normalizeOptionalNumber(profile.bgPow, `${label}.bgPow`, { min: 0, max: 4 })
  out.fgPow = normalizeOptionalNumber(profile.fgPow, `${label}.fgPow`, { min: 0, max: 4 })
  out.wBg = normalizeOptionalNumber(profile.wBg, `${label}.wBg`, { min: 0, max: 4 })
  out.wFg = normalizeOptionalNumber(profile.wFg, `${label}.wFg`, { min: 0, max: 4 })
  out.wDrift = normalizeOptionalNumber(profile.wDrift, `${label}.wDrift`, { min: 0, max: 4 })
  out.minContrast = normalizeOptionalNumber(profile.minContrast, `${label}.minContrast`, { min: 1, max: 21 })
  out.minL = normalizeOptionalNumber(profile.minL, `${label}.minL`, { min: 0, max: 100 })
  out.maxL = normalizeOptionalNumber(profile.maxL, `${label}.maxL`, { min: 0, max: 100 })
  out.minScale = normalizeOptionalNumber(profile.minScale, `${label}.minScale`, { min: 0, max: 6 })
  out.maxScale = normalizeOptionalNumber(profile.maxScale, `${label}.maxScale`, { min: 0, max: 6 })
  out.targetL = normalizeOptionalNumber(profile.targetL, `${label}.targetL`, { min: 0, max: 100, allowNull: true })
  out.wL = normalizeOptionalNumber(profile.wL, `${label}.wL`, { min: 0, max: 4 })
  out.minFgContrast = normalizeOptionalNumber(profile.minFgContrast, `${label}.minFgContrast`, { min: 0, max: 21 })

  const defined = Object.fromEntries(Object.entries(out).filter(([, value]) => value !== undefined))
  if (defined.minL != null && defined.maxL != null) {
    assert(defined.minL <= defined.maxL, `${label}: minL must be <= maxL`)
  }
  if (defined.minScale != null && defined.maxScale != null) {
    assert(defined.minScale <= defined.maxScale, `${label}: minScale must be <= maxScale`)
  }
  return defined
}

function normalizeSiteAssetExpression(value, label, depth = 0) {
  assert(depth <= 32, `${label} exceeds max nesting depth`)
  if (typeof value === 'string') {
    const text = value.trim()
    assert(text.length > 0, `${label} must be a non-empty string`)
    return text
  }
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be a string or an expression object`)
  const type = String(value.type || '').trim()
  assert(type === 'mix' || type === 'alpha', `${label}.type must be "mix" or "alpha"`)
  if (type === 'mix') {
    return {
      type: 'mix',
      a: normalizeSiteAssetExpression(value.a, `${label}.a`, depth + 1),
      b: normalizeSiteAssetExpression(value.b, `${label}.b`, depth + 1),
      t: normalizeNumber(value.t, `${label}.t`, { min: 0, max: 1 }),
    }
  }
  return {
    type: 'alpha',
    color: normalizeSiteAssetExpression(value.color, `${label}.color`, depth + 1),
    value: normalizeNumber(value.value, `${label}.value`, { min: 0, max: 1 }),
  }
}

function normalizeSiteAssetVarMap(mapValue, label) {
  assert(mapValue && typeof mapValue === 'object' && !Array.isArray(mapValue), `${label} must be an object`)
  const out = {}
  for (const [varName, expr] of Object.entries(mapValue)) {
    const key = String(varName || '').trim()
    assert(key.startsWith('--'), `${label} key "${key}" must start with "--"`)
    out[key] = normalizeSiteAssetExpression(expr, `${label}.${key}`)
  }
  return out
}

export function loadColorSystemVariants() {
  const data = readJson(COLOR_SYSTEM_VARIANTS_PATH)
  assert(data && typeof data === 'object' && !Array.isArray(data), `${COLOR_SYSTEM_VARIANTS_PATH} must be an object`)
  assert(typeof data.baseSourcePath === 'string' && data.baseSourcePath.length > 0, `${COLOR_SYSTEM_VARIANTS_PATH}: missing baseSourcePath`)
  assert(typeof data.baseTemplatePath === 'string' && data.baseTemplatePath.length > 0, `${COLOR_SYSTEM_VARIANTS_PATH}: missing baseTemplatePath`)
  assert(Array.isArray(data.variants) && data.variants.length > 0, `${COLOR_SYSTEM_VARIANTS_PATH}: variants must be a non-empty array`)

  const ids = new Set()
  for (const variant of data.variants) {
    assert(variant && typeof variant === 'object', `${COLOR_SYSTEM_VARIANTS_PATH}: invalid variant entry`)
    assert(typeof variant.id === 'string' && variant.id.length > 0, `${COLOR_SYSTEM_VARIANTS_PATH}: variant.id is required`)
    assert(!ids.has(variant.id), `${COLOR_SYSTEM_VARIANTS_PATH}: duplicate variant id "${variant.id}"`)
    ids.add(variant.id)
    assert(typeof variant.name === 'string' && variant.name.length > 0, `${COLOR_SYSTEM_VARIANTS_PATH}: variant "${variant.id}" missing name`)
    assert(variant.type === 'dark' || variant.type === 'light', `${COLOR_SYSTEM_VARIANTS_PATH}: variant "${variant.id}" has invalid type`)
    assert(variant.mode === 'source' || variant.mode === 'derived', `${COLOR_SYSTEM_VARIANTS_PATH}: variant "${variant.id}" has invalid mode`)
    assert(typeof variant.outputPath === 'string' && variant.outputPath.length > 0, `${COLOR_SYSTEM_VARIANTS_PATH}: variant "${variant.id}" missing outputPath`)
    if (variant.mode === 'derived') {
      assert(typeof variant.templatePath === 'string' && variant.templatePath.length > 0, `${COLOR_SYSTEM_VARIANTS_PATH}: derived variant "${variant.id}" missing templatePath`)
    }
  }

  return data
}

export function getThemeOutputFiles() {
  const variants = loadColorSystemVariants().variants
  return Object.fromEntries(variants.map((variant) => [variant.id, variant.outputPath]))
}

export function getThemeMetaList() {
  const variants = loadColorSystemVariants().variants
  return variants.map((variant) => ({
    id: variant.id,
    path: variant.outputPath,
    type: variant.type,
  }))
}

export function loadRoleAdapters() {
  const data = readJson(COLOR_SYSTEM_ADAPTERS_PATH)
  assert(data && typeof data === 'object' && !Array.isArray(data), `${COLOR_SYSTEM_ADAPTERS_PATH} must be an object`)
  assert(Array.isArray(data.roles) && data.roles.length > 0, `${COLOR_SYSTEM_ADAPTERS_PATH}: roles must be a non-empty array`)

  const ids = new Set()
  const roles = data.roles.map((role) => {
    assert(role && typeof role === 'object', `${COLOR_SYSTEM_ADAPTERS_PATH}: invalid role entry`)
    const id = String(role.id || '').trim()
    assert(id, `${COLOR_SYSTEM_ADAPTERS_PATH}: role.id is required`)
    assert(!ids.has(id), `${COLOR_SYSTEM_ADAPTERS_PATH}: duplicate role id "${id}"`)
    ids.add(id)

    const scopes = Array.isArray(role.scopes) ? role.scopes.map((item) => String(item || '').trim()).filter(Boolean) : []
    const semanticKeys = Array.isArray(role.semanticKeys)
      ? role.semanticKeys.map((item) => String(item || '').trim()).filter(Boolean)
      : []

    return {
      id,
      scopes,
      semanticKeys,
      vscodeSemantic: role.vscodeSemantic == null ? null : String(role.vscodeSemantic).trim() || null,
      obsidianVar: role.obsidianVar == null ? null : String(role.obsidianVar).trim() || null,
      webToken: role.webToken == null ? null : String(role.webToken).trim() || null,
      includeInReport: Boolean(role.includeInReport),
      requireTokenCoverage: role.requireTokenCoverage !== false,
    }
  })

  return roles
}

export function loadSemanticPalette() {
  const variants = loadColorSystemVariants().variants
  const variantIds = variants.map((variant) => variant.id)
  const roleIds = new Set(loadRoleAdapters().map((role) => role.id))

  const data = readJson(COLOR_SYSTEM_SEMANTIC_PATH)
  assert(data && typeof data === 'object' && !Array.isArray(data), `${COLOR_SYSTEM_SEMANTIC_PATH} must be an object`)
  assert(data.roles && typeof data.roles === 'object' && !Array.isArray(data.roles), `${COLOR_SYSTEM_SEMANTIC_PATH}: roles must be an object`)

  const palette = {}

  for (const [roleId, valueByVariant] of Object.entries(data.roles)) {
    assert(roleIds.has(roleId), `${COLOR_SYSTEM_SEMANTIC_PATH}: unknown role "${roleId}"`)
    assert(valueByVariant && typeof valueByVariant === 'object' && !Array.isArray(valueByVariant), `${COLOR_SYSTEM_SEMANTIC_PATH}: role "${roleId}" must map to an object`)
    palette[roleId] = {}

    for (const variantId of variantIds) {
      const color = normalizeHex(valueByVariant[variantId])
      assert(color, `${COLOR_SYSTEM_SEMANTIC_PATH}: role "${roleId}" missing valid color for variant "${variantId}"`)
      palette[roleId][variantId] = color
    }
  }

  return palette
}

export function loadColorSystemTuning() {
  const variants = loadColorSystemVariants().variants
  const variantIds = new Set(variants.map((variant) => variant.id))
  const variantTypeById = new Map(variants.map((variant) => [variant.id, variant.type]))
  const roleIds = new Set(loadRoleAdapters().map((role) => role.id))

  const data = readJson(COLOR_SYSTEM_TUNING_PATH)
  assert(data && typeof data === 'object' && !Array.isArray(data), `${COLOR_SYSTEM_TUNING_PATH} must be an object`)

  const rawPolarity = data.lightPolarityRoleOptimization ?? {}
  assert(rawPolarity && typeof rawPolarity === 'object' && !Array.isArray(rawPolarity), `${COLOR_SYSTEM_TUNING_PATH}: lightPolarityRoleOptimization must be an object`)

  const rawSoftBudget = data.softRoleChromaBudget ?? {}
  assert(rawSoftBudget && typeof rawSoftBudget === 'object' && !Array.isArray(rawSoftBudget), `${COLOR_SYSTEM_TUNING_PATH}: softRoleChromaBudget must be an object`)
  const rawGlobalSeparationTargets = data.globalSeparationTargetByVariant ?? {}
  assert(rawGlobalSeparationTargets && typeof rawGlobalSeparationTargets === 'object' && !Array.isArray(rawGlobalSeparationTargets), `${COLOR_SYSTEM_TUNING_PATH}: globalSeparationTargetByVariant must be an object`)
  const rawGlobalSeparationToleranceByVariant = data.globalSeparationToleranceByVariant ?? {}
  assert(rawGlobalSeparationToleranceByVariant && typeof rawGlobalSeparationToleranceByVariant === 'object' && !Array.isArray(rawGlobalSeparationToleranceByVariant), `${COLOR_SYSTEM_TUNING_PATH}: globalSeparationToleranceByVariant must be an object`)
  const rawGlobalSeparationBoostProfiles = data.globalSeparationBoostProfileByVariant ?? {}
  assert(rawGlobalSeparationBoostProfiles && typeof rawGlobalSeparationBoostProfiles === 'object' && !Array.isArray(rawGlobalSeparationBoostProfiles), `${COLOR_SYSTEM_TUNING_PATH}: globalSeparationBoostProfileByVariant must be an object`)
  const rawLightReadabilityCalibration = data.lightReadabilityCalibration ?? {}
  assert(rawLightReadabilityCalibration && typeof rawLightReadabilityCalibration === 'object' && !Array.isArray(rawLightReadabilityCalibration), `${COLOR_SYSTEM_TUNING_PATH}: lightReadabilityCalibration must be an object`)
  const rawLightCoolRoleSoften = data.lightCoolRoleSoften ?? {}
  assert(rawLightCoolRoleSoften && typeof rawLightCoolRoleSoften === 'object' && !Array.isArray(rawLightCoolRoleSoften), `${COLOR_SYSTEM_TUNING_PATH}: lightCoolRoleSoften must be an object`)
  const rawGlobalSeparationRoleProfile = data.globalSeparationRoleProfile ?? {}
  assert(rawGlobalSeparationRoleProfile && typeof rawGlobalSeparationRoleProfile === 'object' && !Array.isArray(rawGlobalSeparationRoleProfile), `${COLOR_SYSTEM_TUNING_PATH}: globalSeparationRoleProfile must be an object`)
  const rawLightPolaritySearchProfile = data.lightPolaritySearchProfile ?? {}
  assert(rawLightPolaritySearchProfile && typeof rawLightPolaritySearchProfile === 'object' && !Array.isArray(rawLightPolaritySearchProfile), `${COLOR_SYSTEM_TUNING_PATH}: lightPolaritySearchProfile must be an object`)
  const rawGlobalSeparationDeficitProfile = data.globalSeparationDeficitProfile ?? {}
  assert(rawGlobalSeparationDeficitProfile && typeof rawGlobalSeparationDeficitProfile === 'object' && !Array.isArray(rawGlobalSeparationDeficitProfile), `${COLOR_SYSTEM_TUNING_PATH}: globalSeparationDeficitProfile must be an object`)
  const rawPairSeparationGates = data.pairSeparationGates ?? {}
  assert(rawPairSeparationGates && typeof rawPairSeparationGates === 'object' && !Array.isArray(rawPairSeparationGates), `${COLOR_SYSTEM_TUNING_PATH}: pairSeparationGates must be an object`)
  const rawLightReadabilitySearchProfile = data.lightReadabilitySearchProfile ?? {}
  assert(rawLightReadabilitySearchProfile && typeof rawLightReadabilitySearchProfile === 'object' && !Array.isArray(rawLightReadabilitySearchProfile), `${COLOR_SYSTEM_TUNING_PATH}: lightReadabilitySearchProfile must be an object`)
  const rawTelemetryProfile = data.telemetryProfile ?? {}
  assert(rawTelemetryProfile && typeof rawTelemetryProfile === 'object' && !Array.isArray(rawTelemetryProfile), `${COLOR_SYSTEM_TUNING_PATH}: telemetryProfile must be an object`)
  const rawSiteDocsProfile = data.siteDocsProfile ?? {}
  assert(rawSiteDocsProfile && typeof rawSiteDocsProfile === 'object' && !Array.isArray(rawSiteDocsProfile), `${COLOR_SYSTEM_TUNING_PATH}: siteDocsProfile must be an object`)
  const rawSiteAssetMapping = data.siteAssetMapping ?? {}
  assert(rawSiteAssetMapping && typeof rawSiteAssetMapping === 'object' && !Array.isArray(rawSiteAssetMapping), `${COLOR_SYSTEM_TUNING_PATH}: siteAssetMapping must be an object`)

  const lightPolarityRoleOptimization = {}
  for (const [variantId, roleProfiles] of Object.entries(rawPolarity)) {
    assert(variantIds.has(variantId), `${COLOR_SYSTEM_TUNING_PATH}: unknown variant "${variantId}" in lightPolarityRoleOptimization`)
    assert(roleProfiles && typeof roleProfiles === 'object' && !Array.isArray(roleProfiles), `${COLOR_SYSTEM_TUNING_PATH}: invalid role profile map for variant "${variantId}"`)
    lightPolarityRoleOptimization[variantId] = {}

    for (const [roleId, profile] of Object.entries(roleProfiles)) {
      assert(roleIds.has(roleId), `${COLOR_SYSTEM_TUNING_PATH}: unknown role "${roleId}" in lightPolarityRoleOptimization.${variantId}`)
      assert(profile && typeof profile === 'object' && !Array.isArray(profile), `${COLOR_SYSTEM_TUNING_PATH}: invalid profile for ${variantId}.${roleId}`)

      lightPolarityRoleOptimization[variantId][roleId] = {
        minBgHueDistance: normalizeNumber(profile.minBgHueDistance, `${COLOR_SYSTEM_TUNING_PATH}: ${variantId}.${roleId}.minBgHueDistance`, { min: 0, max: 180 }),
        targetBgHueDistance: normalizeNumber(profile.targetBgHueDistance, `${COLOR_SYSTEM_TUNING_PATH}: ${variantId}.${roleId}.targetBgHueDistance`, { min: 0, max: 180 }),
        minAnchorDeltaE: normalizeNumber(profile.minAnchorDeltaE, `${COLOR_SYSTEM_TUNING_PATH}: ${variantId}.${roleId}.minAnchorDeltaE`, { min: 0, max: 200 }),
        minGuardDeltaE: normalizeNumber(profile.minGuardDeltaE, `${COLOR_SYSTEM_TUNING_PATH}: ${variantId}.${roleId}.minGuardDeltaE`, { min: 0, max: 200, allowNull: true }),
        minContrast: normalizeNumber(profile.minContrast, `${COLOR_SYSTEM_TUNING_PATH}: ${variantId}.${roleId}.minContrast`, { min: 1, max: 21 }),
        maxDeltaEFromSeed: normalizeNumber(profile.maxDeltaEFromSeed, `${COLOR_SYSTEM_TUNING_PATH}: ${variantId}.${roleId}.maxDeltaEFromSeed`, { min: 0, max: 200 }),
        targetPreferredHueDistance: normalizeNumber(
          profile.targetPreferredHueDistance,
          `${COLOR_SYSTEM_TUNING_PATH}: ${variantId}.${roleId}.targetPreferredHueDistance`,
          { min: 1, max: 180, allowNull: true }
        ),
        anchorRoles: normalizeRoleList(profile.anchorRoles, roleIds, `${COLOR_SYSTEM_TUNING_PATH}: ${variantId}.${roleId}.anchorRoles`),
        guardRoles: normalizeRoleList(profile.guardRoles, roleIds, `${COLOR_SYSTEM_TUNING_PATH}: ${variantId}.${roleId}.guardRoles`),
        preferredRoles: normalizeRoleList(profile.preferredRoles, roleIds, `${COLOR_SYSTEM_TUNING_PATH}: ${variantId}.${roleId}.preferredRoles`),
        applyOnlyWhenCompensationNeeded: profile.applyOnlyWhenCompensationNeeded === true,
      }
    }
  }

  const softRoleChromaBudget = {}
  for (const [variantId, roleBudgets] of Object.entries(rawSoftBudget)) {
    assert(variantIds.has(variantId), `${COLOR_SYSTEM_TUNING_PATH}: unknown variant "${variantId}" in softRoleChromaBudget`)
    assert(roleBudgets && typeof roleBudgets === 'object' && !Array.isArray(roleBudgets), `${COLOR_SYSTEM_TUNING_PATH}: invalid budget map for variant "${variantId}"`)
    softRoleChromaBudget[variantId] = {}

    for (const [roleId, roleBudget] of Object.entries(roleBudgets)) {
      assert(roleIds.has(roleId), `${COLOR_SYSTEM_TUNING_PATH}: unknown role "${roleId}" in softRoleChromaBudget.${variantId}`)
      assert(roleBudget && typeof roleBudget === 'object' && !Array.isArray(roleBudget), `${COLOR_SYSTEM_TUNING_PATH}: invalid budget for ${variantId}.${roleId}`)

      softRoleChromaBudget[variantId][roleId] = {
        factor: normalizeNumber(roleBudget.factor, `${COLOR_SYSTEM_TUNING_PATH}: ${variantId}.${roleId}.factor`, { min: 0, max: 4 }),
        maxChroma: normalizeNumber(roleBudget.maxChroma, `${COLOR_SYSTEM_TUNING_PATH}: ${variantId}.${roleId}.maxChroma`, { min: 0, max: 200, allowNull: true }),
        lightnessLift: normalizeNumber(roleBudget.lightnessLift, `${COLOR_SYSTEM_TUNING_PATH}: ${variantId}.${roleId}.lightnessLift`, { min: -100, max: 100, allowNull: true }),
      }
    }
  }

  const globalSeparationTargetByVariant = {}
  const targetVariantIds = new Set(['default', ...variantIds])
  for (const [variantId, target] of Object.entries(rawGlobalSeparationTargets)) {
    assert(targetVariantIds.has(variantId), `${COLOR_SYSTEM_TUNING_PATH}: unknown variant "${variantId}" in globalSeparationTargetByVariant`)
    assert(target && typeof target === 'object' && !Array.isArray(target), `${COLOR_SYSTEM_TUNING_PATH}: invalid global separation target for "${variantId}"`)
    globalSeparationTargetByVariant[variantId] = {
      median: normalizeNumber(target.median, `${COLOR_SYSTEM_TUNING_PATH}: globalSeparationTargetByVariant.${variantId}.median`, { min: 0, max: 4 }),
      p25: normalizeNumber(target.p25, `${COLOR_SYSTEM_TUNING_PATH}: globalSeparationTargetByVariant.${variantId}.p25`, { min: 0, max: 4 }),
      p10: normalizeNumber(target.p10, `${COLOR_SYSTEM_TUNING_PATH}: globalSeparationTargetByVariant.${variantId}.p10`, { min: 0, max: 4 }),
    }
  }
  assert(globalSeparationTargetByVariant.default, `${COLOR_SYSTEM_TUNING_PATH}: globalSeparationTargetByVariant.default is required`)

  const globalSeparationToleranceByVariant = {}
  const toleranceVariantIds = new Set(['default', ...variantIds])
  for (const [variantId, tolerance] of Object.entries(rawGlobalSeparationToleranceByVariant)) {
    assert(toleranceVariantIds.has(variantId), `${COLOR_SYSTEM_TUNING_PATH}: unknown variant "${variantId}" in globalSeparationToleranceByVariant`)
    globalSeparationToleranceByVariant[variantId] = normalizeNumber(
      tolerance,
      `${COLOR_SYSTEM_TUNING_PATH}: globalSeparationToleranceByVariant.${variantId}`,
      { min: 0, max: 1 }
    )
  }
  if (globalSeparationToleranceByVariant.default == null) {
    globalSeparationToleranceByVariant.default = 0
  }

  const globalSeparationBoostProfileByVariant = {}
  const boostVariantIds = new Set(['default', ...variantIds])
  for (const [variantId, profile] of Object.entries(rawGlobalSeparationBoostProfiles)) {
    assert(boostVariantIds.has(variantId), `${COLOR_SYSTEM_TUNING_PATH}: unknown variant "${variantId}" in globalSeparationBoostProfileByVariant`)
    assert(profile && typeof profile === 'object' && !Array.isArray(profile), `${COLOR_SYSTEM_TUNING_PATH}: invalid global separation boost profile for "${variantId}"`)

    const maxBoostRounds = normalizeNumber(profile.maxBoostRounds, `${COLOR_SYSTEM_TUNING_PATH}: globalSeparationBoostProfileByVariant.${variantId}.maxBoostRounds`, { min: 0, max: 30 })
    assert(Number.isInteger(maxBoostRounds), `${COLOR_SYSTEM_TUNING_PATH}: globalSeparationBoostProfileByVariant.${variantId}.maxBoostRounds must be an integer`)

    globalSeparationBoostProfileByVariant[variantId] = {
      maxNeededFactor: normalizeNumber(profile.maxNeededFactor, `${COLOR_SYSTEM_TUNING_PATH}: globalSeparationBoostProfileByVariant.${variantId}.maxNeededFactor`, { min: 1, max: 4 }),
      maxBoostRounds,
      roleBoostScale: normalizeNumber(profile.roleBoostScale, `${COLOR_SYSTEM_TUNING_PATH}: globalSeparationBoostProfileByVariant.${variantId}.roleBoostScale`, { min: 0, max: 4 }),
      lightnessLiftScale: normalizeNumber(profile.lightnessLiftScale, `${COLOR_SYSTEM_TUNING_PATH}: globalSeparationBoostProfileByVariant.${variantId}.lightnessLiftScale`, { min: 0, max: 4 }),
      maxChroma: normalizeNumber(profile.maxChroma, `${COLOR_SYSTEM_TUNING_PATH}: globalSeparationBoostProfileByVariant.${variantId}.maxChroma`, { min: 0, max: 200, allowNull: true }),
    }
  }
  assert(globalSeparationBoostProfileByVariant.default, `${COLOR_SYSTEM_TUNING_PATH}: globalSeparationBoostProfileByVariant.default is required`)

  const lightReadabilityCalibration = {
    default: normalizeReadabilityCalibrationProfile(
      rawLightReadabilityCalibration.default ?? {},
      `${COLOR_SYSTEM_TUNING_PATH}: lightReadabilityCalibration.default`
    ),
    byRole: {},
  }
  const rawCalibrationByRole = rawLightReadabilityCalibration.byRole ?? {}
  assert(rawCalibrationByRole && typeof rawCalibrationByRole === 'object' && !Array.isArray(rawCalibrationByRole), `${COLOR_SYSTEM_TUNING_PATH}: lightReadabilityCalibration.byRole must be an object`)
  for (const [roleId, profile] of Object.entries(rawCalibrationByRole)) {
    assert(roleIds.has(roleId), `${COLOR_SYSTEM_TUNING_PATH}: unknown role "${roleId}" in lightReadabilityCalibration.byRole`)
    lightReadabilityCalibration.byRole[roleId] = normalizeReadabilityCalibrationProfile(
      profile,
      `${COLOR_SYSTEM_TUNING_PATH}: lightReadabilityCalibration.byRole.${roleId}`
    )
  }

  const lightCoolRoleSoften = {}
  for (const [variantId, profile] of Object.entries(rawLightCoolRoleSoften)) {
    assert(variantIds.has(variantId), `${COLOR_SYSTEM_TUNING_PATH}: unknown variant "${variantId}" in lightCoolRoleSoften`)
    assert(variantTypeById.get(variantId) === 'light', `${COLOR_SYSTEM_TUNING_PATH}: lightCoolRoleSoften.${variantId} must target a light variant`)
    assert(profile && typeof profile === 'object' && !Array.isArray(profile), `${COLOR_SYSTEM_TUNING_PATH}: invalid profile for lightCoolRoleSoften.${variantId}`)

    lightCoolRoleSoften[variantId] = {
      factorByRole: normalizeRoleNumberMap(
        profile.factorByRole ?? {},
        roleIds,
        `${COLOR_SYSTEM_TUNING_PATH}: lightCoolRoleSoften.${variantId}.factorByRole`,
        { min: 0, max: 4 }
      ),
      maxChromaByRole: normalizeRoleNumberMap(
        profile.maxChromaByRole ?? {},
        roleIds,
        `${COLOR_SYSTEM_TUNING_PATH}: lightCoolRoleSoften.${variantId}.maxChromaByRole`,
        { min: 0, max: 200, allowNull: true }
      ),
    }
  }

  const globalSeparationRoleProfile = {
    baselineDeltaE: normalizeNumber(
      rawGlobalSeparationRoleProfile.baselineDeltaE,
      `${COLOR_SYSTEM_TUNING_PATH}: globalSeparationRoleProfile.baselineDeltaE`,
      { min: 0, max: 200 }
    ),
    boostFactorByRole: normalizeRoleNumberMap(
      rawGlobalSeparationRoleProfile.boostFactorByRole ?? {},
      roleIds,
      `${COLOR_SYSTEM_TUNING_PATH}: globalSeparationRoleProfile.boostFactorByRole`,
      { min: 0, max: 4, allowPseudoKeys: ['_default', '_unmapped'] }
    ),
    lightnessLiftByRole: normalizeRoleNumberMap(
      rawGlobalSeparationRoleProfile.lightnessLiftByRole ?? {},
      roleIds,
      `${COLOR_SYSTEM_TUNING_PATH}: globalSeparationRoleProfile.lightnessLiftByRole`,
      { min: -100, max: 100, allowPseudoKeys: ['_default', '_unmapped'] }
    ),
  }
  assert(globalSeparationRoleProfile.boostFactorByRole._default != null, `${COLOR_SYSTEM_TUNING_PATH}: globalSeparationRoleProfile.boostFactorByRole._default is required`)
  assert(globalSeparationRoleProfile.boostFactorByRole._unmapped != null, `${COLOR_SYSTEM_TUNING_PATH}: globalSeparationRoleProfile.boostFactorByRole._unmapped is required`)
  assert(globalSeparationRoleProfile.lightnessLiftByRole._default != null, `${COLOR_SYSTEM_TUNING_PATH}: globalSeparationRoleProfile.lightnessLiftByRole._default is required`)

  const rawPolarityWeights = rawLightPolaritySearchProfile.scoreWeights ?? {}
  assert(rawPolarityWeights && typeof rawPolarityWeights === 'object' && !Array.isArray(rawPolarityWeights), `${COLOR_SYSTEM_TUNING_PATH}: lightPolaritySearchProfile.scoreWeights must be an object`)

  const lightPolaritySearchProfile = {
    hueStep: normalizeNumber(rawLightPolaritySearchProfile.hueStep, `${COLOR_SYSTEM_TUNING_PATH}: lightPolaritySearchProfile.hueStep`, { min: 1, max: 90 }),
    chromaScales: normalizeNumberArray(
      rawLightPolaritySearchProfile.chromaScales,
      `${COLOR_SYSTEM_TUNING_PATH}: lightPolaritySearchProfile.chromaScales`,
      { min: 0, max: 4 }
    ),
    lightnessShifts: normalizeNumberArray(
      rawLightPolaritySearchProfile.lightnessShifts,
      `${COLOR_SYSTEM_TUNING_PATH}: lightPolaritySearchProfile.lightnessShifts`,
      { min: -100, max: 100 }
    ),
    candidateMinL: normalizeNumber(rawLightPolaritySearchProfile.candidateMinL, `${COLOR_SYSTEM_TUNING_PATH}: lightPolaritySearchProfile.candidateMinL`, { min: 0, max: 100 }),
    candidateMaxL: normalizeNumber(rawLightPolaritySearchProfile.candidateMaxL, `${COLOR_SYSTEM_TUNING_PATH}: lightPolaritySearchProfile.candidateMaxL`, { min: 0, max: 100 }),
    candidateMinC: normalizeNumber(rawLightPolaritySearchProfile.candidateMinC, `${COLOR_SYSTEM_TUNING_PATH}: lightPolaritySearchProfile.candidateMinC`, { min: 0, max: 200 }),
    candidateMaxC: normalizeNumber(rawLightPolaritySearchProfile.candidateMaxC, `${COLOR_SYSTEM_TUNING_PATH}: lightPolaritySearchProfile.candidateMaxC`, { min: 0, max: 200 }),
    metricRatioCap: normalizeNumber(rawLightPolaritySearchProfile.metricRatioCap, `${COLOR_SYSTEM_TUNING_PATH}: lightPolaritySearchProfile.metricRatioCap`, { min: 1, max: 4 }),
    preferredDistanceRatioCap: normalizeNumber(
      rawLightPolaritySearchProfile.preferredDistanceRatioCap,
      `${COLOR_SYSTEM_TUNING_PATH}: lightPolaritySearchProfile.preferredDistanceRatioCap`,
      { min: 1, max: 4 }
    ),
    scoreWeights: {
      bg: normalizeNumber(rawPolarityWeights.bg, `${COLOR_SYSTEM_TUNING_PATH}: lightPolaritySearchProfile.scoreWeights.bg`, { min: 0, max: 4 }),
      anchor: normalizeNumber(rawPolarityWeights.anchor, `${COLOR_SYSTEM_TUNING_PATH}: lightPolaritySearchProfile.scoreWeights.anchor`, { min: 0, max: 4 }),
      contrast: normalizeNumber(rawPolarityWeights.contrast, `${COLOR_SYSTEM_TUNING_PATH}: lightPolaritySearchProfile.scoreWeights.contrast`, { min: 0, max: 4 }),
      preferred: normalizeNumber(rawPolarityWeights.preferred, `${COLOR_SYSTEM_TUNING_PATH}: lightPolaritySearchProfile.scoreWeights.preferred`, { min: 0, max: 4 }),
      driftPenalty: normalizeNumber(rawPolarityWeights.driftPenalty, `${COLOR_SYSTEM_TUNING_PATH}: lightPolaritySearchProfile.scoreWeights.driftPenalty`, { min: 0, max: 4 }),
    },
    minImprovement: normalizeNumber(rawLightPolaritySearchProfile.minImprovement, `${COLOR_SYSTEM_TUNING_PATH}: lightPolaritySearchProfile.minImprovement`, { min: 0, max: 2 }),
  }
  assert(Number.isInteger(lightPolaritySearchProfile.hueStep), `${COLOR_SYSTEM_TUNING_PATH}: lightPolaritySearchProfile.hueStep must be an integer`)
  assert(lightPolaritySearchProfile.candidateMinL <= lightPolaritySearchProfile.candidateMaxL, `${COLOR_SYSTEM_TUNING_PATH}: lightPolaritySearchProfile candidate L bounds are invalid`)
  assert(lightPolaritySearchProfile.candidateMinC <= lightPolaritySearchProfile.candidateMaxC, `${COLOR_SYSTEM_TUNING_PATH}: lightPolaritySearchProfile candidate C bounds are invalid`)

  const globalSeparationDeficitProfile = {
    ratioFloorMedian: normalizeNumber(
      rawGlobalSeparationDeficitProfile.ratioFloorMedian,
      `${COLOR_SYSTEM_TUNING_PATH}: globalSeparationDeficitProfile.ratioFloorMedian`,
      { min: 0.01, max: 4 }
    ),
    ratioFloorP25: normalizeNumber(
      rawGlobalSeparationDeficitProfile.ratioFloorP25,
      `${COLOR_SYSTEM_TUNING_PATH}: globalSeparationDeficitProfile.ratioFloorP25`,
      { min: 0.01, max: 4 }
    ),
    ratioFloorP10: normalizeNumber(
      rawGlobalSeparationDeficitProfile.ratioFloorP10,
      `${COLOR_SYSTEM_TUNING_PATH}: globalSeparationDeficitProfile.ratioFloorP10`,
      { min: 0.01, max: 4 }
    ),
    minNeededFactor: normalizeNumber(
      rawGlobalSeparationDeficitProfile.minNeededFactor,
      `${COLOR_SYSTEM_TUNING_PATH}: globalSeparationDeficitProfile.minNeededFactor`,
      { min: 1, max: 4 }
    ),
  }

  const pairSeparationGates = {}
  for (const [gateId, gateProfile] of Object.entries(rawPairSeparationGates)) {
    assert(gateProfile && typeof gateProfile === 'object' && !Array.isArray(gateProfile), `${COLOR_SYSTEM_TUNING_PATH}: pairSeparationGates.${gateId} must be an object`)

    const out = {}
    if (gateProfile.default != null) {
      out.default = normalizeNumber(gateProfile.default, `${COLOR_SYSTEM_TUNING_PATH}: pairSeparationGates.${gateId}.default`, { min: 0, max: 200 })
    }

    const rawByVariant = gateProfile.byVariant ?? {}
    assert(rawByVariant && typeof rawByVariant === 'object' && !Array.isArray(rawByVariant), `${COLOR_SYSTEM_TUNING_PATH}: pairSeparationGates.${gateId}.byVariant must be an object`)
    const byVariant = {}
    for (const [variantId, value] of Object.entries(rawByVariant)) {
      assert(variantIds.has(variantId), `${COLOR_SYSTEM_TUNING_PATH}: pairSeparationGates.${gateId}.byVariant has unknown variant "${variantId}"`)
      byVariant[variantId] = normalizeNumber(value, `${COLOR_SYSTEM_TUNING_PATH}: pairSeparationGates.${gateId}.byVariant.${variantId}`, { min: 0, max: 200 })
    }
    if (Object.keys(byVariant).length > 0) {
      out.byVariant = byVariant
    }

    pairSeparationGates[gateId] = out
  }

  const lightReadabilitySearchProfile = {
    scaleStep: normalizeNumber(rawLightReadabilitySearchProfile.scaleStep, `${COLOR_SYSTEM_TUNING_PATH}: lightReadabilitySearchProfile.scaleStep`, { min: 0.001, max: 1 }),
    driftDivisor: normalizeNumber(rawLightReadabilitySearchProfile.driftDivisor, `${COLOR_SYSTEM_TUNING_PATH}: lightReadabilitySearchProfile.driftDivisor`, { min: 1, max: 400 }),
    lightnessPenaltyDivisor: normalizeNumber(
      rawLightReadabilitySearchProfile.lightnessPenaltyDivisor,
      `${COLOR_SYSTEM_TUNING_PATH}: lightReadabilitySearchProfile.lightnessPenaltyDivisor`,
      { min: 1, max: 400 }
    ),
  }

  const telemetryProfile = {
    readabilityDriftWarningDeltaE: normalizeNumber(
      rawTelemetryProfile.readabilityDriftWarningDeltaE,
      `${COLOR_SYSTEM_TUNING_PATH}: telemetryProfile.readabilityDriftWarningDeltaE`,
      { min: 0, max: 200 }
    ),
  }

  const rawSemanticRows = rawSiteDocsProfile.semanticRows
  assert(Array.isArray(rawSemanticRows), `${COLOR_SYSTEM_TUNING_PATH}: siteDocsProfile.semanticRows must be an array`)
  const semanticRows = rawSemanticRows.map((row, index) => {
    assert(row && typeof row === 'object' && !Array.isArray(row), `${COLOR_SYSTEM_TUNING_PATH}: siteDocsProfile.semanticRows[${index}] must be an object`)
    const id = String(row.id || '').trim()
    const key = String(row.key || '').trim()
    const note = String(row.note || '').trim()
    assert(id, `${COLOR_SYSTEM_TUNING_PATH}: siteDocsProfile.semanticRows[${index}].id is required`)
    assert(key, `${COLOR_SYSTEM_TUNING_PATH}: siteDocsProfile.semanticRows[${index}].key is required`)
    assert(note, `${COLOR_SYSTEM_TUNING_PATH}: siteDocsProfile.semanticRows[${index}].note is required`)
    return { id, key, note }
  })
  assert(semanticRows.length > 0, `${COLOR_SYSTEM_TUNING_PATH}: siteDocsProfile.semanticRows must not be empty`)

  const rawSnapshotRatios = rawSiteDocsProfile.snapshotRatios
  assert(Array.isArray(rawSnapshotRatios), `${COLOR_SYSTEM_TUNING_PATH}: siteDocsProfile.snapshotRatios must be an array`)
  const snapshotRatios = rawSnapshotRatios.map((metric, index) => {
    assert(metric && typeof metric === 'object' && !Array.isArray(metric), `${COLOR_SYSTEM_TUNING_PATH}: siteDocsProfile.snapshotRatios[${index}] must be an object`)
    const label = String(metric.label || '').trim()
    const variant = String(metric.variant || '').trim()
    const left = String(metric.left || '').trim()
    const right = String(metric.right || '').trim()
    assert(label, `${COLOR_SYSTEM_TUNING_PATH}: siteDocsProfile.snapshotRatios[${index}].label is required`)
    assert(variantIds.has(variant), `${COLOR_SYSTEM_TUNING_PATH}: siteDocsProfile.snapshotRatios[${index}] has unknown variant "${variant}"`)
    assert(left, `${COLOR_SYSTEM_TUNING_PATH}: siteDocsProfile.snapshotRatios[${index}].left is required`)
    assert(right, `${COLOR_SYSTEM_TUNING_PATH}: siteDocsProfile.snapshotRatios[${index}].right is required`)
    return { label, variant, left, right }
  })
  assert(snapshotRatios.length > 0, `${COLOR_SYSTEM_TUNING_PATH}: siteDocsProfile.snapshotRatios must not be empty`)
  const siteDocsProfile = { semanticRows, snapshotRatios }

  const rawDerivedColors = rawSiteAssetMapping.derivedColors ?? {}
  assert(rawDerivedColors && typeof rawDerivedColors === 'object' && !Array.isArray(rawDerivedColors), `${COLOR_SYSTEM_TUNING_PATH}: siteAssetMapping.derivedColors must be an object`)
  const derivedColors = {}
  for (const [name, expr] of Object.entries(rawDerivedColors)) {
    const key = String(name || '').trim()
    assert(key, `${COLOR_SYSTEM_TUNING_PATH}: siteAssetMapping.derivedColors has invalid key`)
    derivedColors[key] = normalizeSiteAssetExpression(expr, `${COLOR_SYSTEM_TUNING_PATH}: siteAssetMapping.derivedColors.${key}`)
  }

  const groups = {}
  const rawGroups = rawSiteAssetMapping.groups ?? null
  if (rawGroups != null) {
    assert(rawGroups && typeof rawGroups === 'object' && !Array.isArray(rawGroups), `${COLOR_SYSTEM_TUNING_PATH}: siteAssetMapping.groups must be an object`)
    for (const [groupName, groupVars] of Object.entries(rawGroups)) {
      const name = String(groupName || '').trim()
      assert(name, `${COLOR_SYSTEM_TUNING_PATH}: siteAssetMapping.groups has invalid group key`)
      groups[name] = normalizeSiteAssetVarMap(groupVars, `${COLOR_SYSTEM_TUNING_PATH}: siteAssetMapping.groups.${name}`)
      assert(Object.keys(groups[name]).length > 0, `${COLOR_SYSTEM_TUNING_PATH}: siteAssetMapping.groups.${name} must not be empty`)
    }
  }

  const rawVars = rawSiteAssetMapping.vars ?? null
  if (rawVars != null) {
    groups._ungrouped = normalizeSiteAssetVarMap(rawVars, `${COLOR_SYSTEM_TUNING_PATH}: siteAssetMapping.vars`)
    assert(Object.keys(groups._ungrouped).length > 0, `${COLOR_SYSTEM_TUNING_PATH}: siteAssetMapping.vars must not be empty`)
  }

  assert(Object.keys(groups).length > 0, `${COLOR_SYSTEM_TUNING_PATH}: siteAssetMapping must define either groups or vars`)
  const vars = {}
  for (const [groupName, groupVars] of Object.entries(groups)) {
    for (const [varName, expr] of Object.entries(groupVars)) {
      assert(vars[varName] == null, `${COLOR_SYSTEM_TUNING_PATH}: duplicate siteAssetMapping variable "${varName}" in group "${groupName}"`)
      vars[varName] = expr
    }
  }
  const siteAssetMapping = { derivedColors, groups, vars }

  return {
    lightPolarityRoleOptimization,
    softRoleChromaBudget,
    globalSeparationTargetByVariant,
    globalSeparationToleranceByVariant,
    globalSeparationBoostProfileByVariant,
    lightReadabilityCalibration,
    lightCoolRoleSoften,
    globalSeparationRoleProfile,
    lightPolaritySearchProfile,
    globalSeparationDeficitProfile,
    pairSeparationGates,
    lightReadabilitySearchProfile,
    telemetryProfile,
    siteDocsProfile,
    siteAssetMapping,
  }
}
