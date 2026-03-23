import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { spawnSync } from 'child_process'
import { getReleaseVersion } from './release-metadata.mjs'

const SOURCE_DIR = 'obsidian/themes'
const OUTPUT_ROOT = 'release/obsidian'
const FILES = [
  'hearth-dark.css',
  'hearth-dark-soft.css',
  'hearth-light.css',
  'hearth-light-soft.css',
]

function getArg(name, fallback = null) {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`))
  if (inline) return inline.slice(name.length + 1)
  const idx = process.argv.indexOf(name)
  if (idx === -1) return fallback
  return process.argv[idx + 1] ?? fallback
}

function readVersion() {
  const raw = getArg('--version') || getArg('--ver')
  if (raw) return raw.replace(/^v/i, '')
  return getReleaseVersion()
}

function runStep(command, args, label) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) {
    throw new Error(`${label} failed before packing`)
  }
}

function prepareObsidianThemes() {
  runStep('node', ['scripts/generate-theme-variants.mjs'], 'generate-theme-variants')
  runStep('node', ['scripts/generate-obsidian-themes.mjs'], 'generate-obsidian-themes')
}

function ensureSourceFiles() {
  for (const file of FILES) {
    const path = join(SOURCE_DIR, file)
    if (!existsSync(path)) {
      throw new Error(`Missing source file: ${path}`)
    }
  }
}

function writeInstallGuide(path, version) {
  const content = [
    '# Hearth Obsidian Snippet Pack',
    '',
    `Version: ${version}`,
    '',
    '## Included snippets',
    '',
    '- hearth-dark.css',
    '- hearth-dark-soft.css',
    '- hearth-light.css',
    '- hearth-light-soft.css',
    '',
    '## Install',
    '',
    '1. Copy one or more `hearth-*.css` files into `<Vault>/.obsidian/snippets/`.',
    '2. In Obsidian: Settings -> Appearance -> CSS snippets.',
    '3. Refresh snippets and enable exactly one variant per mode.',
    '',
    'Note: dark variants target `.theme-dark`; light variants target `.theme-light`.',
    '',
  ].join('\n')
  writeFileSync(path, content)
}

function createZip(packageDir, zipPath) {
  const tarResult = spawnSync(
    'tar',
    ['-a', '-c', '-f', zipPath, '-C', packageDir, '.'],
    { stdio: 'pipe' }
  )
  if (tarResult.status === 0) return true

  const zipResult = spawnSync('zip', ['-r', '-q', zipPath, '.'], { cwd: packageDir, stdio: 'pipe' })
  return zipResult.status === 0
}

function run() {
  const version = readVersion()
  prepareObsidianThemes()
  ensureSourceFiles()

  mkdirSync(OUTPUT_ROOT, { recursive: true })

  const packageName = `hearth-obsidian-snippets-v${version}`
  const packageDir = resolve(join(OUTPUT_ROOT, packageName))
  const snippetsDir = join(packageDir, 'snippets')

  rmSync(packageDir, { recursive: true, force: true })
  mkdirSync(snippetsDir, { recursive: true })

  for (const file of FILES) {
    cpSync(join(SOURCE_DIR, file), join(snippetsDir, file))
  }

  writeInstallGuide(join(packageDir, 'INSTALL.md'), version)

  const zipPath = resolve(join(OUTPUT_ROOT, `${packageName}.zip`))
  rmSync(zipPath, { force: true })

  const zipped = createZip(packageDir, zipPath)

  console.log(`[OK] Obsidian package dir: ${packageDir}`)
  if (zipped) {
    console.log(`[OK] Obsidian zip: ${zipPath}`)
  } else {
    console.log('[WARN] zip creation skipped/failed, directory package is ready')
  }
}

try {
  run()
} catch (error) {
  console.error(`[FAIL] ${error.message}`)
  process.exit(1)
}
