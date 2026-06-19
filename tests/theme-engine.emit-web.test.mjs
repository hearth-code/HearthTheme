import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildColorLanguageModel } from '../scripts/color-system/build.mjs'
import { buildGeneratedPlatformTokenMaps } from '../scripts/color-system/artifacts.mjs'
import { webEmitter } from '../scripts/theme-engine/emit/web.mjs'

// Phase 5 / T5.1: prove the Emitter plugin boundary with a real, byte-exact
// emitter. Running the web emitter over the resolved model must reproduce the
// committed src/data/tokens.ts exactly — so an emitter is a pure (ir) -> File[]
// function that the pipeline can swap/remove without touching the engine.

test('the web emitter reproduces the committed src/data/tokens.ts byte-for-byte', () => {
  const model = buildColorLanguageModel()
  const maps = buildGeneratedPlatformTokenMaps(model)
  const files = webEmitter.emit(maps)

  assert.equal(files.length, 1)
  assert.equal(files[0].path, 'src/data/tokens.ts')

  const committed = fs.readFileSync('src/data/tokens.ts', 'utf8')
  assert.equal(files[0].content, committed)
})

test('the web emitter declares its name and consumed layers (the plugin contract)', () => {
  assert.equal(webEmitter.name, 'web')
  assert.ok(Array.isArray(webEmitter.consumes) && webEmitter.consumes.length > 0)
  assert.equal(typeof webEmitter.emit, 'function')
})
