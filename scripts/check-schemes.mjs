import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SCHEMES_ROOT = 'color-system/schemes'
const ACTIVE_SCHEME_PATH = 'color-system/active-scheme.json'
const ACTIVE_PRODUCT_PATH = 'products/active-product.json'
const REQUIRED_FILES = [
  'scheme.json',
  'color-contract.json',
  'philosophy.md',
  'taxonomy.json',
  'foundation.json',
  'semantic-rules.json',
  'surface-rules.json',
  'guidance-rules.json',
  'terminal-rules.json',
  'interface-rules.json',
  'interaction-rules.json',
  'feedback-rules.json',
  'variant-knobs.json',
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

function getConfiguredActiveScheme() {
  const data = JSON.parse(readFileSync(ACTIVE_SCHEME_PATH, 'utf8'))
  const schemeId = String(data?.schemeId || '').trim()
  const schemeDir = String(data?.schemeDir || '').trim()
  if (!schemeId || !schemeDir) {
    fail(`${ACTIVE_SCHEME_PATH} must define schemeId and schemeDir`)
  }
  return { schemeId, schemeDir }
}

function getActiveProductSupportedSchemeIds() {
  const data = JSON.parse(readFileSync(ACTIVE_PRODUCT_PATH, 'utf8'))
  const productDir = String(data?.productDir || '').trim()
  if (!productDir) {
    fail(`${ACTIVE_PRODUCT_PATH} must define productDir`)
  }

  const productPath = join(productDir, 'product.json')
  if (!existsSync(productPath)) {
    fail(`Active product is missing ${productPath}`)
  }

  const product = JSON.parse(readFileSync(productPath, 'utf8'))
  const supportedSchemeIds = Array.isArray(product?.supportedSchemeIds)
    ? product.supportedSchemeIds.map((schemeId) => String(schemeId || '').trim()).filter(Boolean)
    : []

  if (supportedSchemeIds.length === 0) {
    fail(`${productPath} must define a non-empty supportedSchemeIds array`)
  }

  return supportedSchemeIds
}

function main() {
  const supportedSchemeIds = new Set(getActiveProductSupportedSchemeIds())
  const schemeIds = listSchemeIds().filter((schemeId) => supportedSchemeIds.has(schemeId))
  const activeScheme = getConfiguredActiveScheme()
  if (schemeIds.length === 0) {
    fail(`No supported schemes found under ${SCHEMES_ROOT}`)
  }

  try {
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
      run(['scripts/generate-theme-variants.mjs'], env)
      run(['scripts/theme-audit.mjs'], env)
    }
  } finally {
    run(
      ['scripts/generate-theme-variants.mjs'],
      {
        ...process.env,
        COLOR_SYSTEM_SCHEME_ID: activeScheme.schemeId,
        COLOR_SYSTEM_SCHEME_DIR: activeScheme.schemeDir,
      }
    )
  }

  console.log(`[PASS] Scheme registry check passed (${schemeIds.length} schemes).`)
}

main()
