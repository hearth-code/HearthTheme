import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildForgeThemes } from '../scripts/theme-engine/browser-worker.mjs'
import { contrastRatio, deltaE, hexToRgb, rgbToXyz, xyzToLab } from '../scripts/color-utils.mjs'
import { getExportedSiteTokenKeys, loadColorLanguageModelInputs } from '../scripts/color-system/build.mjs'
import {
  COLOR_SYSTEM_ACTIVE_SCHEME_DIR,
  COLOR_SYSTEM_SCHEME_ID,
  COLOR_SYSTEM_SEMANTIC_PATH,
  loadColorSchemeManifest,
  loadColorSystemTuning,
  loadColorSystemVariants,
  loadRoleAdapters,
  loadVscodeChromeContract,
} from '../scripts/color-system.mjs'

// Theme Forge recolors the FINISHED theme in LCH (one primary color turns the
// whole surface). These tests pin the properties that make that trustworthy:
// the default is untouched, the WHOLE syntax set moves (not just the accent),
// and Moss's harmony — role separation, lightness uniformity, chrome contrast —
// survives across the hue circle.

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const SHIPPED_DARK = 'extension/themes/moss-dark.json'

function buildSource() {
  return {
    inputs: loadColorLanguageModelInputs(),
    colorScheme: loadColorSchemeManifest(),
    variantSpec: loadColorSystemVariants(),
    roleDefs: loadRoleAdapters(),
    tuning: loadColorSystemTuning(),
    schemeId: COLOR_SYSTEM_SCHEME_ID,
    activeSchemeDir: COLOR_SYSTEM_ACTIVE_SCHEME_DIR,
    semanticPath: COLOR_SYSTEM_SEMANTIC_PATH,
    colorContract: readJson(`${COLOR_SYSTEM_ACTIVE_SCHEME_DIR}/color-contract.json`),
    vscodeChromeContract: loadVscodeChromeContract(),
    exportedSiteTokenKeys: getExportedSiteTokenKeys(),
  }
}

const readTheme = (result, type) =>
  JSON.parse(result.files.find((f) => JSON.parse(f.content).type === type).content)

function semanticForeground(theme, selector) {
  const value = theme.semanticTokenColors?.[selector]
  return typeof value === 'string' ? value : value?.foreground
}

function roleColor(theme, source, roleId) {
  const roleDef = source.roleDefs.find((role) => role.id === roleId)
  if (roleDef) {
    for (const key of roleDef.semanticKeys || []) {
      const color = semanticForeground(theme, key)
      if (color) return color
    }
    for (const entry of theme.tokenColors || []) {
      const scopes = Array.isArray(entry.scope) ? entry.scope : entry.scope ? [entry.scope] : []
      if (scopes.some((scope) => (roleDef.scopes || []).includes(scope))) return entry.settings?.foreground
    }
  }
  return semanticForeground(theme, roleId)
}

const lightnessOf = (hex) => xyzToLab(rgbToXyz(hexToRgb(hex)))[0]

// Chromatic syntax roles (the ones the even spread targets). Near-neutral roles
// (variable, namespace, comment) are intentionally kept low-chroma and similar.
const SYNTAX_ROLES = ['keyword', 'function', 'method', 'property', 'type', 'string', 'number']

// The sweep value is the primary hue: chrome tints by it and the syntax spread
// anchors keyword to it.
function transformFor(hue) {
  return { hueDelta: hue, chromaScale: 1, primaryHue: hue }
}

test('default (no transform) is byte-identical to the shipped theme', () => {
  const source = buildSource()
  const dark = readTheme(buildForgeThemes({ source }), 'dark')
  const shipped = readJson(SHIPPED_DARK)
  assert.deepEqual(dark.colors, shipped.colors)
  assert.deepEqual(dark.tokenColors, shipped.tokenColors)
  assert.deepEqual(dark.semanticTokenColors, shipped.semanticTokenColors)
})

test('a picked hue recolors the whole syntax surface, not just the accent', () => {
  const source = buildSource()
  const base = readTheme(buildForgeThemes({ source }), 'dark')
  const recolored = readTheme(buildForgeThemes({ source, transform: transformFor(220) }), 'dark')
  const moved = ['keyword', 'function', 'method', 'type', 'string', 'number'].filter(
    (role) => roleColor(base, source, role) !== roleColor(recolored, source, role),
  )
  assert.ok(moved.length >= 5, `expected most syntax roles to move, only: ${moved.join(', ')}`)
})

test('recolor preserves role separation across the hue circle (no crowding)', () => {
  const source = buildSource()
  for (const hue of [60, 150, 240, 330]) {
    const dark = readTheme(buildForgeThemes({ source, transform: transformFor(hue) }), 'dark')
    const colors = SYNTAX_ROLES.map((r) => roleColor(dark, source, r)).filter(Boolean)
    const unique = [...new Set(colors.map((c) => c.toLowerCase()))] // shared-by-design tones count once
    let min = Infinity
    for (let i = 0; i < unique.length; i += 1) {
      for (let j = i + 1; j < unique.length; j += 1) min = Math.min(min, deltaE(unique[i], unique[j]))
    }
    // Chromatic roles are spread to even hue slots, so separation is high and
    // consistent across the whole circle (worst ~9.9, matching shipped Moss).
    assert.ok(min >= 8, `crowded at hue ${hue}: min role ΔE ${min.toFixed(1)}`)
  }
})

test('recolor preserves lightness uniformity (hue turn keeps each L)', () => {
  const source = buildSource()
  const base = readTheme(buildForgeThemes({ source }), 'dark')
  const range = (theme) => {
    const ls = SYNTAX_ROLES.map((r) => roleColor(theme, source, r)).filter(Boolean).map(lightnessOf)
    return Math.max(...ls) - Math.min(...ls)
  }
  const baseRange = range(base)
  for (const hue of [60, 150, 240, 330]) {
    const dark = readTheme(buildForgeThemes({ source, transform: transformFor(hue) }), 'dark')
    // An equal hue turn preserves each color's CIE lightness, so the spread must
    // not widen beyond the shipped spread (a couple of units of rounding slack).
    assert.ok(range(dark) <= baseRange + 2, `lightness spread widened at hue ${hue}: ${range(dark).toFixed(1)} vs ${baseRange.toFixed(1)}`)
  }
})

test('chrome text stays at AA across the hue circle', () => {
  const source = buildSource()
  const pairs = [
    ['statusBar.foreground', 'statusBar.background'],
    ['editor.foreground', 'editor.background'],
    ['sideBar.foreground', 'sideBar.background'],
    ['activityBar.foreground', 'activityBar.background'],
  ]
  for (let hue = 0; hue < 360; hue += 45) {
    const result = buildForgeThemes({ source, transform: transformFor(hue) })
    for (const type of ['dark', 'light']) {
      const colors = readTheme(result, type).colors
      for (const [fg, bg] of pairs) {
        if (!colors[fg] || !colors[bg]) continue
        const ratio = contrastRatio(colors[fg], colors[bg])
        assert.ok(ratio >= 4.5, `${type} ${fg}/${bg} contrast ${ratio.toFixed(2)} < 4.5 at hue ${hue}`)
      }
    }
  }
})
