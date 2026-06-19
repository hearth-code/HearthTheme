import {
  COLOR_SYSTEM_ACTIVE_SCHEME_PATH,
  COLOR_SYSTEM_ADAPTERS_PATH,
  COLOR_SYSTEM_FOUNDATION_PATH,
  COLOR_SYSTEM_FEEDBACK_RULES_PATH,
  COLOR_SYSTEM_GUIDANCE_RULES_PATH,
  COLOR_SYSTEM_INTERFACE_RULES_PATH,
  COLOR_SYSTEM_INTERACTION_RULES_PATH,
  COLOR_SYSTEM_PHILOSOPHY_PATH,
  COLOR_SYSTEM_SCHEME_PATH,
  COLOR_SYSTEM_SEMANTIC_PATH,
  COLOR_SYSTEM_SEMANTIC_RULES_PATH,
  COLOR_SYSTEM_SURFACE_RULES_PATH,
  COLOR_SYSTEM_TAXONOMY_PATH,
  COLOR_SYSTEM_TERMINAL_RULES_PATH,
  COLOR_SYSTEM_TUNING_PATH,
  COLOR_SYSTEM_VARIANT_KNOBS_PATH,
  COLOR_SYSTEM_VARIANT_PROFILES_PATH,
  COLOR_SYSTEM_VARIANTS_PATH,
  loadActiveSchemeContext,
  loadColorSchemeManifest,
  loadColorSystemVariants,
  loadFoundationPalette,
  loadFeedbackAdapters,
  loadFeedbackRules,
  loadGuidanceAdapters,
  loadGuidanceRules,
  loadInterfaceAdapters,
  loadInterfaceRules,
  loadInteractionAdapters,
  loadInteractionRules,
  loadRoleAdapters,
  loadSchemeTaxonomy,
  loadSemanticRules,
  loadSurfaceAdapters,
  loadSurfaceRules,
  loadTerminalAdapters,
  loadTerminalRules,
  loadVariantKnobs,
  loadVariantProfiles,
} from '../color-system.mjs'
import { clamp, hexToRgba, hslToHex, hueDistance, mixHex, normalizeHex, rgbToHsl, rgbaToHex } from '../color-utils.mjs'
import { solveConstrainedColor } from './solve.mjs'

const EXPORTED_SITE_TOKEN_KEYS = [
  'bg',
  'fg',
  'lineBg',
  'lineNo',
  'shellInk',
  'shellSupport',
  'shellMuted',
  'shellSubtle',
  'onAccent',
  'onStatus',
  'shellRaised',
  'shellBand',
  'accentHover',
  'navActiveFill',
  'navInactiveFill',
  'navActiveInk',
  'guide',
  'guideActive',
  'guideInk',
  'whitespace',
  'bracketWarm',
  'bracketBright',
  'bracketCool',
  'bracketMatchFill',
  'bracketMatchStroke',
  'terminalBlack',
  'terminalRed',
  'terminalGreen',
  'terminalYellow',
  'terminalBlue',
  'terminalMagenta',
  'terminalCyan',
  'terminalWhite',
  'terminalBrightBlack',
  'terminalBrightRed',
  'terminalBrightGreen',
  'terminalBrightYellow',
  'terminalBrightBlue',
  'terminalBrightMagenta',
  'terminalBrightCyan',
  'terminalBrightWhite',
  'note',
  'info',
  'success',
  'warning',
  'error',
  'selection',
  'cursor',
  'status',
  'sidebar',
  'border',
  'keyword',
  'fn',
  'method',
  'property',
  'string',
  'number',
  'type',
  'variable',
  'operator',
  'comment',
]

function mergeDerive(base, override) {
  return {
    ...(base || {}),
    ...(override || {}),
  }
}

function resolveFamilyToneHex(foundation, source, variantId) {
  return foundation.families[source.family]?.tones[source.tone]?.[variantId] ?? null
}

function shiftHue(baseHue, delta) {
  let next = Number(baseHue) + Number(delta)
  while (next < 0) next += 360
  while (next >= 360) next -= 360
  return next
}

function clampHueToRange(hue, range) {
  if (!range) return hue
  const min = Number(range.min)
  const max = Number(range.max)
  if (hue == null) return hue
  const inWrappedRange = min <= max
    ? hue >= min && hue <= max
    : hue >= min || hue <= max
  if (inWrappedRange) return hue
  const toMin = hueDistance(hue, min)
  const toMax = hueDistance(hue, max)
  return toMin <= toMax ? min : max
}

function applyDerive(baseHex, derive, foundation, variantId, steps) {
  let current = normalizeHex(baseHex)
  if (!current) {
    throw new Error(`Cannot derive semantic color from invalid base color: ${String(baseHex)}`)
  }

  if (!derive || typeof derive !== 'object') return current

  if (derive.mix) {
    const mixTarget = resolveFamilyToneHex(foundation, derive.mix.with, variantId)
    if (!mixTarget) {
      throw new Error(`Missing mix target for ${derive.mix.with.family}.${derive.mix.with.tone}.${variantId}`)
    }
    current = mixHex(current, mixTarget, derive.mix.t)
    steps.push({
      type: 'mix',
      with: `${derive.mix.with.family}.${derive.mix.with.tone}.${variantId}`,
      t: derive.mix.t,
      value: current,
    })
  }

  if (
    derive.hueShift !== undefined ||
    derive.saturationScale !== undefined ||
    derive.lightnessShift !== undefined ||
    derive.clampHue
  ) {
    const hsl = rgbToHsl(current)
    if (!hsl) {
      throw new Error(`Cannot convert ${current} to HSL while applying semantic derivation`)
    }
    const shifted = {
      h: derive.hueShift !== undefined ? shiftHue(hsl.h, derive.hueShift) : hsl.h,
      s: derive.saturationScale !== undefined ? clamp(hsl.s * derive.saturationScale, 0, 1) : hsl.s,
      l: derive.lightnessShift !== undefined ? clamp(hsl.l + derive.lightnessShift, 0, 1) : hsl.l,
    }
    shifted.h = clampHueToRange(shifted.h, derive.clampHue)
    current = hslToHex(shifted)
    steps.push({
      type: 'hsl-adjust',
      hueShift: derive.hueShift ?? 0,
      saturationScale: derive.saturationScale ?? 1,
      lightnessShift: derive.lightnessShift ?? 0,
      clampHue: derive.clampHue ?? null,
      value: current,
    })
  }

  if (derive.output) {
    current = normalizeHex(derive.output)
    steps.push({
      type: 'escape-hatch',
      value: current,
    })
  }

  return current
}

function uniqueRefs(items) {
  const seen = new Set()
  const out = []
  for (const item of items) {
    if (!item || seen.has(item)) continue
    seen.add(item)
    out.push(item)
  }
  return out
}

function toOpaqueHex(hex) {
  const normalized = normalizeHex(hex)
  if (!normalized) return null
  return normalized.length === 9 ? normalized.slice(0, 7) : normalized
}

function applyAlpha(hex, alpha) {
  const rgba = hexToRgba(hex)
  if (!rgba) {
    throw new Error(`Cannot apply alpha to invalid color: ${String(hex)}`)
  }
  return rgbaToHex({
    r: rgba.r,
    g: rgba.g,
    b: rgba.b,
    a: Math.round(clamp(alpha, 0, 1) * 255),
    hasAlpha: true,
  })
}

