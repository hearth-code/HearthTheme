import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

function getArg(name, fallback = null) {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`))
  if (inline) return inline.slice(name.length + 1)
  const index = process.argv.indexOf(name)
  if (index === -1) return fallback
  return process.argv[index + 1] ?? fallback
}

const SCHEME_ID = String(getArg('--scheme', getArg('--scheme-id', 'moss')) || 'moss').trim()
const CONTRACT_PATH = `color-system/schemes/${SCHEME_ID}/color-contract.json`
const DEFAULT_VISUAL_REPORT_PATH = `reports/${SCHEME_ID}-visual-review/report.json`
const OUTPUT_JSON_PATH = `reports/${SCHEME_ID}-release-contract-audit.json`
const OUTPUT_MD_PATH = `reports/${SCHEME_ID}-release-contract-audit.md`

const issues = []
const warnings = []

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function addIssue(message) {
  issues.push(message)
}

function fixed(value, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) return 'n/a'
  return Number(value).toFixed(digits)
}

function validateShape(contract) {
  const quality = contract.releaseQuality
  if (!quality || typeof quality !== 'object' || Array.isArray(quality)) {
    addIssue(`${SCHEME_ID}: color-contract.json must define releaseQuality`)
    return null
  }
  if (!Array.isArray(quality.requiredVariants) || quality.requiredVariants.length === 0) {
    addIssue(`${SCHEME_ID}: releaseQuality.requiredVariants must be a non-empty array`)
  }
  if (!quality.variantThresholds || typeof quality.variantThresholds !== 'object') {
    addIssue(`${SCHEME_ID}: releaseQuality.variantThresholds must be defined`)
  }
  return quality
}

function resolveVisualReportPath(quality) {
  const explicit = String(quality?.evidence?.visualReport || '').trim()
  return explicit || DEFAULT_VISUAL_REPORT_PATH
}

function validateReport(quality, report) {
  if (report.schemeId !== SCHEME_ID) {
    addIssue(`${SCHEME_ID}: visual report schemeId must be ${SCHEME_ID}, got ${String(report.schemeId || '')}`)
  }
  if (quality.visualStatus && report.status !== quality.visualStatus) {
    addIssue(`${SCHEME_ID}: visual status ${report.status} does not match required ${quality.visualStatus}`)
  }
  if ((report.issues?.length ?? 0) > Number(quality.maxBlockingIssues ?? 0)) {
    addIssue(`${SCHEME_ID}: visual blocking issues ${report.issues.length} exceed ${quality.maxBlockingIssues}`)
  }
  if ((report.warnings?.length ?? 0) > Number(quality.maxWarnings ?? 0)) {
    addIssue(`${SCHEME_ID}: visual warnings ${report.warnings.length} exceed ${quality.maxWarnings}`)
  }
  if (quality.allowSnapshotDrift === false && report.snapshotDrift) {
    addIssue(`${SCHEME_ID}: snapshot drift is not allowed for a release candidate`)
  }

  const variantById = Object.fromEntries((report.variants || []).map((variant) => [variant.variantId, variant]))
  for (const variantId of quality.requiredVariants || []) {
    const variant = variantById[variantId]
    const thresholds = quality.variantThresholds?.[variantId] || {}
    if (!variant) {
      addIssue(`${SCHEME_ID}: visual report missing required variant ${variantId}`)
      continue
    }

    const clarity = variant.visualProxies?.falloutClarityScore
    const mudRisk = variant.visualProxies?.mudRisk
    const dustRisk = variant.visualProxies?.lightSurfaceDustRisk
    const chromeStatus = variant.chromeMetrics?.status

    if (quality.requireChromeStatus && chromeStatus !== quality.requireChromeStatus) {
      addIssue(`${SCHEME_ID}/${variantId}: chrome status ${chromeStatus || 'missing'} does not match ${quality.requireChromeStatus}`)
    }
    if (clarity < Number(thresholds.minClarity ?? 0)) {
      addIssue(`${SCHEME_ID}/${variantId}: clarity ${fixed(clarity)} below ${fixed(thresholds.minClarity)}`)
    }
    if (mudRisk > Number(thresholds.maxMudRisk ?? 1)) {
      addIssue(`${SCHEME_ID}/${variantId}: mud risk ${fixed(mudRisk)} above ${fixed(thresholds.maxMudRisk)}`)
    }
    if (dustRisk > Number(thresholds.maxLightSurfaceDustRisk ?? 1)) {
      addIssue(`${SCHEME_ID}/${variantId}: light surface dust risk ${fixed(dustRisk)} above ${fixed(thresholds.maxLightSurfaceDustRisk)}`)
    }
  }
}

function buildReport(contract, visualReport, visualReportPath) {
  const quality = contract.releaseQuality || {}
  return {
    schemaVersion: 1,
    generatedBy: 'scripts/audit-scheme-release-contract.mjs',
    schemeId: SCHEME_ID,
    status: issues.length > 0 ? 'fail' : 'pass',
    contractPath: CONTRACT_PATH,
    visualReportPath,
    releaseQuality: quality,
    variants: (visualReport.variants || []).map((variant) => ({
      variantId: variant.variantId,
      clarity: variant.visualProxies?.falloutClarityScore ?? null,
      mudRisk: variant.visualProxies?.mudRisk ?? null,
      lightSurfaceDustRisk: variant.visualProxies?.lightSurfaceDustRisk ?? null,
      chromeStatus: variant.chromeMetrics?.status || null,
      snapshotPath: variant.snapshotPath || null,
    })),
    issues,
    warnings,
  }
}

function buildMarkdown(report) {
  const title = `${SCHEME_ID[0]?.toUpperCase() || ''}${SCHEME_ID.slice(1)} Release Contract Audit`
  const lines = [
    `# ${title}`,
    '',
    'Auto-generated by `scripts/audit-scheme-release-contract.mjs`.',
    '',
    `Status: ${report.status}`,
    '',
    '| Variant | Clarity | Mud Risk | Light Surface Dust | Chrome | Snapshot |',
    '| --- | ---: | ---: | ---: | --- | --- |',
  ]

  for (const variant of report.variants) {
    lines.push(
      `| ${variant.variantId} | ${fixed(variant.clarity)} | ${fixed(variant.mudRisk)} | ${fixed(variant.lightSurfaceDustRisk)} | ${variant.chromeStatus || 'n/a'} | ${variant.snapshotPath || 'n/a'} |`
    )
  }

  lines.push('', '## Issues', '')
  lines.push(...(issues.length ? issues.map((issue) => `- ${issue}`) : ['- none']))
  lines.push('', '## Warnings', '')
  lines.push(...(warnings.length ? warnings.map((warning) => `- ${warning}`) : ['- none']))
  lines.push('')
  return lines.join('\n')
}

