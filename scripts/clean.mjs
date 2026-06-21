import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Removes regenerable build / report / packaging output. Every path below is
// git-ignored (see .gitignore) and reproduced by a generator, audit, or pack
// step — no source files are ever listed here. node_modules, .husky/_, .env*
// and editor folders are deliberately left alone.
//
//   node scripts/clean.mjs            delete the artifacts
//   node scripts/clean.mjs --dry-run  show what would be deleted

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const dryRun = process.argv.slice(2).includes('--dry-run')

const TARGET_DIRS = ['dist', 'release', '.astro', 'local-builds', 'tmp', 'reports/theme-audit']
const TARGET_FILES = [
  'reports/color-language-version-summary.json',
  'reports/color-language-version-summary.md',
  'reports/theme-audit-interaction.json',
  'reports/theme-audit-interaction.md',
]
// Directories whose name matches a suffix, scanned under a parent dir.
const GLOB_DIRS = [{ parent: 'reports', match: /(-release-gate|-visual-review)$/ }]
// Files matching a suffix, scanned under a parent dir.
const GLOB_FILES = [{ parent: 'extension', match: /\.vsix$/ }]

const removed = []

function remove(relPath) {
  const abs = path.join(ROOT, relPath)
  if (!fs.existsSync(abs)) return
  if (!dryRun) fs.rmSync(abs, { recursive: true, force: true })
  removed.push(relPath)
}

for (const dir of TARGET_DIRS) remove(dir)
for (const file of TARGET_FILES) remove(file)

for (const { parent, match } of GLOB_DIRS) {
  const abs = path.join(ROOT, parent)
  if (!fs.existsSync(abs)) continue
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (entry.isDirectory() && match.test(entry.name)) remove(path.join(parent, entry.name))
  }
}
for (const { parent, match } of GLOB_FILES) {
  const abs = path.join(ROOT, parent)
  if (!fs.existsSync(abs)) continue
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (entry.isFile() && match.test(entry.name)) remove(path.join(parent, entry.name))
  }
}

if (removed.length === 0) {
  console.log('[clean] Nothing to remove — workspace already clean.')
} else {
  console.log(`[clean] ${dryRun ? 'Would remove' : 'Removed'} ${removed.length} item(s):`)
  for (const item of removed.sort()) console.log(`  - ${item}`)
}
if (dryRun) console.log('\n[clean] Dry run — nothing deleted. Re-run without --dry-run to delete.')
