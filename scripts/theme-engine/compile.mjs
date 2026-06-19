// The generic theme compiler entry point.
//
//   compile({ emitters, model }) -> File[]
//
// Phase 6 (T6.1) wires the EMIT stage: it resolves the model (via the existing
// domain-parameterized builder) and runs each emitter plugin over the resulting
// platform-token maps, returning the files. This is the single generic entry the
// vision calls for — "run it and the whole chain produces the terminal artifacts".
//
// Still partial vs the full target signature compile({ source, domain, emitters,
// variant }): the load + resolve stages currently delegate to
// buildColorLanguageModel() (which is itself domain-parameterized, see Phase 3),
// rather than being inlined here. Folding load/resolve in (and a `verify` stage)
// is the remaining Phase 6 work.

import { buildColorLanguageModel } from '../color-system/build.mjs'
import { buildGeneratedPlatformTokenMaps } from '../color-system/artifacts.mjs'

/**
 * @param {{ emitters?: import('./types.mjs').Emitter[], model?: object }} [options]
 * @returns {import('./types.mjs').File[]}
 */
export function compile({ emitters = [], model = buildColorLanguageModel() } = {}) {
  const maps = buildGeneratedPlatformTokenMaps(model)
  return emitters.flatMap((emitter) => emitter.emit(maps))
}