// Exported as a test seam: the solve dispatch (against-resolution + solver +
// lineage) is proven end-to-end in tests/color-solve-pipeline.test.mjs.
export function resolveAbstractColorSource({
  source,
  variantId,
  foundation,
  resolveRole,
  resolveSurface,
  resolveInterface,
  resolveGuidance,
  resolveTerminal,
  resolveInteraction,
  resolveFeedback,
  entryRef,
}) {
  if (!source || typeof source !== 'object') {
    throw new Error(`Missing abstract color source for ${entryRef}.${variantId}`)
  }

  if (source.type === 'literal') {
    const value = normalizeHex(source.values?.[variantId])
    if (!value) {
      throw new Error(`Missing literal color for ${entryRef}.${variantId}`)
    }
    return {
      color: value,
      chainRefs: [`${entryRef}.source.values.${variantId}`],
      steps: [{
        type: 'literal',
        ref: `${entryRef}.source.values.${variantId}`,
        value,
      }],
      sourceType: 'literal',
      sourceRef: `${entryRef}.source.values.${variantId}`,
      family: null,
      tone: null,
    }
  }

  if (source.type === 'solve') {
    const anchor = normalizeHex(source.anchor?.[variantId])
    if (!anchor) {
      throw new Error(`Missing solve anchor for ${entryRef}.${variantId}`)
    }
    const resolvedConstraints = source.constraints.map((constraint, index) => {
      const background = resolveAbstractColorSource({
        source: constraint.against,
        variantId,
        foundation,
        resolveRole,
        resolveSurface,
        resolveInterface,
        resolveGuidance,
        resolveTerminal,
        resolveInteraction,
        resolveFeedback,
        entryRef: `${entryRef}.constraints[${index}].against`,
      })
      return {
        kind: constraint.kind,
        ratio: constraint.ratio,
        bg: toOpaqueHex(background.color),
        ref: background.sourceRef ?? background.chainRefs?.[0] ?? null,
      }
    })
    const solved = solveConstrainedColor({ anchor, constraints: resolvedConstraints })
    const anchorRef = `${entryRef}.source.anchor.${variantId}`
    return {
      color: solved.color,
      chainRefs: uniqueRefs([anchorRef, ...resolvedConstraints.map((constraint) => constraint.ref).filter(Boolean)]),
      steps: [{
        type: 'solve',
        ref: anchorRef,
        value: solved.color,
      }],
      sourceType: 'solve',
      sourceRef: anchorRef,
      family: null,
      tone: null,
    }
  }

  if (source.type === 'foundation') {
    const value = resolveFamilyToneHex(foundation, source, variantId)
    if (!value) {
      throw new Error(`Missing foundation tone for ${entryRef} via ${source.family}.${source.tone}.${variantId}`)
    }
    const ref = `foundation.families.${source.family}.tones.${source.tone}.${variantId}`
    return {
      color: value,
      chainRefs: [ref],
      steps: [{
        type: 'foundation',
        ref,
        value,
      }],
      sourceType: 'foundation',
      sourceRef: ref,
      family: source.family,
      tone: source.tone,
    }
  }

  if (source.type === 'role') {
    const resolved = resolveRole?.(source.id, variantId)
    if (!resolved) {
      throw new Error(`Missing referenced role "${source.id}" while resolving ${entryRef}.${variantId}`)
    }
    return {
      color: resolved.color,
      chainRefs: [
        `foundation.families.${resolved.family}.tones.${resolved.tone}.${variantId}`,
        `semantic-rules.roles.${source.id}`,
        `variant-profiles.variants.${variantId}`,
      ],
      steps: [{
        type: 'role-ref',
        ref: `semantic-rules.roles.${source.id}`,
        value: resolved.color,
      }],
      sourceType: 'role',
      sourceRef: source.id,
      family: resolved.family,
      tone: resolved.tone,
    }
  }

  if (source.type === 'surface') {
    const resolved = resolveSurface?.(source.id, variantId)
    if (!resolved) {
      throw new Error(`Missing referenced surface "${source.id}" while resolving ${entryRef}.${variantId}`)
    }
    return {
      color: resolved.color,
      chainRefs: resolved.chainRefs,
      steps: [{
        type: 'surface-ref',
        ref: `surface-rules.surfaces.${source.id}.${variantId}`,
        value: resolved.color,
      }],
      sourceType: 'surface',
      sourceRef: source.id,
      family: resolved.family,
      tone: resolved.tone,
    }
  }

  if (source.type === 'interface') {
    const resolved = resolveInterface?.(source.id, variantId)
    if (!resolved) {
      throw new Error(`Missing referenced interface "${source.id}" while resolving ${entryRef}.${variantId}`)
    }
    return {
      color: resolved.color,
      chainRefs: resolved.chainRefs,
      steps: [{
        type: 'interface-ref',
        ref: `interface-rules.interfaces.${source.id}.${variantId}`,
        value: resolved.color,
      }],
      sourceType: 'interface',
      sourceRef: source.id,
      family: resolved.family,
      tone: resolved.tone,
    }
  }

  if (source.type === 'guidance') {
    const resolved = resolveGuidance?.(source.id, variantId)
    if (!resolved) {
      throw new Error(`Missing referenced guidance "${source.id}" while resolving ${entryRef}.${variantId}`)
    }
    return {
      color: resolved.color,
      chainRefs: resolved.chainRefs,
      steps: [{
        type: 'guidance-ref',
        ref: `guidance-rules.guidances.${source.id}.values.${variantId}`,
        value: resolved.color,
      }],
      sourceType: 'guidance',
      sourceRef: source.id,
      family: resolved.family,
      tone: resolved.tone,
    }
  }

  if (source.type === 'terminal') {
    const resolved = resolveTerminal?.(source.id, variantId)
    if (!resolved) {
      throw new Error(`Missing referenced terminal "${source.id}" while resolving ${entryRef}.${variantId}`)
    }
    return {
      color: resolved.color,
      chainRefs: resolved.chainRefs,
      steps: [{
        type: 'terminal-ref',
        ref: `terminal-rules.terminals.${source.id}.values.${variantId}`,
        value: resolved.color,
      }],
      sourceType: 'terminal',
      sourceRef: source.id,
      family: resolved.family,
      tone: resolved.tone,
    }
  }

  if (source.type === 'interaction') {
    const resolved = resolveInteraction?.(source.id, variantId)
    if (!resolved) {
      throw new Error(`Missing referenced interaction "${source.id}" while resolving ${entryRef}.${variantId}`)
    }
    return {
      color: resolved.color,
      chainRefs: resolved.chainRefs,
      steps: [{
        type: 'interaction-ref',
        ref: `interaction-rules.interactions.${source.id}.values.${variantId}`,
        value: resolved.color,
      }],
      sourceType: 'interaction',
      sourceRef: source.id,
      family: resolved.family,
      tone: resolved.tone,
    }
  }

  if (source.type === 'feedback') {
    const resolved = resolveFeedback?.(source.id, variantId)
    if (!resolved) {
      throw new Error(`Missing referenced feedback "${source.id}" while resolving ${entryRef}.${variantId}`)
    }
    return {
      color: resolved.color,
      chainRefs: resolved.chainRefs,
      steps: [{
        type: 'feedback-ref',
        ref: `feedback-rules.feedbacks.${source.id}.values.${variantId}`,
        value: resolved.color,
      }],
      sourceType: 'feedback',
      sourceRef: source.id,
      family: resolved.family,
      tone: resolved.tone,
    }
  }

  throw new Error(`Unsupported abstract color source type "${String(source.type)}" for ${entryRef}`)
}

