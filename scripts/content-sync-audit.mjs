import { readdirSync, readFileSync, statSync } from 'fs'
import { getThemeOutputFiles, loadColorSystemTuning } from './color-system.mjs'

const THEME_FILES = getThemeOutputFiles()
const COLOR_SYSTEM_TUNING = loadColorSystemTuning()
const SITE_DOCS_PROFILE = COLOR_SYSTEM_TUNING.siteDocsProfile

const I18N_FILES = {
  en: 'src/i18n/en.json',
  zh: 'src/i18n/zh.json',
  ja: 'src/i18n/ja.json',
}

const EXTENSION_README = 'extension/README.md'
const EXTENSION_PACKAGE = 'extension/package.json'
const README_JA = 'README.ja.md'
const DOCS_BASELINE = 'docs/theme-baseline.md'
const SITE_THEME_VARS = 'src/styles/theme-vars.css'
const SOURCE_COLOR_SCAN_PATHS = ['src/components', 'src/layouts', 'src/styles']
const LEGACY_HEX = ['#2a2723', '#ece2d3']

const issues = []

function addIssue(message) {
  issues.push(message)
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    addIssue(`${path}: failed to parse JSON (${error.message})`)
    return null
  }
}

function readText(path) {
  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    addIssue(`${path}: failed to read (${error.message})`)
    return null
  }
}

function normalizeHex(hex) {
  if (typeof hex !== 'string') return null
  const value = hex.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(value)) return value
  if (/^#[0-9a-f]{8}$/.test(value)) return value.slice(0, 7)
  return null
}

