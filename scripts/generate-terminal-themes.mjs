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
import { createTerminalEmitter } from './theme-engine/emit/terminal.mjs'

const OUTPUT_DIRS = [
  'terminal/warp',
  'terminal/windows-terminal',
  'terminal/kitty',
  'terminal/alacritty',
  'terminal/iterm2',
]

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
  for (const directory of OUTPUT_DIRS) {
    if (!existsSync(directory)) continue
    for (const name of readdirSync(directory)) {
      const path = join(directory, name)
      if (!statSync(path).isFile() || expectedPaths.has(path)) continue
      rmSync(path, { force: true })
      log(`✓ removed stale ${path}`)
    }
  }
}

export function buildTerminalThemeFiles() {
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
    const emitter = createTerminalEmitter({ schemeId, schemeName: scheme.name })
    return compile({ model, themes, variant: null, emitters: [emitter] })
  })
}

export function generateTerminalThemes({ log = console.log } = {}) {
  const files = buildTerminalThemeFiles()
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
    generateTerminalThemes()
  } catch (error) {
    console.error(`[FAIL] ${error.message}`)
    process.exit(1)
  }
}
