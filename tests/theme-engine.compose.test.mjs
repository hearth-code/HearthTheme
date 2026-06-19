import { test } from 'node:test'
import assert from 'node:assert/strict'
import { composeSource } from '../scripts/theme-engine/core/compose.mjs'

// Phase 1.5 / T1.5.1: composition becomes a first-class, testable seam. These
// fixtures model one token source cell at a time, so the function proves lazy
// selector resolution without changing the production generators yet.

test('composeSource honors base -> scheme -> variant -> knobs precedence', () => {
  const base = {
    source: { type: 'foundation', family: 'ground', tone: 'base' },
    derive: { mix: { with: { type: 'surface', id: 'ink' }, t: 0.1 } },
    byVariant: {
      light: {
        derive: { mix: { t: 0.3 } },
      },
    },
  }
  const scheme = {
    source: { type: 'surface', id: 'canvas' },
    derive: { mix: { tFromVariantKnob: 'surfaceMix.panelLift' } },
    byVariant: {
      light: {
        source: { type: 'literal', values: { light: '#ffffff' } },
      },
    },
  }

  const { source, lineage } = composeSource(base, scheme, {
    variantId: 'light',
    knobs: { surfaceMix: { panelLift: { light: 0.42 } } },
  })

  assert.deepEqual(source, {
    source: { type: 'literal', values: { light: '#ffffff' } },
    derive: { mix: { with: { type: 'surface', id: 'ink' }, t: 0.42 } },
  })
  assert.equal(lineage['source.type'].layer, 'variant')
  assert.equal(lineage['derive.mix.with.id'].layer, 'base')
  assert.equal(lineage['derive.mix.t'].layer, 'knobs')
  assert.equal(lineage['derive.mix.t'].ref, 'variant-knobs.surfaceMix.panelLift.light')
})

test('changing one knob changes only the composed source that references it', () => {
  const knobbed = {
    source: { type: 'surface', id: 'canvas' },
    derive: { alphaFromVariantKnob: 'interactionAlpha.selection' },
  }
  const fixed = {
    source: { type: 'surface', id: 'canvas' },
    derive: { alpha: 0.5 },
  }
  const knobsA = { interactionAlpha: { selection: { dark: 0.18 } } }
  const knobsB = { interactionAlpha: { selection: { dark: 0.32 } } }

  assert.notDeepEqual(
    composeSource(knobbed, {}, { variantId: 'dark', knobs: knobsA }).source,
    composeSource(knobbed, {}, { variantId: 'dark', knobs: knobsB }).source,
  )
  assert.deepEqual(
    composeSource(fixed, {}, { variantId: 'dark', knobs: knobsA }).source,
    composeSource(fixed, {}, { variantId: 'dark', knobs: knobsB }).source,
  )
})

test('composeSource resolves only the selected variant cell', () => {
  const selection = {}
  Object.defineProperty(selection, 'dark', {
    enumerable: true,
    get() {
      return 0.18
    },
  })
  Object.defineProperty(selection, 'light', {
    enumerable: true,
    get() {
      throw new Error('light knob cell should not be touched')
    },
  })

  const { source } = composeSource(
    {
      source: { type: 'surface', id: 'canvas' },
      derive: { alphaFromVariantKnob: 'interactionAlpha.selection' },
    },
    {},
    {
      variantId: 'dark',
      knobs: { interactionAlpha: { selection } },
    },
  )

  assert.equal(source.derive.alpha, 0.18)
})
