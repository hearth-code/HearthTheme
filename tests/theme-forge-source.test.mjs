import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildColorLanguageModel, getColorLanguageModelSources } from '../scripts/color-system/build.mjs'
import { buildColorLanguageModel as buildColorLanguageModelCore } from '../scripts/color-system/build-core.mjs'
import { buildThemeForgeSource, THEME_FORGE_SOURCE_PATH } from '../scripts/generate-theme-forge-source.mjs'

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

test('theme forge source payload reproduces the loader-backed model', () => {
  const source = buildThemeForgeSource()
  const injected = buildColorLanguageModelCore({
    inputs: source.inputs,
    sources: getColorLanguageModelSources(),
  })

  assert.deepEqual(injected, buildColorLanguageModel())
})

test('committed theme forge source payload is generated from Node loaders', () => {
  assert.deepEqual(readJson(THEME_FORGE_SOURCE_PATH), buildThemeForgeSource())
})
