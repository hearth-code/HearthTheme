import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { pathToFileURL } from 'url'
import {
  loadColorProductManifest,
  loadColorSchemeManifest,
} from './color-system.mjs'
import { buildColorLanguageModel } from './color-system/build.mjs'
import { buildVscodeThemes } from './generate-theme-variants-node.mjs'
import { compile } from './theme-engine/compile.mjs'
import { createTelegramEmitter } from './theme-engine/emit/telegram.mjs'

const OUTPUT_ROOT = 'telegram'
const OUTPUT_DIRS = ['desktop', 'ios']

function toBuffer(content) {
  return Buffer.isBuffer(content) ? content : Buffer.from(content.replace(/\r\n/g, '\n'), 'utf8')
}

function writeIfChanged(path, content) {
  const next = toBuffer(content)
  if (existsSync(path) && readFileSync(path).equals(next)) return false
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, next)
  return true
}

function removeStaleFiles(expectedPaths, log) {
  for (const name of OUTPUT_DIRS) {
    const directory = join(OUTPUT_ROOT, name)
    if (!existsSync(directory)) continue
    for (const file of readdirSync(directory)) {
      const path = join(directory, file)
      if (!statSync(path).isFile() || expectedPaths.has(path)) continue
      rmSync(path, { force: true })
      log(`✓ removed stale ${path}`)
    }
  }
}

export function buildTelegramThemeFiles() {
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
    const emitter = createTelegramEmitter({ schemeId, schemeName: scheme.name })
    return compile({ model, themes, variant: null, emitters: [emitter] })
  })
}

export function generateTelegramThemes({ log = console.log } = {}) {
  const files = buildTelegramThemeFiles()
  removeStaleFiles(new Set(files.map((file) => file.path)), log)
  for (const file of files) {
    const changed = writeIfChanged(file.path, file.content)
    log(`${changed ? '✓ generated' : '- unchanged'} ${file.path}`)
  }
  return files
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    generateTelegramThemes()
  } catch (error) {
    console.error(`[FAIL] ${error.message}`)
    process.exit(1)
  }
}
