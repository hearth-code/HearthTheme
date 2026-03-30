import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SCHEMES_ROOT = 'color-system/schemes'
const REQUIRED_FILES = [
  'scheme.json',
  'philosophy.md',
  'taxonomy.json',
  'foundation.json',
  'semantic-rules.json',
  'surface-rules.json',
  'interaction-rules.json',
]

function fail(message) {
  console.error(`[FAIL] ${message}`)
  process.exit(1)
}

function run(commandArgs, env) {
  execFileSync(process.execPath, commandArgs, {
    stdio: 'inherit',
    env,
  })
}

function listSchemeIds() {
  return readdirSync(SCHEMES_ROOT)
    .filter((entry) => statSync(join(SCHEMES_ROOT, entry)).isDirectory())
    .sort()
}

function main() {
  const schemeIds = listSchemeIds()
  if (schemeIds.length === 0) {
    fail(`No schemes found under ${SCHEMES_ROOT}`)
  }

  for (const schemeId of schemeIds) {
    const schemeDir = join(SCHEMES_ROOT, schemeId)
    for (const file of REQUIRED_FILES) {
      const path = join(schemeDir, file)
      if (!existsSync(path)) {
        fail(`Scheme "${schemeId}" is missing required file ${path}`)
      }
    }

    const env = {
      ...process.env,
      COLOR_SYSTEM_SCHEME_ID: schemeId,
      COLOR_SYSTEM_SCHEME_DIR: schemeDir.replace(/\\/g, '/'),
    }

    console.log(`[scheme-check] Auditing ${schemeId}...`)
    run(['scripts/audit-source-layer.mjs'], env)
    run(['scripts/check-scheme-smoke.mjs'], env)
  }

  console.log(`[PASS] Scheme registry check passed (${schemeIds.length} schemes).`)
}

main()
