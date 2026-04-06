import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { pathToFileURL } from 'url'
import path from 'path'
import { buildColorLanguageModel } from './color-system/build.mjs'
import { buildGeneratedPlatformTokenMaps } from './color-system/artifacts.mjs'
import { getThemeOutputFiles, loadColorSystemTuning, loadRoleAdapters } from './color-system.mjs'
import { contrastRatio, hexToRgb, normalizeHex } from './color-utils.mjs'
import { buildProductMetadata } from './product-metadata.mjs'

const COLOR_SYSTEM_TUNING = loadColorSystemTuning()
const SITE_DOCS_PROFILE = COLOR_SYSTEM_TUNING.siteDocsProfile
const SITE_ASSET_MAPPING = COLOR_SYSTEM_TUNING.siteAssetMapping
const ROLE_SCOPES = Object.fromEntries(loadRoleAdapters().map((role) => [role.id, role.scopes || []]))

const EXTENSION_PACKAGE_PATH = 'extension/package.json'
const EXTENSION_THEMES_DIR = 'extension/themes'
const DOCS_BASELINE_PATH = 'docs/theme-baseline.md'
const PRODUCT_DATA_PATH = 'src/data/product.ts'
const THEME_VARS_CSS_PATH = 'src/styles/theme-vars.css'
const THEME_FILES = getThemeOutputFiles()

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeIfChanged(path, content) {
  if (existsSync(path)) {
    const prev = readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
    const next = content.replace(/\r\n/g, '\n')
    if (prev === next) return false
  }
  writeFileSync(path, content)
  return true
}

function toHexByte(value) {
  return Math.round(Math.min(Math.max(value, 0), 255)).toString(16).padStart(2, '0')
}

