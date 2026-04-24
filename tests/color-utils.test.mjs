import test from 'node:test'
import assert from 'node:assert/strict'

import {
  contrastRatio,
  deltaE,
  hexToRgb,
  hexToRgba,
  hueDistance,
  mixHex,
  normalizeHex,
  rgbaToHex,
} from '../scripts/color-utils.mjs'

test('hex helpers normalize, parse, and serialize stable colors', () => {
  assert.equal(normalizeHex('#ABCDEF'), '#abcdef')
  assert.equal(normalizeHex('abcdef'), null)
  assert.equal(normalizeHex('#abc'), '#aabbcc')
  assert.deepEqual(hexToRgb('#102030'), [16, 32, 48])
  assert.deepEqual(hexToRgba('#10203080'), { r: 16, g: 32, b: 48, a: 128, hasAlpha: true })
  assert.equal(rgbaToHex({ r: 16, g: 32, b: 48, a: 128, hasAlpha: true }), '#10203080')
})

test('contrast and color distance helpers keep expected invariants', () => {
  assert.equal(contrastRatio('#000000', '#000000'), 1)
  assert.ok(contrastRatio('#000000', '#ffffff') > 21 - 0.01)
  assert.equal(deltaE('#123456', '#123456'), 0)
  assert.equal(hueDistance(10, 350), 20)
  assert.equal(mixHex('#000000', '#ffffff', 0.5), '#808080')
})
