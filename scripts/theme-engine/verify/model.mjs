// Compile-time verify stage: assert engine invariants on the resolved model
// before any emitter runs. Runs in production via compile() (see sync-themes.mjs),
// so a future regression fails the build loudly instead of shipping a bad artifact.

// Surfaces expose `resolved[id][variant]`; the other chrome layers expose
// `{plural}[id].resolved[variant]`. Normalise both to the variant→cell map.
const variantCells = (entry) => entry?.resolved ?? entry

const LINEAGE_LAYERS = [
  ['surfaceRules', (m) => m.surfaceRules?.resolved],
  ['interfaceRules', (m) => m.interfaceRules?.interfaces],
  ['interactionRules', (m) => m.interactionRules?.interactions],
  ['feedbackRules', (m) => m.feedbackRules?.feedbacks],
  ['guidanceRules', (m) => m.guidanceRules?.guidances],
  ['terminalRules', (m) => m.terminalRules?.terminals],
]

// Invariant #4 (lineage-complete): every resolved chrome token records a
// non-empty provenance chain. Lenient on absent layers/cells so partial or
// stubbed models (in tests) don't false-trip; strict on every present cell —
// which, for the real model, is all of them.
export function assertLineageComplete(model) {
  const variantIds = (model.variants?.variants ?? []).map((v) => v.id)
  if (variantIds.length === 0) return
  for (const [layerName, pick] of LINEAGE_LAYERS) {
    const container = pick(model)
    if (!container || typeof container !== 'object') continue
    for (const [id, entry] of Object.entries(container)) {
      const cells = variantCells(entry)
      for (const variantId of variantIds) {
        const cell = cells?.[variantId]
        if (!cell) continue
        if (!Array.isArray(cell.chainRefs) || cell.chainRefs.length === 0) {
          throw new Error(`compile: ${layerName}.${id}.${variantId} has no lineage chain`)
        }
      }
    }
  }
}

export function verifyResolvedModel({ model, maps, emitters }) {
  if (!model || typeof model !== 'object') {
    throw new Error('compile: resolved model must be an object')
  }
  if (!maps || typeof maps !== 'object') {
    throw new Error('compile: generated platform maps must be an object')
  }
  if (!Array.isArray(emitters)) {
    throw new Error('compile: emitters must be an array')
  }
  for (const emitter of emitters) {
    if (!emitter || typeof emitter.emit !== 'function') {
      throw new Error('compile: every emitter must provide emit(maps)')
    }
  }
  assertLineageComplete(model)
}