function main() {
  if (!SCHEME_ID) {
    addIssue('missing --scheme')
  }
  if (!existsSync(CONTRACT_PATH)) {
    addIssue(`missing contract: ${CONTRACT_PATH}`)
  }

  const contract = existsSync(CONTRACT_PATH) ? readJson(CONTRACT_PATH) : {}
  const quality = validateShape(contract)
  const visualReportPath = resolveVisualReportPath(quality)

  if (!existsSync(visualReportPath)) {
    addIssue(`missing visual report: ${visualReportPath}; run the scheme visual review first`)
  }

  const visualReport = existsSync(visualReportPath) ? readJson(visualReportPath) : {}
  if (quality && existsSync(visualReportPath)) {
    validateReport(quality, visualReport)
  }

  const report = buildReport(contract, visualReport, visualReportPath)
  mkdirSync(dirname(OUTPUT_JSON_PATH), { recursive: true })
  writeFileSync(OUTPUT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`)
  writeFileSync(OUTPUT_MD_PATH, buildMarkdown(report))

  if (issues.length > 0) {
    console.log(`[FAIL] ${SCHEME_ID} release contract audit found blocking issues:`)
    for (const issue of issues) console.log(`  - ${issue}`)
  } else {
    console.log(`[PASS] ${SCHEME_ID} release contract audit passed.`)
  }

  console.log(`[INFO] Report: ${OUTPUT_MD_PATH}`)
  process.exit(issues.length > 0 ? 1 : 0)
}

main()
