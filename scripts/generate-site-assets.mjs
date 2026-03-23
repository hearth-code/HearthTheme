import { existsSync, readFileSync, writeFileSync } from 'fs'
import { pathToFileURL } from 'url'
import { getThemeOutputFiles, loadColorSystemTuning } from './color-system.mjs'

const THEME_FILES = getThemeOutputFiles()
const COLOR_SYSTEM_TUNING = loadColorSystemTuning()
const SITE_DOCS_PROFILE = COLOR_SYSTEM_TUNING.siteDocsProfile
const SITE_ASSET_MAPPING = COLOR_SYSTEM_TUNING.siteAssetMapping

const EXTENSION_PACKAGE_PATH = 'extension/package.json'
const DOCS_BASELINE_PATH = 'docs/theme-baseline.md'
const THEME_VARS_CSS_PATH = 'src/styles/theme-vars.css'

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

function normalizeHex(hex) {
  if (typeof hex !== 'string') return null
  const value = hex.trim().toLowerCase()
  if (/^#[0-9a-f]{3}$/.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
  }
  if (/^#[0-9a-f]{6}$/.test(value)) return value
  return null
}

function hexToRgb(hex) {
  const normalized = normalizeHex(hex)
  if (!normalized) throw new Error(`Invalid hex: ${hex}`)
  const raw = normalized.slice(1)
  return [
    Number.parseInt(raw.slice(0, 2), 16),
    Number.parseInt(raw.slice(2, 4), 16),
    Number.parseInt(raw.slice(4, 6), 16),
  ]
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

function getToken(theme, scopes) {
  for (const scope of scopes) {
    const hit = (theme.tokenColors || []).find((entry) => (
      Array.isArray(entry.scope) ? entry.scope.includes(scope) : entry.scope === scope
    ))
    if (hit?.settings?.foreground) return normalizeHex(hit.settings.foreground)
  }
  return null
}

function extractThemeTokens(theme) {
  return {
    bg: normalizeHex(theme.colors?.['editor.background']),
    fg: normalizeHex(theme.colors?.['editor.foreground']),
    lineBg: normalizeHex(theme.colors?.['editor.lineHighlightBackground']),
    lineNo: normalizeHex(theme.colors?.['editorLineNumber.foreground']),
    status: normalizeHex(theme.colors?.['statusBar.background']),
    sidebar: normalizeHex(theme.colors?.['sideBar.background']),
    border: normalizeHex(theme.colors?.['sideBar.border']),
    keyword: getToken(theme, ['keyword']),
    fn: getToken(theme, ['entity.name.function']),
    string: getToken(theme, ['string']),
    number: getToken(theme, ['constant.numeric']),
    type: getToken(theme, ['entity.name.type']),
    variable: getToken(theme, ['variable']),
    operator: getToken(theme, ['keyword.operator']),
    comment: getToken(theme, ['comment']),
  }
}

function assertTokenSet(id, tokenSet) {
  for (const [key, value] of Object.entries(tokenSet)) {
    if (!value) {
      throw new Error(`Missing required token "${id}.${key}" while generating site assets.`)
    }
  }
}

function toLinear(channel) {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(toLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(a, b) {
  const l1 = luminance(a)
  const l2 = luminance(b)
  const hi = Math.max(l1, l2)
  const lo = Math.min(l1, l2)
  return (hi + 0.05) / (lo + 0.05)
}

function fixed(value) {
  return Number(value).toFixed(1)
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

function syncDocsBaseline(tokens) {
  const markdown = readFileSync(DOCS_BASELINE_PATH, 'utf8').replace(/\r\n/g, '\n')
  const today = new Date().toISOString().slice(0, 10)
  const matrix = buildSemanticMatrixTable(tokens)
  const snapshot = buildSnapshotLines(tokens)

  let next = markdown
    .replace(/^Updated: .+$/m, `Updated: ${today}`)
    .replace(
      /(?<=## 2\) Semantic Color Matrix\n\n)([\s\S]*?)(?=\n\n## 3\) Readability Budget \(Theme Audit Gates\))/,
      matrix
    )
    .replace(
      /(?<=Current snapshot from audit:\n\n)([\s\S]*?)(?=\n\n## 4\) Token Coverage Standard)/,
      snapshot
    )

  if (next !== markdown && !next.endsWith('\n')) next += '\n'
  return writeIfChanged(DOCS_BASELINE_PATH, next)
}

export function generateSiteAssets() {
  const themes = Object.fromEntries(
    Object.entries(THEME_FILES).map(([id, file]) => [id, readJson(file)])
  )

  const tokens = Object.fromEntries(
    Object.entries(themes).map(([id, theme]) => [id, extractThemeTokens(theme)])
  )

  for (const [id, tokenSet] of Object.entries(tokens)) {
    assertTokenSet(id, tokenSet)
  }

  const vars = buildSiteVars(tokens)
  const css = renderThemeVarsCss(vars)

  const results = {
    themeVars: writeIfChanged(THEME_VARS_CSS_PATH, css),
    extensionPackage: syncExtensionPackage(tokens),
    docsBaseline: syncDocsBaseline(tokens),
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