function applyAbstractDerive({
  baseHex,
  derive,
  foundation,
  variantId,
  resolveRole,
  resolveSurface,
  resolveInterface,
  resolveGuidance,
  resolveTerminal,
  resolveInteraction,
  resolveFeedback,
  resolveVariantKnob,
  entryRef,
  steps,
}) {
  let current = normalizeHex(baseHex)
  if (!current) {
    throw new Error(`Cannot derive abstract color from invalid base color: ${String(baseHex)}`)
  }

  if (!derive || typeof derive !== 'object') {
    return {
      color: current,
      chainRefs: [],
    }
  }

  const chainRefs = []

  if (derive.mix) {
    const mixRatio = derive.mix.tFromVariantKnob
      ? resolveVariantKnob?.(derive.mix.tFromVariantKnob, variantId)
      : derive.mix.t
    if (mixRatio == null) {
      throw new Error(`Missing mix ratio while resolving ${entryRef}.${variantId}`)
    }
    const mixTarget = resolveAbstractColorSource({
      source: derive.mix.with,
      variantId,
      foundation,
      resolveRole,
      resolveSurface,
      resolveInterface,
      resolveGuidance,
      resolveTerminal,
      resolveInteraction,
      resolveFeedback,
      entryRef: `${entryRef}.derive.mix.with`,
    })
    const mixed = mixHex(toOpaqueHex(current), toOpaqueHex(mixTarget.color), mixRatio)
    current = normalizeHex(mixed)
    chainRefs.push(...mixTarget.chainRefs)
    if (derive.mix.tFromVariantKnob) {
      chainRefs.push(`variant-knobs.${derive.mix.tFromVariantKnob}.${variantId}`)
      steps.push({
        type: 'variant-knob',
        ref: `variant-knobs.${derive.mix.tFromVariantKnob}.${variantId}`,
        property: 'mix.t',
        value: mixRatio,
      })
    }
    steps.push({
      type: 'mix',
      with: mixTarget.sourceRef,
      t: mixRatio,
      value: current,
    })
  }

  if (
    derive.hueShift !== undefined ||
    derive.saturationScale !== undefined ||
    derive.lightnessShift !== undefined ||
    derive.clampHue
  ) {
    const hsl = rgbToHsl(current)
    if (!hsl) {
      throw new Error(`Cannot convert ${current} to HSL while applying abstract derivation`)
    }
    const shifted = {
      h: derive.hueShift !== undefined ? shiftHue(hsl.h, derive.hueShift) : hsl.h,
      s: derive.saturationScale !== undefined ? clamp(hsl.s * derive.saturationScale, 0, 1) : hsl.s,
      l: derive.lightnessShift !== undefined ? clamp(hsl.l + derive.lightnessShift, 0, 1) : hsl.l,
    }
    shifted.h = clampHueToRange(shifted.h, derive.clampHue)
    current = hslToHex(shifted)
    steps.push({
      type: 'hsl-adjust',
      hueShift: derive.hueShift ?? 0,
      saturationScale: derive.saturationScale ?? 1,
      lightnessShift: derive.lightnessShift ?? 0,
      clampHue: derive.clampHue ?? null,
      value: current,
    })
  }

  if (derive.alpha !== undefined) {
    current = applyAlpha(current, derive.alpha)
    steps.push({
      type: 'alpha',
      alpha: derive.alpha,
      value: current,
    })
  }

  if (derive.alphaFromVariantKnob) {
    const resolvedAlpha = resolveVariantKnob?.(derive.alphaFromVariantKnob, variantId)
    if (resolvedAlpha == null) {
      throw new Error(`Missing variant knob "${derive.alphaFromVariantKnob}" while resolving ${entryRef}.${variantId}`)
    }
    current = applyAlpha(current, resolvedAlpha)
    chainRefs.push(`variant-knobs.${derive.alphaFromVariantKnob}.${variantId}`)
    steps.push({
      type: 'variant-knob',
      ref: `variant-knobs.${derive.alphaFromVariantKnob}.${variantId}`,
      property: 'alpha',
      value: resolvedAlpha,
    })
    steps.push({
      type: 'alpha',
      alpha: resolvedAlpha,
      value: current,
    })
  }

  if (derive.output) {
    current = normalizeHex(derive.output)
    steps.push({
      type: 'escape-hatch',
      value: current,
    })
  }

  return {
    color: current,
    chainRefs,
  }
}

function buildSemanticRoleResolution({ foundation, rules, variantProfiles, roleId, variantId }) {
  const rule = rules.roles[roleId]
  if (!rule) throw new Error(`Missing semantic rule for role "${roleId}"`)
  const perVariant = rule.byVariant?.[variantId] || {}
  const source = perVariant.source || rule.source
  const baseHex = resolveFamilyToneHex(foundation, source, variantId)
  if (!baseHex) {
    throw new Error(`Missing foundation tone for role "${roleId}" via ${source.family}.${source.tone}.${variantId}`)
  }

  const steps = [{
    type: 'foundation',
    ref: `foundation.families.${source.family}.tones.${source.tone}.${variantId}`,
    value: baseHex,
  }]
  const derive = mergeDerive(rule.derive, perVariant.derive)
  const color = applyDerive(baseHex, derive, foundation, variantId, steps)
  steps.push({
    type: 'variant-profile',
    ref: `variant-profiles.variants.${variantId}`,
  })

  return {
    roleId,
    variantId,
    family: source.family,
    tone: source.tone,
    color,
    flags: rule.flags,
    usedEscapeHatch: Boolean(derive.output),
    steps,
    variantProfile: variantProfiles.variants[variantId],
  }
}

function buildSemanticPalette(foundation, rules, variantProfiles, variants) {
  const palette = {}
  const resolved = {}

  for (const roleId of Object.keys(rules.roles)) {
    palette[roleId] = {}
    resolved[roleId] = {}
    for (const variant of variants) {
      const entry = buildSemanticRoleResolution({
        foundation,
        rules,
        variantProfiles,
        roleId,
        variantId: variant.id,
      })
      palette[roleId][variant.id] = entry.color
      resolved[roleId][variant.id] = entry
    }
  }

  return { palette, resolved }
}

function buildResolvedSurfaceRules(rawSurfaceRules, foundation, variantProfiles, variantKnobs, variants) {
  const surfaces = {}
  const resolved = {}
  const resolving = new Set()

  function resolveVariantKnob(knobRef, variantId) {
    const [groupId, knobId] = String(knobRef || '').split('.')
    if (!groupId || !knobId) return null
    return variantKnobs?.[groupId]?.[knobId]?.[variantId] ?? null
  }

  function resolveSurface(surfaceId, variantId) {
    if (resolved[surfaceId]?.[variantId]) return resolved[surfaceId][variantId]
    const definition = rawSurfaceRules.surfaces[surfaceId]
    if (!definition) {
      throw new Error(`Missing surface definition for "${surfaceId}"`)
    }

    const key = `${surfaceId}:${variantId}`
    if (resolving.has(key)) {
      throw new Error(`Surface derivation cycle detected: ${key}`)
    }
    resolving.add(key)

    const variantOverride = definition.byVariant?.[variantId] || {}
    const source = variantOverride.source || definition.source
    const derive = mergeDerive(definition.derive, variantOverride.derive)
    const entryRef = `surface-rules.surfaces.${surfaceId}`
    const sourceResolution = resolveAbstractColorSource({
      source,
      variantId,
      foundation,
      resolveRole: null,
      resolveSurface,
      resolveInteraction: null,
      resolveFeedback: null,
      entryRef,
    })
    const steps = [...sourceResolution.steps]
    const derived = applyAbstractDerive({
      baseHex: sourceResolution.color,
      derive,
      foundation,
      variantId,
      resolveRole: null,
      resolveSurface,
      resolveInteraction: null,
      resolveFeedback: null,
      resolveVariantKnob,
      entryRef,
      steps,
    })
    steps.push({
      type: 'variant-profile',
      ref: `variant-profiles.variants.${variantId}`,
    })

    const result = {
      surfaceId,
      variantId,
      description: definition.description,
      color: derived.color,
      sourceType: sourceResolution.sourceType,
      sourceRef: sourceResolution.sourceRef,
      family: sourceResolution.family,
      tone: sourceResolution.tone,
      usedEscapeHatch: Boolean(derive.output),
      steps,
      variantProfile: variantProfiles.variants[variantId],
      chainRefs: uniqueRefs([
        ...sourceResolution.chainRefs,
        ...derived.chainRefs,
        entryRef,
        `variant-profiles.variants.${variantId}`,
      ]),
    }

    if (!surfaces[surfaceId]) surfaces[surfaceId] = {}
    surfaces[surfaceId][variantId] = result.color
    if (!resolved[surfaceId]) resolved[surfaceId] = {}
    resolved[surfaceId][variantId] = result
    resolving.delete(key)
    return result
  }

  for (const surfaceId of Object.keys(rawSurfaceRules.surfaces)) {
    for (const variant of variants) {
      resolveSurface(surfaceId, variant.id)
    }
  }

  return {
    schemaVersion: rawSurfaceRules.schemaVersion,
    description: rawSurfaceRules.description,
    definitions: rawSurfaceRules.surfaces,
    surfaces,
    resolved,
  }
}

