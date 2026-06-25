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
import { buildColorLanguageModel as buildColorLanguageModelFromInputs } from './build-core.mjs'

export {
  applyAbstractDerive,
  buildResolvedFeedbackRules,
  buildResolvedGuidanceRules,
  buildResolvedInteractionRules,
  buildResolvedInterfaceRules,
  buildResolvedSurfaceRules,
  buildResolvedTerminalRules,
  buildSemanticPalette,
  getExportedSiteTokenKeys,
  resolveAbstractColorSource,
} from './build-core.mjs'

const MODEL_SOURCES = {
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
}

export function getColorLanguageModelSources() {
  return { ...MODEL_SOURCES }
}

export function loadColorLanguageModelInputs(overrides = null) {
  const ov = overrides || {}
  return {
    activeScheme: ov.activeScheme ?? loadActiveSchemeContext(),
    scheme: ov.scheme ?? loadColorSchemeManifest(),
    taxonomy: ov.taxonomy ?? loadSchemeTaxonomy(),
    variants: ov.variants ?? loadColorSystemVariants(),
    adapters: ov.adapters ?? loadRoleAdapters(),
    surfaceAdapters: ov.surfaceAdapters ?? loadSurfaceAdapters(),
    guidanceAdapters: ov.guidanceAdapters ?? loadGuidanceAdapters(),
    terminalAdapters: ov.terminalAdapters ?? loadTerminalAdapters(),
    interfaceAdapters: ov.interfaceAdapters ?? loadInterfaceAdapters(),
    interactionAdapters: ov.interactionAdapters ?? loadInteractionAdapters(),
    feedbackAdapters: ov.feedbackAdapters ?? loadFeedbackAdapters(),
    foundation: ov.foundation ?? loadFoundationPalette(),
    surfaceRules: ov.surfaceRules ?? loadSurfaceRules(),
    guidanceRules: ov.guidanceRules ?? loadGuidanceRules(),
    terminalRules: ov.terminalRules ?? loadTerminalRules(),
    interfaceRules: ov.interfaceRules ?? loadInterfaceRules(),
    interactionRules: ov.interactionRules ?? loadInteractionRules(),
    feedbackRules: ov.feedbackRules ?? loadFeedbackRules(),
    semanticRules: ov.semanticRules ?? loadSemanticRules(),
    variantKnobs: ov.variantKnobs ?? loadVariantKnobs(),
    variantProfiles: ov.variantProfiles ?? loadVariantProfiles(),
  }
}

export function buildColorLanguageModel({
  domain = undefined,
  overrides = null,
  inputs = null,
  sources = MODEL_SOURCES,
} = {}) {
  return buildColorLanguageModelFromInputs({
    domain,
    inputs: inputs ? { ...inputs, ...(overrides || {}) } : loadColorLanguageModelInputs(overrides),
    sources,
  })
}
