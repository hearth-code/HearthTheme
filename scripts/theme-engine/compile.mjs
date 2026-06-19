// The generic theme compiler entry point.
//
//   compile({ source, domain, emitters, variant }) -> File[]
//
// Phase 6 (T6.1) keeps the existing repo loaders/builders as the source adapter,
// then runs verify -> emit through the generic engine seam.

import { buildColorLanguageModel } from '../color-system/build.mjs'
import { buildGeneratedPlatformTokenMaps } from '../color-system/artifacts.mjs'
import themeConfig from '../../theme.config.mjs'
import { verifyResolvedModel } from './verify/model.mjs'

function buildModelFromSource({ source, domain, variant }) {
  if (!source) {
    return buildColorLanguageModel({ domain, variant })
  }
  if (typeof source === 'function') {
    return source({ domain, variant })
  }
  if (source.model) {
    return source.model
  }
  if (typeof source.buildModel === 'function') {
    return source.buildModel({ domain, variant })
  }
  if (typeof source.load === 'function') {
    return source.load({ domain, variant })
  }
  throw new Error('compile: source must be a function or provide model/buildModel/load')
}

/**
 * @param {{ source?: object|Function, domain?: object, emitters?: import('./types.mjs').Emitter[], variant?: object, model?: object, verify?: Function }} [options]
 * @returns {import('./types.mjs').File[]}
 */
export function compile({
  source = null,
  domain = themeConfig.domain,
  emitters = themeConfig.emitters,
  variant = themeConfig.variants,
  model = null,
  verify = verifyResolvedModel,
} = {}) {
  const resolvedModel = model ?? buildModelFromSource({ source, domain, variant })
  const maps = buildGeneratedPlatformTokenMaps(resolvedModel)
  if (verify) {
    verify({ model: resolvedModel, maps, domain, variant, emitters })
  }
  return emitters.flatMap((emitter) => emitter.emit(maps))
}
