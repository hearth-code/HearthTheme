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
  const roleIds = new Set(loadRoleAdapters().map((role) => role.id))

  const data = readJson(COLOR_SYSTEM_TUNING_PATH)
  assert(data && typeof data === 'object' && !Array.isArray(data), `${COLOR_SYSTEM_TUNING_PATH} must be an object`)

  const rawPolarity = data.lightPolarityRoleOptimization ?? {}
  assert(rawPolarity && typeof rawPolarity === 'object' && !Array.isArray(rawPolarity), `${COLOR_SYSTEM_TUNING_PATH}: lightPolarityRoleOptimization must be an object`)

  const rawSoftBudget = data.softRoleChromaBudget ?? {}
  assert(rawSoftBudget && typeof rawSoftBudget === 'object' && !Array.isArray(rawSoftBudget), `${COLOR_SYSTEM_TUNING_PATH}: softRoleChromaBudget must be an object`)
  const rawGlobalSeparationTargets = data.globalSeparationTargetByVariant ?? {}
  assert(rawGlobalSeparationTargets && typeof rawGlobalSeparationTargets === 'object' && !Array.isArray(rawGlobalSeparationTargets), `${COLOR_SYSTEM_TUNING_PATH}: globalSeparationTargetByVariant must be an object`)

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

  return {
    lightPolarityRoleOptimization,
    softRoleChromaBudget,
    globalSeparationTargetByVariant,
  }
}
