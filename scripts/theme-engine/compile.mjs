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

// Variant selection happens at EMIT time: the model is always built in full (so
// model validation + lineage stay complete), then the platform maps are scoped to
// the chosen variant(s) before the emitters run. A null selector — or one naming
// every variant, e.g. the default themeConfig.variants — is identity, keeping the
// default production build byte-identical.
function selectedVariantIds(variant) {
  if (variant == null) return null
  const wanted = Array.isArray(variant) ? variant : [variant]
  const ids = wanted.map((v) => (typeof v === 'string' ? v : v?.id)).filter(Boolean)
  return ids.length > 0 ? ids : null
}

function pickVariants(obj, ids) {
  return Object.fromEntries(Object.entries(obj ?? {}).filter(([variantId]) => ids.includes(variantId)))
}

function scopeMapsToVariants(maps, ids) {
  if (!ids) return maps
  return {
    themes: pickVariants(maps.themes, ids),
    tokenSets: pickVariants(maps.tokenSets, ids),
    web: pickVariants(maps.web, ids),
    obsidian: pickVariants(maps.obsidian, ids),
    vscode: {
      semantic: pickVariants(maps.vscode?.semantic, ids),
      textmate: pickVariants(maps.vscode?.textmate, ids),
      workbench: pickVariants(maps.vscode?.workbench, ids),
    },
  }
}

/**
 * @param {{ source?: object|Function, domain?: object, emitters?: import('./types.mjs').Emitter[], variant?: object, model?: object, themes?: object, verify?: Function }} [options]
 * @returns {import('./types.mjs').File[]}
 */
export function compile({
  source = null,
  domain = themeConfig.domain,
  emitters = themeConfig.emitters,
  variant = themeConfig.variants,
  model = null,
  // Optional in-memory VS Code theme objects (e.g. buildVscodeThemes().themes). When
  // passed, the platform maps derive from these instead of the committed JSON on disk,
  // letting the engine produce the VS Code theme. Default (null) reads disk → byte-identical.
  themes = null,
  verify = verifyResolvedModel,
} = {}) {
  const resolvedModel = model ?? buildModelFromSource({ source, domain, variant })
  const variantIds = selectedVariantIds(variant)
  if (variantIds) {
    const known = new Set((resolvedModel.variants?.variants ?? []).map((v) => v.id))
    const unknown = variantIds.filter((id) => !known.has(id))
    if (unknown.length > 0) {
      throw new Error(`compile: unknown variant selector(s): ${unknown.join(', ')}`)
    }
  }
  const maps = scopeMapsToVariants(buildGeneratedPlatformTokenMaps(resolvedModel, { themes }), variantIds)
  if (verify) {
    verify({ model: resolvedModel, maps, domain, variant, emitters })
  }
  return emitters.flatMap((emitter) => emitter.emit(maps))
}