function buildResolvedInterfaceRules(rawInterfaceRules, foundation, surfaceRules, variantProfiles, variantKnobs, variants) {
  const interfaces = {}
  const resolving = new Set()

  function resolveSurface(surfaceId, variantId) {
    return surfaceRules.resolved?.[surfaceId]?.[variantId] ?? null
  }

  function resolveVariantKnob(knobRef, variantId) {
    const [groupId, knobId] = String(knobRef || '').split('.')
    if (!groupId || !knobId) return null
    return variantKnobs?.[groupId]?.[knobId]?.[variantId] ?? null
  }

  function resolveInterface(interfaceId, variantId) {
    const existing = interfaces[interfaceId]?.resolved?.[variantId]
    if (existing) return existing
    const definition = rawInterfaceRules.interfaces[interfaceId]
    if (!definition) {
      throw new Error(`Missing interface definition for "${interfaceId}"`)
    }

    const key = `${interfaceId}:${variantId}`
    if (resolving.has(key)) {
      throw new Error(`Interface derivation cycle detected: ${key}`)
    }
    resolving.add(key)

    const variantOverride = definition.byVariant?.[variantId] || {}
    const source = variantOverride.source || definition.source
    const derive = mergeDerive(definition.derive, variantOverride.derive)
    const entryRef = `interface-rules.interfaces.${interfaceId}`
    const sourceResolution = resolveAbstractColorSource({
      source,
      variantId,
      foundation,
      resolveRole: null,
      resolveSurface,
      resolveInterface,
      resolveInteraction: null,
      resolveFeedback: null,
      entryRef,
    })
    const steps = [...sourceResolution.steps]
    const derived = applyAbstractDerive({
      baseHex: sourceResolution.color,
      derive,
      foundation,
      variantId,
      resolveRole: null,
      resolveSurface,
      resolveInterface,
      resolveInteraction: null,
      resolveFeedback: null,
      resolveVariantKnob,
      entryRef,
      steps,
    })
    steps.push({
      type: 'variant-profile',
      ref: `variant-profiles.variants.${variantId}`,
    })

    const result = {
      interfaceId,
      variantId,
      description: definition.description,
      color: derived.color,
      sourceType: sourceResolution.sourceType,
      sourceRef: sourceResolution.sourceRef,
      family: sourceResolution.family,
      tone: sourceResolution.tone,
      usedEscapeHatch: Boolean(derive.output),
      steps,
      variantProfile: variantProfiles.variants[variantId],
      chainRefs: uniqueRefs([
        ...sourceResolution.chainRefs,
        ...derived.chainRefs,
        entryRef,
        `variant-profiles.variants.${variantId}`,
      ]),
    }

    if (!interfaces[interfaceId]) {
      interfaces[interfaceId] = {
        description: definition.description,
        values: {},
        resolved: {},
      }
    }
    interfaces[interfaceId].values[variantId] = result.color
    interfaces[interfaceId].resolved[variantId] = result
    resolving.delete(key)
    return result
  }

  for (const interfaceId of Object.keys(rawInterfaceRules.interfaces)) {
    for (const variant of variants) {
      resolveInterface(interfaceId, variant.id)
    }
  }

  return {
    schemaVersion: rawInterfaceRules.schemaVersion,
    description: rawInterfaceRules.description,
    definitions: rawInterfaceRules.interfaces,
    interfaces,
  }
}

function buildResolvedInteractionRules(rawInteractionRules, foundation, surfaceRules, interfaceRules, resolvedSemantic, variantProfiles, variantKnobs, variants) {
  const interactions = {}
  const resolving = new Set()

  function resolveSurface(surfaceId, variantId) {
    return surfaceRules.resolved?.[surfaceId]?.[variantId] ?? null
  }

  function resolveInterface(interfaceId, variantId) {
    return interfaceRules.interfaces?.[interfaceId]?.resolved?.[variantId] ?? null
  }

  function resolveRole(roleId, variantId) {
    return resolvedSemantic?.[roleId]?.[variantId] ?? null
  }

  function resolveVariantKnob(knobRef, variantId) {
    const [groupId, knobId] = String(knobRef || '').split('.')
    if (!groupId || !knobId) return null
    return variantKnobs?.[groupId]?.[knobId]?.[variantId] ?? null
  }

  function resolveInteraction(interactionId, variantId) {
    const existing = interactions[interactionId]?.resolved?.[variantId]
    if (existing) return existing
    const definition = rawInteractionRules.interactions[interactionId]
    if (!definition) {
      throw new Error(`Missing interaction definition for "${interactionId}"`)
    }

    const key = `${interactionId}:${variantId}`
    if (resolving.has(key)) {
      throw new Error(`Interaction derivation cycle detected: ${key}`)
    }
    resolving.add(key)

    const variantOverride = definition.byVariant?.[variantId] || {}
    const source = variantOverride.source || definition.source
    const derive = mergeDerive(definition.derive, variantOverride.derive)
    const entryRef = `interaction-rules.interactions.${interactionId}`
    const sourceResolution = resolveAbstractColorSource({
      source,
      variantId,
      foundation,
      resolveRole,
      resolveSurface,
      resolveInterface,
      resolveInteraction,
      resolveFeedback: null,
      entryRef,
    })
    const steps = [...sourceResolution.steps]
    const derived = applyAbstractDerive({
      baseHex: sourceResolution.color,
      derive,
      foundation,
      variantId,
      resolveRole,
      resolveSurface,
      resolveInterface,
      resolveInteraction,
      resolveFeedback: null,
      resolveVariantKnob,
      entryRef,
      steps,
    })
    steps.push({
      type: 'variant-profile',
      ref: `variant-profiles.variants.${variantId}`,
    })

    const result = {
      interactionId,
      variantId,
      description: definition.description,
      color: derived.color,
      sourceType: sourceResolution.sourceType,
      sourceRef: sourceResolution.sourceRef,
      family: sourceResolution.family,
      tone: sourceResolution.tone,
      usedEscapeHatch: Boolean(derive.output),
      steps,
      variantProfile: variantProfiles.variants[variantId],
      chainRefs: uniqueRefs([
        ...sourceResolution.chainRefs,
        ...derived.chainRefs,
        entryRef,
        `variant-profiles.variants.${variantId}`,
      ]),
    }

    if (!interactions[interactionId]) {
      interactions[interactionId] = {
        description: definition.description,
        values: {},
        resolved: {},
      }
    }
    interactions[interactionId].values[variantId] = result.color
    interactions[interactionId].resolved[variantId] = result
    resolving.delete(key)
    return result
  }

  for (const interactionId of Object.keys(rawInteractionRules.interactions)) {
    for (const variant of variants) {
      resolveInteraction(interactionId, variant.id)
    }
  }

  return {
    schemaVersion: rawInteractionRules.schemaVersion,
    description: rawInteractionRules.description,
    definitions: rawInteractionRules.interactions,
    interactions,
  }
}

function buildResolvedFeedbackRules(rawFeedbackRules, foundation, surfaceRules, interfaceRules, interactionRules, resolvedSemantic, variantProfiles, variantKnobs, variants) {
  const feedbacks = {}
  const resolving = new Set()

  function resolveSurface(surfaceId, variantId) {
    return surfaceRules.resolved?.[surfaceId]?.[variantId] ?? null
  }

  function resolveInteraction(interactionId, variantId) {
    return interactionRules.interactions?.[interactionId]?.resolved?.[variantId] ?? null
  }

  function resolveInterface(interfaceId, variantId) {
    return interfaceRules.interfaces?.[interfaceId]?.resolved?.[variantId] ?? null
  }

  function resolveRole(roleId, variantId) {
    return resolvedSemantic?.[roleId]?.[variantId] ?? null
  }

  function resolveVariantKnob(knobRef, variantId) {
    const [groupId, knobId] = String(knobRef || '').split('.')
    if (!groupId || !knobId) return null
    return variantKnobs?.[groupId]?.[knobId]?.[variantId] ?? null
  }

  function resolveFeedback(feedbackId, variantId) {
    const existing = feedbacks[feedbackId]?.resolved?.[variantId]
    if (existing) return existing
    const definition = rawFeedbackRules.feedbacks[feedbackId]
    if (!definition) {
      throw new Error(`Missing feedback definition for "${feedbackId}"`)
    }

    const key = `${feedbackId}:${variantId}`
    if (resolving.has(key)) {
      throw new Error(`Feedback derivation cycle detected: ${key}`)
    }
    resolving.add(key)

    const variantOverride = definition.byVariant?.[variantId] || {}
    const source = variantOverride.source || definition.source
    const derive = mergeDerive(definition.derive, variantOverride.derive)
    const entryRef = `feedback-rules.feedbacks.${feedbackId}`
    const sourceResolution = resolveAbstractColorSource({
      source,
      variantId,
      foundation,
      resolveRole,
      resolveSurface,
      resolveInterface,
      resolveInteraction,
      resolveFeedback,
      entryRef,
    })
    const steps = [...sourceResolution.steps]
    const derived = applyAbstractDerive({
      baseHex: sourceResolution.color,
      derive,
      foundation,
      variantId,
      resolveRole,
      resolveSurface,
      resolveInterface,
      resolveInteraction,
      resolveFeedback,
      resolveVariantKnob,
      entryRef,
      steps,
    })
    steps.push({
      type: 'variant-profile',
      ref: `variant-profiles.variants.${variantId}`,
    })

    const result = {
      feedbackId,
      variantId,
      description: definition.description,
      color: derived.color,
      sourceType: sourceResolution.sourceType,
      sourceRef: sourceResolution.sourceRef,
      family: sourceResolution.family,
      tone: sourceResolution.tone,
      usedEscapeHatch: Boolean(derive.output),
      steps,
      variantProfile: variantProfiles.variants[variantId],
      chainRefs: uniqueRefs([
        ...sourceResolution.chainRefs,
        ...derived.chainRefs,
        entryRef,
        `variant-profiles.variants.${variantId}`,
      ]),
    }

    if (!feedbacks[feedbackId]) {
      feedbacks[feedbackId] = {
        description: definition.description,
        values: {},
        resolved: {},
      }
    }
    feedbacks[feedbackId].values[variantId] = result.color
    feedbacks[feedbackId].resolved[variantId] = result
    resolving.delete(key)
    return result
  }

  for (const feedbackId of Object.keys(rawFeedbackRules.feedbacks)) {
    for (const variant of variants) {
      resolveFeedback(feedbackId, variant.id)
    }
  }

  return {
    schemaVersion: rawFeedbackRules.schemaVersion,
    description: rawFeedbackRules.description,
    definitions: rawFeedbackRules.feedbacks,
    feedbacks,
  }
}

