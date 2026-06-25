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
import { buildGeneratedPlatformTokenMapsCore } from './artifacts-core.mjs'
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

// `themes` (optional) lets a caller inject the in-memory VS Code theme objects
// (e.g. from buildVscodeThemes()) instead of re-reading the committed JSON from
// disk. Default reads THEME_FILES, so the existing path stays byte-identical.
// Migration step 2 toward engine-owned VS Code themes (plan §11).
export function buildGeneratedPlatformTokenMaps(model, { themes: providedThemes = null } = {}) {
  return buildGeneratedPlatformTokenMapsCore(model, {
    themes: providedThemes,
    themeFiles: THEME_FILES,
    readTheme: readJson,
    roleAdapters: ROLE_ADAPTERS,
    surfaceAdapters: SURFACE_ADAPTERS,
    guidanceAdapters: GUIDANCE_ADAPTERS,
    terminalAdapters: TERMINAL_ADAPTERS,
    interfaceAdapters: INTERFACE_ADAPTERS,
    interactionAdapters: INTERACTION_ADAPTERS,
    feedbackAdapters: FEEDBACK_ADAPTERS,
    exportedSiteTokenKeys: EXPORTED_SITE_TOKEN_KEYS,
  })
}
