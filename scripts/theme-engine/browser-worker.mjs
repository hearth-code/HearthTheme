import { buildGeneratedPlatformTokenMapsCore } from '../color-system/artifacts-core.mjs'
import { renderVscodeThemeJson } from './emit/vscode-core.mjs'

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

export function handleThemeForgeWorkerMessage(message) {
  const { requestId = null, ...input } = message ?? {}
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
