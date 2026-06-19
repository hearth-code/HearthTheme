import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contrastRatio } from '../scripts/color-utils.mjs'
import { colorDomain, toOpaqueHex } from '../scripts/theme-engine/domain-color/index.mjs'

// Phase 1: prove the colour domain is a faithful wrapper of the shipped
// primitives. Fixtures mirror color-solve.test.mjs / the status + cursor anchors,
// so these double as a parity check before build.mjs is re-pointed in Phase 3.

test('parse normalises a hex and rejects garbage', () => {
  assert.equal(colorDomain.parse('#8bb49e'), '#8bb49e')
  assert.throws(() => colorDomain.parse('not-a-colour'), /invalid colour/)
})

test('serialize round-trips the value', () => {
  assert.equal(colorDomain.serialize('#b37f16'), '#b37f16')
})

test('transform mix matches mixHex on resolved operands', () => {
  assert.equal(colorDomain.transforms.mix('#000000', { with: '#ffffff', t: 0.5 }), '#808080')
})

test('transform alpha appends the 8-bit alpha channel (mirrors applyAlpha)', () => {
  // round(0.65 * 255) = 166 = 0xA6
  assert.equal(colorDomain.transforms.alpha('#cb9322', { alpha: 0.65 }), '#cb9322a6')
})

test('toOpaqueHex strips an alpha channel', () => {
  assert.equal(toOpaqueHex('#cb9322a6'), '#cb9322')
  assert.equal(toOpaqueHex('#cb9322'), '#cb9322')
})

test('constraint minContrast reports ok + signed margin (status ink fixture)', () => {
  const r = colorDomain.constraints.minContrast('#191815', { against: '#b37f16', ratio: 4.5 })
  assert.equal(r.ok, true)
  assert.ok(Math.abs(r.margin - (contrastRatio('#191815', '#b37f16') - 4.5)) < 1e-9)
  const fail = colorDomain.constraints.minContrast('#191815', { against: '#b37f16', ratio: 21 })
  assert.equal(fail.ok, false)
  assert.ok(fail.margin < 0)
})

test('solve returns the anchor when already satisfied (inert)', () => {
  assert.equal(
    colorDomain.solve('#8bb49e', [{ kind: 'minContrast', bg: '#1b1d1a', ratio: 3 }]),
    '#8bb49e',
  )
})

test('solve adjusts lightness to satisfy an unmet constraint (deterministic)', () => {
  const out = colorDomain.solve('#23291f', [{ kind: 'minContrast', bg: '#1b1d1a', ratio: 4.5 }])
  assert.equal(out, '#7f867a')
  assert.ok(contrastRatio(out, '#1b1d1a') >= 4.5)
})
