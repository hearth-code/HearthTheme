import { readFileSync, writeFileSync } from 'fs'
import {
  EXTENSION_PACKAGE_PATH,
  RELEASE_METADATA_PATH,
  getReleaseVersion,
  setReleaseVersion,
} from './release-metadata.mjs'

const LEVELS = new Set(['major', 'minor', 'patch'])
const DEFAULT_NOTE = '- Update notes pending'

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function bump(version, level) {
  const parsed = parseVersion(version)
  if (!parsed) return null
  const [major, minor, patch] = parsed
  if (level === 'major') return `${major + 1}.0.0`
  if (level === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

function prependChangelogSection(changelogPath, nextVersion) {
  const original = readFileSync(changelogPath, 'utf8')
  if (original.includes(`## ${nextVersion}`)) return false
  const newline = original.includes('\r\n') ? '\r\n' : '\n'
  const section = [`## ${nextVersion}`, '', DEFAULT_NOTE, '', ''].join(newline)
  writeFileSync(changelogPath, section + original)
  return true
}

function main() {
  const rawLevel = process.argv[2] ?? 'patch'
  const level = rawLevel.toLowerCase()
  if (!LEVELS.has(level)) {
    console.error('[ERROR] Usage: node scripts/bump-extension-version.mjs [major|minor|patch]')
    process.exit(1)
  }

  const changelogPath = 'extension/CHANGELOG.md'
  const current = getReleaseVersion()
  const next = bump(current, level)
  if (!next) {
    console.error(`[ERROR] Invalid release version format in ${RELEASE_METADATA_PATH}: "${current}"`)
    process.exit(1)
  }

  const syncResult = setReleaseVersion(next, { syncExtensionPackage: true })
  prependChangelogSection(changelogPath, next)

  console.log(`[OK] release version bumped: ${current} -> ${next}`)
  console.log(
    `[OK] ${RELEASE_METADATA_PATH} ${syncResult.releaseChanged ? 'updated' : 'already up to date'}`
  )
  console.log(
    `[OK] ${EXTENSION_PACKAGE_PATH} ${syncResult.extensionChanged ? 'updated' : 'already up to date'}`
  )
  console.log(`[OK] changelog section ensured: ${next}`)
}

main()