function buildResolvedGuidanceRules(rawGuidanceRules, foundation, surfaceRules, interfaceRules, interactionRules, feedbackRules, resolvedSemantic, variantProfiles, variantKnobs, variants) {
  const guidances = {}
  const resolving = new Set()

  function resolveSurface(surfaceId, variantId) {
    return surfaceRules.resolved?.[surfaceId]?.[variantId] ?? null
  }

  function resolveInterface(interfaceId, variantId) {
    return interfaceRules.interfaces?.[interfaceId]?.resolved?.[variantId] ?? null
  }

  function resolveInteraction(interactionId, variantId) {
    return interactionRules.interactions?.[interactionId]?.resolved?.[variantId] ?? null
  }

  function resolveFeedback(feedbackId, variantId) {
    return feedbackRules.feedbacks?.[feedbackId]?.resolved?.[variantId] ?? null
  }

  function resolveRole(roleId, variantId) {
    return resolvedSemantic?.[roleId]?.[variantId] ?? null
  }

  function resolveVariantKnob(knobRef, variantId) {
    const [groupId, knobId] = String(knobRef || '').split('.')
    if (!groupId || !knobId) return null
    return variantKnobs?.[groupId]?.[knobId]?.[variantId] ?? null
  }

  function resolveGuidance(guidanceId, variantId) {
    const existing = guidances[guidanceId]?.resolved?.[variantId]
    if (existing) return existing
    const definition = rawGuidanceRules.guidances[guidanceId]
    if (!definition) {
      throw new Error(`Missing guidance definition for "${guidanceId}"`)
    }

    const key = `${guidanceId}:${variantId}`
    if (resolving.has(key)) {
      throw new Error(`Guidance derivation cycle detected: ${key}`)
    }
    resolving.add(key)

    const variantOverride = definition.byVariant?.[variantId] || {}
    const source = variantOverride.source || definition.source
    const derive = mergeDerive(definition.derive, variantOverride.derive)
    const entryRef = `guidance-rules.guidances.${guidanceId}`
    const sourceResolution = resolveAbstractColorSource({
      source,
      variantId,
      foundation,
      resolveRole,
      resolveSurface,
      resolveInterface,
      resolveGuidance,
      resolveInteraction,
      resolveFeedback,
      entryRef,
    })
    const steps = [...sourceResolution.steps]
    const derived = applyAbstractDerive({
      baseHex: sourceResolution.color,
      derive,
      foundation,
      variantId,
      resolveRole,
      resolveSurface,
      resolveInterface,
      resolveGuidance,
      resolveInteraction,
      resolveFeedback,
      resolveVariantKnob,
      entryRef,
      steps,
    })
    steps.push({
      type: 'variant-profile',
      ref: `variant-profiles.variants.${variantId}`,
    })

    const result = {
      guidanceId,
      variantId,
      description: definition.description,
      color: derived.color,
      sourceType: sourceResolution.sourceType,
      sourceRef: sourceResolution.sourceRef,
      family: sourceResolution.family,
      tone: sourceResolution.tone,
      usedEscapeHatch: Boolean(derive.output),
      steps,
      variantProfile: variantProfiles.variants[variantId],
      chainRefs: uniqueRefs([
        ...sourceResolution.chainRefs,
        ...derived.chainRefs,
        entryRef,
        `variant-profiles.variants.${variantId}`,
      ]),
    }

    if (!guidances[guidanceId]) {
      guidances[guidanceId] = {
        description: definition.description,
        values: {},
        resolved: {},
      }
    }
    guidances[guidanceId].values[variantId] = result.color
    guidances[guidanceId].resolved[variantId] = result
    resolving.delete(key)
    return result
  }

  for (const guidanceId of Object.keys(rawGuidanceRules.guidances)) {
    for (const variant of variants) {
      resolveGuidance(guidanceId, variant.id)
    }
  }

  return {
    schemaVersion: rawGuidanceRules.schemaVersion,
    description: rawGuidanceRules.description,
    definitions: rawGuidanceRules.guidances,
    guidances,
  }
}

function buildResolvedTerminalRules(rawTerminalRules, foundation, surfaceRules, interfaceRules, interactionRules, feedbackRules, guidanceRules, resolvedSemantic, variantProfiles, variantKnobs, variants) {
  const terminals = {}
  const resolving = new Set()

  function resolveSurface(surfaceId, variantId) {
    return surfaceRules.resolved?.[surfaceId]?.[variantId] ?? null
  }

  function resolveInterface(interfaceId, variantId) {
    return interfaceRules.interfaces?.[interfaceId]?.resolved?.[variantId] ?? null
  }

  function resolveGuidance(guidanceId, variantId) {
    return guidanceRules.guidances?.[guidanceId]?.resolved?.[variantId] ?? null
  }

  function resolveInteraction(interactionId, variantId) {
    return interactionRules.interactions?.[interactionId]?.resolved?.[variantId] ?? null
  }

  function resolveFeedback(feedbackId, variantId) {
    return feedbackRules.feedbacks?.[feedbackId]?.resolved?.[variantId] ?? null
  }

  function resolveRole(roleId, variantId) {
    return resolvedSemantic?.[roleId]?.[variantId] ?? null
  }

  function resolveVariantKnob(knobRef, variantId) {
    const [groupId, knobId] = String(knobRef || '').split('.')
    if (!groupId || !knobId) return null
    return variantKnobs?.[groupId]?.[knobId]?.[variantId] ?? null
  }

  function resolveTerminal(terminalId, variantId) {
    const existing = terminals[terminalId]?.resolved?.[variantId]
    if (existing) return existing
    const definition = rawTerminalRules.terminals[terminalId]
    if (!definition) {
      throw new Error(`Missing terminal definition for "${terminalId}"`)
    }

    const key = `${terminalId}:${variantId}`
    if (resolving.has(key)) {
      throw new Error(`Terminal derivation cycle detected: ${key}`)
    }
    resolving.add(key)

    const variantOverride = definition.byVariant?.[variantId] || {}
    const source = variantOverride.source || definition.source
    const derive = mergeDerive(definition.derive, variantOverride.derive)
    const entryRef = `terminal-rules.terminals.${terminalId}`
    const sourceResolution = resolveAbstractColorSource({
      source,
      variantId,
      foundation,
      resolveRole,
      resolveSurface,
      resolveInterface,
      resolveGuidance,
      resolveTerminal,
      resolveInteraction,
      resolveFeedback,
      entryRef,
    })
    const steps = [...sourceResolution.steps]
    const derived = applyAbstractDerive({
      baseHex: sourceResolution.color,
      derive,
      foundation,
      variantId,
      resolveRole,
      resolveSurface,
      resolveInterface,
      resolveGuidance,
      resolveTerminal,
      resolveInteraction,
      resolveFeedback,
      resolveVariantKnob,
      entryRef,
      steps,
    })
    steps.push({
      type: 'variant-profile',
      ref: `variant-profiles.variants.${variantId}`,
    })

    const result = {
      terminalId,
      variantId,
      description: definition.description,
      color: derived.color,
      sourceType: sourceResolution.sourceType,
      sourceRef: sourceResolution.sourceRef,
      family: sourceResolution.family,
      tone: sourceResolution.tone,
      usedEscapeHatch: Boolean(derive.output),
      steps,
      variantProfile: variantProfiles.variants[variantId],
      chainRefs: uniqueRefs([
        ...sourceResolution.chainRefs,
        ...derived.chainRefs,
        entryRef,
        `variant-profiles.variants.${variantId}`,
      ]),
    }

    if (!terminals[terminalId]) {
      terminals[terminalId] = {
        description: definition.description,
        values: {},
        resolved: {},
      }
    }
    terminals[terminalId].values[variantId] = result.color
    terminals[terminalId].resolved[variantId] = result
    resolving.delete(key)
    return result
  }

  for (const terminalId of Object.keys(rawTerminalRules.terminals)) {
    for (const variant of variants) {
      resolveTerminal(terminalId, variant.id)
    }
  }

  return {
    schemaVersion: rawTerminalRules.schemaVersion,
    description: rawTerminalRules.description,
    definitions: rawTerminalRules.terminals,
    terminals,
  }
}

