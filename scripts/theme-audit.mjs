import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  COLOR_SYSTEM_SEMANTIC_PATH,
  COLOR_SYSTEM_TUNING_PATH,
  getThemeMetaList,
  loadColorSystemTuning,
  loadColorSystemVariants,
  loadRoleAdapters,
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

const COLOR_SYSTEM = {
  darkSource: VARIANT_SPEC.baseSourcePath,
  templates: [VARIANT_SPEC.baseTemplatePath, ...VARIANT_SPEC.variants
    .filter((variant) => variant.mode === 'derived')
    .map((variant) => variant.templatePath)],
  semantic: COLOR_SYSTEM_SEMANTIC_PATH,
  tuning: COLOR_SYSTEM_TUNING_PATH,
}

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

const ROLE_SCOPES = Object.fromEntries(ROLE_ADAPTERS.map((role) => [role.id, role.scopes]))

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
const ROLE_LANE_COOL_HUE_BAND_BY_VARIANT = ROLE_LANE_PROFILE.coolHueBandByVariant || {}
const ROLE_LANE_WARM_HUE_BAND_BY_VARIANT = ROLE_LANE_PROFILE.warmHueBandByVariant || {}
const ROLE_LANE_NEAR_FG_BY_VARIANT = ROLE_LANE_PROFILE.nearForegroundDeltaEByVariant || {}
const ROLE_LANE_CRITICAL_PAIRS_BY_VARIANT = ROLE_LANE_PROFILE.criticalPairDeltaEByVariant || {}
const ROLE_LANE_WARM_GAMUT_GUARD = ROLE_LANE_PROFILE.warmGamutGuard || null
const DARK_SOFT_PERCEPTION_GUARD = COLOR_SYSTEM_TUNING.darkSoftPerceptionGuard || null
const INTERACTION_STATE_BUDGET = COLOR_SYSTEM_TUNING.interactionStateBudget || {}
const INTERACTION_REPORT_JSON_PATH = 'reports/theme-audit-interaction.json'
const INTERACTION_REPORT_MD_PATH = 'reports/theme-audit-interaction.md'

const issues = []
const warnings = []
const notes = []
const interactionMetricsByVariant = {}

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

function fixed(n) {
  return Number(n).toFixed(1)
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
  mkdirSync('reports', { recursive: true })
  writeFileSync(INTERACTION_REPORT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`)
  writeFileSync(INTERACTION_REPORT_MD_PATH, `${buildInteractionMarkdown(report)}\n`)
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
  writeInteractionReport()

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

  process.exit(issues.length > 0 ? 1 : 0)
}

run()
