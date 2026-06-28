import {
  COLOR_SYSTEM_ACTIVE_SCHEME_PATH,
  COLOR_SYSTEM_ADAPTERS_PATH,
  COLOR_SYSTEM_FOUNDATION_PATH,
  COLOR_SYSTEM_FEEDBACK_RULES_PATH,
  COLOR_SYSTEM_GUIDANCE_RULES_PATH,
  COLOR_SYSTEM_INTERFACE_RULES_PATH,
  COLOR_SYSTEM_INTERACTION_RULES_PATH,
  COLOR_SYSTEM_PHILOSOPHY_PATH,
  COLOR_SYSTEM_SCHEME_ID,
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
  getSchemeContext,
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
  loadSchemeContext,
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

function resolveInputSchemeContext(schemeId) {
  const id = String(schemeId || COLOR_SYSTEM_SCHEME_ID).trim()
  return id === COLOR_SYSTEM_SCHEME_ID ? loadActiveSchemeContext() : loadSchemeContext(id)
}

function buildModelSourcesForScheme(schemeId) {
  const id = String(schemeId || COLOR_SYSTEM_SCHEME_ID).trim()
  if (id === COLOR_SYSTEM_SCHEME_ID) return MODEL_SOURCES
  const context = getSchemeContext(id)
  return {
    ...MODEL_SOURCES,
    scheme: context.schemePath,
    philosophy: context.philosophyPath,
    taxonomy: context.taxonomyPath,
    foundation: context.foundationPath,
    surfaceRules: context.surfaceRulesPath,
    guidanceRules: context.guidanceRulesPath,
    terminalRules: context.terminalRulesPath,
    interfaceRules: context.interfaceRulesPath,
    interactionRules: context.interactionRulesPath,
    feedbackRules: context.feedbackRulesPath,
    semanticRules: context.semanticRulesPath,
    variantKnobs: context.variantKnobsPath,
  }
}

export function getColorLanguageModelSources(schemeId = COLOR_SYSTEM_SCHEME_ID) {
  return { ...buildModelSourcesForScheme(schemeId) }
}

export function loadColorLanguageModelInputs(overrides = null, schemeId = COLOR_SYSTEM_SCHEME_ID) {
  const ov = overrides || {}
  return {
    activeScheme: ov.activeScheme ?? resolveInputSchemeContext(schemeId),
    scheme: ov.scheme ?? loadColorSchemeManifest(schemeId),
    taxonomy: ov.taxonomy ?? loadSchemeTaxonomy(schemeId),
    variants: ov.variants ?? loadColorSystemVariants(schemeId),
    adapters: ov.adapters ?? loadRoleAdapters(),
    surfaceAdapters: ov.surfaceAdapters ?? loadSurfaceAdapters(),
    guidanceAdapters: ov.guidanceAdapters ?? loadGuidanceAdapters(),
    terminalAdapters: ov.terminalAdapters ?? loadTerminalAdapters(),
    interfaceAdapters: ov.interfaceAdapters ?? loadInterfaceAdapters(),
    interactionAdapters: ov.interactionAdapters ?? loadInteractionAdapters(),
    feedbackAdapters: ov.feedbackAdapters ?? loadFeedbackAdapters(),
    foundation: ov.foundation ?? loadFoundationPalette(schemeId),
    surfaceRules: ov.surfaceRules ?? loadSurfaceRules(schemeId),
    guidanceRules: ov.guidanceRules ?? loadGuidanceRules(schemeId),
    terminalRules: ov.terminalRules ?? loadTerminalRules(schemeId),
    interfaceRules: ov.interfaceRules ?? loadInterfaceRules(schemeId),
    interactionRules: ov.interactionRules ?? loadInteractionRules(schemeId),
    feedbackRules: ov.feedbackRules ?? loadFeedbackRules(schemeId),
    semanticRules: ov.semanticRules ?? loadSemanticRules(schemeId),
    variantKnobs: ov.variantKnobs ?? loadVariantKnobs(schemeId),
    variantProfiles: ov.variantProfiles ?? loadVariantProfiles(),
  }
}

export function buildColorLanguageModel({
  domain = undefined,
  overrides = null,
  inputs = null,
  schemeId = COLOR_SYSTEM_SCHEME_ID,
  sources = buildModelSourcesForScheme(schemeId),
} = {}) {
  return buildColorLanguageModelFromInputs({
    domain,
    inputs: inputs ? { ...inputs, ...(overrides || {}) } : loadColorLanguageModelInputs(overrides, schemeId),
    sources,
  })
}