function extractHexes(text) {
  if (typeof text !== 'string') return []
  return [...text.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((match) => match[0].toLowerCase())
}

function hexToRgb(hex) {
  const normalized = normalizeHex(hex)
  if (!normalized) return null
  const raw = normalized.slice(1)
  return [
    Number.parseInt(raw.slice(0, 2), 16),
    Number.parseInt(raw.slice(2, 4), 16),
    Number.parseInt(raw.slice(4, 6), 16),
  ]
}

function toLinear(channel) {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const [r, g, b] = rgb.map(toLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(a, b) {
  const l1 = luminance(a)
  const l2 = luminance(b)
  if (l1 == null || l2 == null) return null
  const hi = Math.max(l1, l2)
  const lo = Math.min(l1, l2)
  return (hi + 0.05) / (lo + 0.05)
}

function fixed(value) {
  return Number(value).toFixed(1)
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

function walkFiles(targetPath) {
  const queue = [targetPath]
  const files = []

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) continue

    let stats
    try {
      stats = statSync(current)
    } catch {
      addIssue(`${current}: failed to stat path`)
      continue
    }

    if (stats.isFile()) {
      files.push(current.replace(/\\/g, '/'))
      continue
    }

    if (!stats.isDirectory()) continue

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const next = `${current}/${entry.name}`.replace(/\\/g, '/')
      if (entry.isDirectory()) {
        queue.push(next)
      } else {
        files.push(next)
      }
    }
  }

  return files
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function validatePhilosophyCopy() {
  for (const [lang, file] of Object.entries(I18N_FILES)) {
    const dict = readJson(file)
    if (!dict) continue

    const body = dict['philosophy.02.body']
    if (typeof body !== 'string') {
      addIssue(`${file}: missing "philosophy.02.body"`)
      continue
    }

    const swatchAria = dict['philosophy.02.swatchesAria']
    if (typeof swatchAria !== 'string' || swatchAria.trim().length === 0) {
      addIssue(`${file}: missing "philosophy.02.swatchesAria"`)
    }

    if (/\{(?:darkBg|darkSoftBg|lightBg|lightSoftBg)\}/.test(body)) {
      addIssue(`${file}: philosophy.02.body should not include raw palette placeholders`)
    }

    const hexSet = new Set(extractHexes(body))
    if (hexSet.size > 0) {
      addIssue(`${file}: philosophy.02.body should not hardcode palette hex values`)
    }

    for (const staleHex of LEGACY_HEX) {
      if (body.includes(staleHex)) {
        addIssue(`${file}: philosophy.02.body still contains stale hex ${staleHex}`)
      }
    }

    if (lang !== 'en' && body.includes('3 variants')) {
      addIssue(`${file}: philosophy.02.body appears stale or incomplete`)
    }
  }
}

function validateVariantCountCopy() {
  const checks = [
    {
      file: I18N_FILES.en,
      key: 'proof.metric.3.label',
      forbidden: [/\b3 variants\b/i, /three variants/i],
    },
    {
      file: I18N_FILES.zh,
      key: 'proof.metric.3.label',
      forbidden: [/三个变体/],
    },
    {
      file: I18N_FILES.ja,
      key: 'proof.metric.3.label',
      forbidden: [/3バリアント/],
    },
  ]

  for (const check of checks) {
    const dict = readJson(check.file)
    if (!dict) continue
    const value = dict[check.key]
    if (typeof value !== 'string') {
      addIssue(`${check.file}: missing "${check.key}"`)
      continue
    }
    for (const pattern of check.forbidden) {
      if (pattern.test(value)) {
        addIssue(`${check.file}: "${check.key}" still uses legacy variant count wording`)
      }
    }
  }

  const readmeJa = readText(README_JA)
  if (readmeJa && /3バリアント/.test(readmeJa)) {
    addIssue(`${README_JA}: still uses legacy "3バリアント" wording`)
  }
}

function validateExtensionReadmeSnapshot() {
  const themes = Object.fromEntries(
    Object.entries(THEME_FILES).map(([id, file]) => [id, readJson(file)])
  )
  if (Object.values(themes).some((theme) => !theme)) return

  const metrics = Object.fromEntries(
    Object.entries(themes).map(([id, theme]) => {
      const bg = normalizeHex(theme.colors?.['editor.background'])
      const fg = normalizeHex(theme.colors?.['editor.foreground'])
      const comment = getTokenColor(theme, 'comment')
      return [
        id,
        {
          fgBg: bg && fg ? contrastRatio(fg, bg) : null,
          commentBg: bg && comment ? contrastRatio(comment, bg) : null,
        },
      ]
    })
  )

  const readme = readText(EXTENSION_README)
  if (!readme) return

  const expectedLines = [
    ['Dark editor foreground/background contrast', fixed(metrics.dark.fgBg)],
    ['Dark Soft editor foreground/background contrast', fixed(metrics.darkSoft.fgBg)],
    ['Light editor foreground/background contrast', fixed(metrics.light.fgBg)],
    ['Light Soft editor foreground/background contrast', fixed(metrics.lightSoft.fgBg)],
  ]

  for (const [label, expected] of expectedLines) {
    const pattern = new RegExp(`- ${escapeRegExp(label)}:\\s*` + '`([^`]+)`')
    const match = readme.match(pattern)
    if (!match) {
      addIssue(`${EXTENSION_README}: missing line "${label}"`)
      continue
    }
    const actual = String(match[1]).trim()
    if (actual !== expected) {
      addIssue(`${EXTENSION_README}: "${label}" expected ${expected}, got ${actual}`)
    }
  }

  const commentValues = Object.values(metrics)
    .map((item) => item.commentBg)
    .filter((value) => value != null)
  const expectedMin = fixed(Math.min(...commentValues))
  const expectedMax = fixed(Math.max(...commentValues))
  const windowMatch = readme.match(/- Comment contrast window:\s*`([0-9.]+)\s*-\s*([0-9.]+)`/)
  if (!windowMatch) {
    addIssue(`${EXTENSION_README}: missing "Comment contrast window" line`)
  } else {
    const [, minValue, maxValue] = windowMatch
    if (minValue !== expectedMin || maxValue !== expectedMax) {
      addIssue(
        `${EXTENSION_README}: "Comment contrast window" expected ${expectedMin} - ${expectedMax}, got ${minValue} - ${maxValue}`
      )
    }
  }
}

function getLineAtIndex(text, index) {
  if (index <= 0) return 1
  let line = 1
  for (let i = 0; i < index; i += 1) {
    if (text[i] === '\n') line += 1
  }
  return line
}

function validateThemeVarsAndMetadata(themes) {
  const dark = themes.dark
  if (!dark) return
  const darkSet = getThemeTokenSet(dark)

  const varsText = readText(SITE_THEME_VARS)
  if (!varsText) return
  if (!varsText.includes('Auto-generated by scripts/generate-site-assets.mjs')) {
    addIssue(`${SITE_THEME_VARS}: missing auto-generated header`)
  }
  if (!varsText.includes(`--hearth-bg: ${darkSet.bg};`)) {
    addIssue(`${SITE_THEME_VARS}: --hearth-bg is out of sync with ${THEME_FILES.dark}`)
  }

  const pkg = readJson(EXTENSION_PACKAGE)
  if (pkg) {
    const banner = normalizeHex(pkg.galleryBanner?.color)
    if (!banner) {
      addIssue(`${EXTENSION_PACKAGE}: galleryBanner.color is missing or invalid`)
    } else if (banner !== darkSet.bg) {
      addIssue(`${EXTENSION_PACKAGE}: galleryBanner.color expected ${darkSet.bg}, got ${banner}`)
    }
  }
}

function validateDocsBaseline(tokens) {
  const docs = readText(DOCS_BASELINE)
  if (!docs) return

  for (const row of SITE_DOCS_PROFILE.semanticRows) {
    const dark = tokens.dark?.[row.key]
    const darkSoft = tokens.darkSoft?.[row.key]
    const light = tokens.light?.[row.key]
    const lightSoft = tokens.lightSoft?.[row.key]
    if (!dark || !darkSoft || !light || !lightSoft) {
      addIssue(`${DOCS_BASELINE}: semantic matrix row "${row.id}" has missing token data`)
      continue
    }
    const line = `| ${row.id} | \`${dark}\` | \`${darkSoft}\` | \`${light}\` | \`${lightSoft}\` |`
    if (!docs.includes(line)) {
      addIssue(`${DOCS_BASELINE}: semantic matrix row "${row.id}" is out of sync`)
    }
  }

  for (const metric of SITE_DOCS_PROFILE.snapshotRatios) {
    const left = tokens?.[metric.variant]?.[metric.left]
    const right = tokens?.[metric.variant]?.[metric.right]
    if (!left || !right) {
      addIssue(`${DOCS_BASELINE}: snapshot line "${metric.label}" has missing token data`)
      continue
    }
    const ratio = contrastRatio(left, right)
    if (ratio == null) {
      addIssue(`${DOCS_BASELINE}: snapshot line "${metric.label}" contrast could not be computed`)
      continue
    }
    const label = metric.label
    const line = `- ${label}: \`${fixed(ratio)}\``
    if (!docs.includes(line)) {
      addIssue(`${DOCS_BASELINE}: snapshot line "${label}" is out of sync`)
    }
  }
}

function validateNoHardcodedColorLiterals() {
  const colorLiteral = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(/g
  const tailwindPaletteClass = /\b(?:text|bg|border)-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:\/\d+|-\d+)?\b/g
  const allowedGenerated = new Set([SITE_THEME_VARS.replace(/\\/g, '/')])

  for (const target of SOURCE_COLOR_SCAN_PATHS) {
    const files = walkFiles(target)
    for (const file of files) {
      if (!/\.(css|astro)$/.test(file)) continue
      if (allowedGenerated.has(file.replace(/\\/g, '/'))) continue
      const text = readText(file)
      if (!text) continue

      const literalMatch = colorLiteral.exec(text)
      colorLiteral.lastIndex = 0
      if (literalMatch) {
        const line = getLineAtIndex(text, literalMatch.index)
        addIssue(`${file}:${line} hardcoded color literal "${literalMatch[0]}" found`)
      }

      const classMatch = tailwindPaletteClass.exec(text)
      tailwindPaletteClass.lastIndex = 0
      if (classMatch) {
        const line = getLineAtIndex(text, classMatch.index)
        addIssue(`${file}:${line} palette utility class "${classMatch[0]}" found (use theme vars instead)`)
      }
    }
  }
}

function run() {
  const themes = Object.fromEntries(
    Object.entries(THEME_FILES).map(([id, file]) => [id, readJson(file)])
  )

  const tokenSets = Object.fromEntries(
    Object.entries(themes).map(([id, theme]) => [id, theme ? getThemeTokenSet(theme) : null])
  )

  validatePhilosophyCopy()
  validateVariantCountCopy()
  validateExtensionReadmeSnapshot()
  validateThemeVarsAndMetadata(themes)
  const tokenSetsReady = Object.entries(tokenSets).every(([, set]) => (
    set && Object.values(set).every(Boolean)
  ))
  if (tokenSetsReady) {
    validateDocsBaseline(tokenSets)
  } else {
    addIssue('theme token extraction failed while validating docs baseline')
  }
  validateNoHardcodedColorLiterals()

  if (issues.length > 0) {
    console.error('[FAIL] Content sync audit found issues:')
    for (const issue of issues) {
      console.error(`  - ${issue}`)
    }
    process.exit(1)
  }

  console.log('[PASS] Content sync audit passed.')
}

run()
