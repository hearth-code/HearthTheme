import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contrastRatio, hexToRgb, rgbToXyz, xyzToLab } from '../scripts/color-utils.mjs'
import { resolveAbstractColorSource } from '../scripts/color-system/build.mjs'
import { colorDomain } from '../scripts/theme-engine/domain-color/index.mjs'

// Pipeline-level proof for type:"solve".
//
// The pure solver is already unit-tested in color-solve.test.mjs. What was NOT
// covered: the REAL generation dispatch (`resolveAbstractColorSource` in
// build.mjs) that resolves each constraint's `against` source, calls the solver,
// and returns the resolved colour + lineage. Both shipped solve tokens (cursor,
// status) are inert (anchor already clears), so the adjust + self-heal paths had
// never executed on the real path. These tests exercise them end-to-end, turning
// the handoff doc's prose claims into executable contract.
//
// All fixture colours below are computed, not guessed (see the probe in the
// commit that introduced this file): the asserted solved hexes are the
// deterministic algorithm output, so a future solver change fails loudly here.

const lightness = (hex) => xyzToLab(rgbToXyz(hexToRgb(hex)))[0]

// Drive the real dispatch. `against:{type:'literal'}` needs no resolver stubs;
// `against:{type:'surface'}` is fed by an injected resolveSurface so we can move
// the background and watch the value re-solve.
function resolveSolve(source, variantId, overrides = {}) {
  return resolveAbstractColorSource({
    source,
    variantId,
    foundation: {},
    resolveRole: null,
    resolveSurface: null,
    resolveInterface: null,
    resolveGuidance: null,
    resolveTerminal: null,
    resolveInteraction: null,
    resolveFeedback: null,
    entryRef: 'test.token',
    domain: colorDomain,
    ...overrides,
  })
}

const surfaceStub = (hex) => ({
  resolveSurface: () => ({
    color: hex,
    chainRefs: [`surface-rules.surfaces.canvas`],
    family: null,
    tone: null,
  }),
})

test('inert solve resolves byte-identically to the anchor (this is WHY cursor/status are zero-drift)', () => {
  // 7.37:1 >= 4.5 → nothing to do; output must equal the authored anchor.
  const out = resolveSolve(
    {
      type: 'solve',
      anchor: { dark: '#8bb49e' },
      constraints: [{ kind: 'minContrast', against: { type: 'literal', values: { dark: '#1b1d1a' } }, ratio: 4.5 }],
    },
    'dark',
  )
  assert.equal(out.color, '#8bb49e')
  assert.equal(out.sourceType, 'solve')
})

test('the solver ADJUST path runs end-to-end through the real dispatch (not just the pure fn)', () => {
  // #23291f on #1b1d1a is 1.14:1 — far below 4.5; the dispatch must lighten it.
  const out = resolveSolve(
    {
      type: 'solve',
      anchor: { dark: '#23291f' },
      constraints: [{ kind: 'minContrast', against: { type: 'literal', values: { dark: '#1b1d1a' } }, ratio: 4.5 }],
    },
    'dark',
  )
  assert.notEqual(out.color, '#23291f')
  assert.equal(out.color, '#7f867a') // deterministic algorithm output
  assert.ok(contrastRatio(out.color, '#1b1d1a') >= 4.5, `got ${contrastRatio(out.color, '#1b1d1a')}`)
  assert.ok(lightness(out.color) > lightness('#23291f'), 'lightened toward the dark canvas constraint')
})

test('self-heal: when the constraint background moves, the resolved colour re-solves to stay satisfying', () => {
  // The keystone property. Same authored cursor anchor, two different canvases,
  // resolved through the real source-graph dispatch.
  const source = {
    type: 'solve',
    anchor: { dark: '#8bb49e' },
    constraints: [{ kind: 'minContrast', against: { type: 'surface', id: 'canvas' }, ratio: 4.5 }],
  }
  const onDarkCanvas = resolveSolve(source, 'dark', surfaceStub('#1b1d1a')) // 7.37:1 → inert
  const onLightCanvas = resolveSolve(source, 'dark', surfaceStub('#e7e5d8')) // 1.82:1 → must re-solve

  assert.equal(onDarkCanvas.color, '#8bb49e', 'unchanged while the dark canvas keeps it readable')
  assert.notEqual(onLightCanvas.color, '#8bb49e', 'the surface moved, so the value is no longer frozen')
  assert.equal(onLightCanvas.color, '#476d5a') // deterministic re-solve (darkened to clear the light canvas)
  assert.ok(contrastRatio(onDarkCanvas.color, '#1b1d1a') >= 4.5)
  assert.ok(contrastRatio(onLightCanvas.color, '#e7e5d8') >= 4.5, 'satisfies its OWN, moved background')
})

test('the resolved background is recorded as a dependency in chainRefs (lineage stays correct)', () => {
  const out = resolveSolve(
    {
      type: 'solve',
      anchor: { dark: '#8bb49e' },
      constraints: [{ kind: 'minContrast', against: { type: 'surface', id: 'canvas' }, ratio: 3 }],
    },
    'dark',
    surfaceStub('#1b1d1a'),
  )
  assert.ok(
    out.chainRefs.includes('canvas'),
    `expected the constraint background in lineage, got ${JSON.stringify(out.chainRefs)}`,
  )
})

test('an unsatisfiable constraint throws loudly through the dispatch (never emits a silent bad colour)', () => {
  assert.throws(
    () =>
      resolveSolve(
        {
          type: 'solve',
          anchor: { dark: '#8bb49e' },
          constraints: [{ kind: 'minContrast', against: { type: 'literal', values: { dark: '#7f7f7f' } }, ratio: 21 }],
        },
        'dark',
      ),
    /no lightness/,
  )
})
