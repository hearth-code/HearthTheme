import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildSparkFoundationOverride,
  forgeSurfaceVars,
  getDefaultSparkHue,
  renderThemeForgeSplitSvg,
} from '../src/lib/themeForgePreview.mjs'

const source = JSON.parse(readFileSync('public/theme-forge/source.json', 'utf8'))
const heroSource = readFileSync('src/components/ui/HeroSection.astro', 'utf8')
const forgeWebviewSource = readFileSync('scripts/forge-webview/ui.mjs', 'utf8')

test('theme forge spark override preserves the foundation structure', () => {
  const foundation = source.inputs.foundation
  const next = buildSparkFoundationOverride(foundation, { hue: 210, saturation: 110 })

  assert.notEqual(next, foundation)
  assert.deepEqual(Object.keys(next.families), Object.keys(foundation.families))
  assert.deepEqual(Object.keys(next.families.spark.tones), Object.keys(foundation.families.spark.tones))
  assert.notEqual(next.families.spark.tones.base.dark, foundation.families.spark.tones.base.dark)
  assert.equal(next.families.jade.tones.base.dark, foundation.families.jade.tones.base.dark)
})

test('theme forge default hue is derived from the spark family', () => {
  const hue = getDefaultSparkHue(source.inputs.foundation)
  assert.equal(Number.isInteger(hue), true)
  assert.equal(hue >= 0 && hue < 360, true)
})

test('theme forge spark override keeps the requested control values distinct', () => {
  const lowSaturation = buildSparkFoundationOverride(source.inputs.foundation, { hue: 210, saturation: 55 })
  const highSaturation = buildSparkFoundationOverride(source.inputs.foundation, { hue: 210, saturation: 155 })

  assert.notEqual(lowSaturation.families.spark.tones.base.dark, source.inputs.foundation.families.spark.tones.base.dark)
  assert.notEqual(highSaturation.families.spark.tones.base.dark, source.inputs.foundation.families.spark.tones.base.dark)
  assert.notEqual(lowSaturation.families.spark.tones.base.dark, highSaturation.families.spark.tones.base.dark)
})

test('hero forge surface state always carries both dark and light layers', () => {
  assert.deepEqual(
    forgeSurfaceVars({
      dark: { bg: '#101410', fg: '#e8e1d5' },
      light: { bg: '#f3ecdc', fg: '#25231f' },
    }),
    {
      '--pick-surface': '#101410',
      '--pick-ink': '#e8e1d5',
      '--compare-surface': '#f3ecdc',
      '--compare-ink': '#25231f',
    },
  )
})

test('theme forge SVG preview renders both returned variants', () => {
  const maps = {
    web: {
      dark: { bg: '#101410', fg: '#e8e1d5', lineBg: '#202820', lineNo: '#756f66', guideInk: '#d4cdbc', shellBand: '#1a2018', shellSubtle: '#8f897e', shellMuted: '#9a9488', terminalRed: '#cf7d6a', terminalYellow: '#c5aa62', terminalGreen: '#8aa66a', cursor: '#d7bd55', status: '#d7bd55', onStatus: '#161410', border: '#3a4035', keyword: '#d7bd55', fn: '#93b76d', method: '#89aeb7', property: '#aabf7a', type: '#89aeb7', number: '#b6a2d8', string: '#d5a164', variable: '#d6cec1', operator: '#b8aa8c', comment: '#8f9a83' },
      light: { bg: '#f3ecdc', fg: '#25231f', lineBg: '#e7ddc8', lineNo: '#908879', guideInk: '#514b42', shellBand: '#e7ddc8', shellSubtle: '#776e60', shellMuted: '#776e60', terminalRed: '#ad5d4f', terminalYellow: '#9a7b2f', terminalGreen: '#627d45', cursor: '#6f7f31', status: '#6f7f31', onStatus: '#fbf7ec', border: '#d3c8b6', keyword: '#7d7429', fn: '#4f7d42', method: '#3f7784', property: '#637a2f', type: '#3f7784', number: '#765aa0', string: '#96651f', variable: '#302d28', operator: '#675f51', comment: '#6f7c63' },
    },
    tokenSets: {},
  }

  const svg = renderThemeForgeSplitSvg({
    maps,
    labels: { dark: 'Dark', light: 'Light' },
    title: 'Theme Forge',
    qualityLabel: 'CONTRACT OK',
  })
  assert.match(svg, /<svg /)
  assert.match(svg, /Forge - Dark/)
  assert.match(svg, /Forge - Light/)
  assert.match(svg, /CONTRACT OK/)
  assert.doesNotMatch(svg, /WCAG AA\+/)
  assert.match(svg, /palette\.ts/)
})

test('hero forge keeps both panes unlit until each pane receives its landing chip', () => {
  const pairedUnlitCalls = heroSource.match(/unlitPane\(darkPane, true\)\s+unlitPane\(lightPane, false\)/g) || []
  assert.equal(pairedUnlitCalls.length, 3, 'intro, click, and swapped DOM all unlight both panes')
  assert.match(heroSource, /const landDark = \(\) =>[\s\S]*item\.isDark[\s\S]*const landLight = \(\) =>/)
  assert.match(heroSource, /later\(300, \(\) => \{\s+echo\.style\.opacity = '0'\s+landLight\(\)/)
})

test('hero comparison divider cannot select its handle text while dragging', () => {
  const dividerRule = heroSource.match(/\.specimen-divider\s*\{([\s\S]*?)\}/)?.[1] || ''

  assert.match(dividerRule, /-webkit-user-select:\s*none;/)
  assert.match(dividerRule, /user-select:\s*none;/)
})

test('extension Forge starts entirely from host-injected assets', () => {
  assert.match(forgeWebviewSource, /config\.workerCode/)
  assert.match(forgeWebviewSource, /source\s*=\s*config\.source/)
  assert.doesNotMatch(forgeWebviewSource, /fetch\(config\.(?:workerUri|sourceUri)\)/)
})

test('extension Forge exposes staged startup, timeout recovery, and retry', () => {
  assert.match(forgeWebviewSource, /2\/4 · Starting engine/)
  assert.match(forgeWebviewSource, /3\/4 · Building first preview/)
  assert.match(forgeWebviewSource, /4\/4 · Ready/)
  assert.match(forgeWebviewSource, /startupTimeoutMs/)
  assert.match(forgeWebviewSource, /type: 'retry'/)
  assert.match(forgeWebviewSource, /useDefault: isDefault/)
  assert.match(forgeWebviewSource, /clearStartupTimeout/)
})
