import { existsSync, readFileSync, writeFileSync } from 'fs'
import { pathToFileURL } from 'url'
import { buildColorLanguageModel } from './color-system/build.mjs'
import { buildGeneratedPlatformTokenMaps } from './color-system/artifacts.mjs'
import { getThemeOutputFiles, loadColorSystemTuning } from './color-system.mjs'
import { contrastRatio, hexToRgb, normalizeHex } from './color-utils.mjs'

const COLOR_SYSTEM_TUNING = loadColorSystemTuning()
const SITE_DOCS_PROFILE = COLOR_SYSTEM_TUNING.siteDocsProfile
const SITE_ASSET_MAPPING = COLOR_SYSTEM_TUNING.siteAssetMapping

const EXTENSION_PACKAGE_PATH = 'extension/package.json'
const DOCS_BASELINE_PATH = 'docs/theme-baseline.md'
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

function getTokenColor(theme, scope) {
  for (const entry of theme.tokenColors || []) {
    const scopes = Array.isArray(entry.scope) ? entry.scope : [entry.scope]
    if (!scopes.includes(scope)) continue
    const color = normalizeHex(entry.settings?.foreground)
    if (color) return color
  }
  return null
}

function getThemeTokenSet(theme) {
  return {
    bg: normalizeHex(theme.colors?.['editor.background']),
    fg: normalizeHex(theme.colors?.['editor.foreground']),
    keyword: getTokenColor(theme, 'keyword'),
    operator: getTokenColor(theme, 'keyword.operator'),
    fn: getTokenColor(theme, 'entity.name.function'),
    method:
      getTokenColor(theme, 'meta.function-call entity.name.function')
      ?? getTokenColor(theme, 'meta.method-call entity.name.function')
      ?? getTokenColor(theme, 'meta.function-call.js entity.name.function.js')
      ?? getTokenColor(theme, 'meta.method-call.js entity.name.function.js')
      ?? getTokenColor(theme, 'meta.function-call.ts entity.name.function.ts')
      ?? getTokenColor(theme, 'meta.method-call.ts entity.name.function.ts')
      ?? getTokenColor(theme, 'meta.function-call.py entity.name.function.py')
      ?? getTokenColor(theme, 'meta.method-call.py entity.name.function.py'),
    property:
      getTokenColor(theme, 'entity.name.function.member')
      ?? getTokenColor(theme, 'variable.other.property')
      ?? getTokenColor(theme, 'meta.property-name'),
    string: getTokenColor(theme, 'string'),
    number: getTokenColor(theme, 'constant.numeric'),
    type: getTokenColor(theme, 'entity.name.type'),
    variable: getTokenColor(theme, 'variable'),
    comment: getTokenColor(theme, 'comment'),
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

function syncExtensionPackage(tokens) {
  const pkg = readJson(EXTENSION_PACKAGE_PATH)
  if (!pkg.galleryBanner || typeof pkg.galleryBanner !== 'object') {
    pkg.galleryBanner = { theme: 'dark' }
  }
  pkg.galleryBanner.color = tokens.dark.bg
  const content = `${JSON.stringify(pkg, null, 4)}\n`
  return writeIfChanged(EXTENSION_PACKAGE_PATH, content)
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

  const results = {
    themeVars: writeIfChanged(THEME_VARS_CSS_PATH, css),
    extensionPackage: syncExtensionPackage(tokens),
    docsBaseline: syncDocsBaseline(),
  }

  console.log(`${results.themeVars ? '✓ updated' : '- unchanged'} ${THEME_VARS_CSS_PATH}`)
  console.log(`${results.extensionPackage ? '✓ updated' : '- unchanged'} ${EXTENSION_PACKAGE_PATH}`)
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
