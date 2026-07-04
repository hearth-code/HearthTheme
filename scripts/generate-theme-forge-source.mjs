import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { pathToFileURL } from 'url'
import { getExportedSiteTokenKeys, loadColorLanguageModelInputs } from './color-system/build.mjs'
import {
  COLOR_SYSTEM_ACTIVE_SCHEME_DIR,
  COLOR_SYSTEM_SCHEME_ID,
  COLOR_SYSTEM_SEMANTIC_PATH,
  loadColorSchemeManifest,
  loadColorSystemTuning,
  loadColorSystemVariants,
  loadRoleAdapters,
  loadVscodeChromeContract,
} from './color-system.mjs'

export const THEME_FORGE_SOURCE_PATH = 'public/theme-forge/source.json'

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeIfChanged(path, content) {
  if (existsSync(path)) {
    const prev = readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
    const next = content.replace(/\r\n/g, '\n')
    if (prev === next) return false
  }
  writeFileSync(path, content)
  return true
}

export function buildThemeForgeSource() {
  return {
    inputs: loadColorLanguageModelInputs(),
    colorScheme: loadColorSchemeManifest(),
    variantSpec: loadColorSystemVariants(),
    roleDefs: loadRoleAdapters(),
    tuning: loadColorSystemTuning(),
    schemeId: COLOR_SYSTEM_SCHEME_ID,
    activeSchemeDir: COLOR_SYSTEM_ACTIVE_SCHEME_DIR,
    semanticPath: COLOR_SYSTEM_SEMANTIC_PATH,
    colorContract: readJson(`${COLOR_SYSTEM_ACTIVE_SCHEME_DIR}/color-contract.json`),
    vscodeChromeContract: loadVscodeChromeContract(),
    exportedSiteTokenKeys: getExportedSiteTokenKeys(),
  }
}

export function generateThemeForgeSource({ outputPath = THEME_FORGE_SOURCE_PATH, log = console.log } = {}) {
  const source = buildThemeForgeSource()
  mkdirSync(dirname(outputPath), { recursive: true })
  const changed = writeIfChanged(outputPath, `${JSON.stringify(source, null, 2)}\n`)
  if (typeof log === 'function') {
    log(`${changed ? '✓ generated' : '- unchanged'} ${outputPath}`)
  }
  return { path: outputPath, source, changed }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    generateThemeForgeSource()
  } catch (error) {
    console.error(`[FAIL] ${error.message}`)
    process.exit(1)
  }
}
