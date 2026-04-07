import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  COLOR_SYSTEM_SCHEME_ID,
  COLOR_SYSTEM_SEMANTIC_PATH,
  COLOR_SYSTEM_TUNING_PATH,
  getThemeMetaList,
  loadColorSchemeManifest,
  loadColorSystemTuning,
  loadColorSystemVariants,
  loadRoleAdapters,
  loadSemanticRules,
} from './color-system.mjs'
import {
  contrastRatio,
  deltaE,
  hexToRgba,
  hueDistance,
  isHueInBand,
  normalizeHex,
  rgbToHsl,
  rgbaToHex,
} from './color-utils.mjs'

const VARIANT_SPEC = loadColorSystemVariants()
const THEME_FILES = getThemeMetaList()
const ROLE_ADAPTERS = loadRoleAdapters()
const COLOR_SYSTEM_TUNING = loadColorSystemTuning()
const COLOR_SCHEME = loadColorSchemeManifest()
const SEMANTIC_RULES = loadSemanticRules()

const COLOR_SYSTEM = {
  darkSource: VARIANT_SPEC.baseSourcePath,
  templates: [VARIANT_SPEC.baseTemplatePath, ...VARIANT_SPEC.variants
    .filter((variant) => variant.mode === 'derived')
    .map((variant) => variant.templatePath)],
  semantic: COLOR_SYSTEM_SEMANTIC_PATH,
  tuning: COLOR_SYSTEM_TUNING_PATH,
}

const REPORT_DIR = join('reports', 'theme-audit', COLOR_SYSTEM_SCHEME_ID)
const REQUIRED_UI_KEYS = [
  'editor.background',
  'editor.foreground',
  'editor.lineHighlightBackground',
  'editor.selectionBackground',
  'editorCursor.foreground',
  'editorLineNumber.foreground',
  'sideBar.background',
  'sideBar.border',
  'statusBar.background',
  'statusBar.foreground',
  'tab.activeBackground',
  'tab.activeForeground',
  'panel.background',
  'panel.border',
  'focusBorder',
  'list.activeSelectionBackground',
  'list.activeSelectionForeground',
  'editorBracketHighlight.foreground1',
]

const ROLE_ADAPTER_BY_ID = Object.fromEntries(ROLE_ADAPTERS.map((role) => [role.id, role]))
const ROLE_SCOPES = Object.fromEntries(ROLE_ADAPTERS.map((role) => [role.id, role.scopes]))
const HIGH_EXPOSURE_ROLES = ['keyword', 'operator', 'function', 'method', 'property', 'string', 'number', 'type', 'variable']
const HUE_BUCKET_SPAN = 45
const HUE_BUCKET_COUNT = 8
const NEUTRAL_SATURATION_THRESHOLD = 0.08

const FIXTURE_DIR = 'fixtures/theme-audit'
const REQUIRED_FIXTURES = [
  'sample.ts',
  'sample.py',
  'sample.rs',
  'sample.go',
  'sample.json',
  'sample.md',
]

const MIN_TEXT_CONTRAST = 7.0
const COMMENT_CONTRAST_MIN = 2.2
const COMMENT_CONTRAST_MAX = 4.2
const OPERATOR_CONTRAST_MIN = 2.8
const OPERATOR_CONTRAST_MAX = 6.2
const MIN_ROLE_DELTA_E = 10
const MAX_ROLE_HUE_DRIFT = 45
const PAIR_SEPARATION_GATES = COLOR_SYSTEM_TUNING.pairSeparationGates || {}
const OPERATOR_COMMENT_PAIR_GATE = PAIR_SEPARATION_GATES.operatorCommentDeltaE || {}
const METHOD_PROPERTY_PAIR_GATE = PAIR_SEPARATION_GATES.methodPropertyDeltaE || {}
const ROLE_LANE_PROFILE = COLOR_SYSTEM_TUNING.roleLaneProfile || {}
const ROLE_LANE_MODE = String(COLOR_SCHEME?.constraints?.roleLaneMode || 'warm-balanced').trim().toLowerCase()
const ROLE_LANE_COOL_HUE_BAND_BY_VARIANT = ROLE_LANE_PROFILE.coolHueBandByVariant || {}
const ROLE_LANE_WARM_HUE_BAND_BY_VARIANT = ROLE_LANE_PROFILE.warmHueBandByVariant || {}
const ROLE_LANE_NEAR_FG_BY_VARIANT = ROLE_LANE_PROFILE.nearForegroundDeltaEByVariant || {}
const ROLE_LANE_CRITICAL_PAIRS_BY_VARIANT = ROLE_LANE_PROFILE.criticalPairDeltaEByVariant || {}
const ROLE_LANE_WARM_GAMUT_GUARD = ROLE_LANE_PROFILE.warmGamutGuard || null
const ROLE_LANE_WARM_EXPOSURE_PROFILE = ROLE_LANE_PROFILE.warmExposureProfile || null
const DARK_SOFT_PERCEPTION_GUARD = COLOR_SYSTEM_TUNING.darkSoftPerceptionGuard || null
const INTERACTION_STATE_BUDGET = COLOR_SYSTEM_TUNING.interactionStateBudget || {}
const INTERACTION_REPORT_JSON_PATH = join(REPORT_DIR, 'interaction.json')
const INTERACTION_REPORT_MD_PATH = join(REPORT_DIR, 'interaction.md')
const RICHNESS_REPORT_JSON_PATH = join(REPORT_DIR, 'richness.json')
const RICHNESS_REPORT_MD_PATH = join(REPORT_DIR, 'richness.md')
const ENERGY_REPORT_JSON_PATH = join(REPORT_DIR, 'energy.json')
const ENERGY_REPORT_MD_PATH = join(REPORT_DIR, 'energy.md')
const DOMINANT_SOURCE_FAMILY_SHARE_WARN = 0.4
const DOMINANT_HUE_BAND_SHARE_WARN = 0.42
const ADJACENT_HUE_BAND_SHARE_WARN = 0.58
const CHROME_ACCENT_KEYS = [
  { key: 'editorCursor.foreground', weight: 1.05 },
  { key: 'activityBarBadge.background', weight: 1.25 },
  { key: 'statusBar.background', weight: 1.35 },
  { key: 'tab.activeBorder', weight: 1.0 },
  { key: 'button.background', weight: 1.15 },
  { key: 'progressBar.background', weight: 0.9 },
  { key: 'notificationLink.foreground', weight: 0.55 },
  { key: 'list.highlightForeground', weight: 0.75 },
]
const PRODUCT_ENERGY_NEUTRAL_SHARE_WARN = 0.24
const PRODUCT_ENERGY_MEAN_SATURATION_WARN = 0.18
const PRODUCT_ENERGY_DOMINANT_HUE_SHARE_WARN = 1.01
const PRODUCT_ENERGY_MIN_BUCKET_COUNT_WARN = 1

const issues = []
const warnings = []
const notes = []
const interactionMetricsByVariant = {}
const richnessMetrics = {
  roleWeights: {},
  sourceFamilyOccupancy: {},
  hueConcentration: {},
}
const energyMetrics = {
  chrome: {},
}

function addIssue(message) {
  issues.push(message)
}

function addWarning(message) {
  warnings.push(message)
}

function addNote(message) {
  notes.push(message)
}

function summarizeList(values, limit = 8) {
  if (values.length === 0) return 'none'
  const sorted = [...values].sort()
  if (sorted.length <= limit) return sorted.join(', ')
  const shown = sorted.slice(0, limit).join(', ')
  return `${shown} ... (+${sorted.length - limit} more)`
}

function diffSet(baseSet, targetSet) {
  return {
    missing: [...baseSet].filter((value) => !targetSet.has(value)),
    extra: [...targetSet].filter((value) => !baseSet.has(value)),
  }
}

function readJson(path) {
  try {
    const text = readFileSync(path, 'utf8')
    return JSON.parse(text)
  } catch (error) {
    addIssue(`${path}: failed to parse JSON (${error.message})`)
    return null
  }
}

function toScopes(entry) {
  if (!entry?.scope) return []
  return Array.isArray(entry.scope) ? entry.scope : [entry.scope]
}

function scopeSignature(entry) {
  return toScopes(entry)
    .map((scope) => String(scope).trim())
    .filter(Boolean)
    .sort()
    .join(' | ')
}

function getColorKeySet(theme) {
  return new Set(Object.keys(theme?.colors || {}))
}

function getTokenScopeSet(theme) {
  const set = new Set()
  for (const entry of theme?.tokenColors || []) {
    const signature = scopeSignature(entry)
    if (signature) set.add(signature)
  }
  return set
}

