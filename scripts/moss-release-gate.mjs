import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = process.cwd()
const NO_PACK = process.argv.includes('--no-pack')
const HELP = process.argv.includes('--help') || process.argv.includes('-h')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function runStep(index, total, label, scriptName) {
  console.log(`\n[${index}/${total}] ${label}`)
  const result = spawnSync('pnpm', ['run', scriptName], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.error) {
    console.error(`[FAIL] ${label}: ${result.error.message}`)
    process.exit(1)
  }

  if ((result.status ?? 1) !== 0) {
    console.error(`[FAIL] ${label}`)
    process.exit(result.status ?? 1)
  }
}

function fixed(value, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) return 'n/a'
  return Number(value).toFixed(digits)
}

function latestVsixPath(version) {
  const candidate = join(ROOT, 'extension', `hearth-theme-${version}.vsix`)
  return existsSync(candidate) ? candidate : null
}

function printSummary({ packed }) {
  const reportPath = join(ROOT, 'reports', 'moss-visual-review', 'report.json')
  const pkgPath = join(ROOT, 'extension', 'package.json')
  const report = existsSync(reportPath) ? readJson(reportPath) : null
  const pkg = existsSync(pkgPath) ? readJson(pkgPath) : null
  const version = pkg?.version || 'unknown'
  const vsix = packed ? latestVsixPath(version) : null

  console.log('\n[OK] Moss release gate completed.')
  console.log(`- Version: ${version}`)
  console.log(`- Visual report: ${reportPath}`)

  if (report) {
    console.log(`- Visual status: ${report.status}`)
    console.log(`- Blocking issues: ${report.issues?.length ?? 0}`)
    console.log(`- Warnings: ${report.warnings?.length ?? 0}`)
    console.log(`- Snapshot drift: ${report.snapshotDrift ? 'yes' : 'no'}`)

    for (const variant of report.variants || []) {
      const clarity = fixed(variant.visualProxies?.falloutClarityScore)
      const mud = fixed(variant.visualProxies?.mudRisk)
      const dust = fixed(variant.visualProxies?.lightSurfaceDustRisk)
      const chrome = variant.chromeMetrics?.status || 'n/a'
      console.log(`- ${variant.variantId}: clarity ${clarity}, mud ${mud}, dust ${dust}, chrome ${chrome}`)
    }
  }

  if (packed) {
    console.log(`- VSIX: ${vsix || 'not found after packaging'}`)
  } else {
    console.log('- VSIX: skipped (--no-pack)')
  }
}

function usage() {
  console.log(`Usage:
  pnpm run gate:moss
  pnpm run gate:moss -- --no-pack

Flow:
  1) sync generated outputs
  2) check generated drift
  3) check preview drift
  4) run theme audit
  5) run color contract audit
  6) run Moss visual CI review
  7) run content/copy/claims/release checks
  8) run tests
  9) build site
  10) test built site
  11) package VSIX unless --no-pack is provided`)
}

if (HELP) {
  usage()
  process.exit(0)
}

const steps = [
  ['Sync outputs', 'sync'],
  ['Check sync drift', 'check:sync'],
  ['Check preview drift', 'check:preview'],
  ['Theme audit', 'audit:theme'],
  ['Color contract audit', 'audit:color-contract'],
  ['Moss visual CI review', 'audit:moss-visual'],
  ['Content sync audit', 'audit:copy'],
  ['Claims audit', 'audit:claims'],
  ['Release consistency audit', 'audit:release'],
  ['Unit tests', 'test'],
  ['Build site', 'build'],
  ['Built site smoke test', 'test:site'],
]

if (!NO_PACK) {
  steps.push(['Package extension VSIX', 'pack:ext'])
}

for (let index = 0; index < steps.length; index += 1) {
  const [label, scriptName] = steps[index]
  runStep(index + 1, steps.length, label, scriptName)
}

printSummary({ packed: !NO_PACK })
