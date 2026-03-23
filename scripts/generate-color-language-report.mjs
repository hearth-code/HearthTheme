import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { pathToFileURL } from 'url'

const THEME_FILES = {
  dark: 'themes/hearth-dark.json',
  darkSoft: 'themes/hearth-dark-soft.json',
  light: 'themes/hearth-light.json',
  lightSoft: 'themes/hearth-light-soft.json',
}

const VARIANT_ORDER = ['dark', 'darkSoft', 'light', 'lightSoft']

const ROLE_SPECS = [
  {
    id: 'comment',
    scopes: ['comment', 'punctuation.definition.comment'],
    vscodeSemantic: null,
    obsidianVar: '--code-comment',
    webToken: 'comment',
  },
  {
    id: 'keyword',
    scopes: ['keyword', 'keyword.control'],
    vscodeSemantic: 'keyword',
    obsidianVar: '--code-keyword',
    webToken: 'keyword',
  },
  {
    id: 'operator',
    scopes: ['keyword.operator', 'keyword.operator.assignment'],
    vscodeSemantic: null,
    obsidianVar: '--code-operator',
    webToken: 'operator',
  },
  {
    id: 'function',
    scopes: ['entity.name.function', 'support.function'],
    vscodeSemantic: 'function',
    obsidianVar: '--code-function',
    webToken: 'fn',
  },
  {
    id: 'string',
    scopes: ['string', 'string.quoted', 'string.template'],
    vscodeSemantic: null,
    obsidianVar: '--code-string',
    webToken: 'string',
  },
  {
    id: 'number',
    scopes: ['constant.numeric'],
    vscodeSemantic: 'enumMember',
    obsidianVar: '--code-value',
    webToken: 'number',
  },
  {
    id: 'type',
    scopes: ['entity.name.type', 'entity.name.class', 'support.type'],
    vscodeSemantic: 'type',
    obsidianVar: '--code-important',
    webToken: 'type',
  },
  {
    id: 'variable',
    scopes: ['variable', 'variable.other.readwrite'],
    vscodeSemantic: 'variable',
    obsidianVar: '--code-normal',
    webToken: 'variable',
  },
  {
    id: 'property',
    scopes: ['variable.other.property', 'support.type.property-name', 'meta.object-literal.key'],
    vscodeSemantic: 'property',
    obsidianVar: '--code-property',
    webToken: null,
  },
  {
    id: 'tag',
    scopes: ['entity.name.tag', 'punctuation.definition.tag'],
    vscodeSemantic: null,
    obsidianVar: '--code-tag',
    webToken: null,
  },
]

const OUTPUT_JSON = 'reports/color-language-consistency.json'
const OUTPUT_MARKDOWN = 'docs/color-language-report.md'

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function normalizeHex(hex) {
  if (typeof hex !== 'string') return null
  const value = hex.trim().toLowerCase()
  if (/^#[0-9a-f]{3}$/.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
  }
  if (/^#[0-9a-f]{6}$/.test(value)) return value
  if (/^#[0-9a-f]{8}$/.test(value)) return value.slice(0, 7)
  return null
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

function rgbToHsl(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  let [r, g, b] = rgb.map((x) => x / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))

  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6)
    else if (max === g) h = 60 * ((b - r) / d + 2)
    else h = 60 * ((r - g) / d + 4)
  }

  if (h < 0) h += 360
  return { h, s, l }
}

function hueDiff(a, b) {
  const diff = Math.abs(a - b)
  return Math.min(diff, 360 - diff)
}

function rgbToXyz([r, g, b]) {
  const rl = toLinear(r)
  const gl = toLinear(g)
  const bl = toLinear(b)
  return [
    rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375,
    rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175,
    rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041,
  ]
}

function xyzToLab([x, y, z]) {
  const xr = x / 0.95047
  const yr = y / 1.0
  const zr = z / 1.08883
  const f = (t) => (t > 0.008856 ? t ** (1 / 3) : 7.787 * t + 16 / 116)
  const fx = f(xr)
  const fy = f(yr)
  const fz = f(zr)
  return [
    116 * fy - 16,
    500 * (fx - fy),
    200 * (fy - fz),
  ]
}

