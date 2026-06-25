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
