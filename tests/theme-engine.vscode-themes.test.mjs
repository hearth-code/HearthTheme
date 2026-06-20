import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildColorLanguageModel } from '../scripts/color-system/build.mjs'
import { buildGeneratedPlatformTokenMaps } from '../scripts/color-system/artifacts.mjs'
import { buildVscodeThemes } from '../scripts/generate-theme-variants.mjs'

// Migration step 2 (plan §11): buildGeneratedPlatformTokenMaps can derive the
// platform maps from in-memory theme objects (buildVscodeThemes) instead of
// re-reading the committed themes/*.json. Proving the in-memory path equals the
// disk path is the byte-identical bridge for steps 3-4, where the engine produces
// the theme instead of re-serializing a file it already wrote.

test('buildVscodeThemes returns the calibrated theme objects keyed by variant', () => {
  const { themes } = buildVscodeThemes()
  assert.ok(themes.dark && themes.light, 'dark + light theme objects present')
  for (const id of ['dark', 'light']) {
    assert.ok(themes[id].colors && Array.isArray(themes[id].tokenColors), `${id} looks like a theme`)
  }
})

test('injecting in-memory themes yields maps identical to reading them from disk', () => {
  const model = buildColorLanguageModel()
  const fromDisk = buildGeneratedPlatformTokenMaps(model)
  const fromMemory = buildGeneratedPlatformTokenMaps(model, { themes: buildVscodeThemes().themes })
  assert.deepEqual(fromMemory, fromDisk)
})