function deltaE(hexA, hexB) {
  const rgbA = hexToRgb(hexA)
  const rgbB = hexToRgb(hexB)
  if (!rgbA || !rgbB) return null
  const [l1, a1, b1] = xyzToLab(rgbToXyz(rgbA))
  const [l2, a2, b2] = xyzToLab(rgbToXyz(rgbB))
  return Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2)
}

function fixed(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return 'n/a'
  return Number(value).toFixed(digits)
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

function toScopes(entry) {
  if (!entry?.scope) return []
  return Array.isArray(entry.scope) ? entry.scope : [entry.scope]
}

function getTokenColor(theme, scopes) {
  for (const entry of theme.tokenColors || []) {
    const entryScopes = toScopes(entry)
    if (!scopes.some((scope) => entryScopes.includes(scope))) continue
    const value = normalizeHex(entry.settings?.foreground)
    if (value) return value
  }
  return null
}

function getSemanticColor(theme, semanticKey) {
  if (!semanticKey) return null
  const value = theme.semanticTokenColors?.[semanticKey]
  if (!value) return null
  if (typeof value === 'string') return normalizeHex(value)
  if (typeof value === 'object' && value.foreground) return normalizeHex(value.foreground)
  return null
}

function loadThemes() {
  const themes = {}
  for (const [id, path] of Object.entries(THEME_FILES)) {
    themes[id] = readJson(path)
  }
  return themes
}

function buildRoleRows(themes) {
  return ROLE_SPECS.map((role) => {
    const variants = {}

    for (const variant of VARIANT_ORDER) {
      const theme = themes[variant]
      const textmate = getTokenColor(theme, role.scopes)
      const semantic = getSemanticColor(theme, role.vscodeSemantic)
      const bg = normalizeHex(theme?.colors?.['editor.background'])
      const contrast = textmate && bg ? contrastRatio(textmate, bg) : null
      variants[variant] = {
        textmate,
        semantic,
        contrastToBackground: contrast == null ? null : Number(contrast.toFixed(2)),
      }
    }

    const darkHue = variants.dark.textmate ? rgbToHsl(variants.dark.textmate) : null
    const lightHue = variants.light.textmate ? rgbToHsl(variants.light.textmate) : null
    const darkSoftHue = variants.darkSoft.textmate ? rgbToHsl(variants.darkSoft.textmate) : null
    const lightSoftHue = variants.lightSoft.textmate ? rgbToHsl(variants.lightSoft.textmate) : null

    const defaultPairHueDrift = darkHue && lightHue ? hueDiff(darkHue.h, lightHue.h) : null
    const softPairHueDrift = darkSoftHue && lightSoftHue ? hueDiff(darkSoftHue.h, lightSoftHue.h) : null

    const semanticDeltaByVariant = {}
    for (const variant of VARIANT_ORDER) {
      const { textmate, semantic } = variants[variant]
      semanticDeltaByVariant[variant] = textmate && semantic ? Number(deltaE(textmate, semantic).toFixed(2)) : null
    }

    return {
      id: role.id,
      scopes: role.scopes,
      adapters: {
        vscodeSemantic: role.vscodeSemantic,
        obsidianVar: role.obsidianVar,
        webToken: role.webToken,
      },
      variants,
      metrics: {
        defaultPairHueDrift: defaultPairHueDrift == null ? null : Number(defaultPairHueDrift.toFixed(1)),
        softPairHueDrift: softPairHueDrift == null ? null : Number(softPairHueDrift.toFixed(1)),
        semanticDeltaE: semanticDeltaByVariant,
      },
    }
  })
}

function buildReportObject(roleRows) {
  const adapterContract = roleRows.map((row) => ({
    role: row.id,
    scopes: row.scopes,
    vscodeSemantic: row.adapters.vscodeSemantic,
    obsidianVar: row.adapters.obsidianVar,
    webToken: row.adapters.webToken,
  }))

  const driftSummary = Object.fromEntries(
    roleRows.map((row) => [
      row.id,
      {
        defaultPairHueDrift: row.metrics.defaultPairHueDrift,
        softPairHueDrift: row.metrics.softPairHueDrift,
      },
    ])
  )

  return {
    schemaVersion: 1,
    sourceOfTruth: {
      themes: Object.values(THEME_FILES),
      generator: 'scripts/generate-theme-variants.mjs',
    },
    adapterContract,
    roles: roleRows,
    driftSummary,
  }
}

function buildMarkdown(roleRows) {
  const lines = [
    '# Color Language Report',
    '',
    'Auto-generated by `scripts/generate-color-language-report.mjs`.',
    '',
    '## Adapter Contract',
    '',
    '| Role | VS Code semantic | Obsidian var | Web token | Primary scope |',
    '| --- | --- | --- | --- | --- |',
  ]

  for (const row of roleRows) {
    lines.push(
      `| ${row.id} | ${row.adapters.vscodeSemantic ?? 'n/a'} | ${row.adapters.obsidianVar} | ${row.adapters.webToken ?? 'n/a'} | ${row.scopes[0]} |`
    )
  }

  lines.push('', '## Variant Palette Matrix', '', '| Role | Dark | Dark Soft | Light | Light Soft |', '| --- | --- | --- | --- | --- |')
  for (const row of roleRows) {
    lines.push(
      `| ${row.id} | ${row.variants.dark.textmate ?? 'n/a'} | ${row.variants.darkSoft.textmate ?? 'n/a'} | ${row.variants.light.textmate ?? 'n/a'} | ${row.variants.lightSoft.textmate ?? 'n/a'} |`
    )
  }

  lines.push(
    '',
    '## Cross-Theme Drift',
    '',
    '| Role | Dark->Light hue drift | DarkSoft->LightSoft hue drift |',
    '| --- | --- | --- |'
  )
  for (const row of roleRows) {
    lines.push(
      `| ${row.id} | ${fixed(row.metrics.defaultPairHueDrift)} | ${fixed(row.metrics.softPairHueDrift)} |`
    )
  }

  lines.push(
    '',
    '## Semantic Alignment (DeltaE)',
    '',
    '| Role | Dark | Dark Soft | Light | Light Soft |',
    '| --- | --- | --- | --- | --- |'
  )
  for (const row of roleRows) {
    lines.push(
      `| ${row.id} | ${fixed(row.metrics.semanticDeltaE.dark, 2)} | ${fixed(row.metrics.semanticDeltaE.darkSoft, 2)} | ${fixed(row.metrics.semanticDeltaE.light, 2)} | ${fixed(row.metrics.semanticDeltaE.lightSoft, 2)} |`
    )
  }

  lines.push('', '## Notes', '', '- Hue drift values are lower-is-more-stable across light/dark pairs.', '- DeltaE values are lower-is-closer between TextMate and semantic token mappings.')

  return `${lines.join('\n')}\n`
}

export function generateColorLanguageReport() {
  const themes = loadThemes()
  const roleRows = buildRoleRows(themes)
  const report = buildReportObject(roleRows)
  const markdown = buildMarkdown(roleRows)

  mkdirSync('reports', { recursive: true })
  mkdirSync('docs', { recursive: true })

  const jsonChanged = writeIfChanged(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`)
  const mdChanged = writeIfChanged(OUTPUT_MARKDOWN, markdown)

  console.log(`${jsonChanged ? '✓ updated' : '- unchanged'} ${OUTPUT_JSON}`)
  console.log(`${mdChanged ? '✓ updated' : '- unchanged'} ${OUTPUT_MARKDOWN}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    generateColorLanguageReport()
  } catch (error) {
    console.error(`[FAIL] ${error.message}`)
    process.exit(1)
  }
}
