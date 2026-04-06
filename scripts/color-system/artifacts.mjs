import { readFileSync } from 'fs'
import {
  loadFeedbackAdapters,
  getThemeOutputFiles,
  loadGuidanceAdapters,
  loadInterfaceAdapters,
  loadInteractionAdapters,
  loadRoleAdapters,
  loadSurfaceAdapters,
  loadTerminalAdapters,
} from '../color-system.mjs'
import { getExportedSiteTokenKeys } from './build.mjs'

const THEME_FILES = getThemeOutputFiles()
const ROLE_ADAPTERS = loadRoleAdapters()
const SURFACE_ADAPTERS = loadSurfaceAdapters()
const GUIDANCE_ADAPTERS = loadGuidanceAdapters()
const TERMINAL_ADAPTERS = loadTerminalAdapters()
const INTERFACE_ADAPTERS = loadInterfaceAdapters()
const INTERACTION_ADAPTERS = loadInteractionAdapters()
const FEEDBACK_ADAPTERS = loadFeedbackAdapters()
const EXPORTED_SITE_TOKEN_KEYS = getExportedSiteTokenKeys()

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function normalizeFlexibleHex(hex) {
  if (typeof hex !== 'string') return null
  const value = hex.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/i.test(value)) return value
  if (/^#[0-9a-f]{8}$/i.test(value)) return value
  return null
}

function toScopes(entry) {
  if (!entry?.scope) return []
  return Array.isArray(entry.scope) ? entry.scope : [entry.scope]
}

function getScopeMatchDetail(entryScopes, scopes) {
  if (!entryScopes?.length || !scopes?.length) return { count: 0, ratio: 0 }
  const count = entryScopes.filter((scope) => scopes.includes(scope)).length
  return {
    count,
    ratio: count > 0 ? count / entryScopes.length : 0,
  }
}

function getTokenColor(theme, scopes) {
  if (!Array.isArray(scopes) || scopes.length === 0) return null

  let bestColor = null
  let bestRatio = -1
  let bestCount = -1
  let bestScopeLength = Number.POSITIVE_INFINITY

  for (const entry of theme.tokenColors || []) {
    const entryScopes = toScopes(entry)
    const detail = getScopeMatchDetail(entryScopes, scopes)
    if (detail.count === 0) continue
    const color = normalizeFlexibleHex(entry.settings?.foreground)
    if (!color) continue

    const isBetter =
      detail.ratio > bestRatio ||
      (detail.ratio === bestRatio && detail.count > bestCount) ||
      (detail.ratio === bestRatio && detail.count === bestCount && entryScopes.length < bestScopeLength)

    if (!isBetter) continue

    bestColor = color
    bestRatio = detail.ratio
    bestCount = detail.count
    bestScopeLength = entryScopes.length
  }
  return bestColor
}

function getSemanticColor(theme, semanticKey) {
  if (!semanticKey) return null
  const value = theme.semanticTokenColors?.[semanticKey]
  if (!value) return null
  if (typeof value === 'string') return normalizeFlexibleHex(value)
  if (typeof value === 'object' && value.foreground) return normalizeFlexibleHex(value.foreground)
  return null
}

function getWorkbenchColor(theme, colorKey) {
  if (!colorKey) return null
  return normalizeFlexibleHex(theme.colors?.[colorKey])
}

function resolveRoleColor(theme, roleDef) {
  return getTokenColor(theme, roleDef.scopes) ?? roleDef.semanticKeys.map((key) => getSemanticColor(theme, key)).find(Boolean) ?? null
}

export function buildGeneratedPlatformTokenMaps(model) {
  const tokenSets = {}
  const web = {}
  const obsidian = {}
  const vscode = {
    semantic: {},
    textmate: {},
    workbench: {},
  }
  const themes = {}

  for (const [variantId, path] of Object.entries(THEME_FILES)) {
    const theme = readJson(path)
    themes[variantId] = theme

    tokenSets[variantId] = {}
    obsidian[variantId] = { ...(model.platformTokenMaps.obsidian?.[variantId] || {}) }
    vscode.semantic[variantId] = {}
    vscode.textmate[variantId] = {}
    vscode.workbench[variantId] = { ...(model.platformTokenMaps.vscode?.workbench?.[variantId] || {}) }

    for (const contract of [...SURFACE_ADAPTERS, ...GUIDANCE_ADAPTERS, ...TERMINAL_ADAPTERS, ...INTERFACE_ADAPTERS, ...INTERACTION_ADAPTERS, ...FEEDBACK_ADAPTERS]) {
      const fallbackWorkbenchColor = contract.vscodeColor
        ? model.platformTokenMaps.vscode?.workbench?.[variantId]?.[contract.vscodeColor]
        : null
      const finalWorkbenchColor = contract.vscodeColor
        ? getWorkbenchColor(theme, contract.vscodeColor) ?? fallbackWorkbenchColor
        : fallbackWorkbenchColor
      const fallbackObsidianColor = contract.obsidianVar
        ? model.platformTokenMaps.obsidian?.[variantId]?.[contract.obsidianVar]
        : null

      if (contract.vscodeColor && finalWorkbenchColor) {
        vscode.workbench[variantId][contract.vscodeColor] = finalWorkbenchColor
      }

      const finalAbstractColor =
        finalWorkbenchColor ??
        fallbackObsidianColor ??
        (contract.webToken ? model.platformTokenMaps.tokenSets?.[variantId]?.[contract.webToken] : null)

      if (contract.obsidianVar && finalAbstractColor) {
        obsidian[variantId][contract.obsidianVar] = finalAbstractColor
      }

      if (contract.webToken) {
        const finalTokenColor = finalAbstractColor
        if (!finalTokenColor) {
          throw new Error(`Missing generated platform token for "${contract.id}" in theme "${variantId}".`)
        }
        tokenSets[variantId][contract.webToken] = finalTokenColor
      }
    }

    for (const roleDef of ROLE_ADAPTERS) {
      const resolvedRoleColor = resolveRoleColor(theme, roleDef)
      if (!resolvedRoleColor) {
        throw new Error(`Missing generated role color for "${roleDef.id}" in theme "${variantId}".`)
      }

      const webKey = roleDef.webToken || roleDef.id
      tokenSets[variantId][webKey] = resolvedRoleColor

      if (roleDef.obsidianVar) {
        obsidian[variantId][roleDef.obsidianVar] = resolvedRoleColor
      }

      if (roleDef.vscodeSemantic) {
        vscode.semantic[variantId][roleDef.vscodeSemantic] =
          getSemanticColor(theme, roleDef.vscodeSemantic) ?? resolvedRoleColor
      }

      if (roleDef.scopes?.length) {
        vscode.textmate[variantId][roleDef.id] = {
          scopes: roleDef.scopes,
          color: getTokenColor(theme, roleDef.scopes) ?? resolvedRoleColor,
        }
      }
    }

    web[variantId] = Object.fromEntries(
      EXPORTED_SITE_TOKEN_KEYS.map((key) => [key, tokenSets[variantId][key]])
    )
  }

  return {
    themes,
    tokenSets,
    web,
    obsidian,
    vscode,
  }
}
