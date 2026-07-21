import { existsSync, readFileSync } from 'fs'
import { buildZedExtensionFiles, ZED_MANIFEST_PATH, ZED_THEMES_DIR } from './generate-zed-themes.mjs'
import { getReleaseVersion } from './release-metadata.mjs'
import { validateZedThemeFamily } from './theme-engine/emit/zed-core.mjs'

const findings = []

function parseManifest(source) {
  const readString = (key) => {
    const match = source.match(new RegExp(`^${key}\\s*=\\s*("(?:[^"\\\\]|\\\\.)*")\\s*$`, 'm'))
    if (!match) return null
    try {
      return JSON.parse(match[1])
    } catch {
      return null
    }
  }
  const schemaVersion = Number(source.match(/^schema_version\s*=\s*(\d+)\s*$/m)?.[1] ?? Number.NaN)
  return {
    id: readString('id'),
    name: readString('name'),
    version: readString('version'),
    description: readString('description'),
    repository: readString('repository'),
    schemaVersion,
  }
}

let generatedFiles = []
try {
  generatedFiles = buildZedExtensionFiles()
} catch (error) {
  findings.push(`generator failed: ${error.message}`)
}

for (const file of generatedFiles) {
  if (!existsSync(file.path)) {
    findings.push(`missing generated file: ${file.path}`)
    continue
  }
  const committed = readFileSync(file.path, 'utf8').replace(/\r\n/g, '\n')
  if (committed !== file.content.replace(/\r\n/g, '\n')) {
    findings.push(`${file.path} does not match the current generator output`)
  }
}

if (existsSync(ZED_MANIFEST_PATH)) {
  const manifest = parseManifest(readFileSync(ZED_MANIFEST_PATH, 'utf8'))
  if (!manifest.id?.endsWith('-theme')) findings.push('extension.toml id must end in "-theme"')
  if (/\b(?:zed|extension)\b/i.test(manifest.name ?? '')) {
    findings.push('extension.toml name cannot contain "Zed" or "extension"')
  }
  if (manifest.schemaVersion !== 1) findings.push('extension.toml schema_version must be 1')
  if (manifest.version !== getReleaseVersion()) {
    findings.push(`extension.toml version ${manifest.version ?? '(missing)'} does not match release ${getReleaseVersion()}`)
  }
  if (!manifest.description) findings.push('extension.toml description is required')
  if (!/^https:\/\/github\.com\//.test(manifest.repository ?? '')) {
    findings.push('extension.toml repository must be an HTTPS GitHub URL')
  }
}

const expectedThemeNames = new Set([
  'HearthCode Moss Dark',
  'HearthCode Moss Light',
  'HearthCode Ember Dark',
  'HearthCode Ember Light',
])
const actualThemeNames = new Set()

for (const file of generatedFiles.filter((entry) => entry.path.startsWith(`${ZED_THEMES_DIR}/`))) {
  let family
  try {
    family = JSON.parse(readFileSync(file.path, 'utf8'))
  } catch (error) {
    findings.push(`${file.path} is invalid JSON: ${error.message}`)
    continue
  }
  for (const error of validateZedThemeFamily(family)) findings.push(`${file.path}: ${error}`)
  const appearances = new Set()
  for (const theme of family.themes ?? []) {
    actualThemeNames.add(theme.name)
    appearances.add(theme.appearance)
    const syntax = theme.style?.syntax ?? {}
    if (syntax.comment?.font_style !== 'italic') {
      findings.push(`${file.path}: ${theme.name} should preserve comment italics`)
    }
    if (syntax.keyword?.font_weight !== 700) {
      findings.push(`${file.path}: ${theme.name} should preserve keyword bold weight`)
    }
  }
  if (family.themes?.length !== 2 || !appearances.has('dark') || !appearances.has('light')) {
    findings.push(`${file.path} must contain exactly one dark and one light theme`)
  }
}

for (const name of expectedThemeNames) {
  if (!actualThemeNames.has(name)) findings.push(`missing Zed theme: ${name}`)
}
for (const name of actualThemeNames) {
  if (!expectedThemeNames.has(name)) findings.push(`unexpected Zed theme: ${name}`)
}

if (findings.length > 0) {
  console.error('[FAIL] Zed theme audit found issues:')
  for (const finding of findings) console.error(`  - ${finding}`)
  process.exit(1)
}

console.log(`[PASS] Zed theme audit passed (${actualThemeNames.size} themes, schema v0.2.0 contract).`)
