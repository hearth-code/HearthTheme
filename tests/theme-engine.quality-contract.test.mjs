import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  buildQualityContract,
  resolvePairGate,
} from '../scripts/color-system/quality-contract-core.mjs'
import {
  buildCriticalPairFloors,
  buildGlobalSeparationConstraint,
} from '../scripts/generate-theme-variants-node.mjs'
import {
  COLOR_SYSTEM_SCHEME_ID,
  loadQualityContract,
} from '../scripts/color-system.mjs'
import { resolvePairGateThreshold } from '../scripts/theme-audit.mjs'

test('resolvePairGate follows the declared precedence order', () => {
  const profile = {
    default: 4.5,
    byVariant: { light: 5 },
    byScheme: { ember: { light: 10, default: 7 } },
  }

  assert.equal(resolvePairGate(profile, { schemeId: 'ember', variantId: 'light' }), 10)
  assert.equal(resolvePairGate(profile, { schemeId: 'ember', variantId: 'dark' }), 7)
  assert.equal(resolvePairGate(profile, { schemeId: 'moss', variantId: 'light' }), 5)
  assert.equal(resolvePairGate(profile, { schemeId: 'moss', variantId: 'dark' }), 4.5)
  assert.equal(resolvePairGate(null, { schemeId: 'moss', variantId: 'dark', fallback: 9 }), 9)
  assert.equal(resolvePairGate({}, { variantId: 'dark', fallback: 9 }), 9)
})

test('the generator derives its critical-pair floors from the shared contract core', () => {
  // buildCriticalPairFloors (runtime-bound, drives the joint optimizer and the emit
  // assertion) and loadQualityContract (pure loader view, consumed by audits and the
  // Forge worker) must be the same derivation — this is the single-source guarantee.
  const contract = loadQualityContract(COLOR_SYSTEM_SCHEME_ID)
  for (const variantId of ['dark', 'light']) {
    assert.deepEqual(
      buildCriticalPairFloors(variantId),
      contract.variants[variantId].criticalPairFloors,
      `${variantId}: generator floors == contract floors`,
    )
  }
})

test('the generator derives its globalSeparation constraint from the shared contract core', () => {
  const contract = loadQualityContract(COLOR_SYSTEM_SCHEME_ID)
  for (const variantId of ['dark', 'light']) {
    assert.deepEqual(
      buildGlobalSeparationConstraint(variantId),
      contract.variants[variantId].globalSeparation,
      `${variantId}: generator constraint == contract constraint`,
    )
  }
})

test('the theme audit resolves pair gates through the shared contract core', () => {
  const profile = {
    default: 4.5,
    byVariant: { light: 5 },
    byScheme: { ember: { light: 10 } },
  }
  for (const schemeId of ['moss', 'ember']) {
    for (const variantId of ['dark', 'light']) {
      assert.equal(
        resolvePairGateThreshold(profile, variantId, 99, schemeId),
        resolvePairGate(profile, { schemeId, variantId, fallback: 99 }),
      )
    }
  }
})

test('buildQualityContract carries floors and separation targets per variant', () => {
  const contract = buildQualityContract({
    tuning: {
      roleLaneProfile: { criticalPairDeltaEByVariant: { default: { 'function->keyword': 13 } } },
      pairSeparationGates: { operatorCommentDeltaE: { default: 10 } },
      globalSeparationTargetByVariant: { light: { median: 1.28, p25: 1.03, p10: 0.77 } },
      globalSeparationRoleProfile: { baselineDeltaE: 8 },
    },
    colorContract: { criticalPairs: [{ left: 'keyword', right: 'string', minDeltaE: 9 }] },
    schemeId: 'moss',
    variantIds: ['dark', 'light'],
  })

  assert.equal(contract.schemeId, 'moss')
  const light = contract.variants.light
  const has = (a, b, min) => light.criticalPairFloors.some((f) => f.a === a && f.b === b && f.min === min)
  assert.ok(has('function', 'keyword', 13), 'table floor present')
  assert.ok(has('operator', 'comment', 10), 'gate floor present')
  assert.ok(has('method', 'property', 10), 'gate fallback floor present')
  assert.ok(has('keyword', 'string', 9), 'scheme contract floor present')
  assert.deepEqual(light.globalSeparation, {
    kind: 'globalSeparation',
    target: { median: 1.28, p25: 1.03, p10: 0.77 },
    tolerance: 0,
    baselineDeltaE: 8,
  })
  assert.equal(contract.variants.dark.globalSeparation, null, 'dark declares no distribution target')
})

test('the quality-contract core stays bundle-safe (no imports at all)', () => {
  // The Forge worker bundles this module; a loader or fs import here would silently
  // couple the browser path back to the repo.
  const source = fs.readFileSync('scripts/color-system/quality-contract-core.mjs', 'utf8')
  assert.doesNotMatch(source, /^\s*import\s/m, 'quality-contract-core must not import anything')
})