function getSemanticKeySet(theme) {
  return new Set(Object.keys(theme?.semanticTokenColors || {}))
}

function getTokenColor(theme, scopes) {
  if (!Array.isArray(scopes) || scopes.length === 0) return null

  let bestColor = null
  let bestRatio = -1
  let bestCount = -1
  let bestScopeLength = Number.POSITIVE_INFINITY

  for (const entry of theme.tokenColors || []) {
    const entryScopes = toScopes(entry)
    const count = entryScopes.filter((scope) => scopes.includes(scope)).length
    if (count === 0) continue

    const color = entry.settings?.foreground ? normalizeHex(entry.settings.foreground) : null
    if (!color) continue

    const ratio = count / entryScopes.length
    const isBetter =
      ratio > bestRatio ||
      (ratio === bestRatio && count > bestCount) ||
      (ratio === bestRatio && count === bestCount && entryScopes.length < bestScopeLength)

    if (!isBetter) continue

    bestColor = color
    bestRatio = ratio
    bestCount = count
    bestScopeLength = entryScopes.length
  }

  return bestColor
}

function getSemanticColor(theme, semanticKey) {
  const value = theme.semanticTokenColors?.[semanticKey]
  if (!value) return null
  if (typeof value === 'string') return normalizeHex(value)
  if (typeof value === 'object' && value.foreground) return normalizeHex(value.foreground)
  return null
}

function getRoleColor(theme, roleId) {
  const roleDef = ROLE_ADAPTER_BY_ID[roleId]
  if (!roleDef) return null
  return getTokenColor(theme, roleDef.scopes || []) ?? (roleDef.semanticKeys || []).map((key) => getSemanticColor(theme, key)).find(Boolean) ?? null
}

function fixed(n) {
  return Number(n).toFixed(1)
}

function formatPercent(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return 'n/a'
  return `${(value * 100).toFixed(digits)}%`
}

function resolvePairGateThreshold(profile, variantId, fallback) {
  if (!profile || typeof profile !== 'object') return fallback

  const byVariant = profile.byVariant || {}
  const variantValue = byVariant?.[variantId]
  if (typeof variantValue === 'number' && Number.isFinite(variantValue)) return variantValue

  const defaultValue = profile.default
  if (typeof defaultValue === 'number' && Number.isFinite(defaultValue)) return defaultValue

  return fallback
}

function resolveVariantRoleProfile(profileByVariant, variantId) {
  const base = profileByVariant?.default || {}
  const specific = profileByVariant?.[variantId] || {}
  return {
    ...base,
    ...specific,
  }
}

function resolveCriticalPairThresholds(profileByVariant, variantId) {
  const base = profileByVariant?.default || {}
  const specific = profileByVariant?.[variantId] || {}
  return {
    ...base,
    ...specific,
  }
}

function getInteractionBudget(variantId) {
  return {
    ...(INTERACTION_STATE_BUDGET.default || {}),
    ...(INTERACTION_STATE_BUDGET[variantId] || {}),
  }
}

function getHighExposureRoleWeights() {
  const fallback = Object.fromEntries(HIGH_EXPOSURE_ROLES.map((roleId) => [roleId, 1 / HIGH_EXPOSURE_ROLES.length]))
  if (!ROLE_LANE_WARM_EXPOSURE_PROFILE) return fallback

  const rawWeights = {}
  for (const roleId of HIGH_EXPOSURE_ROLES) {
    let weightedFrequency = 0
    for (const [languageId, mixWeight] of Object.entries(ROLE_LANE_WARM_EXPOSURE_PROFILE.languageMixWeights || {})) {
      const frequency = ROLE_LANE_WARM_EXPOSURE_PROFILE.roleFrequencyByLanguage?.[languageId]?.[roleId]
      if (typeof frequency === 'number') {
        weightedFrequency += mixWeight * frequency
      }
    }
    const saliency = typeof ROLE_LANE_WARM_EXPOSURE_PROFILE.saliencyByRole?.[roleId] === 'number'
      ? ROLE_LANE_WARM_EXPOSURE_PROFILE.saliencyByRole[roleId]
      : 1
    rawWeights[roleId] = weightedFrequency * saliency
  }

  const total = Object.values(rawWeights).reduce((sum, value) => sum + value, 0)
  if (!(total > 0)) return fallback

  return Object.fromEntries(
    Object.entries(rawWeights).map(([roleId, value]) => [roleId, value / total])
  )
}

function getEffectiveSemanticSource(roleId, variantId) {
  const rule = SEMANTIC_RULES.roles?.[roleId]
  if (!rule) return null
  return rule.byVariant?.[variantId]?.source || rule.source || null
}

function getHueBucketId(index) {
  return `band-${index}`
}

function getHueBucketLabel(index) {
  const start = index * HUE_BUCKET_SPAN
  const end = start + HUE_BUCKET_SPAN - 1
  return `${start}-${end}`
}

function getHueBucketForColor(hex) {
  const hsl = rgbToHsl(hex)
  if (!hsl) return null
  if (hsl.s < NEUTRAL_SATURATION_THRESHOLD) {
    return {
      id: 'neutral',
      label: 'neutral',
      hsl,
    }
  }

  const hue = ((hsl.h % 360) + 360) % 360
  const index = Math.floor(hue / HUE_BUCKET_SPAN) % HUE_BUCKET_COUNT
  return {
    id: getHueBucketId(index),
    label: getHueBucketLabel(index),
    index,
    hsl,
  }
}

function summarizeWeightEntries(entryMap, shareKey = 'share') {
  return Object.entries(entryMap || {})
    .filter(([, detail]) => (detail?.weight ?? 0) > 0)
    .sort(([, left], [, right]) => (right?.weight ?? 0) - (left?.weight ?? 0))
    .map(([id, detail]) => `${id} ${formatPercent(detail?.[shareKey] ?? null)}`)
    .join(', ')
}

