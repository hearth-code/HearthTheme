import { buildGeneratedPlatformTokenMapsCore } from '../color-system/artifacts-core.mjs'
import { buildColorLanguageModel } from '../color-system/build-core.mjs'
import { computeVscodeChromeReferenceDocs } from '../color-system/vscode-chrome-core.mjs'
import { buildVscodeThemes } from '../generate-theme-variants.mjs'
import { renderVscodeThemeJson } from './emit/vscode-core.mjs'
import { tintWorkbenchColors, tintPreviewTokens } from './forge-chrome-tint.mjs'

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

function themeFilesFromThemes(themes) {
  return Object.fromEntries(Object.keys(themes ?? {}).map((variantId) => [variantId, `${variantId}.json`]))
}

function resolveThemeFiles({ themeFiles, themes }) {
  return themeFiles ?? themeFilesFromThemes(themes)
}

export function buildBrowserThemeMaps({
  model,
  themes,
  themeFiles = null,
  exportedSiteTokenKeys = null,
  variant = null,
}) {
  if (!model) throw new Error('buildBrowserThemeMaps: model is required')
  if (!themes) throw new Error('buildBrowserThemeMaps: themes are required')

  const variantIds = selectedVariantIds(variant)
  return scopeMapsToVariants(
    buildGeneratedPlatformTokenMapsCore(model, {
      themes,
      themeFiles: resolveThemeFiles({ themeFiles, themes }),
      ...(exportedSiteTokenKeys ? { exportedSiteTokenKeys } : {}),
    }),
    variantIds,
  )
}

export function buildBrowserThemeFiles({
  model,
  themes,
  themeFiles = null,
  exportedSiteTokenKeys = null,
  variant = null,
}) {
  const resolvedThemeFiles = resolveThemeFiles({ themeFiles, themes })
  const maps = buildBrowserThemeMaps({
    model,
    themes,
    themeFiles: resolvedThemeFiles,
    exportedSiteTokenKeys,
    variant,
  })

  return Object.entries(resolvedThemeFiles)
    .filter(([variantId]) => maps.themes?.[variantId])
    .map(([variantId, path]) => ({ path, content: renderVscodeThemeJson(maps.themes[variantId]) }))
}

function cloneDoc(value) {
  return structuredClone(value)
}

// Full in-browser path: build the model from injected source (+ optional
// foundation/params override), recompute chrome reference docs, run the bundle-
// safe VS Code calibration in preview mode (zero disk), then emit maps + files.
// `source` is every fixed input the page fetched once; `overrides` is the per-
// drag patch (e.g. { foundation }). Same code as Node, so output is identical.
// `chrome` (a hue number, or null) optionally tints the editor chrome toward the
// picked color; null leaves output byte-identical to the Node pipeline.
export function buildForgeThemes({ source, overrides = null, variant = null, chrome = null }) {
  if (!source) throw new Error('buildForgeThemes: source is required')
  const { exportedSiteTokenKeys } = source
  if (!exportedSiteTokenKeys) {
    throw new Error('buildForgeThemes: source.exportedSiteTokenKeys is required')
  }

  const model = buildColorLanguageModel({ inputs: source.inputs, overrides })
  const referenceDocs = computeVscodeChromeReferenceDocs(model, source.variantSpec, source.vscodeChromeContract)
  const contractPath = `${source.activeSchemeDir}/color-contract.json`
  const injectedDocs = { ...referenceDocs, [contractPath]: source.colorContract }

  const { themes, outputPaths, warnings } = buildVscodeThemes({
    model,
    colorScheme: source.colorScheme,
    variantSpec: source.variantSpec,
    roleDefs: source.roleDefs,
    tuning: source.tuning,
    schemeId: source.schemeId,
    activeSchemeDir: source.activeSchemeDir,
    semanticPath: source.semanticPath,
    referenceDocs,
    readJsonFile(path) {
      if (path in injectedDocs) return cloneDoc(injectedDocs[path])
      throw new Error(`buildForgeThemes: unexpected file read "${path}"`)
    },
    existsPath(path) {
      return path in injectedDocs
    },
    syncReferenceFiles() {
      throw new Error('buildForgeThemes: must use injected reference docs')
    },
    writeReferenceFiles: false,
    writeReferenceJson() {
      throw new Error('buildForgeThemes: preview must not write reference files')
    },
    enforce: false,
    log: null,
  })

  // Tint the editor chrome toward the picked hue. Done on the emitted theme
  // colors (so workbench maps + downloadable files follow) and below on the web
  // preview tokens (so the SVG preview matches). A null hue leaves both untouched.
  if (chrome != null) {
    for (const variantId of Object.keys(themes)) {
      themes[variantId].colors = tintWorkbenchColors(themes[variantId].colors, chrome)
    }
  }

  const emitInput = { model, themes, themeFiles: outputPaths, exportedSiteTokenKeys, variant }
  const maps = buildBrowserThemeMaps(emitInput)
  if (chrome != null && maps.web) {
    for (const variantId of Object.keys(maps.web)) {
      maps.web[variantId] = tintPreviewTokens(maps.web[variantId], chrome)
    }
  }

  return {
    model,
    themes,
    warnings,
    maps,
    files: buildBrowserThemeFiles(emitInput),
  }
}

export function handleThemeForgeWorkerMessage(message) {
  const { requestId = null, ...input } = message ?? {}
  if (input.source) {
    const { maps, files, warnings } = buildForgeThemes(input)
    return { requestId, maps, files, warnings }
  }
  return {
    requestId,
    files: buildBrowserThemeFiles(input),
  }
}

function getWorkerScope() {
  if (typeof globalThis === 'undefined') return null
  if (typeof globalThis.addEventListener !== 'function') return null
  if (typeof globalThis.postMessage !== 'function') return null
  if ('document' in globalThis) return null
  return globalThis
}

const workerScope = getWorkerScope()
if (workerScope) {
  workerScope.addEventListener('message', (event) => {
    try {
      workerScope.postMessage(handleThemeForgeWorkerMessage(event.data))
    } catch (error) {
      workerScope.postMessage({
        requestId: event.data?.requestId ?? null,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  })
}
