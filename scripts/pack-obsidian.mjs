import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { spawnSync } from 'child_process'
import { getReleaseVersion } from './release-metadata.mjs'
import { buildProductMetadata } from './product-metadata.mjs'

const APP_THEME_DIR = 'obsidian/app-theme'
const OUTPUT_ROOT = 'release/obsidian'
const REQUIRED_FILES = ['manifest.json', 'theme.css', 'versions.json', 'screenshot.png', 'community-css-theme-entry.json']
const PRODUCT = buildProductMetadata()

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

function prepareAppTheme() {
  runStep('node', ['scripts/generate-theme-variants.mjs'], 'generate-theme-variants')
  runStep('node', ['scripts/generate-obsidian-themes.mjs'], 'generate-obsidian-themes')
  runStep('node', ['scripts/generate-obsidian-app-theme.mjs'], 'generate-obsidian-app-theme')
}

function ensureSourceFiles() {
  for (const file of REQUIRED_FILES) {
    const path = join(APP_THEME_DIR, file)
    if (!existsSync(path)) {
      throw new Error(`Missing source file: ${path}`)
    }
  }
}

function writeInstallGuide(path, version) {
  const content = [
    `# ${PRODUCT.product.name} Obsidian App Theme Package`,
    '',
    `Version: ${version}`,
    '',
    '## Included files',
    '',
    '- manifest.json',
    '- theme.css',
    '- versions.json',
    '- screenshot.png',
    '- community-css-theme-entry.json (for obsidian-releases PR)',
    '',
    '## Community release flow',
    '',
    '1. Create a GitHub Release tag that matches `manifest.json.version` (e.g., `v1.0.17`).',
    '2. Upload at least `manifest.json` and `theme.css` as release assets.',
    '3. Submit/Update your entry in `obsidianmd/obsidian-releases` -> `community-css-themes.json`.',
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
  prepareAppTheme()
  ensureSourceFiles()

  mkdirSync(OUTPUT_ROOT, { recursive: true })

  const packageName = `${PRODUCT.obsidian.packageBasename}-v${version}`
  const packageDir = resolve(join(OUTPUT_ROOT, packageName))

  rmSync(packageDir, { recursive: true, force: true })
  mkdirSync(packageDir, { recursive: true })

  for (const file of REQUIRED_FILES) {
    cpSync(join(APP_THEME_DIR, file), join(packageDir, file))
  }

  writeInstallGuide(join(packageDir, 'INSTALL.md'), version)

  const zipPath = resolve(join(OUTPUT_ROOT, `${packageName}.zip`))
  rmSync(zipPath, { force: true })

  const zipped = createZip(packageDir, zipPath)

  console.log(`[OK] Obsidian app-theme package dir: ${packageDir}`)
  if (zipped) {
    console.log(`[OK] Obsidian app-theme zip: ${zipPath}`)
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