function blendStateColorOverBackground(colorHex, bgHex) {
  const state = hexToRgba(colorHex)
  const bg = hexToRgba(bgHex)
  if (!state || !bg) return colorHex
  if (!state.hasAlpha) return rgbaToHex({ r: state.r, g: state.g, b: state.b, hasAlpha: false })
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

function roundMetric(value, digits = 3) {
  if (value == null || Number.isNaN(value)) return null
  return Number(value.toFixed(digits))
}

function validateInteractionStateBudget(themeMeta, theme) {
  if (!theme) return
  const bg = normalizeHex(theme.colors?.['editor.background'])
  const lineHighlight = normalizeHex(theme.colors?.['editor.lineHighlightBackground'])
  const listHover = normalizeHex(theme.colors?.['list.hoverBackground'])
  const tabHover = normalizeHex(theme.colors?.['tab.hoverBackground'])
  const lineNo = normalizeHex(theme.colors?.['editorLineNumber.foreground'])
  const lineNoActive = normalizeHex(theme.colors?.['editorLineNumber.activeForeground'])
  if (!bg || !lineHighlight || !listHover || !tabHover || !lineNo || !lineNoActive) return

  const budget = getInteractionBudget(themeMeta.id)
  if (!budget || Object.keys(budget).length === 0) return

  const lineHighlightContrast = contrastAgainstEditorBackground(lineHighlight, bg)
  const listHoverContrast = contrastAgainstEditorBackground(listHover, bg)
  const tabHoverContrast = contrastAgainstEditorBackground(tabHover, bg)
  const lineNumberContrast = contrastRatio(lineNo, bg)
  const lineNumberActiveContrast = contrastRatio(lineNoActive, bg)
  const lineNumberActiveDelta =
    lineNumberContrast == null || lineNumberActiveContrast == null
      ? null
      : lineNumberActiveContrast - lineNumberContrast

  const checks = [
    {
      id: 'editor.lineHighlightBackground',
      metric: lineHighlightContrast,
      threshold: budget.lineHighlightMinContrast,
    },
    {
      id: 'list.hoverBackground',
      metric: listHoverContrast,
      threshold: budget.listHoverMinContrast,
    },
    {
      id: 'tab.hoverBackground',
      metric: tabHoverContrast,
      threshold: budget.tabHoverMinContrast,
    },
    {
      id: 'editorLineNumber.activeDelta',
      metric: lineNumberActiveDelta,
      threshold: budget.lineNumberActiveDeltaMin,
    },
  ]

  const failed = []
  for (const check of checks) {
    if (typeof check.threshold !== 'number' || check.metric == null) continue
    if (check.metric < check.threshold) {
      failed.push({
        id: check.id,
        metric: roundMetric(check.metric),
        threshold: roundMetric(check.threshold),
      })
      addIssue(
        `${themeMeta.path}: interaction state "${check.id}" ${fixed(check.metric)} is below ${fixed(check.threshold)}`
      )
    }
  }

  interactionMetricsByVariant[themeMeta.id] = {
    thresholds: {
      lineHighlightMinContrast: budget.lineHighlightMinContrast ?? null,
      listHoverMinContrast: budget.listHoverMinContrast ?? null,
      tabHoverMinContrast: budget.tabHoverMinContrast ?? null,
      lineNumberActiveDeltaMin: budget.lineNumberActiveDeltaMin ?? null,
    },
    metrics: {
      lineHighlightContrast: roundMetric(lineHighlightContrast),
      listHoverContrast: roundMetric(listHoverContrast),
      tabHoverContrast: roundMetric(tabHoverContrast),
      lineNumberContrast: roundMetric(lineNumberContrast),
      lineNumberActiveContrast: roundMetric(lineNumberActiveContrast),
      lineNumberActiveDelta: roundMetric(lineNumberActiveDelta),
    },
    status: failed.length === 0 ? 'pass' : 'fail',
    failedChecks: failed,
  }

  if (failed.length === 0) {
    addNote(
      `${themeMeta.id}: interaction visibility line=${fixed(lineHighlightContrast)}, list.hover=${fixed(listHoverContrast)}, tab.hover=${fixed(tabHoverContrast)}, lineNoDelta=${fixed(lineNumberActiveDelta)}`
    )
  }
}

function buildInteractionReport() {
  return {
    schemaVersion: 1,
    generatedBy: 'scripts/theme-audit.mjs',
    schemeId: COLOR_SYSTEM_SCHEME_ID,
    thresholds: INTERACTION_STATE_BUDGET,
    variants: interactionMetricsByVariant,
  }
}

function buildInteractionMarkdown(report) {
  const lines = [
    '# Theme Audit Interaction State Report',
    '',
    'Auto-generated by `scripts/theme-audit.mjs`.',
    '',
    `Scheme: \`${report.schemeId}\``,
    '',
    '| Variant | Status | lineHighlight | list.hover | tab.hover | lineNo delta |',
    '| --- | --- | --- | --- | --- | --- |',
  ]

  for (const [variantId, detail] of Object.entries(report.variants || {})) {
    const status = detail.status || 'n/a'
    const metrics = detail.metrics || {}
    lines.push(
      `| ${variantId} | ${status} | ${metrics.lineHighlightContrast ?? 'n/a'} / ${detail.thresholds?.lineHighlightMinContrast ?? 'n/a'} | ${metrics.listHoverContrast ?? 'n/a'} / ${detail.thresholds?.listHoverMinContrast ?? 'n/a'} | ${metrics.tabHoverContrast ?? 'n/a'} / ${detail.thresholds?.tabHoverMinContrast ?? 'n/a'} | ${metrics.lineNumberActiveDelta ?? 'n/a'} / ${detail.thresholds?.lineNumberActiveDeltaMin ?? 'n/a'} |`
    )
  }

  lines.push('', '## Failed Checks', '')
  for (const [variantId, detail] of Object.entries(report.variants || {})) {
    const failedChecks = detail.failedChecks || []
    if (failedChecks.length === 0) continue
    lines.push(`- ${variantId}`)
    for (const check of failedChecks) {
      lines.push(`  - ${check.id}: ${check.metric} < ${check.threshold}`)
    }
  }
  if (!Object.values(report.variants || {}).some((detail) => (detail.failedChecks || []).length > 0)) {
    lines.push('- none')
  }
  lines.push('')
  return lines.join('\n')
}

function writeInteractionReport() {
  const report = buildInteractionReport()
  mkdirSync(REPORT_DIR, { recursive: true })
  writeFileSync(INTERACTION_REPORT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`)
  writeFileSync(INTERACTION_REPORT_MD_PATH, `${buildInteractionMarkdown(report)}\n`)
}

function buildSourceFamilyOccupancy(roleWeights) {
  const sourceByVariant = {}
  const groupedWarnings = new Map()

  for (const themeMeta of THEME_FILES) {
    const families = {}
    let totalWeight = 0

    for (const roleId of HIGH_EXPOSURE_ROLES) {
      const roleWeight = roleWeights[roleId] ?? 0
      if (!(roleWeight > 0)) continue

      const source = getEffectiveSemanticSource(roleId, themeMeta.id)
      const familyId = String(source?.family || 'unmapped').trim() || 'unmapped'
      if (!families[familyId]) {
        families[familyId] = {
          weight: 0,
          roles: [],
        }
      }
      families[familyId].weight += roleWeight
      families[familyId].roles.push(roleId)
      totalWeight += roleWeight
    }

    for (const detail of Object.values(families)) {
      detail.roles.sort()
      detail.weight = roundMetric(detail.weight, 4)
      detail.share = totalWeight > 0 ? roundMetric(detail.weight / totalWeight, 4) : null
    }

    const sortedFamilies = Object.entries(families)
      .sort(([, left], [, right]) => (right?.weight ?? 0) - (left?.weight ?? 0) || left.roles.join(',').localeCompare(right.roles.join(',')))
    const [dominantFamilyId, dominantFamilyDetail] = sortedFamilies[0] || [null, null]
    const dominantShare = dominantFamilyDetail?.share ?? null

    sourceByVariant[themeMeta.id] = {
      totalWeight: roundMetric(totalWeight, 4),
      dominantFamily: dominantFamilyId,
      dominantShare,
      families,
    }

    if (dominantFamilyId && dominantShare != null && dominantShare > DOMINANT_SOURCE_FAMILY_SHARE_WARN) {
      const key = `${dominantFamilyId}:${dominantShare.toFixed(4)}`
      if (!groupedWarnings.has(key)) {
        groupedWarnings.set(key, {
          family: dominantFamilyId,
          share: dominantShare,
          variants: [],
        })
      }
      groupedWarnings.get(key).variants.push(themeMeta.id)
    }
  }

  for (const violation of groupedWarnings.values()) {
    addWarning(
      `${COLOR_SYSTEM_SCHEME_ID}: richness dominant source family "${violation.family}" share ${formatPercent(violation.share)} exceeds ${formatPercent(DOMINANT_SOURCE_FAMILY_SHARE_WARN)} (${violation.variants.join(', ')})`
    )
  }

  return sourceByVariant
}

function buildHueConcentration(themes, roleWeights) {
  const byVariant = {}

  for (const themeMeta of THEME_FILES) {
    const theme = themes[themeMeta.id]
    if (!theme) continue

    const buckets = {
      neutral: { label: 'neutral', weight: 0, roles: [] },
    }
    for (let index = 0; index < HUE_BUCKET_COUNT; index += 1) {
      buckets[getHueBucketId(index)] = {
        label: getHueBucketLabel(index),
        weight: 0,
        roles: [],
      }
    }

    let totalWeight = 0
    let chromaticWeight = 0

    for (const roleId of HIGH_EXPOSURE_ROLES) {
      const roleWeight = roleWeights[roleId] ?? 0
      if (!(roleWeight > 0)) continue

      const color = getRoleColor(theme, roleId)
      if (!color) continue

      const bucket = getHueBucketForColor(color)
      if (!bucket) continue

      const bucketDetail = buckets[bucket.id]
      bucketDetail.weight += roleWeight
      bucketDetail.roles.push(roleId)
      totalWeight += roleWeight
      if (bucket.id !== 'neutral') {
        chromaticWeight += roleWeight
      }
    }

    for (const detail of Object.values(buckets)) {
      detail.roles.sort()
      detail.weight = roundMetric(detail.weight, 4)
      detail.share = totalWeight > 0 ? roundMetric(detail.weight / totalWeight, 4) : null
      detail.shareChromatic = detail.label === 'neutral' || chromaticWeight <= 0
        ? null
        : roundMetric(detail.weight / chromaticWeight, 4)
    }

    let dominantBucketId = null
    let dominantBucketShare = null
    let dominantBucketWeight = -1
    for (let index = 0; index < HUE_BUCKET_COUNT; index += 1) {
      const bucketId = getHueBucketId(index)
      const detail = buckets[bucketId]
      if ((detail?.weight ?? 0) <= dominantBucketWeight) continue
      dominantBucketId = bucketId
      dominantBucketWeight = detail?.weight ?? 0
      dominantBucketShare = detail?.shareChromatic ?? null
    }

    let adjacentPair = null
    let adjacentPairShare = null
    if (chromaticWeight > 0) {
      let bestWeight = -1
      for (let index = 0; index < HUE_BUCKET_COUNT; index += 1) {
        const nextIndex = (index + 1) % HUE_BUCKET_COUNT
        const left = buckets[getHueBucketId(index)]
        const right = buckets[getHueBucketId(nextIndex)]
        const pairWeight = (left?.weight ?? 0) + (right?.weight ?? 0)
        if (pairWeight <= bestWeight) continue
        bestWeight = pairWeight
        adjacentPair = [left?.label ?? getHueBucketLabel(index), right?.label ?? getHueBucketLabel(nextIndex)]
        adjacentPairShare = roundMetric(pairWeight / chromaticWeight, 4)
      }
    }

    byVariant[themeMeta.id] = {
      totalWeight: roundMetric(totalWeight, 4),
      chromaticWeight: roundMetric(chromaticWeight, 4),
      neutralShare: buckets.neutral.share,
      dominantHueBand: dominantBucketId ? buckets[dominantBucketId]?.label ?? null : null,
      dominantShare: dominantBucketShare,
      topAdjacentHueBands: adjacentPair,
      topAdjacentShare: adjacentPairShare,
      buckets,
    }

    if (dominantBucketShare != null && dominantBucketShare > DOMINANT_HUE_BAND_SHARE_WARN) {
      addWarning(
        `${themeMeta.path}: richness dominant hue band "${byVariant[themeMeta.id].dominantHueBand}" share ${formatPercent(dominantBucketShare)} exceeds ${formatPercent(DOMINANT_HUE_BAND_SHARE_WARN)}`
      )
    }
    if (adjacentPairShare != null && adjacentPairShare > ADJACENT_HUE_BAND_SHARE_WARN) {
      addWarning(
        `${themeMeta.path}: richness adjacent hue bands "${adjacentPair?.join(' + ')}" share ${formatPercent(adjacentPairShare)} exceeds ${formatPercent(ADJACENT_HUE_BAND_SHARE_WARN)}`
      )
    }
  }

  return byVariant
}

function buildRichnessReport() {
  return {
    schemaVersion: 1,
    generatedBy: 'scripts/theme-audit.mjs',
    schemeId: COLOR_SYSTEM_SCHEME_ID,
    thresholds: {
      neutralSaturationThreshold: NEUTRAL_SATURATION_THRESHOLD,
      hueBucketSpan: HUE_BUCKET_SPAN,
      dominantSourceFamilyShareMax: DOMINANT_SOURCE_FAMILY_SHARE_WARN,
      dominantHueBandShareMax: DOMINANT_HUE_BAND_SHARE_WARN,
      adjacentHueBandShareMax: ADJACENT_HUE_BAND_SHARE_WARN,
    },
    roleWeights: richnessMetrics.roleWeights,
    sourceFamilyOccupancy: richnessMetrics.sourceFamilyOccupancy,
    hueConcentration: richnessMetrics.hueConcentration,
  }
}

function buildRichnessMarkdown(report) {
  const lines = [
    '# Theme Audit Richness Report',
    '',
    'Auto-generated by `scripts/theme-audit.mjs`.',
    '',
    `Scheme: \`${report.schemeId}\``,
    '',
    '## Role Weights',
    '',
    '| Role | Weight |',
    '| --- | --- |',
  ]

  for (const roleId of HIGH_EXPOSURE_ROLES) {
    lines.push(`| ${roleId} | ${formatPercent(report.roleWeights?.[roleId] ?? null)} |`)
  }

  lines.push('', '## Source-Family Occupancy', '', '| Variant | Dominant family | Dominant share | Families |', '| --- | --- | --- | --- |')
  for (const themeMeta of THEME_FILES) {
    const detail = report.sourceFamilyOccupancy?.[themeMeta.id] || null
    lines.push(
      `| ${themeMeta.id} | ${detail?.dominantFamily ?? 'n/a'} | ${formatPercent(detail?.dominantShare ?? null)} | ${summarizeWeightEntries(detail?.families || {}) || 'n/a'} |`
    )
  }

  lines.push('', '## Hue Concentration', '', '| Variant | Dominant hue band | Dominant share | Adjacent top-two | Adjacent share | Neutral share |', '| --- | --- | --- | --- | --- | --- |')
  for (const themeMeta of THEME_FILES) {
    const detail = report.hueConcentration?.[themeMeta.id] || null
    const adjacentLabel = Array.isArray(detail?.topAdjacentHueBands) ? detail.topAdjacentHueBands.join(' + ') : 'n/a'
    lines.push(
      `| ${themeMeta.id} | ${detail?.dominantHueBand ?? 'n/a'} | ${formatPercent(detail?.dominantShare ?? null)} | ${adjacentLabel} | ${formatPercent(detail?.topAdjacentShare ?? null)} | ${formatPercent(detail?.neutralShare ?? null)} |`
    )
  }

  lines.push('', '## Bucket Breakdown', '')
  for (const themeMeta of THEME_FILES) {
    const detail = report.hueConcentration?.[themeMeta.id] || null
    if (!detail) continue
    lines.push(`### ${themeMeta.id}`, '')
    lines.push('| Bucket | Share | Chromatic share | Roles |')
    lines.push('| --- | --- | --- | --- |')
    lines.push(`| neutral | ${formatPercent(detail.buckets?.neutral?.share ?? null)} | n/a | ${(detail.buckets?.neutral?.roles || []).join(', ') || 'none'} |`)
    for (let index = 0; index < HUE_BUCKET_COUNT; index += 1) {
      const bucketId = getHueBucketId(index)
      const bucket = detail.buckets?.[bucketId]
      lines.push(
        `| ${bucket?.label ?? getHueBucketLabel(index)} | ${formatPercent(bucket?.share ?? null)} | ${formatPercent(bucket?.shareChromatic ?? null)} | ${(bucket?.roles || []).join(', ') || 'none'} |`
      )
    }
    lines.push('')
  }

  return lines.join('\n')
}

function writeRichnessReport() {
  const report = buildRichnessReport()
  mkdirSync(REPORT_DIR, { recursive: true })
  writeFileSync(RICHNESS_REPORT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`)
  writeFileSync(RICHNESS_REPORT_MD_PATH, `${buildRichnessMarkdown(report)}\n`)
}

function validateRichnessDiagnostics(themes) {
  const roleWeights = getHighExposureRoleWeights()
  richnessMetrics.roleWeights = Object.fromEntries(
    Object.entries(roleWeights).map(([roleId, weight]) => [roleId, roundMetric(weight, 4)])
  )
  richnessMetrics.sourceFamilyOccupancy = buildSourceFamilyOccupancy(roleWeights)
  richnessMetrics.hueConcentration = buildHueConcentration(themes, roleWeights)
}

function buildProductEnergyDiagnostics(themes) {
  const byVariant = {}

  for (const themeMeta of THEME_FILES) {
    const theme = themes[themeMeta.id]
    if (!theme) continue

    const bg = normalizeHex(theme.colors?.['editor.background'])
    const sidebarBg = normalizeHex(theme.colors?.['sideBar.background'])
    const panelBg = normalizeHex(theme.colors?.['panel.background'])

    const buckets = {
      neutral: { label: 'neutral', weight: 0, keys: [] },
    }
    for (let index = 0; index < HUE_BUCKET_COUNT; index += 1) {
      buckets[getHueBucketId(index)] = {
        label: getHueBucketLabel(index),
        weight: 0,
        keys: [],
      }
    }

    let accentWeight = 0
    let chromaticWeight = 0
    let weightedSaturation = 0
    let weightedContrast = 0
    let contrastWeight = 0
    const accentBucketIds = new Set()

    for (const accentKey of CHROME_ACCENT_KEYS) {
      const color = normalizeHex(theme.colors?.[accentKey.key])
      if (!color) continue

      const bucket = getHueBucketForColor(color)
      if (!bucket) continue

      const detail = buckets[bucket.id]
      detail.weight += accentKey.weight
      detail.keys.push(accentKey.key)
      accentWeight += accentKey.weight
      weightedSaturation += accentKey.weight * bucket.hsl.s

      if (bg) {
        const contrast = contrastAgainstEditorBackground(color, bg)
        if (contrast != null) {
          weightedContrast += accentKey.weight * contrast
          contrastWeight += accentKey.weight
        }
      }

      if (bucket.id !== 'neutral') {
        chromaticWeight += accentKey.weight
        accentBucketIds.add(bucket.id)
      }
    }

    for (const detail of Object.values(buckets)) {
      detail.keys.sort()
      detail.weight = roundMetric(detail.weight, 4)
      detail.share = accentWeight > 0 ? roundMetric(detail.weight / accentWeight, 4) : null
      detail.shareChromatic = detail.label === 'neutral' || chromaticWeight <= 0
        ? null
        : roundMetric(detail.weight / chromaticWeight, 4)
    }

    let dominantBucketId = null
    let dominantBucketShare = null
    let dominantBucketWeight = -1
    for (let index = 0; index < HUE_BUCKET_COUNT; index += 1) {
      const bucketId = getHueBucketId(index)
      const detail = buckets[bucketId]
      if ((detail?.weight ?? 0) <= dominantBucketWeight) continue
      dominantBucketId = bucketId
      dominantBucketWeight = detail?.weight ?? 0
      dominantBucketShare = detail?.shareChromatic ?? null
    }

    const editorToSidebarDeltaE = bg && sidebarBg ? roundMetric(deltaE(bg, sidebarBg)) : null
    const sidebarToPanelDeltaE = sidebarBg && panelBg ? roundMetric(deltaE(sidebarBg, panelBg)) : null
    const accentMeanSaturation = accentWeight > 0 ? roundMetric(weightedSaturation / accentWeight, 4) : null
    const accentMeanContrast = contrastWeight > 0 ? roundMetric(weightedContrast / contrastWeight, 4) : null
    const accentNeutralShare = buckets.neutral.share
    const accentHueBucketCount = accentBucketIds.size

    byVariant[themeMeta.id] = {
      accentWeight: roundMetric(accentWeight, 4),
      accentMeanSaturation,
      accentMeanContrast,
      accentNeutralShare,
      accentHueBucketCount,
      dominantAccentHueBand: dominantBucketId ? buckets[dominantBucketId]?.label ?? null : null,
      dominantAccentHueShare: dominantBucketShare,
      surfaceDepth: {
        editorToSidebarDeltaE,
        sidebarToPanelDeltaE,
      },
      buckets,
    }

    if (accentNeutralShare != null && accentNeutralShare > PRODUCT_ENERGY_NEUTRAL_SHARE_WARN) {
      addWarning(
        `${themeMeta.path}: product energy accent neutral share ${formatPercent(accentNeutralShare)} exceeds ${formatPercent(PRODUCT_ENERGY_NEUTRAL_SHARE_WARN)}`
      )
    }
    if (accentMeanSaturation != null && accentMeanSaturation < PRODUCT_ENERGY_MEAN_SATURATION_WARN) {
      addWarning(
        `${themeMeta.path}: product energy accent mean saturation ${fixed(accentMeanSaturation)} is below ${fixed(PRODUCT_ENERGY_MEAN_SATURATION_WARN)}`
      )
    }
    if (dominantBucketShare != null && dominantBucketShare > PRODUCT_ENERGY_DOMINANT_HUE_SHARE_WARN) {
      addWarning(
        `${themeMeta.path}: product energy dominant accent hue band "${byVariant[themeMeta.id].dominantAccentHueBand}" share ${formatPercent(dominantBucketShare)} exceeds ${formatPercent(PRODUCT_ENERGY_DOMINANT_HUE_SHARE_WARN)}`
      )
    }
    if (accentWeight > 0 && accentHueBucketCount < PRODUCT_ENERGY_MIN_BUCKET_COUNT_WARN) {
      addWarning(
        `${themeMeta.path}: product energy accent hue bucket coverage ${accentHueBucketCount} is below ${PRODUCT_ENERGY_MIN_BUCKET_COUNT_WARN}`
      )
    }

    addNote(
      `${themeMeta.id}: chrome energy sat=${fixed(accentMeanSaturation ?? 0)}, contrast=${fixed(accentMeanContrast ?? 0)}, buckets=${accentHueBucketCount}, dominant=${byVariant[themeMeta.id].dominantAccentHueBand ?? 'n/a'}, depth=${fixed(editorToSidebarDeltaE ?? 0)}/${fixed(sidebarToPanelDeltaE ?? 0)}`
    )
  }

  return byVariant
}

function buildEnergyReport() {
  return {
    schemaVersion: 1,
    generatedBy: 'scripts/theme-audit.mjs',
    schemeId: COLOR_SYSTEM_SCHEME_ID,
    thresholds: {
      neutralSaturationThreshold: NEUTRAL_SATURATION_THRESHOLD,
      accentNeutralShareMax: PRODUCT_ENERGY_NEUTRAL_SHARE_WARN,
      accentMeanSaturationMin: PRODUCT_ENERGY_MEAN_SATURATION_WARN,
      dominantAccentHueShareMax: PRODUCT_ENERGY_DOMINANT_HUE_SHARE_WARN,
      minAccentHueBucketCount: PRODUCT_ENERGY_MIN_BUCKET_COUNT_WARN,
    },
    accentKeys: CHROME_ACCENT_KEYS,
    chrome: energyMetrics.chrome,
  }
}

function buildEnergyMarkdown(report) {
  const lines = [
    '# Theme Audit Product Energy Report',
    '',
    'Auto-generated by `scripts/theme-audit.mjs`.',
    '',
    `Scheme: \`${report.schemeId}\``,
    '',
    '## Chrome Summary',
    '',
    '| Variant | Mean saturation | Mean contrast | Neutral share | Hue buckets | Dominant hue band | Dominant share | Surface depth |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ]

  for (const themeMeta of THEME_FILES) {
    const detail = report.chrome?.[themeMeta.id] || null
    const surfaceDepth = detail?.surfaceDepth
      ? `${detail.surfaceDepth.editorToSidebarDeltaE ?? 'n/a'} / ${detail.surfaceDepth.sidebarToPanelDeltaE ?? 'n/a'}`
      : 'n/a'
    lines.push(
      `| ${themeMeta.id} | ${detail?.accentMeanSaturation ?? 'n/a'} | ${detail?.accentMeanContrast ?? 'n/a'} | ${formatPercent(detail?.accentNeutralShare ?? null)} | ${detail?.accentHueBucketCount ?? 'n/a'} | ${detail?.dominantAccentHueBand ?? 'n/a'} | ${formatPercent(detail?.dominantAccentHueShare ?? null)} | ${surfaceDepth} |`
    )
  }

  lines.push('', '## Accent Bucket Breakdown', '')
  for (const themeMeta of THEME_FILES) {
    const detail = report.chrome?.[themeMeta.id] || null
    if (!detail) continue
    lines.push(`### ${themeMeta.id}`, '')
    lines.push('| Bucket | Share | Chromatic share | UI keys |')
    lines.push('| --- | --- | --- | --- |')
    lines.push(`| neutral | ${formatPercent(detail.buckets?.neutral?.share ?? null)} | n/a | ${(detail.buckets?.neutral?.keys || []).join(', ') || 'none'} |`)
    for (let index = 0; index < HUE_BUCKET_COUNT; index += 1) {
      const bucketId = getHueBucketId(index)
      const bucket = detail.buckets?.[bucketId]
      lines.push(
        `| ${bucket?.label ?? getHueBucketLabel(index)} | ${formatPercent(bucket?.share ?? null)} | ${formatPercent(bucket?.shareChromatic ?? null)} | ${(bucket?.keys || []).join(', ') || 'none'} |`
      )
    }
    lines.push('')
  }

  return lines.join('\n')
}

function writeEnergyReport() {
  const report = buildEnergyReport()
  mkdirSync(REPORT_DIR, { recursive: true })
  writeFileSync(ENERGY_REPORT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`)
  writeFileSync(ENERGY_REPORT_MD_PATH, `${buildEnergyMarkdown(report)}\n`)
}

function validateProductEnergyDiagnostics(themes) {
  energyMetrics.chrome = buildProductEnergyDiagnostics(themes)
}

function validateFixtures() {
  if (!existsSync(FIXTURE_DIR)) {
    addIssue(`${FIXTURE_DIR}: missing fixture directory`)
    return
  }

  for (const file of REQUIRED_FIXTURES) {
    const path = join(FIXTURE_DIR, file)
    if (!existsSync(path)) {
      addIssue(`${path}: missing fixture file`)
      continue
    }
    if (statSync(path).size < 32) {
      addWarning(`${path}: fixture is unusually small`)
    }
  }
}

function validateThemeStructure(themeMeta, theme) {
  if (!theme) return

  if (theme.type !== themeMeta.type) {
    addIssue(`${themeMeta.path}: expected type "${themeMeta.type}", got "${theme.type}"`)
  }

  if (!Array.isArray(theme.tokenColors) || theme.tokenColors.length === 0) {
    addIssue(`${themeMeta.path}: tokenColors is empty or missing`)
  }

  if (!theme.semanticTokenColors || typeof theme.semanticTokenColors !== 'object') {
    addIssue(`${themeMeta.path}: semanticTokenColors is missing`)
  }

  for (const key of REQUIRED_UI_KEYS) {
    const value = normalizeHex(theme.colors?.[key])
    if (!value) addIssue(`${themeMeta.path}: missing or invalid color "${key}"`)
  }

  for (const role of ROLE_ADAPTERS) {
    if (role.requireTokenCoverage === false) continue
    const scopes = role.scopes || []
    if (scopes.length === 0) continue
    const color = getTokenColor(theme, scopes)
    if (!color) addIssue(`${themeMeta.path}: missing token color coverage for role "${role.id}"`)
  }
}

function validateReadability(themeMeta, theme) {
  if (!theme) return

  const bg = normalizeHex(theme.colors?.['editor.background'])
  const fg = normalizeHex(theme.colors?.['editor.foreground'])
  const comment = getTokenColor(theme, ROLE_SCOPES.comment)
  const operator = getTokenColor(theme, ROLE_SCOPES.operator)

  if (!bg || !fg) return

  const fgContrast = contrastRatio(fg, bg)
  if (fgContrast < MIN_TEXT_CONTRAST) {
    addIssue(`${themeMeta.path}: editor fg/bg contrast ${fixed(fgContrast)} is below ${MIN_TEXT_CONTRAST}`)
  } else {
    addNote(`${themeMeta.id}: fg/bg contrast ${fixed(fgContrast)}`)
  }

  if (comment) {
    const ratio = contrastRatio(comment, bg)
    if (ratio < COMMENT_CONTRAST_MIN || ratio > COMMENT_CONTRAST_MAX) {
      addWarning(`${themeMeta.path}: comment contrast ${fixed(ratio)} outside target ${COMMENT_CONTRAST_MIN}-${COMMENT_CONTRAST_MAX}`)
    } else {
      addNote(`${themeMeta.id}: comment contrast ${fixed(ratio)}`)
    }
  }

  if (operator) {
    const ratio = contrastRatio(operator, bg)
    if (ratio < OPERATOR_CONTRAST_MIN || ratio > OPERATOR_CONTRAST_MAX) {
      addWarning(`${themeMeta.path}: operator contrast ${fixed(ratio)} outside target ${OPERATOR_CONTRAST_MIN}-${OPERATOR_CONTRAST_MAX}`)
    } else {
      addNote(`${themeMeta.id}: operator contrast ${fixed(ratio)}`)
    }
  }
}

function validateRoleSeparation(themeMeta, theme) {
  if (!theme) return

  const roles = ['keyword', 'function', 'method', 'property', 'string', 'number', 'type', 'variable', 'operator']
  const colors = Object.fromEntries(roles.map((role) => [role, getTokenColor(theme, ROLE_SCOPES[role])]))
  const missing = roles.filter((role) => !colors[role])
  if (missing.length > 0) return

  for (let i = 0; i < roles.length; i++) {
    for (let j = i + 1; j < roles.length; j++) {
      const a = roles[i]
      const b = roles[j]
      const dE = deltaE(colors[a], colors[b])
      if (dE < MIN_ROLE_DELTA_E) {
        addWarning(`${themeMeta.path}: "${a}" vs "${b}" deltaE ${fixed(dE)} is low (<${MIN_ROLE_DELTA_E})`)
      }
    }
  }
}

function validateSemanticAlignment(themeMeta, theme) {
  if (!theme) return

  for (const roleDef of ROLE_ADAPTERS) {
    const semanticKeys = roleDef.semanticKeys || []
    if (semanticKeys.length === 0) continue

    const tokenColor = getTokenColor(theme, ROLE_SCOPES[roleDef.id] || [])
    if (!tokenColor) {
      if (roleDef.requireTokenCoverage === false) continue
      addIssue(`${themeMeta.path}: semantic/textmate missing for role "${roleDef.id}"`)
      continue
    }

    for (const semanticKey of semanticKeys) {
      const semanticColor = getSemanticColor(theme, semanticKey)
      if (!semanticColor) {
        addIssue(`${themeMeta.path}: semantic token "${semanticKey}" missing for role "${roleDef.id}"`)
        continue
      }

      const dE = deltaE(tokenColor, semanticColor)
      if (dE > 6) {
        addWarning(`${themeMeta.path}: semantic drift for "${semanticKey}" vs role "${roleDef.id}" (deltaE ${fixed(dE)})`)
      }
    }
  }
}

function validateCriticalPairSeparation(themeMeta, theme) {
  if (!theme) return

  const checks = [
    {
      left: 'operator',
      right: 'comment',
      profile: OPERATOR_COMMENT_PAIR_GATE,
      fallback: 4.5,
    },
    {
      left: 'method',
      right: 'property',
      profile: METHOD_PROPERTY_PAIR_GATE,
      fallback: 10,
    },
  ]

  for (const check of checks) {
    const leftColor = getTokenColor(theme, ROLE_SCOPES[check.left] || [])
    const rightColor = getTokenColor(theme, ROLE_SCOPES[check.right] || [])
    if (!leftColor || !rightColor) continue

    const dE = deltaE(leftColor, rightColor)
    if (dE == null) continue

    const threshold = resolvePairGateThreshold(check.profile, themeMeta.id, check.fallback)
    if (dE < threshold) {
      addIssue(
        `${themeMeta.path}: critical pair "${check.left}" vs "${check.right}" deltaE ${fixed(dE)} is below ${fixed(threshold)}`
      )
    }
  }
}

function validateLightPolarityCompensation(themeMeta, theme) {
  if (!theme || themeMeta.type !== 'light') return

  const bg = normalizeHex(theme.colors?.['editor.background'])
  if (!bg) return

  const variantProfiles = COLOR_SYSTEM_TUNING.lightPolarityRoleOptimization?.[themeMeta.id]
  if (!variantProfiles || Object.keys(variantProfiles).length === 0) return

  const bgHsl = rgbToHsl(bg)
  for (const [roleId, profile] of Object.entries(variantProfiles)) {
    const roleColor = getTokenColor(theme, ROLE_SCOPES[roleId] || [])
    if (!roleColor) {
      addWarning(`${themeMeta.path}: polarity role "${roleId}" color not found`)
      continue
    }

    const emitNote = roleId === 'function'
    const roleHsl = rgbToHsl(roleColor)
    if (bgHsl && roleHsl) {
      const bgHueGap = hueDistance(bgHsl.h, roleHsl.h)
      if (bgHueGap < profile.minBgHueDistance) {
        addWarning(`${themeMeta.path}: ${roleId}/background hue distance ${fixed(bgHueGap)} is below ${fixed(profile.minBgHueDistance)}`)
      } else if (emitNote) {
        addNote(`${themeMeta.id}: ${roleId}/background hue distance ${fixed(bgHueGap)}`)
      }
    }

    const anchorColors = (profile.anchorRoles || [])
      .map((anchorRoleId) => getTokenColor(theme, ROLE_SCOPES[anchorRoleId] || []))
      .filter(Boolean)
    if (anchorColors.length > 0) {
      const anchorDeltaEValues = anchorColors
        .map((anchor) => deltaE(roleColor, anchor))
        .filter((value) => value != null)
      if (anchorDeltaEValues.length > 0) {
        const minAnchorDeltaE = Math.min(...anchorDeltaEValues)
        if (minAnchorDeltaE < profile.minAnchorDeltaE) {
          addWarning(`${themeMeta.path}: ${roleId} anchor separation deltaE ${fixed(minAnchorDeltaE)} is below ${fixed(profile.minAnchorDeltaE)}`)
        } else if (emitNote) {
          addNote(`${themeMeta.id}: ${roleId} anchor separation deltaE ${fixed(minAnchorDeltaE)}`)
        }
      }
    }

    if (profile.minGuardDeltaE != null) {
      const guardColors = (profile.guardRoles || [])
        .map((guardRoleId) => getTokenColor(theme, ROLE_SCOPES[guardRoleId] || []))
        .filter(Boolean)
      if (guardColors.length > 0) {
        const guardDeltaEValues = guardColors
          .map((guard) => deltaE(roleColor, guard))
          .filter((value) => value != null)
        if (guardDeltaEValues.length > 0) {
          const minGuardDeltaE = Math.min(...guardDeltaEValues)
          if (minGuardDeltaE < profile.minGuardDeltaE) {
            addWarning(`${themeMeta.path}: ${roleId} guard separation deltaE ${fixed(minGuardDeltaE)} is below ${fixed(profile.minGuardDeltaE)}`)
          }
        }
      }
    }
  }
}

function validateRoleLaneProfile(themeMeta, theme) {
  if (!theme) return

  const bg = normalizeHex(theme.colors?.['editor.background'])
  const fg = normalizeHex(theme.colors?.['editor.foreground'])
  if (!bg || !fg) return

  if (ROLE_LANE_MODE === 'material-editorial') {
    const nearForegroundRoleProfile = resolveVariantRoleProfile(ROLE_LANE_NEAR_FG_BY_VARIANT, themeMeta.id)
    for (const [roleId, profile] of Object.entries(nearForegroundRoleProfile)) {
      const roleColor = getTokenColor(theme, ROLE_SCOPES[roleId] || [])
      if (!roleColor) continue

      const fgDelta = deltaE(roleColor, fg)
      if (fgDelta == null) continue
      if (fgDelta < profile.minDeltaE || fgDelta > profile.maxDeltaE) {
        addIssue(
          `${themeMeta.path}: role lane near-foreground budget failed for "${roleId}" (deltaE ${fixed(fgDelta)} not in ${fixed(profile.minDeltaE)}-${fixed(profile.maxDeltaE)})`
        )
      }

      const ratio = contrastRatio(roleColor, bg)
      if (ratio == null || ratio < profile.minBgContrast) {
        addIssue(`${themeMeta.path}: role lane near-foreground contrast failed for "${roleId}" (${fixed(ratio ?? 0)} < ${fixed(profile.minBgContrast)})`)
      }
    }

    const criticalPairs = resolveCriticalPairThresholds(ROLE_LANE_CRITICAL_PAIRS_BY_VARIANT, themeMeta.id)
    for (const [pairKey, threshold] of Object.entries(criticalPairs)) {
      const pairMatch = String(pairKey).match(/^([a-zA-Z0-9_-]+)->([a-zA-Z0-9_-]+)$/)
      if (!pairMatch) continue
      const [, leftRole, rightRole] = pairMatch
      const leftColor = getTokenColor(theme, ROLE_SCOPES[leftRole] || [])
      const rightColor = getTokenColor(theme, ROLE_SCOPES[rightRole] || [])
      if (!leftColor || !rightColor) continue
      const dE = deltaE(leftColor, rightColor)
      if (dE == null) continue
      if (dE < threshold) {
        addIssue(`${themeMeta.path}: role lane critical pair "${leftRole}" vs "${rightRole}" deltaE ${fixed(dE)} is below ${fixed(threshold)}`)
      }
    }

    return
  }

  const useCoolBandOnly = ROLE_LANE_MODE === 'contrast-forward' || ROLE_LANE_MODE === 'earthy-groove'
  const coolHueRoleProfile = resolveVariantRoleProfile(ROLE_LANE_COOL_HUE_BAND_BY_VARIANT, themeMeta.id)
  for (const [roleId, profile] of Object.entries(coolHueRoleProfile)) {
    const roleColor = getTokenColor(theme, ROLE_SCOPES[roleId] || [])
    if (!roleColor) continue

    const hsl = rgbToHsl(roleColor)
    if (!hsl) continue
    if (!isHueInBand(hsl.h, profile.hueMin, profile.hueMax)) {
      addIssue(`${themeMeta.path}: role lane cool hue band failed for "${roleId}" (${fixed(hsl.h)} not in ${fixed(profile.hueMin)}-${fixed(profile.hueMax)})`)
    }

    const ratio = contrastRatio(roleColor, bg)
    if (ratio == null || ratio < profile.minBgContrast) {
      addIssue(`${themeMeta.path}: role lane cool hue band contrast failed for "${roleId}" (${fixed(ratio ?? 0)} < ${fixed(profile.minBgContrast)})`)
    }
  }

  if (!useCoolBandOnly) {
    const warmHueRoleProfile = resolveVariantRoleProfile(ROLE_LANE_WARM_HUE_BAND_BY_VARIANT, themeMeta.id)
    for (const [roleId, profile] of Object.entries(warmHueRoleProfile)) {
      const roleColor = getTokenColor(theme, ROLE_SCOPES[roleId] || [])
      if (!roleColor) continue

      const hsl = rgbToHsl(roleColor)
      if (!hsl) continue
      if (!isHueInBand(hsl.h, profile.hueMin, profile.hueMax)) {
        addIssue(`${themeMeta.path}: role lane warm hue band failed for "${roleId}" (${fixed(hsl.h)} not in ${fixed(profile.hueMin)}-${fixed(profile.hueMax)})`)
      }

      const ratio = contrastRatio(roleColor, bg)
      if (ratio == null || ratio < profile.minBgContrast) {
        addIssue(`${themeMeta.path}: role lane warm hue band contrast failed for "${roleId}" (${fixed(ratio ?? 0)} < ${fixed(profile.minBgContrast)})`)
      }
    }

    if (ROLE_LANE_WARM_GAMUT_GUARD) {
      for (const roleId of ROLE_LANE_WARM_GAMUT_GUARD.roles || []) {
        const roleColor = getTokenColor(theme, ROLE_SCOPES[roleId] || [])
        if (!roleColor) continue
        const hsl = rgbToHsl(roleColor)
        if (!hsl) continue
        if (hsl.s < (ROLE_LANE_WARM_GAMUT_GUARD.minSaturation ?? 0)) continue
        if (isHueInBand(hsl.h, ROLE_LANE_WARM_GAMUT_GUARD.forbiddenHueMin, ROLE_LANE_WARM_GAMUT_GUARD.forbiddenHueMax)) {
          addIssue(
            `${themeMeta.path}: warm gamut guard failed for "${roleId}" (${fixed(hsl.h)} in ${fixed(ROLE_LANE_WARM_GAMUT_GUARD.forbiddenHueMin)}-${fixed(ROLE_LANE_WARM_GAMUT_GUARD.forbiddenHueMax)})`
          )
        }
      }
    }
  }

  const nearForegroundRoleProfile = resolveVariantRoleProfile(ROLE_LANE_NEAR_FG_BY_VARIANT, themeMeta.id)
  for (const [roleId, profile] of Object.entries(nearForegroundRoleProfile)) {
    const roleColor = getTokenColor(theme, ROLE_SCOPES[roleId] || [])
    if (!roleColor) continue

    const fgDelta = deltaE(roleColor, fg)
    if (fgDelta == null) continue
    if (fgDelta < profile.minDeltaE || fgDelta > profile.maxDeltaE) {
      addIssue(
        `${themeMeta.path}: role lane near-foreground budget failed for "${roleId}" (deltaE ${fixed(fgDelta)} not in ${fixed(profile.minDeltaE)}-${fixed(profile.maxDeltaE)})`
      )
    }

    const ratio = contrastRatio(roleColor, bg)
    if (ratio == null || ratio < profile.minBgContrast) {
      addIssue(`${themeMeta.path}: role lane near-foreground contrast failed for "${roleId}" (${fixed(ratio ?? 0)} < ${fixed(profile.minBgContrast)})`)
    }
  }

  const criticalPairs = resolveCriticalPairThresholds(ROLE_LANE_CRITICAL_PAIRS_BY_VARIANT, themeMeta.id)
  for (const [pairKey, threshold] of Object.entries(criticalPairs)) {
    const pairMatch = String(pairKey).match(/^([a-zA-Z0-9_-]+)->([a-zA-Z0-9_-]+)$/)
    if (!pairMatch) continue
    const [, leftRole, rightRole] = pairMatch
    const leftColor = getTokenColor(theme, ROLE_SCOPES[leftRole] || [])
    const rightColor = getTokenColor(theme, ROLE_SCOPES[rightRole] || [])
    if (!leftColor || !rightColor) continue
    const dE = deltaE(leftColor, rightColor)
    if (dE == null) continue
    if (dE < threshold) {
      addIssue(`${themeMeta.path}: role lane critical pair "${leftRole}" vs "${rightRole}" deltaE ${fixed(dE)} is below ${fixed(threshold)}`)
    }
  }
}

function validateDarkSoftPerception(themeMeta, theme) {
  if (!theme || themeMeta.id !== 'darkSoft' || !DARK_SOFT_PERCEPTION_GUARD) return

  const functionProfile = DARK_SOFT_PERCEPTION_GUARD.function || null
  const warmRoles = Array.isArray(DARK_SOFT_PERCEPTION_GUARD.warmRoles) ? DARK_SOFT_PERCEPTION_GUARD.warmRoles : []
  const warmAverageMinSaturation = DARK_SOFT_PERCEPTION_GUARD.warmAverageMinSaturation
  const minSaturationByRole = DARK_SOFT_PERCEPTION_GUARD.minSaturationByRole || {}

  if (functionProfile) {
    const fnColor = getTokenColor(theme, ROLE_SCOPES.function || [])
    if (fnColor) {
      const hsl = rgbToHsl(fnColor)
      if (hsl) {
        if (!isHueInBand(hsl.h, functionProfile.hueMin, functionProfile.hueMax)) {
          addWarning(`${themeMeta.path}: darkSoft perception guard: function hue ${fixed(hsl.h)} outside ${fixed(functionProfile.hueMin)}-${fixed(functionProfile.hueMax)}`)
        }
        if (functionProfile.maxSaturation != null && hsl.s > functionProfile.maxSaturation) {
          addWarning(`${themeMeta.path}: darkSoft perception guard: function saturation ${fixed(hsl.s)} exceeds ${fixed(functionProfile.maxSaturation)}`)
        }
        if (functionProfile.maxLightness != null && hsl.l > functionProfile.maxLightness) {
          addWarning(`${themeMeta.path}: darkSoft perception guard: function lightness ${fixed(hsl.l)} exceeds ${fixed(functionProfile.maxLightness)}`)
        }
      }
    }
  }

  const warmRoleSaturations = warmRoles
    .map((roleId) => getTokenColor(theme, ROLE_SCOPES[roleId] || []))
    .filter(Boolean)
    .map((hex) => rgbToHsl(hex))
    .filter(Boolean)
    .map((hsl) => hsl.s)

  if (typeof warmAverageMinSaturation === 'number' && warmRoleSaturations.length > 0) {
    const averageSaturation = warmRoleSaturations.reduce((sum, value) => sum + value, 0) / warmRoleSaturations.length
    if (averageSaturation < warmAverageMinSaturation) {
      addWarning(`${themeMeta.path}: darkSoft perception guard: warm-role average saturation ${fixed(averageSaturation)} below ${fixed(warmAverageMinSaturation)}`)
    }
  }

  for (const [roleId, minSaturation] of Object.entries(minSaturationByRole)) {
    if (typeof minSaturation !== 'number') continue
    const color = getTokenColor(theme, ROLE_SCOPES[roleId] || [])
    if (!color) continue
    const hsl = rgbToHsl(color)
    if (!hsl) continue
    if (hsl.s < minSaturation) {
      addWarning(`${themeMeta.path}: darkSoft perception guard: ${roleId} saturation ${fixed(hsl.s)} below ${fixed(minSaturation)}`)
    }
  }
}

function validateCrossThemeDrift(darkTheme, lightTheme, pairLabel = 'core') {
  if (!darkTheme || !lightTheme) return

  const roles = ['comment', 'keyword', 'operator', 'string', 'number', 'type', 'variable', 'method', 'property']
  for (const role of roles) {
    const darkColor = getTokenColor(darkTheme, ROLE_SCOPES[role])
    const lightColor = getTokenColor(lightTheme, ROLE_SCOPES[role])
    if (!darkColor || !lightColor) continue

    const dh = rgbToHsl(darkColor)
    const lh = rgbToHsl(lightColor)
    if (!dh || !lh) continue

    const lowSat = dh.s < 0.08 && lh.s < 0.08
    if (lowSat) continue

    const drift = hueDistance(dh.h, lh.h)
    if (drift > MAX_ROLE_HUE_DRIFT) {
      addWarning(`${pairLabel} cross-theme: role "${role}" hue drift ${fixed(drift)} exceeds ${MAX_ROLE_HUE_DRIFT}`)
    }
  }
}

function validateSoftPairDrift(darkSoftTheme, lightSoftTheme) {
  if (!darkSoftTheme || !lightSoftTheme) return
  validateCrossThemeDrift(darkSoftTheme, lightSoftTheme, 'soft-pair')
}

function validateColorSystemSource(themes) {
  if (!existsSync(COLOR_SYSTEM.darkSource)) {
    addIssue(`${COLOR_SYSTEM.darkSource}: source file not found`)
    return
  }
  if (!existsSync(COLOR_SYSTEM.semantic)) {
    addIssue(`${COLOR_SYSTEM.semantic}: semantic palette file not found`)
  }
  if (!existsSync(COLOR_SYSTEM.tuning)) {
    addIssue(`${COLOR_SYSTEM.tuning}: tuning file not found`)
  }

  const sourceTheme = readJson(COLOR_SYSTEM.darkSource)
  const generatedDark = themes.dark
  if (!sourceTheme || !generatedDark) return

  for (const templatePath of COLOR_SYSTEM.templates) {
    if (!existsSync(templatePath)) {
      addIssue(`${templatePath}: template file not found`)
    }
  }
}

function validateThemeParity(themes) {
  const baseMeta = THEME_FILES.find((themeMeta) => themeMeta.id === 'dark')
  if (!baseMeta) return

  const baseTheme = themes[baseMeta.id]
  if (!baseTheme) return

  const baseColorKeys = getColorKeySet(baseTheme)
  const baseTokenScopes = getTokenScopeSet(baseTheme)
  const baseSemanticKeys = getSemanticKeySet(baseTheme)

  for (const themeMeta of THEME_FILES) {
    if (themeMeta.id === baseMeta.id) continue
    const theme = themes[themeMeta.id]
    if (!theme) continue

    const colorDiff = diffSet(baseColorKeys, getColorKeySet(theme))
    if (colorDiff.missing.length > 0 || colorDiff.extra.length > 0) {
      addIssue(
        `${themeMeta.path}: color key parity mismatch vs ${baseMeta.path}; ` +
        `missing (${colorDiff.missing.length}): ${summarizeList(colorDiff.missing)}; ` +
        `extra (${colorDiff.extra.length}): ${summarizeList(colorDiff.extra)}`
      )
    }

    const tokenScopeDiff = diffSet(baseTokenScopes, getTokenScopeSet(theme))
    if (tokenScopeDiff.missing.length > 0 || tokenScopeDiff.extra.length > 0) {
      addIssue(
        `${themeMeta.path}: token scope parity mismatch vs ${baseMeta.path}; ` +
        `missing (${tokenScopeDiff.missing.length}): ${summarizeList(tokenScopeDiff.missing)}; ` +
        `extra (${tokenScopeDiff.extra.length}): ${summarizeList(tokenScopeDiff.extra)}`
      )
    }

    const semanticDiff = diffSet(baseSemanticKeys, getSemanticKeySet(theme))
    if (semanticDiff.missing.length > 0 || semanticDiff.extra.length > 0) {
      addIssue(
        `${themeMeta.path}: semantic token key parity mismatch vs ${baseMeta.path}; ` +
        `missing (${semanticDiff.missing.length}): ${summarizeList(semanticDiff.missing)}; ` +
        `extra (${semanticDiff.extra.length}): ${summarizeList(semanticDiff.extra)}`
      )
    }
  }
}

function run() {
  const themes = {}

  for (const themeMeta of THEME_FILES) {
    if (!existsSync(themeMeta.path)) {
      addIssue(`${themeMeta.path}: file not found`)
      continue
    }
    const theme = readJson(themeMeta.path)
    themes[themeMeta.id] = theme
    validateThemeStructure(themeMeta, theme)
    validateReadability(themeMeta, theme)
    validateRoleSeparation(themeMeta, theme)
    validateCriticalPairSeparation(themeMeta, theme)
    validateSemanticAlignment(themeMeta, theme)
    validateLightPolarityCompensation(themeMeta, theme)
  validateRoleLaneProfile(themeMeta, theme)
    validateDarkSoftPerception(themeMeta, theme)
    validateInteractionStateBudget(themeMeta, theme)
  }

  validateColorSystemSource(themes)
  validateCrossThemeDrift(themes.dark, themes.light, 'default-pair')
  validateSoftPairDrift(themes.darkSoft, themes.lightSoft)
  validateThemeParity(themes)
  validateFixtures()
  validateRichnessDiagnostics(themes)
  validateProductEnergyDiagnostics(themes)
  writeInteractionReport()
  writeRichnessReport()
  writeEnergyReport()

  if (issues.length > 0) {
    console.log('[FAIL] Theme audit found blocking issues:')
    for (const issue of issues) console.log(`  - ${issue}`)
  } else {
    console.log('[PASS] No blocking theme issues found.')
  }

  if (warnings.length > 0) {
    console.log('\n[WARN] Follow-up improvements:')
    for (const warning of warnings) console.log(`  - ${warning}`)
  }

  if (notes.length > 0) {
    console.log('\n[INFO] Key metrics:')
    for (const note of notes) console.log(`  - ${note}`)
  }
  console.log(`\n[INFO] Interaction state report: ${INTERACTION_REPORT_JSON_PATH}`)
  console.log(`[INFO] Richness report: ${RICHNESS_REPORT_JSON_PATH}`)
  console.log(`[INFO] Product energy report: ${ENERGY_REPORT_JSON_PATH}`)

  process.exit(issues.length > 0 ? 1 : 0)
}

run()
