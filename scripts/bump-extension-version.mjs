import { readFileSync, writeFileSync } from 'fs'

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

  const packagePath = 'extension/package.json'
  const changelogPath = 'extension/CHANGELOG.md'
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))

  const current = packageJson.version
  const next = bump(current, level)
  if (!next) {
    console.error(`[ERROR] Invalid extension version format: "${current}"`)
    process.exit(1)
  }

  packageJson.version = next
  writeFileSync(packagePath, JSON.stringify(packageJson, null, 4))
  prependChangelogSection(changelogPath, next)

  console.log(`[OK] extension version bumped: ${current} -> ${next}`)
  console.log(`[OK] changelog section ensured: ${next}`)
}

main()
