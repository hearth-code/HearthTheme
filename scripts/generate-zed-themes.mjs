import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { pathToFileURL } from 'url'
import {
  getThemeMetaListForSchemeId,
  loadColorProductManifest,
  loadColorProductReleaseConfig,
  loadColorSchemeManifest,
} from './color-system.mjs'
import { buildColorLanguageModel } from './color-system/build.mjs'
import { buildVscodeThemes } from './generate-theme-variants-node.mjs'
import { getReleaseVersion } from './release-metadata.mjs'
import { compile } from './theme-engine/compile.mjs'
import { createZedEmitter } from './theme-engine/emit/zed.mjs'

export const ZED_EXTENSION_DIR = 'zed/extension'
export const ZED_THEMES_DIR = `${ZED_EXTENSION_DIR}/themes`
export const ZED_MANIFEST_PATH = `${ZED_EXTENSION_DIR}/extension.toml`

function writeIfChanged(path, content) {
  if (existsSync(path)) {
    const previous = readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
    const next = content.replace(/\r\n/g, '\n')
    if (previous === next) return false
  }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
  return true
}

function tomlString(value) {
  return JSON.stringify(String(value))
}

function renderManifest({ config, version }) {
  return [
    `id = ${tomlString(config.id)}`,
    `name = ${tomlString(config.name)}`,
    'schema_version = 1',
    `version = ${tomlString(version)}`,
    `authors = [${config.authors.map(tomlString).join(', ')}]`,
    `description = ${tomlString(config.description)}`,
    `repository = ${tomlString(config.repository)}`,
    '',
  ].join('\n')
}

function removeStaleThemeFiles(expectedPaths, log) {
  if (!existsSync(ZED_THEMES_DIR)) return
  for (const name of readdirSync(ZED_THEMES_DIR)) {
    const path = join(ZED_THEMES_DIR, name)
    if (!statSync(path).isFile() || expectedPaths.has(path)) continue
    rmSync(path, { force: true })
    log(`✓ removed stale ${path}`)
  }
}

export function buildZedExtensionFiles() {
  const product = loadColorProductManifest()
  const releaseConfig = loadColorProductReleaseConfig()
  const zedConfig = releaseConfig.zedExtension
  if (!zedConfig) throw new Error('Active product release config is missing zedExtension metadata')

  const themeFiles = product.supportedSchemeIds.flatMap((schemeId) => {
    const scheme = loadColorSchemeManifest(schemeId)
    const model = buildColorLanguageModel({ schemeId })
    const { themes } = buildVscodeThemes({
      schemeId,
      model,
      writeReferenceFiles: false,
      log: null,
    })
    const flavorName = product.flavorNames?.[schemeId]?.theme || `${product.name} ${scheme.name}`
    const themeNames = Object.fromEntries(
      getThemeMetaListForSchemeId(schemeId).map((variant) => [
        variant.id,
        `${flavorName} ${variant.climateLabel}`,
      ])
    )
    const emitter = createZedEmitter({
      familyName: flavorName,
      author: product.author.name,
      themeNames,
      outputPath: `${ZED_THEMES_DIR}/${product.id}-${schemeId}.json`,
    })
    return compile({ model, themes, variant: null, emitters: [emitter] })
  })

  return [
    {
      path: ZED_MANIFEST_PATH,
      content: renderManifest({ config: zedConfig, version: getReleaseVersion() }),
    },
    ...themeFiles,
  ]
}

export function generateZedThemes({ log = console.log } = {}) {
  const files = buildZedExtensionFiles()
  const expectedThemePaths = new Set(
    files.filter((file) => file.path.startsWith(`${ZED_THEMES_DIR}/`)).map((file) => file.path)
  )
  removeStaleThemeFiles(expectedThemePaths, log)
  for (const file of files) {
    const changed = writeIfChanged(file.path, file.content)
    log(`${changed ? '✓ generated' : '- unchanged'} ${file.path}`)
  }
  return files
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    generateZedThemes()
  } catch (error) {
    console.error(`[FAIL] ${error.message}`)
    process.exit(1)
  }
}
