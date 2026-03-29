import { readdirSync, readFileSync, statSync } from 'fs'
import { getThemeOutputFiles, loadColorSystemTuning, loadColorSystemVariants } from './color-system.mjs'

const THEME_FILES = getThemeOutputFiles()
const COLOR_SYSTEM_TUNING = loadColorSystemTuning()
const VARIANT_SPEC = loadColorSystemVariants()
const SITE_DOCS_PROFILE = COLOR_SYSTEM_TUNING.siteDocsProfile

const I18N_FILES = {
  en: 'src/i18n/en.json',
  zh: 'src/i18n/zh.json',
  ja: 'src/i18n/ja.json',
}

const EXTENSION_README = 'extension/README.md'
const EXTENSION_PACKAGE = 'extension/package.json'
const README_EN = 'README.md'
const README_ZH = 'README.zh-CN.md'
const README_JA = 'README.ja.md'
const PREVIEW_MANIFEST = 'reports/preview-manifest.json'
const DOCS_BASELINE = 'docs/theme-baseline.md'
const BASELINE_DOCS_COMPONENT = 'src/components/ui/BaselineDocs.astro'
const PROOF_SECTION_COMPONENT = 'src/components/ui/ProofSection.astro'
const CODE_PREVIEW_COMPONENT = 'src/components/code/CodePreview.astro'
const THEME_AUDIT_SCRIPT = 'scripts/theme-audit.mjs'
const SITE_THEME_VARS = 'src/styles/theme-vars.css'
const SOURCE_COLOR_SCAN_PATHS = ['src/components', 'src/layouts', 'src/styles']
const LEGACY_HEX = ['#2a2723', '#ece2d3']
const SITE_TEXT_CONTRAST_BUDGET = [
  { fgVar: '--hearth-metric-muted', bgVar: '--hearth-bg', minRatio: 4.5 },
  { fgVar: '--hearth-doc-date', bgVar: '--hearth-bg', minRatio: 4.5 },
  { fgVar: '--hearth-footer-meta', bgVar: '--hearth-bg', minRatio: 4.5 },
]
const SITE_BUTTON_BUDGET = {
  minVisualSeparation: 4,
  secondaryTextMinRatio: 4.5,
  tertiaryTextMinRatio: 4.5,
}

const issues = []
const LIVE_SURFACE_IDS = ['vsx', 'vscode', 'obsidian']

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

function rgbToHsl([r, g, b]) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255

  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min

  let h = 0
  const l = (max + min) / 2
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))

  if (delta !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6)
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2)
    else h = 60 * ((rn - gn) / delta + 4)
  }

  if (h < 0) h += 360
  return { h, s, l }
}

function hueInBand(hue, min, max) {
  if (hue == null) return false
  if (min <= max) return hue >= min && hue <= max
  return hue >= min || hue <= max
}

function fixed(value) {
  return Number(value).toFixed(1)
}

function parseNumericConst(scriptText, constName) {
  const match = scriptText.match(new RegExp(`const\\s+${constName}\\s*=\\s*([0-9]+(?:\\.[0-9]+)?)`))
  if (!match) {
    addIssue(`${THEME_AUDIT_SCRIPT}: missing constant "${constName}"`)
    return null
  }
  return {
    raw: match[1],
    value: Number(match[1]),
  }
}

function formatDocNumber(value, { forceOneDecimal = false } = {}) {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  if (forceOneDecimal) return n.toFixed(1)
  return Number.isInteger(n) ? String(n) : String(n)
}

function resolvePairGateThreshold(profile, variantId, fallback) {
  if (!profile || typeof profile !== 'object') return fallback
  const variantValue = profile.byVariant?.[variantId]
  if (typeof variantValue === 'number' && Number.isFinite(variantValue)) return variantValue
  if (typeof profile.default === 'number' && Number.isFinite(profile.default)) return profile.default
  return fallback
}

function resolveVariantRoleProfile(profileByVariant, variantId) {
  const base = profileByVariant?.default || {}
  const specific = profileByVariant?.[variantId] || {}
  return {
    ...base,
    ...specific,
  }
}

function resolveCriticalPairThreshold(profileByVariant, variantId, pairKey, fallback = null) {
  const specific = profileByVariant?.[variantId]?.[pairKey]
  if (typeof specific === 'number' && Number.isFinite(specific)) return specific
  const base = profileByVariant?.default?.[pairKey]
  if (typeof base === 'number' && Number.isFinite(base)) return base
  return fallback
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

function parseSiteThemeVars(varsText) {
  const vars = {}
  for (const match of varsText.matchAll(/(--hearth-[a-z0-9-]+):\s*([^;]+);/g)) {
    vars[match[1]] = String(match[2]).trim()
  }
  return vars
}

function parseRgbWithAlpha(value) {
  if (typeof value !== 'string') return null
  const match = value.trim().match(/^rgb\(\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s*\/\s*(0|1|0?\.\d+)\s*\)$/)
  if (!match) return null

  const r = Number(match[1])
  const g = Number(match[2])
  const b = Number(match[3])
  const a = Number(match[4])
  if ([r, g, b, a].some((x) => Number.isNaN(x))) return null
  if (r > 255 || g > 255 || b > 255) return null
  if (a < 0 || a > 1) return null
  return { r, g, b, a }
}

function rgbToHex({ r, g, b }) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)))
  const toHex = (v) => clamp(v).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function blendOverBackground(rgba, bgHex) {
  const bg = hexToRgb(bgHex)
  if (!bg || !rgba) return null
  const alpha = Math.max(0, Math.min(1, rgba.a))
  return rgbToHex({
    r: rgba.r * alpha + bg[0] * (1 - alpha),
    g: rgba.g * alpha + bg[1] * (1 - alpha),
    b: rgba.b * alpha + bg[2] * (1 - alpha),
  })
}