function buildSemanticSnapshotDocument(palette) {
  return {
    schemaVersion: 3,
    generated: true,
    generatedFrom: {
      activeScheme: COLOR_SYSTEM_ACTIVE_SCHEME_PATH,
      scheme: COLOR_SYSTEM_SCHEME_PATH,
      philosophy: COLOR_SYSTEM_PHILOSOPHY_PATH,
      taxonomy: COLOR_SYSTEM_TAXONOMY_PATH,
      foundation: COLOR_SYSTEM_FOUNDATION_PATH,
      surfaceRules: COLOR_SYSTEM_SURFACE_RULES_PATH,
      terminalRules: COLOR_SYSTEM_TERMINAL_RULES_PATH,
      interfaceRules: COLOR_SYSTEM_INTERFACE_RULES_PATH,
      interactionRules: COLOR_SYSTEM_INTERACTION_RULES_PATH,
      feedbackRules: COLOR_SYSTEM_FEEDBACK_RULES_PATH,
      semanticRules: COLOR_SYSTEM_SEMANTIC_RULES_PATH,
      variantKnobs: COLOR_SYSTEM_VARIANT_KNOBS_PATH,
      variantProfiles: COLOR_SYSTEM_VARIANT_PROFILES_PATH,
      variants: COLOR_SYSTEM_VARIANTS_PATH,
      adapters: COLOR_SYSTEM_ADAPTERS_PATH,
      calibration: COLOR_SYSTEM_TUNING_PATH,
    },
    roles: palette,
  }
}

function resolveWebTokenKey(roleDef) {
  if (!roleDef) return null
  return roleDef.webToken || roleDef.id
}

function buildBasePlatformMaps({ surfaceRules, guidanceRules, terminalRules, interfaceRules, interactionRules, feedbackRules, surfaceAdapters, guidanceAdapters, terminalAdapters, interfaceAdapters, interactionAdapters, feedbackAdapters, variants }) {
  const tokenSets = {}
  const obsidian = {}
  const vscodeWorkbench = {}

  for (const variant of variants) {
    tokenSets[variant.id] = {}
    obsidian[variant.id] = {}
    vscodeWorkbench[variant.id] = {}

    for (const contract of surfaceAdapters) {
      const color = surfaceRules.surfaces[contract.id]?.[variant.id]
      if (!color) {
        throw new Error(`Missing surface color for "${contract.id}.${variant.id}"`)
      }
      if (contract.webToken) tokenSets[variant.id][contract.webToken] = color
      if (contract.obsidianVar) obsidian[variant.id][contract.obsidianVar] = color
      if (contract.vscodeColor) vscodeWorkbench[variant.id][contract.vscodeColor] = color
    }

    for (const contract of guidanceAdapters) {
      const color = guidanceRules.guidances[contract.id]?.values?.[variant.id]
      if (!color) {
        throw new Error(`Missing guidance color for "${contract.id}.${variant.id}"`)
      }
      if (contract.webToken) tokenSets[variant.id][contract.webToken] = color
      if (contract.obsidianVar) obsidian[variant.id][contract.obsidianVar] = color
      if (contract.vscodeColor) vscodeWorkbench[variant.id][contract.vscodeColor] = color
    }

    for (const contract of terminalAdapters) {
      const color = terminalRules.terminals[contract.id]?.values?.[variant.id]
      if (!color) {
        throw new Error(`Missing terminal color for "${contract.id}.${variant.id}"`)
      }
      if (contract.webToken) tokenSets[variant.id][contract.webToken] = color
      if (contract.obsidianVar) obsidian[variant.id][contract.obsidianVar] = color
      if (contract.vscodeColor) vscodeWorkbench[variant.id][contract.vscodeColor] = color
    }

    for (const contract of interfaceAdapters) {
      const color = interfaceRules.interfaces[contract.id]?.values?.[variant.id]
      if (!color) {
        throw new Error(`Missing interface color for "${contract.id}.${variant.id}"`)
      }
      if (contract.webToken) tokenSets[variant.id][contract.webToken] = color
      if (contract.obsidianVar) obsidian[variant.id][contract.obsidianVar] = color
      if (contract.vscodeColor) vscodeWorkbench[variant.id][contract.vscodeColor] = color
    }

    for (const contract of interactionAdapters) {
      const color = interactionRules.interactions[contract.id]?.values?.[variant.id]
      if (!color) {
        throw new Error(`Missing interaction color for "${contract.id}.${variant.id}"`)
      }
      if (contract.webToken) tokenSets[variant.id][contract.webToken] = color
      if (contract.obsidianVar) obsidian[variant.id][contract.obsidianVar] = color
      if (contract.vscodeColor) vscodeWorkbench[variant.id][contract.vscodeColor] = color
    }

    for (const contract of feedbackAdapters) {
      const color = feedbackRules.feedbacks[contract.id]?.values?.[variant.id]
      if (!color) {
        throw new Error(`Missing feedback color for "${contract.id}.${variant.id}"`)
      }
      if (contract.webToken) tokenSets[variant.id][contract.webToken] = color
      if (contract.obsidianVar) obsidian[variant.id][contract.obsidianVar] = color
      if (contract.vscodeColor) vscodeWorkbench[variant.id][contract.vscodeColor] = color
    }
  }

  return {
    tokenSets,
    obsidian,
    vscodeWorkbench,
  }
}

function buildPlatformTokenMaps({
  surfaceRules,
  guidanceRules,
  terminalRules,
  interfaceRules,
  interactionRules,
  feedbackRules,
  semanticPalette,
  roleAdapters,
  surfaceAdapters,
  guidanceAdapters,
  terminalAdapters,
  interfaceAdapters,
  interactionAdapters,
  feedbackAdapters,
  variants,
}) {
  const baseMaps = buildBasePlatformMaps({
    surfaceRules,
    guidanceRules,
    terminalRules,
    interfaceRules,
    interactionRules,
    feedbackRules,
    surfaceAdapters,
    guidanceAdapters,
    terminalAdapters,
    interfaceAdapters,
    interactionAdapters,
    feedbackAdapters,
    variants,
  })

  const tokenSets = Object.fromEntries(
    Object.entries(baseMaps.tokenSets).map(([variantId, tokens]) => [variantId, { ...tokens }])
  )
  const web = {}
  const obsidian = Object.fromEntries(
    Object.entries(baseMaps.obsidian).map(([variantId, vars]) => [variantId, { ...vars }])
  )
  const vscode = {
    semantic: {},
    textmate: {},
    workbench: Object.fromEntries(
      Object.entries(baseMaps.vscodeWorkbench).map(([variantId, colors]) => [variantId, { ...colors }])
    ),
  }

  for (const variant of variants) {
    const variantId = variant.id
    vscode.semantic[variantId] = {}
    vscode.textmate[variantId] = {}

    for (const roleDef of roleAdapters) {
      const color = semanticPalette[roleDef.id]?.[variantId]
      if (!color) continue

      const webKey = resolveWebTokenKey(roleDef)
      if (webKey) tokenSets[variantId][webKey] = color

      if (roleDef.obsidianVar) {
        obsidian[variantId][roleDef.obsidianVar] = color
      }
      if (roleDef.vscodeSemantic) {
        vscode.semantic[variantId][roleDef.vscodeSemantic] = color
      }
      if (roleDef.scopes?.length) {
        vscode.textmate[variantId][roleDef.id] = {
          scopes: roleDef.scopes,
          color,
        }
      }
    }

    web[variantId] = Object.fromEntries(
      EXPORTED_SITE_TOKEN_KEYS.map((key) => [key, tokenSets[variantId][key]])
    )
  }

  return {
    tokenSets,
    web,
    obsidian,
    vscode,
  }
}

