import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validate } from './json-schema-validator.mjs'

// Validates the hand-edited JSON *source* files that drive the whole color
// language + release pipeline. A typo'd key or a wrong-typed field in any of
// these silently produces wrong themes or broken release metadata, so this
// audit fails the build before the generators run. Generated JSON (themes/,
// semantic.json, ...) is intentionally out of scope — those are checked by the
// generated-origin and contract audits.

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const SCHEMA_DIR = path.join(ROOT, 'schemas')

function loadSchema(name) {
  return JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, name), 'utf8'))
}

const schemas = {
  activeScheme: loadSchema('active-scheme.schema.json'),
  activeProduct: loadSchema('active-product.schema.json'),
  product: loadSchema('product.schema.json'),
  release: loadSchema('release.schema.json'),
  preview: loadSchema('preview.schema.json'),
}

const schemaFailures = []
const contractFailures = []
let checked = 0

function rel(absPath) {
  return path.relative(ROOT, absPath).replace(/\\/g, '/')
}

function checkFile(absPath, schema) {
  const relPath = rel(absPath)
  if (!fs.existsSync(absPath)) {
    schemaFailures.push({ file: relPath, errors: ['file not found'] })
    return null
  }
  let data
  try {
    data = JSON.parse(fs.readFileSync(absPath, 'utf8'))
  } catch (error) {
    schemaFailures.push({ file: relPath, errors: [`invalid JSON: ${error.message}`] })
    return null
  }
  checked += 1
  const errors = validate(data, schema)
  if (errors.length) schemaFailures.push({ file: relPath, errors })
  return data
}

// --- top-level selectors -------------------------------------------------
checkFile(path.join(ROOT, 'color-system', 'active-scheme.json'), schemas.activeScheme)
checkFile(path.join(ROOT, 'products', 'active-product.json'), schemas.activeProduct)

// --- every product definition --------------------------------------------
const productsDir = path.join(ROOT, 'products')
const productDirs = fs
  .readdirSync(productsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

for (const dir of productDirs) {
  const base = path.join(productsDir, dir)
  const product = checkFile(path.join(base, 'product.json'), schemas.product)
  checkFile(path.join(base, 'release.json'), schemas.release)
  checkFile(path.join(base, 'preview.json'), schemas.preview)

  // Cross-field invariants a flat schema can't express.
  if (product) {
    const supported = new Set(product.supportedSchemeIds || [])
    if (product.defaultSchemeId && !supported.has(product.defaultSchemeId)) {
      contractFailures.push(
        `products/${dir}/product.json: defaultSchemeId "${product.defaultSchemeId}" is not in supportedSchemeIds [${[...supported].join(', ')}]`,
      )
    }
    for (const schemeId of supported) {
      if (!product.flavorNames || !(schemeId in product.flavorNames)) {
        contractFailures.push(
          `products/${dir}/product.json: supported scheme "${schemeId}" has no flavorNames entry`,
        )
      }
    }
    for (const theme of product.featuredThemes || []) {
      if (theme.schemeId && !supported.has(theme.schemeId)) {
        contractFailures.push(
          `products/${dir}/product.json: featuredThemes "${theme.id}" references unsupported schemeId "${theme.schemeId}"`,
        )
      }
    }
  }
}

if (schemaFailures.length === 0 && contractFailures.length === 0) {
  console.log(`[PASS] Source schema audit: ${checked} JSON source file(s) match their schemas.`)
  process.exit(0)
}

console.error('[FAIL] Source schema audit found problems:')
for (const { file, errors } of schemaFailures) {
  console.error(`\n  ${file}`)
  for (const error of errors) console.error(`    - ${error}`)
}
if (contractFailures.length) {
  console.error('\n  cross-field contract violations:')
  for (const violation of contractFailures) console.error(`    - ${violation}`)
}
process.exit(1)
