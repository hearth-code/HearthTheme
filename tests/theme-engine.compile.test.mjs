import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { compile } from '../scripts/theme-engine/compile.mjs'
import { webEmitter } from '../scripts/theme-engine/emit/web.mjs'

// Phase 6 / T6.1: the single generic entry assembles emitter plugins over the
// resolved model and returns the terminal artifacts. Proven by reproducing a
// committed output byte-for-byte through compile() — "run it, get the files".

test('compile assembles emitters over the resolved model into files', () => {
  const files = compile({ emitters: [webEmitter] })
  const tokensFile = files.find((f) => f.path === 'src/data/tokens.ts')
  assert.ok(tokensFile, 'web emitter produced the tokens file')
  assert.equal(tokensFile.content, fs.readFileSync('src/data/tokens.ts', 'utf8'))
})

test('compile with no emitters produces no files', () => {
  assert.deepEqual(compile({ emitters: [] }), [])
})
