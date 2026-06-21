import { loadColorSystemVariants, loadVariantKnobs } from './scripts/color-system.mjs'
import { colorDomain } from './scripts/theme-engine/domain-color/index.mjs'
import { obsidianEmitter } from './scripts/theme-engine/emit/obsidian.mjs'
import { vscodeEmitter } from './scripts/theme-engine/emit/vscode.mjs'
import { webEmitter } from './scripts/theme-engine/emit/web.mjs'

const variantSpec = loadColorSystemVariants()
const activeVariantKnobs = loadVariantKnobs()

function variantKnob(ref, description) {
  const [groupId, knobId] = String(ref || '').split('.')
  const values = activeVariantKnobs?.[groupId]?.[knobId]
  if (!values) {
    throw new Error(`theme.config.mjs: missing variant knob "${ref}"`)
  }
  return Object.freeze({
    ref,
    description,
    values: Object.freeze({ ...values }),
  })
}

export const themeKnobs = Object.freeze({
  interactionAlpha: Object.freeze({
    selection: variantKnob('interactionAlpha.selection', 'Selection overlay alpha.'),
    focusRing: variantKnob('interactionAlpha.focusRing', 'Focus ring alpha after the opaque focus base is resolved.'),
  }),
  surfaceMix: Object.freeze({
    panelLift: variantKnob('surfaceMix.panelLift', 'Panel lift from canvas toward ink.'),
    gutterBand: variantKnob('surfaceMix.gutterBand', 'Gutter band mix from canvas toward ink.'),
    borderBand: variantKnob('surfaceMix.borderBand', 'Structural border mix from canvas toward ink.'),
  }),
  interfaceMix: Object.freeze({
    supportInk: variantKnob('interfaceMix.supportInk', 'Support ink mix intensity.'),
    mutedInk: variantKnob('interfaceMix.mutedInk', 'Muted ink mix intensity.'),
    subtleInk: variantKnob('interfaceMix.subtleInk', 'Subtle ink mix intensity.'),
    shellRaised: variantKnob('interfaceMix.shellRaised', 'Raised shell fill mix intensity.'),
    navActiveFill: variantKnob('interfaceMix.navActiveFill', 'Active navigation fill mix intensity.'),
    navInactiveFill: variantKnob('interfaceMix.navInactiveFill', 'Inactive navigation fill mix intensity.'),
  }),
  guidanceMix: Object.freeze({
    guide: variantKnob('guidanceMix.guide', 'Guide rail mix intensity.'),
  }),
  guidanceAlpha: Object.freeze({
    bracketMatchFill: variantKnob('guidanceAlpha.bracketMatchFill', 'Bracket match fill alpha.'),
    bracketMatchStroke: variantKnob('guidanceAlpha.bracketMatchStroke', 'Bracket match stroke alpha.'),
  }),
})

export const themeConfig = Object.freeze({
  domain: colorDomain,
  emitters: Object.freeze([webEmitter, vscodeEmitter, obsidianEmitter]),
  knobs: themeKnobs,
  variants: Object.freeze([...variantSpec.variants]),
})

export default themeConfig
