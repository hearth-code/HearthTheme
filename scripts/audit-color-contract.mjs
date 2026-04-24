import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { deltaE, hueDistance, isHueInBand, normalizeHex, rgbToHsl } from './color-utils.mjs'

const ACTIVE_PRODUCT_PATH = 'products/active-product.json'
const SCHEMES_ROOT = 'color-system/schemes'
const ADAPTERS_PATH = 'color-system/framework/adapters.json'
const VARIANTS_PATH = 'color-system/framework/variants.json'
const REPORT_JSON_PATH = 'reports/color-contract-audit.json'
const REPORT_MD_PATH = 'reports/color-contract-audit.md'

const issues = []
const warnings = []
const report = {
  schemaVersion: 1,
  generatedBy: 'scripts/audit-color-contract.mjs',
  schemes: {}
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function addIssue(message) {
  issues.push(message)
}

function addWarning(message) {
  warnings.push(message)
}

function formatNumber(value, digits = 1) {
  return Number(value).toFixed(digits)
}

function getSupportedSchemeIds() {
  const activeProduct = readJson(ACTIVE_PRODUCT_PATH)
  const productDir = String(activeProduct.productDir || '').trim()
  const product = readJson(join(productDir, 'product.json'))
  return (product.supportedSchemeIds || []).map((schemeId) => String(schemeId).trim()).filter(Boolean)
}

function getVariants() {
  return (readJson(VARIANTS_PATH).variants || []).map((variant) => ({
    id: String(variant.id || '').trim(),
    fileSlug: String(variant.fileSlug || variant.id || '').trim(),
    type: String(variant.type || '').trim()
  })).filter((variant) => variant.id && variant.fileSlug)
}

function buildRoleScopes() {
  const adapters = readJson(ADAPTERS_PATH)
  return Object.fromEntries((adapters.roles || []).map((role) => [
    role.id,
    Array.isArray(role.scopes) ? role.scopes : []
  ]))
}

function toScopes(entry) {
  if (!entry?.scope) return []
  return Array.isArray(entry.scope) ? entry.scope : [entry.scope]
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
    const color = normalizeHex(entry.settings?.foreground)
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

function resolveRoleSource(semanticRules, roleId, variantId) {
  const rule = semanticRules.roles?.[roleId]
  return rule?.byVariant?.[variantId]?.source || rule?.source || null
}

function validateContractShape(schemeId, contract) {
  if (contract.schemaVersion !== 1) {
    addIssue(`${schemeId}: color-contract.json schemaVersion must be 1`)
  }
  if (contract.id !== schemeId) {
    addIssue(`${schemeId}: color-contract.json id must match scheme id`)
  }
  if (!contract.signalLanes || typeof contract.signalLanes !== 'object' || Array.isArray(contract.signalLanes)) {
    addIssue(`${schemeId}: color-contract.json must define signalLanes`)
  }
  if (!contract.roleSources || typeof contract.roleSources !== 'object' || Array.isArray(contract.roleSources)) {
    addIssue(`${schemeId}: color-contract.json must define roleSources`)
  }
}

function validateReviewFixtures(schemeId, contract) {
  for (const fixture of contract.reviewFixtures || []) {
    if (!existsSync(fixture)) {
      addIssue(`${schemeId}: review fixture missing: ${fixture}`)
    }
  }
}

function validateRoleSources(schemeId, contract, semanticRules, variants) {
  for (const [roleId, expected] of Object.entries(contract.roleSources || {})) {
    for (const variant of variants) {
      const actual = resolveRoleSource(semanticRules, roleId, variant.id)
      if (!actual) {
        addIssue(`${schemeId}/${variant.id}: role "${roleId}" has no semantic source`)
        continue
      }
      if (actual.family !== expected.family || actual.tone !== expected.tone) {
        addIssue(
          `${schemeId}/${variant.id}: role "${roleId}" source ${actual.family}.${actual.tone} does not match contract ${expected.family}.${expected.tone}`
        )
      }
    }
  }
}

function validateSignalLanes(schemeId, contract, theme, variant, roleScopes, variantReport) {
  for (const [laneId, lane] of Object.entries(contract.signalLanes || {})) {
    const hueBand = lane.hueBand || []
    const minSaturation = Number(lane.minSaturation ?? 0)
    const laneReport = {
      hueBand,
      minSaturation,
      roles: {}
    }

    for (const roleId of lane.roles || []) {
      const color = getTokenColor(theme, roleScopes[roleId] || [])
      if (!color) {
        addIssue(`${schemeId}/${variant.id}: lane "${laneId}" role "${roleId}" has no generated color`)
        continue
      }
      const hsl = rgbToHsl(color)
      if (!hsl) continue

      laneReport.roles[roleId] = {
        color,
        hue: Number(hsl.h.toFixed(1)),
        saturation: Number(hsl.s.toFixed(3)),
        lightness: Number(hsl.l.toFixed(3))
      }

      if (!isHueInBand(hsl.h, hueBand[0], hueBand[1])) {
        addIssue(
          `${schemeId}/${variant.id}: lane "${laneId}" role "${roleId}" hue ${formatNumber(hsl.h)} outside ${formatNumber(hueBand[0])}-${formatNumber(hueBand[1])}`
        )
      }
      if (hsl.s < minSaturation) {
        addIssue(
          `${schemeId}/${variant.id}: lane "${laneId}" role "${roleId}" saturation ${formatNumber(hsl.s, 3)} below ${formatNumber(minSaturation, 3)}`
        )
      }

      const targetHue = (hueBand[0] + hueBand[1]) / 2
      const drift = hueDistance(hsl.h, targetHue)
      if (drift > 18) {
        addWarning(
          `${schemeId}/${variant.id}: lane "${laneId}" role "${roleId}" hue drift ${formatNumber(drift)} from contract center`
        )
      }
    }

    variantReport.signalLanes[laneId] = laneReport
  }
}

function validateCriticalPairs(schemeId, contract, theme, variant, roleScopes, variantReport) {
  for (const pair of contract.criticalPairs || []) {
    const left = getTokenColor(theme, roleScopes[pair.left] || [])
    const right = getTokenColor(theme, roleScopes[pair.right] || [])
    if (!left || !right) {
      addIssue(`${schemeId}/${variant.id}: critical pair "${pair.left}" vs "${pair.right}" is missing a role color`)
      continue
    }
    const distance = deltaE(left, right)
    const entry = {
      left: pair.left,
      right: pair.right,
      minDeltaE: pair.minDeltaE,
      deltaE: Number(distance.toFixed(1))
    }
    variantReport.criticalPairs.push(entry)
    if (distance < pair.minDeltaE) {
      addIssue(
        `${schemeId}/${variant.id}: critical pair "${pair.left}" vs "${pair.right}" deltaE ${formatNumber(distance)} below ${formatNumber(pair.minDeltaE)}`
      )
    }
  }
}

function validateScheme(schemeId, variants, roleScopes) {
  const schemeDir = join(SCHEMES_ROOT, schemeId)
  const contractPath = join(schemeDir, 'color-contract.json')
  const semanticRulesPath = join(schemeDir, 'semantic-rules.json')
  if (!existsSync(contractPath)) {
    addIssue(`${schemeId}: missing ${contractPath}`)
    return
  }

  const contract = readJson(contractPath)
  const semanticRules = readJson(semanticRulesPath)
  validateContractShape(schemeId, contract)
  validateReviewFixtures(schemeId, contract)
  validateRoleSources(schemeId, contract, semanticRules, variants)

  const schemeReport = {
    atmosphere: contract.atmosphere || '',
    antiGoals: contract.antiGoals || [],
    variants: {}
  }

  for (const variant of variants) {
    const themePath = `themes/${schemeId}-${variant.fileSlug}.json`
    if (!existsSync(themePath)) {
      addIssue(`${schemeId}/${variant.id}: missing generated theme ${themePath}`)
      continue
    }
    const theme = readJson(themePath)
    const variantReport = {
      path: themePath,
      signalLanes: {},
      criticalPairs: []
    }
    validateSignalLanes(schemeId, contract, theme, variant, roleScopes, variantReport)
    validateCriticalPairs(schemeId, contract, theme, variant, roleScopes, variantReport)
    schemeReport.variants[variant.id] = variantReport
  }

  report.schemes[schemeId] = schemeReport
}

function buildMarkdown() {
  const lines = [
    '# Color Contract Audit',
    '',
    'Auto-generated by `scripts/audit-color-contract.mjs`.',
    '',
    `Status: ${issues.length === 0 ? 'pass' : 'fail'}`,
    ''
  ]

  for (const [schemeId, scheme] of Object.entries(report.schemes)) {
    lines.push(`## ${schemeId}`, '', scheme.atmosphere || '', '')
    for (const [variantId, variant] of Object.entries(scheme.variants || {})) {
      lines.push(`### ${variantId}`, '', '| Lane | Role | Color | Hue | Sat |', '| --- | --- | --- | ---: | ---: |')
      for (const [laneId, lane] of Object.entries(variant.signalLanes || {})) {
        for (const [roleId, detail] of Object.entries(lane.roles || {})) {
          lines.push(`| ${laneId} | ${roleId} | ${detail.color} | ${detail.hue} | ${detail.saturation} |`)
        }
      }
      lines.push('', '| Pair | deltaE | Minimum |', '| --- | ---: | ---: |')
      for (const pair of variant.criticalPairs || []) {
        lines.push(`| ${pair.left} / ${pair.right} | ${pair.deltaE} | ${pair.minDeltaE} |`)
      }
      lines.push('')
    }
  }

  lines.push('## Issues', '')
  lines.push(...(issues.length ? issues.map((issue) => `- ${issue}`) : ['- none']))
  lines.push('', '## Warnings', '')
  lines.push(...(warnings.length ? warnings.map((warning) => `- ${warning}`) : ['- none']))
  lines.push('')
  return lines.join('\n')
}

function main() {
  const supportedSchemeIds = getSupportedSchemeIds()
  const variants = getVariants()
  const roleScopes = buildRoleScopes()

  for (const schemeId of supportedSchemeIds) {
    validateScheme(schemeId, variants, roleScopes)
  }

  mkdirSync('reports', { recursive: true })
  writeFileSync(REPORT_JSON_PATH, `${JSON.stringify({ ...report, issues, warnings }, null, 2)}\n`)
  writeFileSync(REPORT_MD_PATH, buildMarkdown())

  if (issues.length > 0) {
    console.log('[FAIL] Color contract audit found blocking issues:')
    for (const issue of issues) console.log(`  - ${issue}`)
  } else {
    console.log(`[PASS] Color contract audit passed (${supportedSchemeIds.length} schemes).`)
  }

  if (warnings.length > 0) {
    console.log('\n[WARN] Follow-up improvements:')
    for (const warning of warnings) console.log(`  - ${warning}`)
  }

  console.log(`\n[INFO] Color contract report: ${REPORT_JSON_PATH}`)
  process.exit(issues.length > 0 ? 1 : 0)
}

main()
