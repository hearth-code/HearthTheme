import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyAbstractDerive } from '../scripts/color-system/build.mjs'
import { colorDomain } from '../scripts/theme-engine/domain-color/index.mjs'

// Phase 2 / T2.1: prove the derive stage end-to-end on the real dispatch, the way
// M1 (color-solve-pipeline.test.mjs) did for the resolve stage. applyAbstractDerive
// is where alpha and mix are applied AFTER source resolution; this is the seam the
// future composite-aware focusRing constraint (Phase 7) will extend.

function derive({ baseHex, derive: d, variantId = 'dark', resolveVariantKnob = null }) {
  const steps = []
  const result = applyAbstractDerive({
    baseHex,
    derive: d,
    foundation: {},
    variantId,
    resolveRole: null,
    resolveSurface: null,
    resolveInterface: null,
    resolveGuidance: null,
    resolveTerminal: null,
    resolveInteraction: null,
    resolveFeedback: null,
    resolveVariantKnob,
    entryRef: 'test.token',
    steps,
    domain: colorDomain,
  })
  return { ...result, steps }
}

test('no derive passes the base colour through untouched', () => {
  const out = derive({ baseHex: '#cb9322', derive: null })
  assert.equal(out.color, '#cb9322')
  assert.deepEqual(out.chainRefs, [])
})

test('alphaFromVariantKnob appends the resolved alpha channel (the focusRing pattern)', () => {
  const out = derive({
    baseHex: '#cb9322',
    derive: { alphaFromVariantKnob: 'interactionAlpha.focusRing' },
    resolveVariantKnob: (knob, v) => (knob === 'interactionAlpha.focusRing' && v === 'dark' ? 0.65 : null),
  })
  assert.equal(out.color, '#cb9322a6') // round(0.65 * 255) = 166 = 0xa6
  assert.ok(out.chainRefs.includes('variant-knobs.interactionAlpha.focusRing.dark'))
})

test('a literal derive.alpha appends the alpha channel', () => {
  assert.equal(derive({ baseHex: '#cb9322', derive: { alpha: 0.65 } }).color, '#cb9322a6')
})

test('mix resolves its target through the source graph and blends (literal target)', () => {
  const out = derive({
    baseHex: '#000000',
    derive: { mix: { with: { type: 'literal', values: { dark: '#ffffff' } }, t: 0.5 } },
  })
  assert.equal(out.color, '#808080')
  assert.ok(out.steps.some((s) => s.type === 'mix'))
})

test('a missing variant knob throws loudly (never silently drops the alpha)', () => {
  assert.throws(
    () => derive({ baseHex: '#cb9322', derive: { alphaFromVariantKnob: 'nope.missing' }, resolveVariantKnob: () => null }),
    /Missing variant knob/,
  )
})