function rgbToHex([r, g, b]) {
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`
}

function mixHex(a, b, t) {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  const ratio = Math.min(Math.max(t, 0), 1)
  return rgbToHex([
    ar + (br - ar) * ratio,
    ag + (bg - ag) * ratio,
    ab + (bb - ab) * ratio,
  ])
}

function alpha(hex, value) {
  const [r, g, b] = hexToRgb(hex)
  const v = Number(value).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  return `rgb(${r} ${g} ${b} / ${v})`
}

function fixed(value) {
  return Number(value).toFixed(1)
}

function todayInTokyo() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function resolveSiteToken(tokens, variantId, key) {
  const variant = tokens?.[variantId]
  if (!variant) {
    throw new Error(`Missing site docs variant "${variantId}" in generated tokens.`)
  }
  const value = variant[key]
  if (!value) {
    throw new Error(`Missing site docs token "${variantId}.${key}" in generated tokens.`)
  }
  return value
}

function toScopes(entry) {
  if (!entry?.scope) return []
  return Array.isArray(entry.scope) ? entry.scope : [entry.scope]
}

function getScopeMatchDetail(entryScopes, scopes) {
  if (!entryScopes?.length || !scopes?.length) return { count: 0, ratio: 0 }
  const count = entryScopes.filter((scope) => scopes.includes(scope)).length
  return {
    count,
    ratio: count > 0 ? count / entryScopes.length : 0,
  }
}

function getTokenColor(theme, scopes) {
  const expected = Array.isArray(scopes) ? scopes : [scopes]
  let bestColor = null
  let bestRatio = -1
  let bestCount = -1
  let bestScopeLength = Number.POSITIVE_INFINITY

  for (const entry of theme.tokenColors || []) {
    const entryScopes = toScopes(entry)
    const detail = getScopeMatchDetail(entryScopes, expected)
    if (detail.count === 0) continue

    const color = normalizeHex(entry.settings?.foreground)
    if (!color) continue

    const isBetter =
      detail.ratio > bestRatio ||
      (detail.ratio === bestRatio && detail.count > bestCount) ||
      (detail.ratio === bestRatio && detail.count === bestCount && entryScopes.length < bestScopeLength)

    if (!isBetter) continue

    bestColor = color
    bestRatio = detail.ratio
    bestCount = detail.count
    bestScopeLength = entryScopes.length
  }

  return bestColor
}

function getThemeTokenSet(theme) {
  return {
    bg: normalizeHex(theme.colors?.['editor.background']),
    fg: normalizeHex(theme.colors?.['editor.foreground']),
    keyword: getTokenColor(theme, ROLE_SCOPES.keyword || ['keyword']),
    operator: getTokenColor(theme, ROLE_SCOPES.operator || ['keyword.operator']),
    fn: getTokenColor(theme, ROLE_SCOPES.function || ['entity.name.function']),
    method: getTokenColor(theme, ROLE_SCOPES.method || ['meta.method-call entity.name.function']),
    property: getTokenColor(theme, ROLE_SCOPES.property || ['variable.other.property', 'meta.property-name']),
    string: getTokenColor(theme, ROLE_SCOPES.string || ['string']),
    number: getTokenColor(theme, ROLE_SCOPES.number || ['constant.numeric']),
    type: getTokenColor(theme, ROLE_SCOPES.type || ['entity.name.type']),
    variable: getTokenColor(theme, ROLE_SCOPES.variable || ['variable']),
    comment: getTokenColor(theme, ROLE_SCOPES.comment || ['comment']),
  }
}

function loadDocsBaselineTokens() {
  return Object.fromEntries(
    Object.entries(THEME_FILES).map(([variantId, path]) => [variantId, getThemeTokenSet(readJson(path))])
  )
}

function resolveSiteAssetColorRef(ref, tokens, mapping, cache, stack) {
  const value = String(ref || '').trim()
  if (!value) {
    throw new Error('siteAssetMapping reference must be a non-empty string')
  }

  const directHex = normalizeHex(value)
  if (directHex) return directHex

  if (value.startsWith('@')) {
    const name = value.slice(1).trim()
    if (!name) {
      throw new Error('siteAssetMapping derived color reference is invalid')
    }
    if (cache.has(name)) return cache.get(name)
    if (stack.has(name)) {
      throw new Error(`siteAssetMapping derived color cycle detected: ${name}`)
    }
    const expr = mapping.derivedColors?.[name]
    if (!expr) {
      throw new Error(`siteAssetMapping references unknown derived color: ${name}`)
    }
    stack.add(name)
    const resolved = evaluateSiteAssetColorExpr(expr, tokens, mapping, cache, stack)
    stack.delete(name)
    cache.set(name, resolved)
    return resolved
  }

  const tokenRef = value.match(/^(dark|light)\.([A-Za-z0-9_-]+)$/)
  if (tokenRef) {
    const variantId = tokenRef[1]
    const key = tokenRef[2]
    const token = tokens?.[variantId]?.[key]
    const hex = normalizeHex(token)
    if (!hex) {
      throw new Error(`siteAssetMapping token reference ${value} is missing in generated theme tokens`)
    }
    return hex
  }

  throw new Error(`Unsupported siteAssetMapping reference: ${value}`)
}

function evaluateSiteAssetColorExpr(expr, tokens, mapping, cache, stack) {
  if (typeof expr === 'string') {
    return resolveSiteAssetColorRef(expr, tokens, mapping, cache, stack)
  }
  if (!expr || typeof expr !== 'object') {
    throw new Error('siteAssetMapping color expression must be a string or object')
  }
  if (expr.type === 'mix') {
    const a = evaluateSiteAssetColorExpr(expr.a, tokens, mapping, cache, stack)
    const b = evaluateSiteAssetColorExpr(expr.b, tokens, mapping, cache, stack)
    return mixHex(a, b, expr.t)
  }
  throw new Error(`Unsupported siteAssetMapping color expression type: ${String(expr.type || '')}`)
}

function evaluateSiteAssetVarExpr(expr, tokens, mapping, cache, stack) {
  if (expr && typeof expr === 'object' && expr.type === 'alpha') {
    const color = evaluateSiteAssetColorExpr(expr.color, tokens, mapping, cache, stack)
    return alpha(color, expr.value)
  }
  return evaluateSiteAssetColorExpr(expr, tokens, mapping, cache, stack)
}

function buildSiteVars(tokens) {
  const mapping = SITE_ASSET_MAPPING
  if (!mapping || !mapping.vars || typeof mapping.vars !== 'object') {
    throw new Error('Missing siteAssetMapping.vars in color-system tuning')
  }

  const out = {}
  const derivedCache = new Map()
  const derivedStack = new Set()

  for (const [name, expr] of Object.entries(mapping.vars)) {
    out[name] = evaluateSiteAssetVarExpr(expr, tokens, mapping, derivedCache, derivedStack)
  }

  return out
}

function renderThemeVarsCss(vars) {
  const lines = [
    '/* Auto-generated by scripts/generate-site-assets.mjs - DO NOT EDIT */',
    ':root {',
  ]

  for (const key of Object.keys(vars).sort()) {
    lines.push(`  ${key}: ${vars[key]};`)
  }

  lines.push('}', '')
  return `${lines.join('\n')}`
}

function renderProductDataModule(productData) {
  const clientProductData = {
    brand: productData.brand,
    product: {
      id: productData.product.id,
      name: productData.product.name,
      displayName: productData.product.displayName,
      summary: productData.product.summary,
      author: productData.product.author,
      wordmark: productData.product.wordmark,
    },
    defaultFlavor: productData.defaultFlavor,
    featuredFlavorIds: productData.featuredFlavorIds,
    flavors: productData.flavors,
    themes: productData.themes,
    site: productData.site,
    release: productData.release,
    extension: {
      itemName: productData.extension.itemName,
      defaultPreviewThemeLabel: productData.extension.defaultPreviewThemeLabel,
      themeCatalog: productData.extension.themeCatalog,
    },
    links: productData.links,
  }

  return (
    `// Auto-generated by scripts/generate-site-assets.mjs - DO NOT EDIT\n` +
    `export const productData = ${JSON.stringify(clientProductData, null, 2)} as const\n`
  )
}

