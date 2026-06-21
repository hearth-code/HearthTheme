import { test } from 'node:test'
import assert from 'node:assert/strict'
import { themeConfig } from '../theme.config.mjs'
import { composeSource } from '../scripts/theme-engine/core/compose.mjs'

function knobMap(namedKnob, values = namedKnob.values) {
  const [groupId, knobId] = namedKnob.ref.split('.')
  return { [groupId]: { [knobId]: values } }
}

test('theme config exposes existing variant knobs as named parameters', () => {
  assert.equal(themeConfig.knobs.surfaceMix.panelLift.ref, 'surfaceMix.panelLift')
  assert.equal(typeof themeConfig.knobs.surfaceMix.panelLift.values.dark, 'number')
  assert.equal(typeof themeConfig.knobs.surfaceMix.panelLift.values.light, 'number')
  assert.ok(Object.isFrozen(themeConfig.knobs))
  assert.ok(Object.isFrozen(themeConfig.knobs.surfaceMix.panelLift.values))
})

test('flipping a named knob only changes composed sources that reference it', () => {
  const selection = themeConfig.knobs.interactionAlpha.selection
  const changedSelectionValues = {
    ...selection.values,
    dark: selection.values.dark + 0.1,
  }
  const knobbed = {
    source: { type: 'surface', id: 'canvas' },
    derive: { alphaFromVariantKnob: selection.ref },
  }
  const fixed = {
    source: { type: 'surface', id: 'canvas' },
    derive: { alpha: selection.values.dark },
  }

  assert.equal(
    composeSource(knobbed, {}, { variantId: 'dark', knobs: knobMap(selection, changedSelectionValues) }).source.derive.alpha,
    changedSelectionValues.dark,
  )
  assert.deepEqual(
    composeSource(fixed, {}, { variantId: 'dark', knobs: knobMap(selection) }).source,
    composeSource(fixed, {}, { variantId: 'dark', knobs: knobMap(selection, changedSelectionValues) }).source,
  )
})
