import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildForgeThemes } from '../scripts/theme-engine/browser-worker.mjs'
import { buildGlobalHueOverride } from '../src/lib/themeForgePreview.mjs'
import { contrastRatio } from '../scripts/color-utils.mjs'
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

// The Forge sliders are clamped to this range (extension/forge.js +
// ThemeForgeIsland.astro). Whole-palette rotation across the full hue circle, at
// saturation 60–100, must keep the worst role-pair separation (p25/p10) at or
// above the shipped themes' floor. If the scheme's chroma profile drifts enough
// to break this, the clamp range must be re-derived — this test fails first.
const HUE_RANGE = { min: 0, max: 359 }
const SAT_RANGE = { min: 60, max: 100 }
const FLOOR = { p25: 1.03, p10: 0.77 }

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

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

// When the relaxed preview falls short of the strict target it emits a
// "global separation median … p25 … p10 …" warning; with no warning the
// separation already meets the target, so the floor is satisfied by definition.
function worstTail(warnings) {
  let p25 = Infinity
  let p10 = Infinity
  for (const w of warnings || []) {
    const m = /global separation median [\d.]+ .*p25 ([\d.]+).*p10 ([\d.]+)/.exec(w)
    if (m) {
      p25 = Math.min(p25, Number(m[1]))
      p10 = Math.min(p10, Number(m[2]))
    }
  }
  return { p25, p10 }
}

test('clamped Forge range keeps role separation above the shipped floor', () => {
  const source = buildSource()
  const foundation = source.inputs.foundation
  let worstP25 = Infinity
  let worstP10 = Infinity
  let worstAt = ''

  for (let hue = HUE_RANGE.min; hue <= HUE_RANGE.max; hue += 30) {
    for (let saturation = SAT_RANGE.min; saturation <= SAT_RANGE.max; saturation += 20) {
      const override = buildGlobalHueOverride(foundation, { hue, saturation })
      const { p25, p10 } = worstTail(buildForgeThemes({ source, overrides: { foundation: override } }).warnings)
      if (p25 < worstP25) worstP25 = p25
      if (p10 < worstP10) {
        worstP10 = p10
        worstAt = `hue ${hue}, sat ${saturation}`
      }
    }
  }

  assert.ok(worstP25 >= FLOOR.p25, `worst p25 ${worstP25} below floor ${FLOOR.p25}`)
  assert.ok(worstP10 >= FLOOR.p10, `worst p10 ${worstP10} below floor ${FLOOR.p10} at ${worstAt}`)
})

test('chrome tint keeps editor-surface text at AA across the hue circle', () => {
  const source = buildSource()
  const foundation = source.inputs.foundation
  const pairs = [
    ['statusBar.foreground', 'statusBar.background'],
    ['editor.foreground', 'editor.background'],
    ['sideBar.foreground', 'sideBar.background'],
    ['activityBar.foreground', 'activityBar.background'],
  ]
  const colorsOf = (result, type) =>
    JSON.parse(result.files.find((f) => JSON.parse(f.content).type === type).content).colors

  for (let hue = 0; hue < 360; hue += 45) {
    const override = buildGlobalHueOverride(foundation, { hue, saturation: 100 })
    const result = buildForgeThemes({ source, overrides: { foundation: override }, chrome: hue })
    for (const type of ['dark', 'light']) {
      const colors = colorsOf(result, type)
      for (const [fg, bg] of pairs) {
        if (!colors[fg] || !colors[bg]) continue
        const ratio = contrastRatio(colors[fg], colors[bg])
        assert.ok(ratio >= 4.5, `${type} ${fg}/${bg} contrast ${ratio.toFixed(2)} < 4.5 at hue ${hue}`)
      }
    }
  }
})
