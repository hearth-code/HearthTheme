// Build-time payload for the hero forge loop: per-scheme token palettes, seed
// colors, and per-platform key counts, all sourced from the real pipeline.
// Moss comes from one engine run (byte-identical to the shipped themes); Ember
// is extracted from its shipped theme JSONs via the role adapters, and the
// extractor is self-checked against the engine's Moss output at build time so
// it can never silently drift. Node-only; imported from Astro frontmatter.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildForgeThemes } from '../../scripts/theme-engine/browser-worker.mjs'
import { loadRoleAdapters, getThemeOutputFilesForSchemeId } from '../../scripts/color-system.mjs'

// Adapter role id -> web token key (only `function` is renamed).
const EXTRACT_ROLES = ['comment', 'keyword', 'function', 'string', 'number', 'type', 'variable', 'property', 'method', 'operator']
const ROLE_KEY = { function: 'fn' }

let cached = null

function readJson(path) {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8'))
}

function normalizeHex(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().toLowerCase()
  return /^#[0-9a-f]{6}$/.test(trimmed) ? trimmed : null
}

function entryScopes(entry) {
  const scope = entry?.scope
  if (typeof scope === 'string') return scope.split(',').map((part) => part.trim()).filter(Boolean)
  if (Array.isArray(scope)) return scope.map((part) => String(part).trim())
  return []
}

function tokenColor(theme, scopes) {
  for (const wanted of scopes || []) {
    for (const entry of theme.tokenColors || []) {
      if (!entryScopes(entry).includes(wanted)) continue
      const color = normalizeHex(entry.settings?.foreground)
      if (color) return color
    }
  }
  return null
}

function extractTokens(theme, roleScopes) {
  const tokens = {
    bg: normalizeHex(theme.colors?.['editor.background']),
    fg: normalizeHex(theme.colors?.['editor.foreground']),
    cursor: normalizeHex(theme.colors?.['editorCursor.foreground']),
    status: normalizeHex(theme.colors?.['statusBar.background']),
    onStatus: normalizeHex(theme.colors?.['statusBar.foreground']),
  }
  for (const roleId of EXTRACT_ROLES) {
    const color = tokenColor(theme, roleScopes[roleId])
    if (color) tokens[ROLE_KEY[roleId] || roleId] = color
  }
  return tokens
}

// The extractor must reproduce the engine's web tokens for the scheme the
// engine built; a mismatch means the scope matcher went stale — fail the build.
function assertExtractorMatches(extracted, webTokens, label) {
  for (const roleId of EXTRACT_ROLES) {
    const key = ROLE_KEY[roleId] || roleId
    const mine = extracted[key]
    const truth = normalizeHex(webTokens[key])
    if (mine && truth && mine !== truth) {
      throw new Error(`forgeIgnition: extractor drift on ${label}.${key} (${mine} != ${truth})`)
    }
  }
}

export function getForgeIgnitionData() {
  if (cached) return cached

  const source = readJson('public/theme-forge/source.json')
  const { maps } = buildForgeThemes({ source })
  const roleScopes = Object.fromEntries(loadRoleAdapters().map((role) => [role.id, role.scopes || []]))

  const mossFiles = getThemeOutputFilesForSchemeId('moss')
  const emberFiles = getThemeOutputFilesForSchemeId('ember')
  const mossDark = readJson(mossFiles.dark)
  const emberDark = readJson(emberFiles.dark)
  const emberLight = readJson(emberFiles.light)

  assertExtractorMatches(extractTokens(mossDark, roleScopes), maps.web?.dark || {}, 'moss-dark')

  const emberDarkTokens = extractTokens(emberDark, roleScopes)
  const webCount = Object.keys(maps.web?.dark || {}).length

  cached = {
    spark: source.inputs.foundation.families.spark.tones.base.dark,
    schemes: {
      moss: {
        seed: source.inputs.foundation.families.spark.tones.base.dark,
        tokens: { dark: maps.web?.dark || {}, light: maps.web?.light || {} },
        counts: {
          vscode: Object.keys(mossDark.colors || {}).length,
          web: webCount,
          obsidian: Object.keys(maps.obsidian?.dark || {}).length,
        },
      },
      // Ember ships VS Code + web only; obsidian stays null so the ship line
      // honestly shows two doors for it.
      ember: {
        seed: emberDarkTokens.keyword || emberDarkTokens.fg,
        tokens: { dark: emberDarkTokens, light: extractTokens(emberLight, roleScopes) },
        counts: {
          vscode: Object.keys(emberDark.colors || {}).length,
          web: webCount,
          obsidian: null,
        },
      },
    },
  }
  return cached
}
