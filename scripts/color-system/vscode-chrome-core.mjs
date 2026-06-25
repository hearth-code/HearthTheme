// Bundle-safe core of the VS Code chrome reference computation: pure colour
// resolution + seed patching with the chrome contract INJECTED (no fs, no
// loaders). The fs/loader wrapper + residual report live in vscode-chrome.mjs;
// the browser worker imports this so it can recompute reference docs per primary-
// colour override without touching disk.
import { contrastRatio, hexToRgba, normalizeHex, rgbaToHex } from '../color-utils.mjs'
import { getVscodeChromeSeedDocument } from './vscode-chrome-seeds.mjs'

function resolveBindingBaseColor(binding, model, variantId) {
  if (binding.surface) {
    return normalizeHex(model.surfaceRules?.surfaces?.[binding.surface]?.[variantId])
  }
  if (binding.guidance) {
    return normalizeHex(model.guidanceRules?.guidances?.[binding.guidance]?.values?.[variantId])
  }
  if (binding.terminal) {
    return normalizeHex(model.terminalRules?.terminals?.[binding.terminal]?.values?.[variantId])
  }
  if (binding.interface) {
    return normalizeHex(model.interfaceRules?.interfaces?.[binding.interface]?.values?.[variantId])
  }
  if (binding.interaction) {
    return normalizeHex(model.interactionRules?.interactions?.[binding.interaction]?.values?.[variantId])
  }
  if (binding.feedback) {
    return normalizeHex(model.feedbackRules?.feedbacks?.[binding.feedback]?.values?.[variantId])
  }
  return null
}

function applyAlphaTransform(hex, binding) {
  const rgba = hexToRgba(hex)
  if (!rgba) return hex

  const next = {
    r: rgba.r,
    g: rgba.g,
    b: rgba.b,
    a: rgba.a,
    hasAlpha: rgba.hasAlpha,
  }

  if (binding.alphaScale !== undefined) {
    next.a = Math.max(0, Math.min(255, Math.round(next.a * binding.alphaScale)))
    next.hasAlpha = true
  }
  if (binding.alpha !== undefined) {
    next.a = Math.max(0, Math.min(255, Math.round(binding.alpha * 255)))
    next.hasAlpha = next.a < 255 || rgba.hasAlpha
  }

  return rgbaToHex(next)
}

// Ink that sits on a chrome fill (button/badge text). Instead of trusting a fixed
// ink token to stay legible, pick whichever candidate clears the most contrast
// against the fill this variant actually resolves to. This makes the chrome text
// robust to scheme/polarity differences: moss's warm ochre buttons keep dark ink,
// ember's accent-toned buttons keep cream, with no shared token able to silently
// drop one of them below 4.5:1.
function pickInkForFill(backgroundHex, choices) {
  let best = null
  let bestContrast = -Infinity
  for (const choice of choices || []) {
    const ink = normalizeHex(choice)
    if (!ink) continue
    const ratio = contrastRatio(backgroundHex, ink)
    if (ratio != null && ratio > bestContrast) {
      bestContrast = ratio
      best = ink
    }
  }
  return best
}

export function buildVscodeChromeColors(model, variantId, contract) {
  const out = {}
  for (const binding of contract.bindings) {
    if (binding.inkOn) {
      const fillColor = resolveBindingBaseColor(binding.inkOn, model, variantId)
      if (!fillColor) {
        throw new Error(`Missing chrome ink fill for "${binding.key}" in variant "${variantId}"`)
      }
      const ink = pickInkForFill(fillColor, binding.inkChoices)
      if (!ink) {
        throw new Error(`No legible ink choice for "${binding.key}" in variant "${variantId}"`)
      }
      out[binding.key] = ink
      continue
    }
    const baseColor = resolveBindingBaseColor(binding, model, variantId)
    if (!baseColor) {
      throw new Error(`Missing chrome binding source for "${binding.key}" in variant "${variantId}"`)
    }
    out[binding.key] = applyAlphaTransform(baseColor, binding)
  }
  return out
}

export function patchThemeColorsDocument(doc, generatedColors) {
  const currentColors = doc.colors && typeof doc.colors === 'object' && !Array.isArray(doc.colors)
    ? doc.colors
    : {}

  const nextColors = {}
  for (const key of Object.keys(currentColors)) {
    nextColors[key] = generatedColors[key] ?? currentColors[key]
  }
  for (const [key, value] of Object.entries(generatedColors)) {
    if (!(key in nextColors)) nextColors[key] = value
  }

  return {
    ...doc,
    colors: nextColors,
  }
}

// In-memory reference docs (seed doc patched with model-derived chrome colours)
// for every target the calibration reads. Order matches the writer (source,
// dark template, then derived-variant templates). No disk, no report — those
// stay in the fs wrapper.
export function computeVscodeChromeReferenceDocs(model, variantSpec, contract) {
  const targets = [
    { variantId: 'dark', path: variantSpec.baseSourcePath },
    { variantId: 'dark', path: variantSpec.baseTemplatePath },
    ...variantSpec.variants
      .filter((variant) => variant.mode === 'derived')
      .map((variant) => ({ variantId: variant.id, path: variant.templatePath })),
  ]
  const refs = {}
  for (const target of targets) {
    const doc = getVscodeChromeSeedDocument(target.path)
    const generatedColors = buildVscodeChromeColors(model, target.variantId, contract)
    refs[target.path] = patchThemeColorsDocument(doc, generatedColors)
  }
  return refs
}
