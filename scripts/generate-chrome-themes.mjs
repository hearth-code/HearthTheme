import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs'
import { dirname, join } from 'path'
import { pathToFileURL } from 'url'
import {
  loadColorProductManifest,
  loadColorSchemeManifest,
} from './color-system.mjs'
import { buildColorLanguageModel } from './color-system/build.mjs'
import { buildVscodeThemes } from './generate-theme-variants-node.mjs'
import { compile } from './theme-engine/compile.mjs'
import { createChromeEmitter } from './theme-engine/emit/chrome.mjs'

const OUTPUT_ROOT = 'chrome'
const VERSION = JSON.parse(readFileSync('releases/color-language.json', 'utf8')).version

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

function removeStaleFiles(expectedPaths, log) {
  if (!existsSync(OUTPUT_ROOT)) return
  for (const name of readdirSync(OUTPUT_ROOT)) {
    const directory = join(OUTPUT_ROOT, name)
    if (!statSync(directory).isDirectory()) continue // README.md and other files stay
    const path = join(directory, 'manifest.json')
    if (expectedPaths.has(path)) continue
    rmSync(directory, { recursive: true, force: true })
    log(`✓ removed stale ${directory}`)
  }
}

export function buildChromeThemeFiles() {
  const product = loadColorProductManifest()
  return product.supportedSchemeIds.flatMap((schemeId) => {
    const scheme = loadColorSchemeManifest(schemeId)
    const model = buildColorLanguageModel({ schemeId })
    const { themes } = buildVscodeThemes({
      schemeId,
      model,
      writeReferenceFiles: false,
      log: () => {},
    })
    const emitter = createChromeEmitter({ schemeId, schemeName: scheme.name, version: VERSION })
    return compile({ model, themes, variant: null, emitters: [emitter] })
  })
}

export function generateChromeThemes({ log = console.log } = {}) {
  const files = buildChromeThemeFiles()
  const expectedPaths = new Set(files.map((file) => file.path))
  removeStaleFiles(expectedPaths, log)

  for (const file of files) {
    const changed = writeIfChanged(file.path, file.content)
    log(`${changed ? '✓ generated' : '- unchanged'} ${file.path}`)
  }
  return files
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    generateChromeThemes()
  } catch (error) {
    console.error(`[FAIL] ${error.message}`)
    process.exit(1)
  }
}