function syncProductData(productData) {
  return writeIfChanged(PRODUCT_DATA_PATH, renderProductDataModule(productData))
}

function syncExtensionPackage(tokens, productData) {
  const pkg = readJson(EXTENSION_PACKAGE_PATH)
  pkg.name = productData.extension.name
  pkg.displayName = productData.extension.displayName
  pkg.description = productData.extension.description
  pkg.publisher = productData.extension.publisher
  pkg.engines = { ...productData.extension.engines }
  pkg.categories = [...productData.extension.categories]
  pkg.keywords = [...productData.extension.keywords]
  pkg.galleryBanner = {
    color: tokens.dark.bg,
    theme: productData.extension.galleryBannerTheme,
  }
  pkg.icon = productData.extension.icon
  pkg.homepage = productData.links.websiteUrl
  pkg.repository = {
    type: 'git',
    url: productData.product.repository.url,
  }
  pkg.bugs = {
    url: productData.links.issuesUrl,
  }
  pkg.qna = productData.extension.qna
  pkg.license = productData.extension.license
  pkg.contributes = {
    ...(pkg.contributes && typeof pkg.contributes === 'object' ? pkg.contributes : {}),
    themes: productData.extension.themes,
  }
  const content = `${JSON.stringify(pkg, null, 4)}\n`
  return writeIfChanged(EXTENSION_PACKAGE_PATH, content)
}

