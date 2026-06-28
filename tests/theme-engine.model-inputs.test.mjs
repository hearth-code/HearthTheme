import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildColorLanguageModel,
  getColorLanguageModelSources,
  loadColorLanguageModelInputs,
} from '../scripts/color-system/build.mjs'
import { buildColorLanguageModel as buildColorLanguageModelCore } from '../scripts/color-system/build-core.mjs'

test('fully injected model inputs reproduce the loader-backed model', () => {
  const loaderBacked = buildColorLanguageModel()
  const inputs = loadColorLanguageModelInputs()
  const injected = buildColorLanguageModelCore({
    inputs,
    sources: getColorLanguageModelSources(),
  })

  assert.deepEqual(injected, loaderBacked)
})

test('model inputs can target a non-active scheme without env overrides', () => {
  const inputs = loadColorLanguageModelInputs(null, 'ember')
  const sources = getColorLanguageModelSources('ember')

  assert.equal(inputs.activeScheme.schemeId, 'ember')
  assert.equal(inputs.activeScheme.schemeDir, 'color-system/schemes/ember')
  assert.equal(inputs.scheme.id, 'ember')
  assert.equal(inputs.variants.variants[0].outputPath, 'themes/ember-dark.json')
  assert.ok(Object.keys(inputs.foundation.families).length > 0)
  assert.equal(sources.foundation, 'color-system/schemes/ember/foundation.json')
  assert.equal(sources.variantKnobs, 'color-system/schemes/ember/variant-knobs.json')
})

test('the injected model core requires source inputs instead of falling back to loaders', () => {
  assert.throws(
    () => buildColorLanguageModelCore(),
    /missing injected input "activeScheme"/,
  )
})

test('the model core bundles without fs loaders', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'hearththeme-model-core-bundle-'))
  const bundlePath = join(tmp, 'model-core.mjs')

  try {
    execFileSync(
      'node_modules/.bin/rollup',
      ['scripts/color-system/build-core.mjs', '--format', 'esm', '--file', bundlePath, '--silent'],
      { cwd: process.cwd(), stdio: 'pipe' },
    )

    const bundleSource = readFileSync(bundlePath, 'utf8')
    assert.doesNotMatch(bundleSource, /from ['"](?:node:)?fs['"]/)
    assert.doesNotMatch(bundleSource, /readFileSync/)
    assert.doesNotMatch(bundleSource, /color-system\.mjs/)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})