function rgbDistance(a, b) {
  const ar = hexToRgb(a)
  const br = hexToRgb(b)
  if (!ar || !br) return null
  const dr = ar[0] - br[0]
  const dg = ar[1] - br[1]
  const db = ar[2] - br[2]
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

function validateSiteContrastBudget(vars) {
  for (const { fgVar, bgVar, minRatio } of SITE_TEXT_CONTRAST_BUDGET) {
    const fg = normalizeHex(vars[fgVar])
    const bg = normalizeHex(vars[bgVar])
    if (!fg || !bg) {
      addIssue(`${SITE_THEME_VARS}: missing contrast budget vars ${fgVar} or ${bgVar}`)
      continue
    }
    const ratio = contrastRatio(fg, bg)
    if (ratio == null || ratio < minRatio) {
      const actual = ratio == null ? 'n/a' : fixed(ratio)
      addIssue(`${SITE_THEME_VARS}: contrast ${fgVar} on ${bgVar} is ${actual}, below ${fixed(minRatio)}`)
    }
  }

  const baseBg = normalizeHex(vars['--hearth-bg'])
  const secondaryBgRaw = parseRgbWithAlpha(vars['--hearth-btn-secondary-bg'])
  const tertiaryBgRaw = parseRgbWithAlpha(vars['--hearth-btn-tertiary-bg'])
  const secondaryText = normalizeHex(vars['--hearth-doc-heading'])
  const tertiaryText = normalizeHex(vars['--hearth-doc-bullet'])
  if (!baseBg || !secondaryBgRaw || !tertiaryBgRaw || !secondaryText || !tertiaryText) {
    addIssue(`${SITE_THEME_VARS}: button hierarchy budget vars are missing or invalid`)
    return
  }

  const secondaryBg = blendOverBackground(secondaryBgRaw, baseBg)
  const tertiaryBg = blendOverBackground(tertiaryBgRaw, baseBg)
  if (!secondaryBg || !tertiaryBg) {
    addIssue(`${SITE_THEME_VARS}: failed to resolve button background contrast budget colors`)
    return
  }

  const separation = rgbDistance(secondaryBg, tertiaryBg)
  if (separation == null || separation < SITE_BUTTON_BUDGET.minVisualSeparation) {
    const actual = separation == null ? 'n/a' : Number(separation).toFixed(2)
    addIssue(
      `${SITE_THEME_VARS}: button background separation is ${actual}, below ${SITE_BUTTON_BUDGET.minVisualSeparation.toFixed(2)}`
    )
  }

  const secondaryTextRatio = contrastRatio(secondaryText, secondaryBg)
  if (secondaryTextRatio == null || secondaryTextRatio < SITE_BUTTON_BUDGET.secondaryTextMinRatio) {
    const actual = secondaryTextRatio == null ? 'n/a' : fixed(secondaryTextRatio)
    addIssue(
      `${SITE_THEME_VARS}: secondary button text contrast is ${actual}, below ${fixed(SITE_BUTTON_BUDGET.secondaryTextMinRatio)}`
    )
  }

  const tertiaryTextRatio = contrastRatio(tertiaryText, tertiaryBg)
  if (tertiaryTextRatio == null || tertiaryTextRatio < SITE_BUTTON_BUDGET.tertiaryTextMinRatio) {
    const actual = tertiaryTextRatio == null ? 'n/a' : fixed(tertiaryTextRatio)
    addIssue(
      `${SITE_THEME_VARS}: tertiary button text contrast is ${actual}, below ${fixed(SITE_BUTTON_BUDGET.tertiaryTextMinRatio)}`
    )
  }
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractFirstNumber(value) {
  if (typeof value !== 'string') return null
  const match = value.match(/\d+/)
  if (!match) return null
  return Number(match[0])
}

function variantToPreviewSlug(variantId) {
  if (variantId === 'darkSoft') return 'dark-soft'
  if (variantId === 'lightSoft') return 'light-soft'
  return variantId
}

function variantToProofTitleKeySuffix(variantId) {
  if (variantId === 'darkSoft') return 'soft'
  return variantId
}

function extractBraceBlock(text, marker, fromIndex = 0) {
  const markerIndex = text.indexOf(marker, fromIndex)
  if (markerIndex < 0) return null
  const openIndex = text.indexOf('{', markerIndex + marker.length)
  if (openIndex < 0) return null

  let depth = 0
  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i]
    if (ch === '{') depth += 1
    if (ch === '}') {
      depth -= 1
      if (depth === 0) {
        return {
          start: openIndex,
          end: i,
          body: text.slice(openIndex + 1, i),
        }
      }
    }
  }

  return null
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

function validateSiteParameterClaims() {
  const variantCount = VARIANT_SPEC.variants.length
  const liveSurfaceCount = LIVE_SURFACE_IDS.length
  const proofSection = readText(PROOF_SECTION_COMPONENT)
  const baselineDocsComponent = readText(BASELINE_DOCS_COMPONENT)

  const requiredVariantProofEntries = VARIANT_SPEC.variants.map((variant) => {
    const keySuffix = variantToProofTitleKeySuffix(variant.id)
    return {
      variantId: variant.id,
      previewPath: `/previews/preview-${variantToPreviewSlug(variant.id)}.png`,
      titleKey: `proof.variant.${keySuffix}.title`,
      bodyKey: `proof.variant.${keySuffix}.body`,
      guideTitleKey: `proof.guide.${variant.id}.title`,
      guideBodyKey: `proof.guide.${variant.id}.body`,
    }
  })

  if (proofSection) {
    for (const entry of requiredVariantProofEntries) {
      if (!proofSection.includes(entry.previewPath)) {
        addIssue(`${PROOF_SECTION_COMPONENT}: missing preview asset "${entry.previewPath}" for variant "${entry.variantId}"`)
      }
      if (!proofSection.includes(`"${entry.titleKey}"`)) {
        addIssue(`${PROOF_SECTION_COMPONENT}: missing title key "${entry.titleKey}" for variant "${entry.variantId}"`)
      }
      if (!proofSection.includes(`"${entry.bodyKey}"`)) {
        addIssue(`${PROOF_SECTION_COMPONENT}: missing body key "${entry.bodyKey}" for variant "${entry.variantId}"`)
      }
      if (!proofSection.includes(`"${entry.guideTitleKey}"`)) {
        addIssue(`${PROOF_SECTION_COMPONENT}: missing guide title key "${entry.guideTitleKey}" for variant "${entry.variantId}"`)
      }
      if (!proofSection.includes(`"${entry.guideBodyKey}"`)) {
        addIssue(`${PROOF_SECTION_COMPONENT}: missing guide body key "${entry.guideBodyKey}" for variant "${entry.variantId}"`)
      }
    }
  }

  if (baselineDocsComponent) {
    const enBlock = extractBraceBlock(baselineDocsComponent, 'en:')
    const enRolesBlock = enBlock ? extractBraceBlock(enBlock.body, 'roles:') : null
    if (!enRolesBlock) {
      addIssue(`${BASELINE_DOCS_COMPONENT}: unable to locate copy.en.roles block for semantic narrative contract`)
    }

    for (const row of SITE_DOCS_PROFILE.semanticRows) {
      if (!baselineDocsComponent.includes(`role: "${row.id}"`)) {
        addIssue(`${BASELINE_DOCS_COMPONENT}: semantic row "${row.id}" missing from matrix data`)
      }

      if (enRolesBlock) {
        const rowPattern = new RegExp(`\\b${escapeRegExp(row.id)}\\s*:\\s*"([^"]+)"`)
        const rowMatch = enRolesBlock.body.match(rowPattern)
        if (!rowMatch) {
          addIssue(`${BASELINE_DOCS_COMPONENT}: copy.en.roles is missing "${row.id}"`)
          continue
        }
        const actual = String(rowMatch[1]).trim()
        if (actual !== row.note) {
          addIssue(`${BASELINE_DOCS_COMPONENT}: copy.en.roles["${row.id}"] expected "${row.note}", got "${actual}"`)
        }
      }
    }
  }

  for (const [lang, file] of Object.entries(I18N_FILES)) {
    const dict = readJson(file)
    if (!dict) continue

    const variantMetric = dict['proof.metric.2.value']
    const variantMetricCount = extractFirstNumber(variantMetric)
    if (variantMetricCount == null) {
      addIssue(`${file}: "proof.metric.2.value" must include variant count`)
    } else if (variantMetricCount !== variantCount) {
      addIssue(`${file}: "proof.metric.2.value" expected ${variantCount}, got ${variantMetricCount}`)
    }

    const surfaceMetric = dict['proof.metric.3.value']
    const surfaceMetricCount = extractFirstNumber(surfaceMetric)
    if (surfaceMetricCount == null) {
      addIssue(`${file}: "proof.metric.3.value" must include live surface count`)
    } else if (surfaceMetricCount !== liveSurfaceCount) {
      addIssue(`${file}: "proof.metric.3.value" expected ${liveSurfaceCount}, got ${surfaceMetricCount}`)
    }

    const finalMetaSecondary = dict['final.meta.secondary']
    if (typeof finalMetaSecondary !== 'string' || finalMetaSecondary.trim().length === 0) {
      addIssue(`${file}: missing "final.meta.secondary"`)
    } else {
      const numbers = [...finalMetaSecondary.matchAll(/\d+/g)].map((match) => Number(match[0]))
      if (numbers.length < 3) {
        addIssue(`${file}: "final.meta.secondary" must include system/variant/surface counts`)
      } else {
        const [systemCount, variantMetaCount, surfaceMetaCount] = numbers
        if (systemCount !== 1 || variantMetaCount !== variantCount || surfaceMetaCount !== liveSurfaceCount) {
          addIssue(
            `${file}: "final.meta.secondary" expected counts 1/${variantCount}/${liveSurfaceCount}, got ${systemCount}/${variantMetaCount}/${surfaceMetaCount}`
          )
        }
      }
    }
  }
}

function validateCodePreviewSourceOfTruth() {
  const codePreview = readText(CODE_PREVIEW_COMPONENT)
  if (!codePreview) return

  const requiredThemeRefs = [
    '../../../themes/hearth-dark.json',
    '../../../themes/hearth-dark-soft.json',
    '../../../themes/hearth-light.json',
    '../../../themes/hearth-light-soft.json',
  ]

  for (const ref of requiredThemeRefs) {
    if (!codePreview.includes(ref)) {
      addIssue(`${CODE_PREVIEW_COMPONENT}: missing real theme source reference "${ref}"`)
    }
  }

  if (!codePreview.includes("readFileSync(new URL(")) {
    addIssue(`${CODE_PREVIEW_COMPONENT}: should load theme JSON via readFileSync + URL source path`)
  }

  if (codePreview.includes("import { tokens } from '../../data/tokens'")) {
    addIssue(`${CODE_PREVIEW_COMPONENT}: should not use generated token snapshot as preview theme source`)
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

function normalizeRepoPath(path) {
  if (typeof path !== 'string') return null
  return path.replace(/\\/g, '/').replace(/^\.\//, '')
}

function collectMarkdownImagePaths(text) {
  if (typeof text !== 'string') return []
  return [...text.matchAll(/!\[[^\]]*]\(([^)]+)\)/g)].map((match) => String(match[1]).trim())
}

function validateReadmePreviewAssets() {
  const manifest = readJson(PREVIEW_MANIFEST)
  if (!manifest) return

  const contrastOutput = normalizeRepoPath(manifest.contrastImage?.outputs?.[0])

  if (!contrastOutput) {
    addIssue(`${PREVIEW_MANIFEST}: missing primary contrast preview output`)
    return
  }

  const expectedRootPreviewPaths = [`./${contrastOutput}`]
  const expectedExtensionPreviewPaths = [
    contrastOutput.startsWith('extension/')
      ? contrastOutput.slice('extension/'.length)
      : contrastOutput,
  ]

  const expectedReadmes = [
    {
      file: README_EN,
      note: 'The preview in this README is rendered from the shipped theme files, so the installed theme matches the visual language shown here.',
      previewPaths: expectedRootPreviewPaths,
    },
    {
      file: README_ZH,
      note: '本 README 中的预览图直接由随包发布的主题文件生成，因此安装后的主题会与这里展示的视觉语言保持一致。',
      previewPaths: expectedRootPreviewPaths,
    },
    {
      file: README_JA,
      note: 'この README のプレビュー画像は同梱されるテーマファイルから直接生成されるため、インストール後のテーマ体験はここで見える色設計と一致します。',
      previewPaths: expectedRootPreviewPaths,
    },
    {
      file: EXTENSION_README,
      note: 'The preview in this README is rendered from the shipped theme files, so the installed theme matches the visual language shown here.',
      previewPaths: expectedExtensionPreviewPaths,
    },
  ]

  for (const spec of expectedReadmes) {
    const readme = readText(spec.file)
    if (!readme) continue

    if (!readme.includes(spec.note)) {
      addIssue(`${spec.file}: missing preview/source-of-truth note`)
    }

    const previewPaths = collectMarkdownImagePaths(readme).filter((path) => /preview-.*\.png$/i.test(path))
    if (previewPaths.length !== spec.previewPaths.length) {
      addIssue(
        `${spec.file}: expected ${spec.previewPaths.length} generated preview images, got ${previewPaths.length}`
      )
      continue
    }

    for (let i = 0; i < spec.previewPaths.length; i += 1) {
      const actual = previewPaths[i]
      const expected = spec.previewPaths[i]
      if (actual !== expected) {
        addIssue(`${spec.file}: preview image ${i + 1} expected "${expected}", got "${actual}"`)
      }
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
  const siteVars = parseSiteThemeVars(varsText)
  validateSiteContrastBudget(siteVars)

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

function validateWarmAnchorContract(tokens) {
  const roleSignalProfile = COLOR_SYSTEM_TUNING.roleSignalProfile || {}
  const coolHueByVariant = roleSignalProfile.coolHueBandByVariant || {}
  const warmHueByVariant = roleSignalProfile.warmHueBandByVariant || {}
  const warmGamutGuard = roleSignalProfile.warmGamutGuard || null

  for (const [variantId, roleBands] of Object.entries(coolHueByVariant)) {
    if (Object.keys(roleBands || {}).length > 0) {
      addIssue(`color-system/tuning.json: roleSignalProfile.coolHueBandByVariant must be empty in warm-only mode (found entries in "${variantId}")`)
    }
  }

  const siteMapping = COLOR_SYSTEM_TUNING.siteAssetMapping || {}
  const siteGroups = siteMapping.groups || {}
  const siteDerived = siteMapping.derivedColors || {}
  const hitPaths = []
  const walkSite = (node, path = []) => {
    if (typeof node === 'string') {
      if (node.includes('@coolAnchor')) hitPaths.push(path.join('.'))
      return
    }
    if (Array.isArray(node)) {
      node.forEach((item, index) => walkSite(item, [...path, String(index)]))
      return
    }
    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        walkSite(value, [...path, key])
      }
    }
  }
  walkSite(siteDerived, ['siteAssetMapping', 'derivedColors'])
  walkSite(siteGroups, ['siteAssetMapping', 'groups'])
  for (const hit of hitPaths) {
    addIssue(`color-system/tuning.json: site mapping must not reference @coolAnchor (${hit})`)
  }

  const variantToTokenSet = {
    dark: tokens.dark,
    darkSoft: tokens.darkSoft,
    light: tokens.light,
    lightSoft: tokens.lightSoft,
  }
  const roleTokenKey = {
    comment: 'comment',
    keyword: 'keyword',
    operator: 'operator',
    function: 'fn',
    method: 'method',
    property: 'property',
    string: 'string',
    number: 'number',
    type: 'type',
    variable: 'variable',
  }

  for (const [variantId, tokenSet] of Object.entries(variantToTokenSet)) {
    if (!tokenSet) continue
    const warmBandRoleProfile = resolveVariantRoleProfile(warmHueByVariant, variantId)
    if (Object.keys(warmBandRoleProfile).length === 0) {
      addIssue(`color-system/tuning.json: roleSignalProfile.warmHueBandByVariant missing profile for variant "${variantId}"`)
      continue
    }
    for (const roleId of Object.keys(roleTokenKey)) {
      if (!warmBandRoleProfile[roleId]) {
        addIssue(`color-system/tuning.json: roleSignalProfile.warmHueBandByVariant missing "${roleId}" for variant "${variantId}"`)
      }
    }
  }

  if (!warmGamutGuard) {
    addIssue('color-system/tuning.json: roleSignalProfile.warmGamutGuard is required in warm-only mode')
    return
  }

  const guardedRoles = new Set(Array.isArray(warmGamutGuard.roles) ? warmGamutGuard.roles : [])
  if (guardedRoles.size === 0) {
    addIssue('color-system/tuning.json: roleSignalProfile.warmGamutGuard.roles must declare at least one guarded role')
    return
  }

  for (const [variantId, tokenSet] of Object.entries(variantToTokenSet)) {
    if (!tokenSet) continue
    for (const [roleId, tokenKey] of Object.entries(roleTokenKey)) {
      if (!guardedRoles.has(roleId)) continue
      const color = normalizeHex(tokenSet[tokenKey])
      if (!color) continue
      const rgb = hexToRgb(color)
      if (!rgb) continue
      const { h, s } = rgbToHsl(rgb)
      if (s >= (warmGamutGuard.minSaturation ?? 0) && hueInBand(h, warmGamutGuard.forbiddenHueMin, warmGamutGuard.forbiddenHueMax)) {
        addIssue(
          `${DOCS_BASELINE}: role "${roleId}" in "${variantId}" entered forbidden cool gamut ${warmGamutGuard.forbiddenHueMin}-${warmGamutGuard.forbiddenHueMax} (${color})`
        )
      }
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

function validateReadabilityBudgetContract() {
  const docs = readText(DOCS_BASELINE)
  const baselineDocsComponent = readText(BASELINE_DOCS_COMPONENT)
  const themeAuditScript = readText(THEME_AUDIT_SCRIPT)
  if (!docs || !baselineDocsComponent || !themeAuditScript) return

  const minTextContrast = parseNumericConst(themeAuditScript, 'MIN_TEXT_CONTRAST')
  const commentMin = parseNumericConst(themeAuditScript, 'COMMENT_CONTRAST_MIN')
  const commentMax = parseNumericConst(themeAuditScript, 'COMMENT_CONTRAST_MAX')
  const operatorMin = parseNumericConst(themeAuditScript, 'OPERATOR_CONTRAST_MIN')
  const operatorMax = parseNumericConst(themeAuditScript, 'OPERATOR_CONTRAST_MAX')
  const minRoleDeltaE = parseNumericConst(themeAuditScript, 'MIN_ROLE_DELTA_E')
  const maxRoleHueDrift = parseNumericConst(themeAuditScript, 'MAX_ROLE_HUE_DRIFT')
  if (!minTextContrast || !commentMin || !commentMax || !operatorMin || !operatorMax || !minRoleDeltaE || !maxRoleHueDrift) return

  const operatorCommentProfile = COLOR_SYSTEM_TUNING.pairSeparationGates?.operatorCommentDeltaE || {}
  const methodPropertyProfile = COLOR_SYSTEM_TUNING.pairSeparationGates?.methodPropertyDeltaE || {}
  const lightFunctionProfile = COLOR_SYSTEM_TUNING.lightPolarityRoleOptimization?.light?.function || {}
  const roleSignalProfile = COLOR_SYSTEM_TUNING.roleSignalProfile || {}
  const warmGamutGuard = roleSignalProfile.warmGamutGuard || null
  const warmExposureProfile = roleSignalProfile.warmExposureProfile || null
  const nearForegroundByVariant = roleSignalProfile.nearForegroundDeltaEByVariant || {}
  const criticalPairsByVariant = roleSignalProfile.criticalPairDeltaEByVariant || {}

  const operatorCommentDefault = resolvePairGateThreshold(operatorCommentProfile, 'dark', 4.5)
  const operatorCommentLight = resolvePairGateThreshold(operatorCommentProfile, 'light', operatorCommentDefault)
  const operatorCommentLightSoft = resolvePairGateThreshold(operatorCommentProfile, 'lightSoft', operatorCommentDefault)
  const methodPropertyThreshold = resolvePairGateThreshold(methodPropertyProfile, 'dark', 10)
  const lightFunctionBgHueDistance = typeof lightFunctionProfile.minBgHueDistance === 'number'
    ? lightFunctionProfile.minBgHueDistance
    : 60
  const lightFunctionAnchorDeltaE = typeof lightFunctionProfile.minAnchorDeltaE === 'number'
    ? lightFunctionProfile.minAnchorDeltaE
    : 22
  const variableNearFgDark = resolveVariantRoleProfile(nearForegroundByVariant, 'dark').variable || { minDeltaE: 3, maxDeltaE: 12 }
  const variableNearFgDarkSoft = resolveVariantRoleProfile(nearForegroundByVariant, 'darkSoft').variable || { minDeltaE: 3, maxDeltaE: 12 }
  const variableNearFgLight = resolveVariantRoleProfile(nearForegroundByVariant, 'light').variable || { minDeltaE: 6, maxDeltaE: 22 }
  const variableNearFgLightSoft = resolveVariantRoleProfile(nearForegroundByVariant, 'lightSoft').variable || { minDeltaE: 5, maxDeltaE: 14 }
  const functionKeywordDeltaE = resolveCriticalPairThreshold(criticalPairsByVariant, 'dark', 'function->keyword', 18)
  const functionNumberDeltaE = resolveCriticalPairThreshold(criticalPairsByVariant, 'dark', 'function->number', 14)
  const functionTagDeltaE = resolveCriticalPairThreshold(criticalPairsByVariant, 'dark', 'function->tag', 18)
  const functionVariableDeltaE = resolveCriticalPairThreshold(criticalPairsByVariant, 'dark', 'function->variable', 14)
  const functionMethodDeltaE = resolveCriticalPairThreshold(criticalPairsByVariant, 'dark', 'function->method', Number.NaN)
  const methodVariableDeltaE = resolveCriticalPairThreshold(criticalPairsByVariant, 'dark', 'method->variable', 12)
  const propertyOperatorDeltaE = resolveCriticalPairThreshold(criticalPairsByVariant, 'dark', 'property->operator', Number.NaN)
  const typeVariableDeltaE = resolveCriticalPairThreshold(criticalPairsByVariant, 'dark', 'type->variable', Number.NaN)
  const typeOperatorDeltaE = resolveCriticalPairThreshold(criticalPairsByVariant, 'dark', 'type->operator', Number.NaN)
  const lightKeywordTagDeltaE = resolveCriticalPairThreshold(criticalPairsByVariant, 'light', 'keyword->tag', Number.NaN)
  const lightCommentTypeDeltaE = resolveCriticalPairThreshold(criticalPairsByVariant, 'light', 'comment->type', Number.NaN)
  const lightPropertyStringDeltaE = resolveCriticalPairThreshold(criticalPairsByVariant, 'light', 'property->string', Number.NaN)
  const lightMethodVariableDeltaE = resolveCriticalPairThreshold(criticalPairsByVariant, 'light', 'method->variable', Number.NaN)
  const lightSoftKeywordTagDeltaE = resolveCriticalPairThreshold(criticalPairsByVariant, 'lightSoft', 'keyword->tag', Number.NaN)
  const lightSoftCommentTypeDeltaE = resolveCriticalPairThreshold(criticalPairsByVariant, 'lightSoft', 'comment->type', Number.NaN)
  const lightSoftPropertyStringDeltaE = resolveCriticalPairThreshold(criticalPairsByVariant, 'lightSoft', 'property->string', Number.NaN)
  const lightSoftMethodVariableDeltaE = resolveCriticalPairThreshold(criticalPairsByVariant, 'lightSoft', 'method->variable', Number.NaN)

  const warmGuardDoc = warmGamutGuard
    ? `forbid ${formatDocNumber(warmGamutGuard.forbiddenHueMin)}-${formatDocNumber(warmGamutGuard.forbiddenHueMax)} deg (s>=${formatDocNumber(warmGamutGuard.minSaturation)})`
    : 'forbid 170-250 deg (s>=0.08)'
  const warmExposureLanguages = warmExposureProfile
    ? Object.keys(warmExposureProfile.languageMixWeights || {}).join('/')
    : 'TS/Py/Go/Rust/JSON/MD'
  const warmExposureDoc = `frequency-damped chroma + saliency boost (${warmExposureLanguages})`
  const lightKeyPairsDoc = `keyword/tag>=${formatDocNumber(lightKeywordTagDeltaE)}, comment/type>=${formatDocNumber(lightCommentTypeDeltaE)}, property/string>=${formatDocNumber(lightPropertyStringDeltaE)}, method/variable>=${formatDocNumber(lightMethodVariableDeltaE)}`
  const lightSoftKeyPairsDoc = `keyword/tag>=${formatDocNumber(lightSoftKeywordTagDeltaE)}, comment/type>=${formatDocNumber(lightSoftCommentTypeDeltaE)}, property/string>=${formatDocNumber(lightSoftPropertyStringDeltaE)}, method/variable>=${formatDocNumber(lightSoftMethodVariableDeltaE)}`
  const variableNearFgDoc = `dark ${formatDocNumber(variableNearFgDark.minDeltaE)}-${formatDocNumber(variableNearFgDark.maxDeltaE)}, darkSoft ${formatDocNumber(variableNearFgDarkSoft.minDeltaE)}-${formatDocNumber(variableNearFgDarkSoft.maxDeltaE)}, light ${formatDocNumber(variableNearFgLight.minDeltaE)}-${formatDocNumber(variableNearFgLight.maxDeltaE)}, lightSoft ${formatDocNumber(variableNearFgLightSoft.minDeltaE)}-${formatDocNumber(variableNearFgLightSoft.maxDeltaE)}`
  const functionCriticalParts = [
    `keyword>=${formatDocNumber(functionKeywordDeltaE)}`,
    `number>=${formatDocNumber(functionNumberDeltaE)}`,
    `tag>=${formatDocNumber(functionTagDeltaE)}`,
    `variable>=${formatDocNumber(functionVariableDeltaE)}`,
  ]
  if (Number.isFinite(functionMethodDeltaE)) {
    functionCriticalParts.push(`method>=${formatDocNumber(functionMethodDeltaE)}`)
  }
  const functionCriticalDoc = functionCriticalParts.join(', ')
  const methodCriticalDoc = `variable>=${formatDocNumber(methodVariableDeltaE)}`
  const propertyCriticalDoc = Number.isFinite(propertyOperatorDeltaE)
    ? `operator>=${formatDocNumber(propertyOperatorDeltaE)}`
    : null
  const typeCriticalParts = []
  if (Number.isFinite(typeVariableDeltaE)) {
    typeCriticalParts.push(`variable>=${formatDocNumber(typeVariableDeltaE)}`)
  }
  if (Number.isFinite(typeOperatorDeltaE)) {
    typeCriticalParts.push(`operator>=${formatDocNumber(typeOperatorDeltaE)}`)
  }
  const typeCriticalDoc = typeCriticalParts.length > 0 ? typeCriticalParts.join(', ') : null

  const expectedBaselineRows = [
    `| editor fg/bg contrast | \`>= ${minTextContrast.raw}\` |`,
    `| comment contrast window | \`${commentMin.raw} - ${commentMax.raw}\` |`,
    `| operator contrast window | \`${operatorMin.raw} - ${operatorMax.raw}\` |`,
    `| minimum role separation (\`deltaE\`) | \`>= ${formatDocNumber(minRoleDeltaE.value)}\` |`,
    `| method/property critical separation (\`deltaE\`) | \`>= ${formatDocNumber(methodPropertyThreshold)}\` |`,
    `| cross-theme role hue drift (comment/keyword/operator/string/number/type/variable/method/property) | \`<= ${formatDocNumber(maxRoleHueDrift.value)} deg\` |`,
    `| light function/background hue distance | \`>= ${formatDocNumber(lightFunctionBgHueDistance)} deg\` |`,
    `| light function anchor separation (\`deltaE\` vs keyword/number/tag) | \`>= ${formatDocNumber(lightFunctionAnchorDeltaE)}\` |`,
    `| warm gamut guard | \`${warmGuardDoc}\` |`,
    `| red/yellow exposure balance | \`${warmExposureDoc}\` |`,
    `| light key pair separation (\`deltaE\`) | \`${lightKeyPairsDoc}\` |`,
    `| light soft key pair separation (\`deltaE\`) | \`${lightSoftKeyPairsDoc}\` |`,
    `| variable/parameter near-foreground deltaE | \`${variableNearFgDoc}\` |`,
    `| function critical separation deltaE | \`${functionCriticalDoc}\` |`,
    `| method critical separation deltaE | \`${methodCriticalDoc}\` |`,
  ]
  if (propertyCriticalDoc) {
    expectedBaselineRows.push(`| property critical separation deltaE | \`${propertyCriticalDoc}\` |`)
  }
  if (typeCriticalDoc) {
    expectedBaselineRows.push(`| type critical separation deltaE | \`${typeCriticalDoc}\` |`)
  }

  for (const expectedRow of expectedBaselineRows) {
    if (!docs.includes(expectedRow)) {
      addIssue(`${DOCS_BASELINE}: readability budget row out of sync -> ${expectedRow}`)
    }
  }

  const operatorCommentRow = `| operator/comment critical separation (\`deltaE\`) | \`>= ${formatDocNumber(operatorCommentDefault, { forceOneDecimal: true })}\` (\`light\`/\`lightSoft\` use \`>= ${formatDocNumber(operatorCommentLight, { forceOneDecimal: true })}\`) |`
  if (!docs.includes(operatorCommentRow)) {
    addIssue(`${DOCS_BASELINE}: operator/comment budget row is out of sync`)
  }
  if (Math.abs(operatorCommentLight - operatorCommentLightSoft) > 1e-9) {
    addIssue(
      `${DOCS_BASELINE}: expects light and lightSoft to share operator/comment threshold, got ${operatorCommentLight} vs ${operatorCommentLightSoft}`
    )
  }

  const expectedUiBudgetRows = [
    ['Editor fg/bg contrast', `>= ${minTextContrast.raw}`],
    ['Comment contrast', `${commentMin.raw} - ${commentMax.raw}`],
    ['Operator contrast', `${operatorMin.raw} - ${operatorMax.raw}`],
    ['Role separation deltaE', `>= ${formatDocNumber(minRoleDeltaE.value)}`],
    ['Method/property separation deltaE', `>= ${formatDocNumber(methodPropertyThreshold)}`],
    ['Operator/comment separation deltaE', `>= ${formatDocNumber(operatorCommentDefault, { forceOneDecimal: true })} (light & light soft >= ${formatDocNumber(operatorCommentLight, { forceOneDecimal: true })})`],
    ['Cross-theme hue drift', `<= ${formatDocNumber(maxRoleHueDrift.value)}°`],
    ['Warm gamut guard', warmGuardDoc],
    ['Red/yellow exposure balance', warmExposureDoc],
    ['Light key pair separation deltaE', lightKeyPairsDoc],
    ['Light soft key pair separation deltaE', lightSoftKeyPairsDoc],
    ['Variable/parameter near-foreground deltaE', variableNearFgDoc],
    ['Function critical separation deltaE', functionCriticalDoc],
    ['Method critical separation deltaE', methodCriticalDoc],
  ]
  if (propertyCriticalDoc) {
    expectedUiBudgetRows.push(['Property critical separation deltaE', propertyCriticalDoc])
  }
  if (typeCriticalDoc) {
    expectedUiBudgetRows.push(['Type critical separation deltaE', typeCriticalDoc])
  }

  for (const [metric, target] of expectedUiBudgetRows) {
    const rowPattern = new RegExp(`\\{\\s*metric:\\s*"${escapeRegExp(metric)}"\\s*,\\s*target:\\s*"([^"]+)"\\s*\\}`)
    const match = baselineDocsComponent.match(rowPattern)
    if (!match) {
      addIssue(`${BASELINE_DOCS_COMPONENT}: missing budget row "${metric}"`)
      continue
    }
    const actualTarget = String(match[1]).trim()
    if (actualTarget !== target) {
      addIssue(`${BASELINE_DOCS_COMPONENT}: budget row "${metric}" expected "${target}", got "${actualTarget}"`)
    }
  }
}

function validateNoHardcodedColorLiterals() {
  const colorLiteral = /#[0-9a-fA-F]{3,8}\b|(?<![a-zA-Z0-9])(?:rgb|rgba|hsl|hsla)\(/g
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
  validateSiteParameterClaims()
  validateCodePreviewSourceOfTruth()
  validateExtensionReadmeSnapshot()
  validateReadmePreviewAssets()
  validateThemeVarsAndMetadata(themes)
  const tokenSetsReady = Object.entries(tokenSets).every(([, set]) => (
    set && Object.values(set).every(Boolean)
  ))
  if (tokenSetsReady) {
    validateDocsBaseline(tokenSets)
    validateWarmAnchorContract(tokenSets)
  } else {
    addIssue('theme token extraction failed while validating docs baseline')
  }
  validateReadabilityBudgetContract()
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
