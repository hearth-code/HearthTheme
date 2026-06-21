import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildSemanticPalette,
  buildResolvedFeedbackRules,
  buildResolvedGuidanceRules,
  buildResolvedInterfaceRules,
  buildResolvedInteractionRules,
  buildResolvedSurfaceRules,
  buildResolvedTerminalRules,
} from '../scripts/color-system/build.mjs'
import { colorDomain } from '../scripts/theme-engine/domain-color/index.mjs'

// Phase 2 / T2.2: the layer builders are exported as explicit seams. These tests
// keep the fixtures tiny so each stage can be entered without the full repo model.

const variants = Object.freeze([{ id: 'dark' }])
const variantProfiles = Object.freeze({ variants: { dark: { mode: 'dark' } } })
const variantKnobs = Object.freeze({})
const foundation = Object.freeze({
  families: {
    neutral: {
      tones: {
        canvas: { dark: '#101010' },
        border: { dark: '#303030' },
      },
    },
    accent: {
      tones: {
        keyword: { dark: '#8bb49e' },
      },
    },
  },
})

test('layer builders are exported as stage seams', () => {
  for (const builder of [
    buildSemanticPalette,
    buildResolvedSurfaceRules,
    buildResolvedInterfaceRules,
    buildResolvedInteractionRules,
    buildResolvedFeedbackRules,
    buildResolvedGuidanceRules,
    buildResolvedTerminalRules,
  ]) {
    assert.equal(typeof builder, 'function')
  }
})

test('semantic palette builder resolves a minimal role from foundation', () => {
  const { palette, resolved } = buildSemanticPalette(
    foundation,
    {
      roles: {
        keyword: {
          source: { family: 'accent', tone: 'keyword' },
        },
      },
    },
    variantProfiles,
    variants,
    colorDomain,
  )

  assert.equal(palette.keyword.dark, '#8bb49e')
  assert.equal(resolved.keyword.dark.family, 'accent')
  assert.equal(resolved.keyword.dark.tone, 'keyword')
})

test('surface builder resolves a minimal surface from foundation', () => {
  const surfaceRules = buildResolvedSurfaceRules(
    {
      schemaVersion: 1,
      description: 'test surfaces',
      surfaces: {
        canvas: {
          description: 'canvas',
          source: { type: 'foundation', family: 'neutral', tone: 'canvas' },
        },
      },
    },
    foundation,
    variantProfiles,
    variantKnobs,
    variants,
    colorDomain,
  )

  assert.equal(surfaceRules.surfaces.canvas.dark, '#101010')
  assert.equal(surfaceRules.resolved.canvas.dark.sourceType, 'foundation')
  assert.ok(surfaceRules.resolved.canvas.dark.chainRefs.includes('surface-rules.surfaces.canvas'))
})

test('interaction builder resolves through injected surface and interface tables', () => {
  const surfaceRules = {
    resolved: {
      canvas: {
        dark: {
          color: '#101010',
          chainRefs: ['surface-rules.surfaces.canvas'],
          family: 'neutral',
          tone: 'canvas',
        },
      },
    },
  }
  const interfaceRules = {
    interfaces: {
      border: {
        resolved: {
          dark: {
            color: '#303030',
            chainRefs: ['interface-rules.interfaces.border'],
            family: 'neutral',
            tone: 'border',
          },
        },
      },
    },
  }

  const interactionRules = buildResolvedInteractionRules(
    {
      schemaVersion: 1,
      description: 'test interactions',
      interactions: {
        hover: {
          description: 'hover',
          source: { type: 'surface', id: 'canvas' },
          derive: {
            mix: { with: { type: 'interface', id: 'border' }, t: 0.5 },
          },
        },
      },
    },
    foundation,
    surfaceRules,
    interfaceRules,
    {},
    variantProfiles,
    variantKnobs,
    variants,
    colorDomain,
  )

  const hover = interactionRules.interactions.hover.resolved.dark
  assert.equal(hover.color, '#202020')
  assert.equal(hover.sourceType, 'surface')
  assert.ok(hover.chainRefs.includes('surface-rules.surfaces.canvas'))
  assert.ok(hover.chainRefs.includes('interface-rules.interfaces.border'))
})

test('surface builder throws on an intra-layer derivation cycle', () => {
  assert.throws(
    () =>
      buildResolvedSurfaceRules(
        {
          schemaVersion: 1,
          description: 'cyclic surfaces',
          surfaces: {
            a: { source: { type: 'surface', id: 'b' } },
            b: { source: { type: 'surface', id: 'a' } },
          },
        },
        foundation,
        variantProfiles,
        variantKnobs,
        variants,
        colorDomain,
      ),
    /Surface derivation cycle detected: a:dark/,
  )
})