function validateGroupedCoverage(groups, expectedIds, label) {
  const seen = new Map()
  for (const [groupName, ids] of Object.entries(groups || {})) {
    for (const id of ids) {
      if (seen.has(id)) {
        throw new Error(`${label}: "${id}" is assigned to both "${seen.get(id)}" and "${groupName}"`)
      }
      seen.set(id, groupName)
    }
  }

  for (const expectedId of expectedIds) {
    if (!seen.has(expectedId)) {
      throw new Error(`${label}: missing "${expectedId}"`)
    }
  }

  for (const id of seen.keys()) {
    if (!expectedIds.has(id)) {
      throw new Error(`${label}: unknown id "${id}"`)
    }
  }
}

function validateModel({
  scheme,
  taxonomy,
  foundation,
  surfaceRules,
  guidanceRules,
  terminalRules,
  interfaceRules,
  interactionRules,
  feedbackRules,
  semanticRules,
  variantProfiles,
  variants,
  adapters,
  surfaceAdapters,
  guidanceAdapters,
  terminalAdapters,
  interfaceAdapters,
  interactionAdapters,
  feedbackAdapters,
  semanticPalette,
  resolvedSemantic,
}) {
  const variantList = Array.isArray(variants) ? variants : variants.variants
  if (!Array.isArray(variantList) || variantList.length === 0) {
    throw new Error('Color language model is missing variant definitions')
  }

  if (scheme.defaultVariant && !variantList.some((variant) => variant.id === scheme.defaultVariant)) {
    throw new Error(`Scheme defaultVariant "${scheme.defaultVariant}" does not exist in variants`)
  }

  const variantIds = new Set(variantList.map((variant) => variant.id))
  const foundationFamilyIds = new Set(Object.keys(foundation.families))
  const semanticRoleIds = new Set(Object.keys(semanticRules.roles))
  const surfaceIds = new Set(Object.keys(surfaceRules.surfaces))
  const guidanceIds = new Set(Object.keys(guidanceRules.guidances))
  const terminalIds = new Set(Object.keys(terminalRules.terminals))
  const interfaceIds = new Set(Object.keys(interfaceRules.interfaces))
  const interactionIds = new Set(Object.keys(interactionRules.interactions))
  const feedbackIds = new Set(Object.keys(feedbackRules.feedbacks))

  for (const familyId of scheme.vocabulary) {
    if (!foundationFamilyIds.has(familyId)) {
      throw new Error(`Scheme vocabulary "${familyId}" does not exist in foundation.json`)
    }
  }

  const variantPhilosophyKeys = new Set(Object.keys(scheme.variantPhilosophy || {}))
  for (const variantId of variantIds) {
    if (!variantPhilosophyKeys.has(variantId)) {
      throw new Error(`Scheme variantPhilosophy is missing "${variantId}"`)
    }
  }
  for (const variantId of variantPhilosophyKeys) {
    if (!variantIds.has(variantId)) {
      throw new Error(`Scheme variantPhilosophy contains unknown variant "${variantId}"`)
    }
  }

  validateGroupedCoverage(taxonomy.families, foundationFamilyIds, 'taxonomy.families')
  validateGroupedCoverage(taxonomy.roles, semanticRoleIds, 'taxonomy.roles')
  validateGroupedCoverage(taxonomy.surfaces, surfaceIds, 'taxonomy.surfaces')
  validateGroupedCoverage(taxonomy.guidance, guidanceIds, 'taxonomy.guidance')
  validateGroupedCoverage(taxonomy.terminals, terminalIds, 'taxonomy.terminals')
  validateGroupedCoverage(taxonomy.interfaces, interfaceIds, 'taxonomy.interfaces')
  validateGroupedCoverage(taxonomy.interactions, interactionIds, 'taxonomy.interactions')
  validateGroupedCoverage(taxonomy.feedback, feedbackIds, 'taxonomy.feedback')
  validateGroupedCoverage(taxonomy.variants, variantIds, 'taxonomy.variants')

  const adapterRoleIds = new Set(adapters.map((role) => role.id))
  for (const roleId of Object.keys(semanticRules.roles)) {
    if (!adapterRoleIds.has(roleId)) {
      throw new Error(`Semantic rule "${roleId}" is not represented in adapters.json`)
    }
  }

  for (const surfaceId of Object.keys(surfaceRules.surfaces)) {
    if (!surfaceAdapters.some((entry) => entry.id === surfaceId)) {
      throw new Error(`Surface rule "${surfaceId}" is not represented in adapters.json surfaces`)
    }
  }

  for (const guidanceId of Object.keys(guidanceRules.guidances)) {
    if (!guidanceAdapters.some((entry) => entry.id === guidanceId)) {
      throw new Error(`Guidance rule "${guidanceId}" is not represented in adapters.json guidances`)
    }
  }

  for (const terminalId of Object.keys(terminalRules.terminals)) {
    if (!terminalAdapters.some((entry) => entry.id === terminalId)) {
      throw new Error(`Terminal rule "${terminalId}" is not represented in adapters.json terminals`)
    }
  }

  for (const interactionId of Object.keys(interactionRules.interactions)) {
    if (!interactionAdapters.some((entry) => entry.id === interactionId)) {
      throw new Error(`Interaction rule "${interactionId}" is not represented in adapters.json interactions`)
    }
  }

  for (const interfaceId of Object.keys(interfaceRules.interfaces)) {
    if (!interfaceAdapters.some((entry) => entry.id === interfaceId)) {
      throw new Error(`Interface rule "${interfaceId}" is not represented in adapters.json interfaces`)
    }
  }

  for (const feedbackId of Object.keys(feedbackRules.feedbacks)) {
    if (!feedbackAdapters.some((entry) => entry.id === feedbackId)) {
      throw new Error(`Feedback rule "${feedbackId}" is not represented in adapters.json feedbacks`)
    }
  }

  for (const variant of variantList) {
    if (!variantProfiles.variants[variant.id]) {
      throw new Error(`Missing variant profile for "${variant.id}"`)
    }
    for (const surfaceAdapter of surfaceAdapters) {
      if (!surfaceRules.surfaces[surfaceAdapter.id]?.[variant.id]) {
        throw new Error(`Missing surface "${surfaceAdapter.id}" for variant "${variant.id}"`)
      }
    }
    for (const guidanceAdapter of guidanceAdapters) {
      if (!guidanceRules.guidances[guidanceAdapter.id]?.values?.[variant.id]) {
        throw new Error(`Missing guidance "${guidanceAdapter.id}" for variant "${variant.id}"`)
      }
    }
    for (const terminalAdapter of terminalAdapters) {
      if (!terminalRules.terminals[terminalAdapter.id]?.values?.[variant.id]) {
        throw new Error(`Missing terminal "${terminalAdapter.id}" for variant "${variant.id}"`)
      }
    }
    for (const interfaceAdapter of interfaceAdapters) {
      if (!interfaceRules.interfaces[interfaceAdapter.id]?.values?.[variant.id]) {
        throw new Error(`Missing interface "${interfaceAdapter.id}" for variant "${variant.id}"`)
      }
    }
    for (const interactionAdapter of interactionAdapters) {
      if (!interactionRules.interactions[interactionAdapter.id]?.values?.[variant.id]) {
        throw new Error(`Missing interaction "${interactionAdapter.id}" for variant "${variant.id}"`)
      }
    }
    for (const feedbackAdapter of feedbackAdapters) {
      if (!feedbackRules.feedbacks[feedbackAdapter.id]?.values?.[variant.id]) {
        throw new Error(`Missing feedback "${feedbackAdapter.id}" for variant "${variant.id}"`)
      }
    }
  }

  for (const roleDef of adapters) {
    if (!semanticRules.roles[roleDef.id]) {
      throw new Error(`Missing semantic rule for adapter role "${roleDef.id}"`)
    }
    for (const variant of variantList) {
      const color = semanticPalette[roleDef.id]?.[variant.id]
      if (!color) {
        throw new Error(`Missing semantic palette color for role "${roleDef.id}" in variant "${variant.id}"`)
      }
      const resolved = resolvedSemantic[roleDef.id]?.[variant.id]
      if (!resolved) {
        throw new Error(`Missing resolved semantic lineage for role "${roleDef.id}" in variant "${variant.id}"`)
      }
      if (!foundation.families[resolved.family]?.tones[resolved.tone]?.[variant.id]) {
        throw new Error(`Resolved family/tone is missing in foundation for ${roleDef.id}.${variant.id}`)
      }
    }
  }

  for (const feedbackDef of feedbackAdapters) {
    if (!feedbackRules.feedbacks[feedbackDef.id]) {
      throw new Error(`Missing feedback rule for adapter "${feedbackDef.id}"`)
    }
    for (const variant of variantList) {
      const resolved = feedbackRules.feedbacks[feedbackDef.id]?.resolved?.[variant.id]
      if (!resolved) {
        throw new Error(`Missing resolved feedback lineage for "${feedbackDef.id}" in variant "${variant.id}"`)
      }
      if (!foundation.families[resolved.family]?.tones[resolved.tone]?.[variant.id]) {
        throw new Error(`Resolved family/tone is missing in foundation for feedback ${feedbackDef.id}.${variant.id}`)
      }
    }
  }

  for (const guidanceDef of guidanceAdapters) {
    if (!guidanceRules.guidances[guidanceDef.id]) {
      throw new Error(`Missing guidance rule for adapter "${guidanceDef.id}"`)
    }
    for (const variant of variantList) {
      const resolved = guidanceRules.guidances[guidanceDef.id]?.resolved?.[variant.id]
      if (!resolved) {
        throw new Error(`Missing resolved guidance lineage for "${guidanceDef.id}" in variant "${variant.id}"`)
      }
    }
  }

  for (const terminalDef of terminalAdapters) {
    if (!terminalRules.terminals[terminalDef.id]) {
      throw new Error(`Missing terminal rule for adapter "${terminalDef.id}"`)
    }
    for (const variant of variantList) {
      const resolved = terminalRules.terminals[terminalDef.id]?.resolved?.[variant.id]
      if (!resolved) {
        throw new Error(`Missing resolved terminal lineage for "${terminalDef.id}" in variant "${variant.id}"`)
      }
    }
  }

  for (const interfaceDef of interfaceAdapters) {
    if (!interfaceRules.interfaces[interfaceDef.id]) {
      throw new Error(`Missing interface rule for adapter "${interfaceDef.id}"`)
    }
    for (const variant of variantList) {
      const resolved = interfaceRules.interfaces[interfaceDef.id]?.resolved?.[variant.id]
      if (!resolved) {
        throw new Error(`Missing resolved interface lineage for "${interfaceDef.id}" in variant "${variant.id}"`)
      }
    }
  }
}

