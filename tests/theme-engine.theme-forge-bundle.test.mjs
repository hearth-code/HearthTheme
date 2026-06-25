import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { buildColorLanguageModel, getExportedSiteTokenKeys, loadColorLanguageModelInputs } from '../scripts/color-system/build.mjs'
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
import { buildGeneratedPlatformTokenMaps } from '../scripts/color-system/artifacts.mjs'
import { buildVscodeThemes as buildNodeVscodeThemes } from '../scripts/generate-theme-variants-node.mjs'
import { compile } from '../scripts/theme-engine/compile.mjs'
import { buildForgeThemes } from '../scripts/theme-engine/browser-worker.mjs'
import { vscodeEmitter } from '../scripts/theme-engine/emit/vscode.mjs'
import { buildSparkFoundationOverride } from '../src/lib/themeForgePreview.mjs'

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const sortFiles = (files) => [...files].sort((a, b) => a.path.localeCompare(b.path))

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

// Ground truth: the same primary-colour override run through the Node pipeline
// end-to-end (model build + calibration + emit).
function nodePipeline(overrides) {
  const model = buildColorLanguageModel(overrides ? { overrides } : {})
  const { themes } = buildNodeVscodeThemes({ model, writeReferenceFiles: false, log: null })
  const maps = buildGeneratedPlatformTokenMaps(model, { themes })
  const files = compile({ model, themes, variant: null, emitters: [vscodeEmitter], verify: null })
  return { maps, files }
}

test('bundled theme-forge worker recalibrates in-browser and matches Node (default + override)', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'hearththeme-theme-forge-bundle-'))
  const bundlePath = join(tmp, 'theme-forge-worker.mjs')

  try {
    execFileSync(
      'node_modules/.bin/rollup',
      ['scripts/theme-engine/browser-worker.mjs', '--format', 'esm', '--file', bundlePath, '--silent'],
      { cwd: process.cwd(), stdio: 'pipe' },
    )

    const src = readFileSync(bundlePath, 'utf8')
    assert.doesNotMatch(src, /from ['"](?:node:)?fs['"]/)
    assert.doesNotMatch(src, /readFileSync/)
    assert.doesNotMatch(src, /color-system\.mjs/)

    const worker = await import(`${pathToFileURL(bundlePath).href}?t=${Date.now()}`)
    const source = buildSource()

    // default — bundled worker output equals the Node pipeline
    const forgeDefault = worker.buildForgeThemes({ source })
    const nodeDefault = nodePipeline(null)
    assert.deepEqual(forgeDefault.maps, nodeDefault.maps)
    assert.deepEqual(sortFiles(forgeDefault.files), sortFiles(nodeDefault.files))

    // foundation override (shift the primary spark hue) — recalibrated in-browser,
    // equals the same override run through Node
    const foundation = structuredClone(source.inputs.foundation)
    foundation.families.spark.tones.base.dark = '#3a86ff'
    foundation.families.spark.tones.base.light = '#2f5fb0'
    const overrides = { foundation }

    const forgeOverride = worker.buildForgeThemes({ source, overrides })
    const nodeOverride = nodePipeline(overrides)
    assert.deepEqual(forgeOverride.maps, nodeOverride.maps)
    assert.deepEqual(sortFiles(forgeOverride.files), sortFiles(nodeOverride.files))

    // the override actually moved the output (the calibration really ran)
    assert.notDeepEqual(forgeOverride.maps, forgeDefault.maps)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('theme-forge relaxed preview builds a primary hue sweep', () => {
  const source = buildSource()
  let sawRelaxedWarning = false

  for (let hue = 0; hue < 360; hue += 30) {
    const foundation = buildSparkFoundationOverride(source.inputs.foundation, { hue, saturation: 100 })
    let forge
    try {
      forge = buildForgeThemes({ source, overrides: { foundation } })
    } catch (error) {
      assert.fail(`hue ${hue} should build in relaxed preview mode: ${error instanceof Error ? error.message : String(error)}`)
    }

    assert.ok(forge.themes.dark, `hue ${hue}: dark theme`)
    assert.ok(forge.themes.light, `hue ${hue}: light theme`)
    assert.ok(forge.maps.web.dark, `hue ${hue}: dark web map`)
    assert.ok(forge.maps.web.light, `hue ${hue}: light web map`)
    sawRelaxedWarning ||= (forge.warnings || []).some((warning) => /emitted globalSeparation misses target/.test(warning))
  }

  assert.equal(sawRelaxedWarning, true)
})
