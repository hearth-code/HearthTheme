import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildColorLanguageModel } from '../scripts/color-system/build.mjs'

// Engine invariants (§3 of docs/theme-engine-extraction-plan.md), enforced on the
// REAL production model — turning the "高可靠 / high reliability" pillars from prose
// claims into executable guarantees. Additive: no generation change, zero drift.
//
// Covered here:
//   #2 Deterministic — same source ⇒ identical model, every build.
//   #4 Lineage-complete — every resolved token records a non-empty provenance chain.
// (#1 Acyclic is already covered per-layer in theme-engine.layers.test.mjs; #3
//  Idempotent is covered by the committed-output golden + check:sync gate.)

test('invariant #2 — the resolved model is deterministic (same source ⇒ equal model)', () => {
  const a = buildColorLanguageModel()
  const b = buildColorLanguageModel()
  assert.deepEqual(b, a)
})

// Surfaces expose `resolved[id][variant]`; the other chrome layers expose
// `{plural}[id].resolved[variant]`. This normalises both to the variant→cell map.
const variantCells = (entry) => entry?.resolved ?? entry

test('invariant #4 — every resolved chrome token has a non-empty lineage chain', () => {
  const model = buildColorLanguageModel()
  const variantIds = model.variants.variants.map((v) => v.id)

  const layers = [
    ['surfaceRules', model.surfaceRules.resolved],
    ['interfaceRules', model.interfaceRules.interfaces],
    ['interactionRules', model.interactionRules.interactions],
    ['feedbackRules', model.feedbackRules.feedbacks],
    ['guidanceRules', model.guidanceRules.guidances],
    ['terminalRules', model.terminalRules.terminals],
  ]

  let checked = 0
  for (const [layerName, container] of layers) {
    assert.ok(container && typeof container === 'object', `${layerName}: missing resolved container`)
    for (const [id, entry] of Object.entries(container)) {
      const cells = variantCells(entry)
      for (const variantId of variantIds) {
        const cell = cells?.[variantId]
        assert.ok(cell, `${layerName}.${id}.${variantId}: missing resolved cell`)
        assert.ok(
          Array.isArray(cell.chainRefs) && cell.chainRefs.length > 0,
          `${layerName}.${id}.${variantId}: empty lineage chain`,
        )
        checked += 1
      }
    }
  }
  assert.ok(checked > 0, 'swept at least one resolved token')
})