export function buildColorLanguageModel() {
  const activeScheme = loadActiveSchemeContext()
  const scheme = loadColorSchemeManifest()
  const taxonomy = loadSchemeTaxonomy()
  const variantSpec = loadColorSystemVariants()
  const adapters = loadRoleAdapters()
  const surfaceAdapters = loadSurfaceAdapters()
  const guidanceAdapters = loadGuidanceAdapters()
  const terminalAdapters = loadTerminalAdapters()
  const interfaceAdapters = loadInterfaceAdapters()
  const interactionAdapters = loadInteractionAdapters()
  const feedbackAdapters = loadFeedbackAdapters()
  const foundation = loadFoundationPalette()
  const rawSurfaceRules = loadSurfaceRules()
  const rawGuidanceRules = loadGuidanceRules()
  const rawTerminalRules = loadTerminalRules()
  const rawInterfaceRules = loadInterfaceRules()
  const rawInteractionRules = loadInteractionRules()
  const rawFeedbackRules = loadFeedbackRules()
  const semanticRules = loadSemanticRules()
  const variantKnobs = loadVariantKnobs()
  const variantProfiles = loadVariantProfiles()
  const { palette, resolved } = buildSemanticPalette(foundation, semanticRules, variantProfiles, variantSpec.variants)
  const surfaceRules = buildResolvedSurfaceRules(rawSurfaceRules, foundation, variantProfiles, variantKnobs, variantSpec.variants)
  const interfaceRules = buildResolvedInterfaceRules(rawInterfaceRules, foundation, surfaceRules, variantProfiles, variantKnobs, variantSpec.variants)
  const interactionRules = buildResolvedInteractionRules(rawInteractionRules, foundation, surfaceRules, interfaceRules, resolved, variantProfiles, variantKnobs, variantSpec.variants)
  const feedbackRules = buildResolvedFeedbackRules(rawFeedbackRules, foundation, surfaceRules, interfaceRules, interactionRules, resolved, variantProfiles, variantKnobs, variantSpec.variants)
  const guidanceRules = buildResolvedGuidanceRules(rawGuidanceRules, foundation, surfaceRules, interfaceRules, interactionRules, feedbackRules, resolved, variantProfiles, variantKnobs, variantSpec.variants)
  const terminalRules = buildResolvedTerminalRules(rawTerminalRules, foundation, surfaceRules, interfaceRules, interactionRules, feedbackRules, guidanceRules, resolved, variantProfiles, variantKnobs, variantSpec.variants)
  const semanticSnapshot = buildSemanticSnapshotDocument(palette)
  const platformTokenMaps = buildPlatformTokenMaps({
    surfaceRules,
    guidanceRules,
    terminalRules,
    interfaceRules,
    interactionRules,
    feedbackRules,
    semanticPalette: palette,
    roleAdapters: adapters,
    surfaceAdapters,
    guidanceAdapters,
    terminalAdapters,
    interfaceAdapters,
    interactionAdapters,
    feedbackAdapters,
    variants: variantSpec.variants,
  })

  const model = {
    sources: {
      activeScheme: COLOR_SYSTEM_ACTIVE_SCHEME_PATH,
      scheme: COLOR_SYSTEM_SCHEME_PATH,
      philosophy: COLOR_SYSTEM_PHILOSOPHY_PATH,
      taxonomy: COLOR_SYSTEM_TAXONOMY_PATH,
      foundation: COLOR_SYSTEM_FOUNDATION_PATH,
      surfaceRules: COLOR_SYSTEM_SURFACE_RULES_PATH,
      guidanceRules: COLOR_SYSTEM_GUIDANCE_RULES_PATH,
      terminalRules: COLOR_SYSTEM_TERMINAL_RULES_PATH,
      interfaceRules: COLOR_SYSTEM_INTERFACE_RULES_PATH,
      interactionRules: COLOR_SYSTEM_INTERACTION_RULES_PATH,
      feedbackRules: COLOR_SYSTEM_FEEDBACK_RULES_PATH,
      semanticRules: COLOR_SYSTEM_SEMANTIC_RULES_PATH,
      variantKnobs: COLOR_SYSTEM_VARIANT_KNOBS_PATH,
      variantProfiles: COLOR_SYSTEM_VARIANT_PROFILES_PATH,
      adapters: COLOR_SYSTEM_ADAPTERS_PATH,
      variants: COLOR_SYSTEM_VARIANTS_PATH,
      tuning: COLOR_SYSTEM_TUNING_PATH,
      semanticSnapshot: COLOR_SYSTEM_SEMANTIC_PATH,
    },
    activeScheme,
    scheme,
    taxonomy,
    foundation,
    surfaceRules,
    guidanceRules,
    terminalRules,
    interfaceRules,
    interactionRules,
    feedbackRules,
    semanticRules,
    variantKnobs,
    variantProfiles,
    variants: variantSpec,
    adapters,
    surfaceAdapters,
    guidanceAdapters,
    terminalAdapters,
    interfaceAdapters,
    interactionAdapters,
    feedbackAdapters,
    platformContracts: {
      roles: adapters,
      surfaces: surfaceAdapters,
      guidances: guidanceAdapters,
      terminals: terminalAdapters,
      interfaces: interfaceAdapters,
      interactions: interactionAdapters,
      feedbacks: feedbackAdapters,
    },
    semanticPalette: palette,
    resolvedSemantic: resolved,
    semanticSnapshot,
    platformTokenMaps,
  }

  validateModel(model)
  return model
}

export function getExportedSiteTokenKeys() {
  return [...EXPORTED_SITE_TOKEN_KEYS]
}
