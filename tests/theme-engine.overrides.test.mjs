import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildColorLanguageModel } from '../scripts/color-system/build.mjs'
import { loadFoundationPalette } from '../scripts/color-system.mjs'

// The `overrides` seam lets a caller inject already-resolved source data (the
// playground / in-browser path: a "primary color" is an overridden foundation).
// These tests pin the contract: the seam is INERT by default (no overrides ->
// same emitted token maps) and ACTIVE when given data (override propagates to
// outputs without leaking into the loader-backed default).

test('overrides is inert by default — emitted token maps are unchanged', () => {
  const base = buildColorLanguageModel()
  const none = buildColorLanguageModel({ overrides: null })
  const empty = buildColorLanguageModel({ overrides: {} })
  assert.deepEqual(none.platformTokenMaps, base.platformTokenMaps)
  assert.deepEqual(empty.platformTokenMaps, base.platformTokenMaps)
})

test('an overridden foundation propagates through the build', () => {
  const base = buildColorLanguageModel()

  const foundation = structuredClone(loadFoundationPalette())
  foundation.families.spark.tones.base.dark = '#3a86ff'
  const shifted = buildColorLanguageModel({ overrides: { foundation } })

  // the injected data is what the model used, not the on-disk file
  assert.equal(shifted.foundation.families.spark.tones.base.dark, '#3a86ff')
  // and it reached the emitted outputs (keyword anchors on spark/base)
  assert.notEqual(
    JSON.stringify(shifted.platformTokenMaps),
    JSON.stringify(base.platformTokenMaps),
  )

  // the override must not leak into the default loader path
  const again = buildColorLanguageModel()
  assert.deepEqual(again.platformTokenMaps, base.platformTokenMaps)
})
