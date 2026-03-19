import { existsSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

const THEME_FILES = [
  { id: 'dark', path: 'themes/hearth-dark.json', type: 'dark' },
  { id: 'darkSoft', path: 'themes/hearth-dark-soft.json', type: 'dark' },
  { id: 'light', path: 'themes/hearth-light.json', type: 'light' },
]

const REQUIRED_UI_KEYS = [
  'editor.background',
  'editor.foreground',
  'editor.lineHighlightBackground',
  'editor.selectionBackground',
  'editorCursor.foreground',
  'editorLineNumber.foreground',
  'sideBar.background',
  'sideBar.border',
  'statusBar.background',
  'statusBar.foreground',
  'tab.activeBackground',
  'tab.activeForeground',
  'panel.background',
  'panel.border',
  'focusBorder',
  'list.activeSelectionBackground',
  'list.activeSelectionForeground',
  'editorBracketHighlight.foreground1',
]

const ROLE_SCOPES = {
  comment: ['comment', 'punctuation.definition.comment'],
  keyword: ['keyword', 'keyword.control'],
  operator: ['keyword.operator', 'keyword.operator.assignment'],
  function: ['entity.name.function', 'support.function'],
  string: ['string', 'string.quoted', 'string.template'],
  number: ['constant.numeric'],
  type: ['entity.name.type', 'entity.name.class', 'support.type'],
  variable: ['variable', 'variable.other.readwrite'],
  property: ['variable.other.property', 'support.type.property-name'],
}

const SEMANTIC_ROLE_KEYS = {
  keyword: 'keyword',
  function: 'function',
  number: 'enumMember',
  type: 'type',
  variable: 'variable',
  property: 'property',
}

const FIXTURE_DIR = 'fixtures/theme-audit'
const REQUIRED_FIXTURES = [
  'sample.ts',
  'sample.py',
  'sample.rs',
  'sample.go',
  'sample.json',
  'sample.md',
]

const MIN_TEXT_CONTRAST = 7.0
const COMMENT_CONTRAST_MIN = 2.2
const COMMENT_CONTRAST_MAX = 4.2
const OPERATOR_CONTRAST_MIN = 2.8
const OPERATOR_CONTRAST_MAX = 6.2
const MIN_ROLE_DELTA_E = 10
const MAX_ROLE_HUE_DRIFT = 45

const issues = []
const warnings = []
const notes = []

function addIssue(message) {
  issues.push(message)
}

function addWarning(message) {
  warnings.push(message)
}

function addNote(message) {
  notes.push(message)
}

function readJson(path) {
  try {
    const text = readFileSync(path, 'utf8')
    return JSON.parse(text)
  } catch (error) {
    addIssue(`${path}: failed to parse JSON (${error.message})`)
    return null
  }
}

function toScopes(entry) {
  if (!entry?.scope) return []
  return Array.isArray(entry.scope) ? entry.scope : [entry.scope]
}

function getTokenColor(theme, scopes) {
  for (const entry of theme.tokenColors || []) {
    const entryScopes = toScopes(entry)
    const hit = scopes.some((scope) => entryScopes.includes(scope))
    if (hit && entry.settings?.foreground) {
      return normalizeHex(entry.settings.foreground)
    }
  }
  return null
}

function getSemanticColor(theme, semanticKey) {
  const value = theme.semanticTokenColors?.[semanticKey]
  if (!value) return null
  if (typeof value === 'string') return normalizeHex(value)
  if (typeof value === 'object' && value.foreground) return normalizeHex(value.foreground)
  return null
}

function normalizeHex(hex) {
  if (typeof hex !== 'string') return null
  const value = hex.trim().toLowerCase()
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
    rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750,
    rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041,
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

function fixed(n) {
  return Number(n).toFixed(1)
}

function validateFixtures() {
  if (!existsSync(FIXTURE_DIR)) {
    addIssue(`${FIXTURE_DIR}: missing fixture directory`)
    return
  }

  for (const file of REQUIRED_FIXTURES) {
    const path = join(FIXTURE_DIR, file)
    if (!existsSync(path)) {
      addIssue(`${path}: missing fixture file`)
      continue
    }
    if (statSync(path).size < 32) {
      addWarning(`${path}: fixture is unusually small`)
    }
  }
}

function validateThemeStructure(themeMeta, theme) {
  if (!theme) return

  if (theme.type !== themeMeta.type) {
    addIssue(`${themeMeta.path}: expected type "${themeMeta.type}", got "${theme.type}"`)
  }

  if (!Array.isArray(theme.tokenColors) || theme.tokenColors.length === 0) {
    addIssue(`${themeMeta.path}: tokenColors is empty or missing`)
  }

  if (!theme.semanticTokenColors || typeof theme.semanticTokenColors !== 'object') {
    addIssue(`${themeMeta.path}: semanticTokenColors is missing`)
  }

  for (const key of REQUIRED_UI_KEYS) {
    const value = normalizeHex(theme.colors?.[key])
    if (!value) addIssue(`${themeMeta.path}: missing or invalid color "${key}"`)
  }

  for (const [role, scopes] of Object.entries(ROLE_SCOPES)) {
    const color = getTokenColor(theme, scopes)
    if (!color) addIssue(`${themeMeta.path}: missing token color coverage for role "${role}"`)
  }
}

function validateReadability(themeMeta, theme) {
  if (!theme) return

  const bg = normalizeHex(theme.colors?.['editor.background'])
  const fg = normalizeHex(theme.colors?.['editor.foreground'])
  const comment = getTokenColor(theme, ROLE_SCOPES.comment)
  const operator = getTokenColor(theme, ROLE_SCOPES.operator)

  if (!bg || !fg) return

  const fgContrast = contrastRatio(fg, bg)
  if (fgContrast < MIN_TEXT_CONTRAST) {
    addIssue(`${themeMeta.path}: editor fg/bg contrast ${fixed(fgContrast)} is below ${MIN_TEXT_CONTRAST}`)
  } else {
    addNote(`${themeMeta.id}: fg/bg contrast ${fixed(fgContrast)}`)
  }

  if (comment) {
    const ratio = contrastRatio(comment, bg)
    if (ratio < COMMENT_CONTRAST_MIN || ratio > COMMENT_CONTRAST_MAX) {
      addWarning(`${themeMeta.path}: comment contrast ${fixed(ratio)} outside target ${COMMENT_CONTRAST_MIN}-${COMMENT_CONTRAST_MAX}`)
    } else {
      addNote(`${themeMeta.id}: comment contrast ${fixed(ratio)}`)
    }
  }

  if (operator) {
    const ratio = contrastRatio(operator, bg)
    if (ratio < OPERATOR_CONTRAST_MIN || ratio > OPERATOR_CONTRAST_MAX) {
      addWarning(`${themeMeta.path}: operator contrast ${fixed(ratio)} outside target ${OPERATOR_CONTRAST_MIN}-${OPERATOR_CONTRAST_MAX}`)
    } else {
      addNote(`${themeMeta.id}: operator contrast ${fixed(ratio)}`)
    }
  }
}

function validateRoleSeparation(themeMeta, theme) {
  if (!theme) return

  const roles = ['keyword', 'function', 'string', 'number', 'type', 'variable', 'operator']
  const colors = Object.fromEntries(roles.map((role) => [role, getTokenColor(theme, ROLE_SCOPES[role])]))
  const missing = roles.filter((role) => !colors[role])
  if (missing.length > 0) return

  for (let i = 0; i < roles.length; i++) {
    for (let j = i + 1; j < roles.length; j++) {
      const a = roles[i]
      const b = roles[j]
      const dE = deltaE(colors[a], colors[b])
      if (dE < MIN_ROLE_DELTA_E) {
        addWarning(`${themeMeta.path}: "${a}" vs "${b}" deltaE ${fixed(dE)} is low (<${MIN_ROLE_DELTA_E})`)
      }
    }
  }
}

function validateSemanticAlignment(themeMeta, theme) {
  if (!theme) return

  for (const [role, semanticKey] of Object.entries(SEMANTIC_ROLE_KEYS)) {
    const tokenColor = getTokenColor(theme, ROLE_SCOPES[role])
    const semanticColor = getSemanticColor(theme, semanticKey)
    if (!tokenColor || !semanticColor) {
      addIssue(`${themeMeta.path}: semantic/textmate missing for role "${role}"`)
      continue
    }
    const dE = deltaE(tokenColor, semanticColor)
    if (dE > 6) {
      addWarning(`${themeMeta.path}: semantic drift for "${role}" (deltaE ${fixed(dE)})`)
    }
  }
}

function validateCrossThemeDrift(darkTheme, lightTheme) {
  if (!darkTheme || !lightTheme) return

  const roles = ['comment', 'keyword', 'operator', 'function', 'string', 'number', 'type', 'variable']
  for (const role of roles) {
    const darkColor = getTokenColor(darkTheme, ROLE_SCOPES[role])
    const lightColor = getTokenColor(lightTheme, ROLE_SCOPES[role])
    if (!darkColor || !lightColor) continue

    const dh = rgbToHsl(darkColor)
    const lh = rgbToHsl(lightColor)
    if (!dh || !lh) continue

    const lowSat = dh.s < 0.08 && lh.s < 0.08
    if (lowSat) continue

    const drift = hueDiff(dh.h, lh.h)
    if (drift > MAX_ROLE_HUE_DRIFT) {
      addWarning(`cross-theme: role "${role}" hue drift ${fixed(drift)} exceeds ${MAX_ROLE_HUE_DRIFT}`)
    }
  }
}

function run() {
  const themes = {}

  for (const themeMeta of THEME_FILES) {
    if (!existsSync(themeMeta.path)) {
      addIssue(`${themeMeta.path}: file not found`)
      continue
    }
    const theme = readJson(themeMeta.path)
    themes[themeMeta.id] = theme
    validateThemeStructure(themeMeta, theme)
    validateReadability(themeMeta, theme)
    validateRoleSeparation(themeMeta, theme)
    validateSemanticAlignment(themeMeta, theme)
  }

  validateCrossThemeDrift(themes.dark, themes.light)
  validateFixtures()

  if (issues.length > 0) {
    console.log('[FAIL] Theme audit found blocking issues:')
    for (const issue of issues) console.log(`  - ${issue}`)
  } else {
    console.log('[PASS] No blocking theme issues found.')
  }

  if (warnings.length > 0) {
    console.log('\n[WARN] Follow-up improvements:')
    for (const warning of warnings) console.log(`  - ${warning}`)
  }

  if (notes.length > 0) {
    console.log('\n[INFO] Key metrics:')
    for (const note of notes) console.log(`  - ${note}`)
  }

  process.exit(issues.length > 0 ? 1 : 0)
}

run()