function syncExtensionThemes(productData) {
  const themeEntries = Array.isArray(productData.extension?.themes) ? productData.extension.themes : []
  const publicThemeFiles = new Set(
    themeEntries
      .map((theme) => String(theme.path || '').split(/[\\/]/).pop())
      .filter(Boolean)
  )

  mkdirSync(EXTENSION_THEMES_DIR, { recursive: true })

  let changed = false
  for (const file of readdirSync(EXTENSION_THEMES_DIR)) {
    if (!file.endsWith('.json')) continue
    if (publicThemeFiles.has(file)) continue
    rmSync(path.join(EXTENSION_THEMES_DIR, file), { force: true })
    changed = true
  }

  for (const theme of themeEntries) {
    const sourcePath = String(theme.path || '').replace(/^\.\//, '')
    const source = path.join(process.cwd(), sourcePath)
    const file = String(theme.path || '').split(/[\\/]/).pop()
    if (!file) continue
    const destination = path.join(process.cwd(), EXTENSION_THEMES_DIR, file)
    copyFileSync(source, destination)
    changed = true
  }

  return changed
}

function buildSemanticMatrixTable(tokens) {
  const header = [
    '| Role | Dark | Dark Soft | Light | Light Soft | Narrative Role |',
    '| --- | --- | --- | --- | --- | --- |',
  ]

  const rows = SITE_DOCS_PROFILE.semanticRows.map((row) => {
    const dark = resolveSiteToken(tokens, 'dark', row.key)
    const darkSoft = resolveSiteToken(tokens, 'darkSoft', row.key)
    const light = resolveSiteToken(tokens, 'light', row.key)
    const lightSoft = resolveSiteToken(tokens, 'lightSoft', row.key)
    return `| ${row.id} | \`${dark}\` | \`${darkSoft}\` | \`${light}\` | \`${lightSoft}\` | ${row.note} |`
  })

  return [...header, ...rows].join('\n')
}

function buildSnapshotLines(tokens) {
  const lines = SITE_DOCS_PROFILE.snapshotRatios.map((metric) => {
    const left = resolveSiteToken(tokens, metric.variant, metric.left)
    const right = resolveSiteToken(tokens, metric.variant, metric.right)
    return `- ${metric.label}: \`${fixed(contrastRatio(left, right))}\``
  })
  return lines.join('\n')
}

function syncDocsBaseline() {
  const markdown = readFileSync(DOCS_BASELINE_PATH, 'utf8').replace(/\r\n/g, '\n')
  const today = todayInTokyo()
  const tokens = loadDocsBaselineTokens()
  const matrix = buildSemanticMatrixTable(tokens)
  const snapshot = buildSnapshotLines(tokens)

  const withoutUpdated = (value) => value.replace(/^Updated: .+$/m, 'Updated: __UNCHANGED__')

  let next = markdown
    .replace(
      /(?<=## 2\) Semantic Color Matrix\n\n)([\s\S]*?)(?=\n\n## 3\) Readability Budget \(Theme Audit Gates\))/,
      matrix
    )
    .replace(
      /(?<=Current snapshot from audit:\n\n)([\s\S]*?)(?=\n\n## 4\) Token Coverage Standard)/,
      snapshot
    )

  if (withoutUpdated(next) !== withoutUpdated(markdown)) {
    next = next.replace(/^Updated: .+$/m, `Updated: ${today}`)
  }

  if (next !== markdown && !next.endsWith('\n')) next += '\n'
  return writeIfChanged(DOCS_BASELINE_PATH, next)
}

export function generateSiteAssets() {
  const model = buildColorLanguageModel()
  const generatedPlatformMaps = buildGeneratedPlatformTokenMaps(model)
  const tokens = generatedPlatformMaps.web
  const vars = buildSiteVars(tokens)
  const css = renderThemeVarsCss(vars)
  const productData = buildProductMetadata()

  const results = {
    themeVars: writeIfChanged(THEME_VARS_CSS_PATH, css),
    productData: syncProductData(productData),
    extensionPackage: syncExtensionPackage(tokens, productData),
    extensionThemes: syncExtensionThemes(productData),
    docsBaseline: syncDocsBaseline(),
  }

  console.log(`${results.themeVars ? '✓ updated' : '- unchanged'} ${THEME_VARS_CSS_PATH}`)
  console.log(`${results.productData ? '✓ updated' : '- unchanged'} ${PRODUCT_DATA_PATH}`)
  console.log(`${results.extensionPackage ? '✓ updated' : '- unchanged'} ${EXTENSION_PACKAGE_PATH}`)
  console.log(`${results.extensionThemes ? '✓ updated' : '- unchanged'} ${EXTENSION_THEMES_DIR}`)
  console.log(`${results.docsBaseline ? '✓ updated' : '- unchanged'} ${DOCS_BASELINE_PATH}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    generateSiteAssets()
  } catch (error) {
    console.error(`[FAIL] ${error.message}`)
    process.exit(1)
  }
}
