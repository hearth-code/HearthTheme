const COMPOSITION_META_KEYS = new Set(['byVariant', 'override', 'overrides', 'knobs'])
const KNOB_SUFFIX = 'FromVariantKnob'

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function cloneWithoutCompositionMeta(value) {
  if (Array.isArray(value)) return value.map((item) => cloneWithoutCompositionMeta(item))
  if (!isPlainObject(value)) return value

  const out = {}
  for (const [key, child] of Object.entries(value)) {
    if (COMPOSITION_META_KEYS.has(key)) continue
    out[key] = cloneWithoutCompositionMeta(child)
  }
  return out
}

function lineageRef(layer, path) {
  return `${layer}.${path}`
}

function joinPath(path, key) {
  return path ? `${path}.${key}` : key
}

function shouldDeepMerge(existing, incoming) {
  if (!isPlainObject(existing) || !isPlainObject(incoming)) return false
  if ('type' in existing || 'type' in incoming) {
    return existing.type === incoming.type
  }
  return true
}

function recordLineage(lineage, path, layer, ref = null) {
  lineage[path] = { layer, ref: ref || lineageRef(layer, path) }
}

function mergeLayer(target, patch, lineage, layer, path = '') {
  if (!isPlainObject(patch)) return target

  for (const [key, value] of Object.entries(patch)) {
    if (COMPOSITION_META_KEYS.has(key)) continue
    const nextPath = joinPath(path, key)
    if (shouldDeepMerge(target[key], value)) {
      mergeLayer(target[key], value, lineage, layer, nextPath)
      continue
    }
    target[key] = cloneWithoutCompositionMeta(value)
    recordLeaves(lineage, target[key], layer, nextPath)
  }

  return target
}

function recordLeaves(lineage, value, layer, path) {
  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      recordLeaves(lineage, child, layer, joinPath(path, key))
    }
    return
  }
  recordLineage(lineage, path, layer)
}

function getVariantId(selector) {
  const variantId = selector?.variantId ?? selector?.variant?.id
  if (!variantId) {
    throw new Error('composeSource: selector.variantId is required')
  }
  return variantId
}

function lookupKnobCell(knobs, ref, variantId) {
  const [groupId, knobId] = String(ref || '').split('.')
  if (!groupId || !knobId) {
    throw new Error(`composeSource: invalid variant knob ref "${String(ref)}"`)
  }
  const value = knobs?.[groupId]?.[knobId]?.[variantId]
  if (value == null) {
    throw new Error(`composeSource: missing variant knob "${ref}.${variantId}"`)
  }
  return value
}

function concreteKnobKey(key) {
  const base = key.slice(0, -KNOB_SUFFIX.length)
  return base ? `${base[0].toLowerCase()}${base.slice(1)}` : key
}

function resolveKnobRefs(value, { knobs, variantId, lineage, path = '' }) {
  if (Array.isArray(value)) {
    return value.map((item, index) => resolveKnobRefs(item, { knobs, variantId, lineage, path: `${path}[${index}]` }))
  }
  if (!isPlainObject(value)) return value

  const out = {}
  for (const [key, child] of Object.entries(value)) {
    const childPath = joinPath(path, key)
    if (key.endsWith(KNOB_SUFFIX) && typeof child === 'string') {
      const targetKey = concreteKnobKey(key)
      const targetPath = joinPath(path, targetKey)
      out[targetKey] = lookupKnobCell(knobs, child, variantId)
      recordLineage(lineage, targetPath, 'knobs', `variant-knobs.${child}.${variantId}`)
      continue
    }
    out[key] = resolveKnobRefs(child, { knobs, variantId, lineage, path: childPath })
  }
  return out
}

/**
 * Compose one effective source cell without enumerating the full variant matrix.
 *
 * Precedence is intentionally single-order and leaf-level:
 * base -> scheme override -> selected variant override -> selected knob cell.
 */
export function composeSource(base, scheme = {}, selector = {}) {
  const variantId = getVariantId(selector)
  const lineage = {}
  const source = {}

  mergeLayer(source, base, lineage, 'base')
  mergeLayer(source, scheme?.override ?? scheme?.overrides ?? scheme, lineage, 'scheme')
  mergeLayer(source, base?.byVariant?.[variantId], lineage, 'variant')
  mergeLayer(source, scheme?.byVariant?.[variantId], lineage, 'variant')

  return {
    source: resolveKnobRefs(source, {
      knobs: selector.knobs ?? scheme?.knobs ?? base?.knobs ?? {},
      variantId,
      lineage,
    }),
    lineage,
  }
}
