import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveAbstractColorSource, applyAbstractDerive } from '../scripts/color-system/build.mjs'
import { colorDomain } from '../scripts/theme-engine/domain-color/index.mjs'

// Phase 3 / T3.1: the resolve + derive stages are now parameterized by a `domain`.
// These prove (a) the engine DELEGATES its value maths to the injected domain — a
// fake non-colour domain's solve/transforms are what run, not hardcoded colour
// maths — and (b) the explicitly injected colour domain still resolves the shipped
// fixtures unchanged. This is the concrete evidence that "the middle is generic".
//
// T3.2 removes the colour-domain default from the seam: callers inject the domain
// explicitly, and literal/foundation/ref/base parsing runs through domain.tryParse.

const fakeDomain = {
  tryParse: (x) => x ?? null,
  parse: (x) => x,
  serialize: (x) => x,
  toOpaque: (x) => x,
  transforms: {
    mix: () => '#aaaaaa', // sentinel — proves the engine called domain.transforms.mix
    alpha: () => '#bbbbbb', // sentinel
  },
  constraints: { minContrast: () => ({ ok: true, margin: 1 }) },
  solve: () => '#5ee0ed', // sentinel — proves the engine called domain.solve
}

const nonColorLiteralDomain = {
  tryParse: (x) => (x == null ? null : `literal:${x}`),
  parse: (x) => `literal:${x}`,
  serialize: (x) => String(x),
  toOpaque: (x) => x,
  transforms: {},
  constraints: {},
  solve: () => {
    throw new Error('nonColorLiteralDomain.solve should not run')
  },
}

test('resolve solve delegates to the injected domain.solve (fake domain)', () => {
  const out = resolveAbstractColorSource({
    source: {
      type: 'solve',
      anchor: { dark: '#000000' },
      constraints: [{ kind: 'minContrast', against: { type: 'literal', values: { dark: '#ffffff' } }, ratio: 99 }],
    },
    variantId: 'dark',
    foundation: {},
    entryRef: 'fake.token',
    domain: fakeDomain,
  })
  assert.equal(out.color, '#5ee0ed')
})

test('derive alpha delegates to the injected domain.transforms.alpha (fake domain)', () => {
  const out = applyAbstractDerive({
    baseHex: '#000000',
    derive: { alpha: 0.5 },
    foundation: {},
    variantId: 'dark',
    entryRef: 'fake.token',
    steps: [],
    domain: fakeDomain,
  })
  assert.equal(out.color, '#bbbbbb')
})

test('derive mix delegates to the injected domain.transforms.mix (fake domain)', () => {
  const out = applyAbstractDerive({
    baseHex: '#000000',
    derive: { mix: { with: { type: 'literal', values: { dark: '#ffffff' } }, t: 0.5 } },
    foundation: {},
    variantId: 'dark',
    entryRef: 'fake.token',
    steps: [],
    domain: fakeDomain,
  })
  assert.equal(out.color, '#aaaaaa')
})

test('literal values are parsed through the injected domain.tryParse (non-colour proof)', () => {
  const out = resolveAbstractColorSource({
    source: { type: 'literal', values: { dark: 'sz-4' } },
    variantId: 'dark',
    foundation: {},
    entryRef: 'fake.size',
    domain: nonColorLiteralDomain,
  })

  assert.equal(out.color, 'literal:sz-4')
  assert.equal(out.steps[0].value, 'literal:sz-4')
})

test('explicit colour domain still resolves a solve fixture unchanged (byte-identical path)', () => {
  const out = resolveAbstractColorSource({
    source: {
      type: 'solve',
      anchor: { dark: '#8bb49e' },
      constraints: [{ kind: 'minContrast', against: { type: 'literal', values: { dark: '#1b1d1a' } }, ratio: 3 }],
    },
    variantId: 'dark',
    foundation: {},
    entryRef: 'cursor',
    domain: colorDomain,
  })
  assert.equal(out.color, '#8bb49e')
})
