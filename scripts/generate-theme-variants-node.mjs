import { existsSync, readFileSync, writeFileSync } from 'fs'
import { pathToFileURL } from 'url'
import {
  COLOR_SYSTEM_ACTIVE_SCHEME_DIR,
  COLOR_SYSTEM_SCHEME_ID,
  COLOR_SYSTEM_SEMANTIC_PATH,
  loadColorSchemeManifest,
  loadColorSystemTuning,
  loadColorSystemVariants,
  loadRoleAdapters,
} from './color-system.mjs'
import { buildColorLanguageModel } from './color-system/build.mjs'
import { syncVscodeChromeReferenceFiles } from './color-system/vscode-chrome.mjs'
import {
  assertGlobalSeparationTarget as assertGlobalSeparationTargetCore,
  buildCriticalPairFloors as buildCriticalPairFloorsCore,
  buildGlobalSeparationConstraint as buildGlobalSeparationConstraintCore,
  buildInteractionStateConstraints as buildInteractionStateConstraintsCore,
  buildVscodeThemes as buildVscodeThemesCore,
  computeGlobalSeparationRatio as computeGlobalSeparationRatioCore,
  createThemeVariantRuntime,
  generateThemeVariants as generateThemeVariantsCore,
  solveInteractionStateConstraint as solveInteractionStateConstraintCore,
  withThemeVariantRuntime,
} from './generate-theme-variants.mjs'

let defaultColorLanguageModel = null

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, data) {
  const next = `${JSON.stringify(data, null, 4)}\n`
  if (existsSync(path)) {
    const prev = readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
    if (prev === next) return false
  }
  writeFileSync(path, next)
  return true
}

function resolveColorLanguageModel({ model = null, overrides = null, domain = undefined } = {}) {
  if (model) return model
  if (overrides || domain) return buildColorLanguageModel({ domain, overrides })
  defaultColorLanguageModel ??= buildColorLanguageModel()
  return defaultColorLanguageModel
}

function createNodeThemeVariantRuntime({
  model = null,
  overrides = null,
  domain = undefined,
  referenceDocs = null,
  syncReferenceFiles = syncVscodeChromeReferenceFiles,
  readJsonFile = readJson,
  writeJsonFile = writeJson,
  existsPath = existsSync,
} = {}) {
  return createThemeVariantRuntime({
    model: resolveColorLanguageModel({ model, overrides, domain }),
    colorScheme: loadColorSchemeManifest(),
    variantSpec: loadColorSystemVariants(),
    roleDefs: loadRoleAdapters(),
    tuning: loadColorSystemTuning(),
    schemeId: COLOR_SYSTEM_SCHEME_ID,
    activeSchemeDir: COLOR_SYSTEM_ACTIVE_SCHEME_DIR,
    semanticPath: COLOR_SYSTEM_SEMANTIC_PATH,
    referenceDocs,
    syncReferenceFiles,
    readJsonFile,
    writeJsonFile,
    existsPath,
  })
}

function runWithNodeThemeVariantRuntime(options, callback) {
  return withThemeVariantRuntime(options.runtime ?? createNodeThemeVariantRuntime(options), callback)
}

export { createNodeThemeVariantRuntime, createThemeVariantRuntime, withThemeVariantRuntime }

export function buildInteractionStateConstraints(theme, variantId, options = {}) {
  return runWithNodeThemeVariantRuntime(options, () => buildInteractionStateConstraintsCore(theme, variantId))
}

export function solveInteractionStateConstraint(theme, variantId, warnings, declaration, options = {}) {
  return runWithNodeThemeVariantRuntime(
    options,
    () => solveInteractionStateConstraintCore(theme, variantId, warnings, declaration),
  )
}

export function buildGlobalSeparationConstraint(variantId, options = {}) {
  return runWithNodeThemeVariantRuntime(options, () => buildGlobalSeparationConstraintCore(variantId))
}

export function computeGlobalSeparationRatio(theme, darkTheme, options = {}) {
  return runWithNodeThemeVariantRuntime(options, () => computeGlobalSeparationRatioCore(theme, darkTheme))
}

export function buildCriticalPairFloors(variantId, options = {}) {
  return runWithNodeThemeVariantRuntime(options, () => buildCriticalPairFloorsCore(variantId))
}

export function assertGlobalSeparationTarget(theme, darkTheme, variantId, options = {}) {
  return runWithNodeThemeVariantRuntime(
    options,
    () => assertGlobalSeparationTargetCore(theme, darkTheme, variantId),
  )
}

export function buildVscodeThemes(options = {}) {
  return buildVscodeThemesCore({
    ...options,
    runtime: options.runtime ?? createNodeThemeVariantRuntime(options),
  })
}

export function generateThemeVariants(options = {}) {
  return generateThemeVariantsCore({
    ...options,
    runtime: options.runtime ?? createNodeThemeVariantRuntime(options),
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    generateThemeVariants()
  } catch (error) {
    console.error(`[FAIL] ${error.message}`)
    process.exit(1)
  }
}
