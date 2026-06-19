import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compile } from '../scripts/theme-engine/compile.mjs'
import { SOURCE_KINDS } from '../scripts/theme-engine/types.mjs'

// Phase 0 smoke contract: the engine skeleton exists and is importable, and the
// value algebra is the closed set of four kinds. These lock the shape before any
// logic is extracted into it.

test('compile is a function (wired in Phase 6 to assemble emitters)', () => {
  assert.equal(typeof compile, 'function')
})

test('the source-kind algebra is exactly the closed set of four', () => {
  assert.deepEqual([...SOURCE_KINDS].sort(), ['derive', 'literal', 'ref', 'solve'])
})

test('SOURCE_KINDS is frozen so the algebra cannot drift open accidentally', () => {
  assert.ok(Object.isFrozen(SOURCE_KINDS))
})
