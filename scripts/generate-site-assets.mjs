import { existsSync, readFileSync, writeFileSync } from 'fs'
import { pathToFileURL } from 'url'
import { getThemeOutputFiles, loadColorSystemTuning } from './color-system.mjs'

const THEME_FILES = getThemeOutputFiles()
const COLOR_SYSTEM_TUNING = loadColorSystemTuning()
const SITE_DOCS_PROFILE = COLOR_SYSTEM_TUNING.siteDocsProfile

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

function buildSiteVars(tokens) {
  const dark = tokens.dark
  const light = tokens.light

  const ember = mixHex(dark.keyword, dark.fn, 0.58)

  return {
    '--hearth-bg': dark.bg,
    '--hearth-fg': mixHex(dark.fg, light.bg, 0.08),
    '--hearth-muted': mixHex(dark.comment, dark.fg, 0.28),
    '--hearth-ember': ember,
    '--hearth-brass': mixHex(dark.fn, light.bg, 0.18),
    '--hearth-kicker-accent': mixHex(dark.fn, dark.keyword, 0.4),
    '--hearth-brand-main': mixHex(dark.fg, light.bg, 0.28),
    '--hearth-brand-accent': mixHex(dark.fn, dark.keyword, 0.28),
    '--hearth-logo-main': mixHex(dark.fg, light.bg, 0.2),
    '--hearth-logo-accent': mixHex(dark.fn, dark.keyword, 0.34),
    '--hearth-nav-icon-bg': mixHex(dark.sidebar, dark.bg, 0.52),
    '--hearth-text-heading': mixHex(dark.fg, light.bg, 0.34),
    '--hearth-text-heading-strong': mixHex(dark.fg, light.bg, 0.4),
    '--hearth-text-body-soft': mixHex(dark.fg, dark.comment, 0.34),
    '--hearth-text-body-muted': mixHex(dark.fg, dark.comment, 0.44),
    '--hearth-metric-muted': mixHex(dark.comment, dark.fg, 0.24),
    '--hearth-proof-metric-title': mixHex(dark.fg, light.bg, 0.31),
    '--hearth-proof-variant-title': mixHex(dark.fg, light.bg, 0.25),
    '--hearth-proof-variant-body': mixHex(dark.comment, dark.fg, 0.37),
    '--hearth-surface-border-weak': alpha(mixHex(dark.fn, dark.fg, 0.24), 0.2),
    '--hearth-surface-border-soft': alpha(mixHex(dark.fn, dark.fg, 0.24), 0.18),
    '--hearth-doc-heading': mixHex(dark.fg, light.bg, 0.18),
    '--hearth-doc-body': mixHex(dark.comment, dark.fg, 0.42),
    '--hearth-doc-mono': mixHex(dark.variable, dark.fg, 0.33),
    '--hearth-doc-note': mixHex(dark.comment, dark.fg, 0.34),
    '--hearth-doc-border': mixHex(dark.border, dark.bg, 0.22),
    '--hearth-doc-date': mixHex(dark.comment, dark.fg, 0.22),
    '--hearth-doc-bullet': mixHex(dark.comment, dark.fg, 0.48),
    '--hearth-footer-meta': mixHex(dark.comment, dark.bg, 0.46),
    '--hearth-badge-aaa': mixHex(dark.string, light.bg, 0.18),
    '--hearth-badge-aa': mixHex(dark.fn, light.bg, 0.22),
    '--hearth-badge-dec-border': mixHex(dark.border, dark.bg, 0.25),
    '--hearth-badge-dec-text': mixHex(dark.comment, dark.bg, 0.34),

    '--hearth-bg-grad-0': mixHex(dark.bg, dark.sidebar, 0.44),
    '--hearth-bg-grad-1': mixHex(dark.bg, dark.sidebar, 0.62),
    '--hearth-bg-grad-2': mixHex(dark.bg, dark.sidebar, 0.78),
    '--hearth-bg-mobile-grad-0': mixHex(dark.bg, dark.sidebar, 0.4),
    '--hearth-bg-mobile-grad-1': mixHex(dark.bg, dark.sidebar, 0.58),
    '--hearth-bg-mobile-grad-2': mixHex(dark.bg, dark.sidebar, 0.74),
    '--hearth-bg-ambient-top-left': alpha(mixHex(light.bg, dark.fn, 0.55), 0.13),
    '--hearth-bg-ambient-top-right': alpha(ember, 0.16),
    '--hearth-bg-ambient-bottom': alpha(mixHex(dark.number, dark.sidebar, 0.45), 0.2),
    '--hearth-grid-line-soft': alpha(light.bg, 0.015),
    '--hearth-grid-line-faint': alpha(light.bg, 0.01),
    '--hearth-firelight-a': alpha(mixHex(ember, dark.fn, 0.35), 0.3),
    '--hearth-firelight-b': alpha(mixHex(ember, dark.keyword, 0.42), 0.26),
    '--hearth-firelight-c': alpha(mixHex(dark.number, ember, 0.52), 0.24),
    '--hearth-firelight-d': alpha(mixHex(dark.number, dark.sidebar, 0.45), 0.2),
    '--hearth-firelight-e': alpha(mixHex(dark.sidebar, dark.number, 0.32), 0.18),
    '--hearth-fabric-line-soft': alpha(mixHex(light.bg, dark.fg, 0.26), 0.015),
    '--hearth-fabric-line-faint': alpha(mixHex(light.bg, dark.fg, 0.26), 0.01),
    '--hearth-fabric-haze': alpha(mixHex(light.bg, dark.fg, 0.22), 0.035),
    '--hearth-bg-ambient-mobile-a': alpha(ember, 0.14),
    '--hearth-bg-ambient-mobile-b': alpha(mixHex(dark.number, dark.sidebar, 0.42), 0.12),
    '--hearth-grid-line-mobile': alpha(light.bg, 0.012),
    '--hearth-focus-ring': alpha(mixHex(ember, dark.fn, 0.28), 0.8),
    '--hearth-line-divider': alpha(mixHex(dark.fn, dark.number, 0.35), 0.36),
    '--hearth-table-head-border': alpha(light.bg, 0.1),
    '--hearth-table-row-border': alpha(light.bg, 0.06),
    '--hearth-btn-primary-border': alpha(mixHex(dark.fn, light.bg, 0.24), 0.35),
    '--hearth-btn-primary-bg-a': alpha(mixHex(ember, dark.fn, 0.4), 0.3),
    '--hearth-btn-primary-bg-b': alpha(mixHex(dark.number, dark.sidebar, 0.5), 0.2),
    '--hearth-shadow-024': alpha(mixHex(dark.bg, dark.sidebar, 0.75), 0.24),
    '--hearth-btn-primary-hover-border': alpha(mixHex(dark.fn, light.bg, 0.38), 0.55),
    '--hearth-btn-secondary-border': alpha(mixHex(dark.fg, dark.comment, 0.34), 0.3),
    '--hearth-surface-soft-bg': alpha(light.bg, 0.02),
    '--hearth-shadow-018': alpha(mixHex(dark.bg, dark.sidebar, 0.75), 0.18),
    '--hearth-btn-secondary-hover-border': alpha(mixHex(dark.fn, light.bg, 0.34), 0.55),
    '--hearth-btn-tertiary-border': alpha(mixHex(dark.fn, dark.comment, 0.38), 0.24),
    '--hearth-btn-tertiary-hover-border': alpha(mixHex(dark.fn, light.bg, 0.32), 0.45),
    '--hearth-tail-line-core': alpha(mixHex(dark.fn, dark.number, 0.4), 0.28),
    '--hearth-tail-glow-a': alpha(mixHex(ember, dark.fn, 0.44), 0.09),
    '--hearth-tail-glow-b': alpha(mixHex(dark.number, dark.sidebar, 0.45), 0.1),
    '--hearth-footer-border': alpha(mixHex(dark.fn, dark.fg, 0.25), 0.1),
    '--hearth-footer-grad-start': alpha(mixHex(dark.bg, dark.sidebar, 0.7), 0),
    '--hearth-footer-grad-end': alpha(mixHex(dark.bg, dark.sidebar, 0.82), 0.68),
    '--hearth-footer-glow': alpha(mixHex(ember, dark.fn, 0.44), 0.12),
    '--hearth-topbar-grad-start': alpha(mixHex(dark.bg, dark.sidebar, 0.75), 0.7),
    '--hearth-topbar-grad-end': alpha(mixHex(dark.bg, dark.sidebar, 0.82), 0.54),
    '--hearth-topbar-shadow-line': alpha(light.bg, 0.08),
    '--hearth-shadow-016': alpha(mixHex(dark.bg, dark.sidebar, 0.75), 0.16),
    '--hearth-topbar-overlay-grid': alpha(mixHex(light.bg, dark.fg, 0.26), 0.008),
    '--hearth-topbar-overlay-glaze': alpha(light.bg, 0.03),
    '--hearth-topbar-cond-grad-start': alpha(mixHex(dark.bg, dark.sidebar, 0.82), 0.78),
    '--hearth-topbar-cond-grad-end': alpha(mixHex(dark.bg, dark.sidebar, 0.88), 0.7),
    '--hearth-shadow-020': alpha(mixHex(dark.bg, dark.sidebar, 0.75), 0.2),
    '--hearth-shadow-012': alpha(mixHex(dark.bg, dark.sidebar, 0.75), 0.12),
    '--hearth-pill-underline-shadow': alpha(mixHex(dark.fn, light.bg, 0.35), 0.2),
    '--hearth-nav-active-shadow': alpha(mixHex(dark.fn, light.bg, 0.42), 0.2),
    '--hearth-nav-dot': alpha(mixHex(dark.fn, dark.fg, 0.33), 0.4),
    '--hearth-lang-active-shadow': alpha(mixHex(dark.fn, light.bg, 0.45), 0.2),
    '--hearth-pill-focus-shadow': alpha(mixHex(dark.fn, light.bg, 0.35), 0.3),
    '--hearth-feature-border': alpha(light.bg, 0.11),
    '--hearth-paper-glow': alpha(light.bg, 0.14),
    '--hearth-paper-grad-end': alpha(mixHex(dark.bg, dark.sidebar, 0.75), 0.05),
    '--hearth-paper-grid-soft': alpha(light.bg, 0.04),
    '--hearth-paper-grid-warm': alpha(mixHex(dark.number, dark.sidebar, 0.45), 0.02),
    '--hearth-paper-edge-highlight': alpha(light.bg, 0.25),
    '--hearth-paper-shadow-depth': alpha(mixHex(dark.number, dark.sidebar, 0.45), 0.06),
    '--hearth-preview-mobile-shadow-deep': alpha(mixHex(dark.bg, dark.sidebar, 0.75), 0.34),
    '--hearth-preview-shell-edge': alpha(light.bg, 0.05),
    '--hearth-preview-shell-grad-start': alpha(light.bg, 0.015),
    '--hearth-preview-shell-grad-end': alpha(mixHex(dark.bg, dark.sidebar, 0.75), 0.08),
    '--hearth-preview-shell-shadow-deep': alpha(mixHex(dark.bg, dark.sidebar, 0.75), 0.44),
    '--hearth-preview-shell-shadow-mid': alpha(mixHex(dark.bg, dark.sidebar, 0.75), 0.3),
    '--hearth-preview-stage-grad-start': alpha(light.bg, 0.02),
    '--hearth-preview-stage-grad-end': alpha(mixHex(dark.bg, dark.sidebar, 0.75), 0.1),
    '--hearth-preview-strip-border-dark': alpha(light.bg, 0.08),
    '--hearth-preview-strip-border-light': alpha(mixHex(dark.border, dark.number, 0.32), 0.18),
    '--hearth-preview-switch-active-bg': alpha(mixHex(ember, dark.fn, 0.4), 0.26),
    '--hearth-preview-switch-active-ring': alpha(mixHex(dark.fn, light.bg, 0.34), 0.24),
    '--hearth-preview-switch-border': alpha(mixHex(dark.fn, dark.fg, 0.24), 0.22),
    '--hearth-preview-tab-active-shadow': alpha(mixHex(dark.fn, light.bg, 0.35), 0.16),
    '--hearth-colorsystem-row-border': alpha(light.bg, 0.07),
  }
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
