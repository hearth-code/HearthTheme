import { execSync } from 'node:child_process'

const SYNCED_PATHS = [
  'color-system/hearth-dark.source.json',
  'color-system/templates',
  'color-system/semantic.json',
  'themes',
  'public/themes',
  'extension/themes',
  'obsidian/themes',
  'obsidian/app-theme',
  'docs/color-language-report.md',
  'docs/color-language-contract-checklist.md',
  'docs/color-language-contract-review.md',
  'reports/color-language-lineage.json',
  'reports/color-language-consistency.json',
  'reports/color-language-parity.json',
  'src/data/tokens.ts',
  'src/styles/theme-vars.css',
  'docs/theme-baseline.md',
  'extension/package.json',
  'reports/vscode-chrome-residual.json',
]

function run(command, options = {}) {
  return execSync(command, {
    encoding: 'utf8',
    stdio: 'pipe',
    ...options,
  })
}

function shellEscape(value) {
  if (/^[A-Za-z0-9._/:-]+$/.test(value)) return value
  return `"${value.replace(/"/g, '\\"')}"`
}

function diffChangedFiles(paths) {
  const targetArgs = paths.map(shellEscape).join(' ')
  const output = run(`git diff --name-only -- ${targetArgs}`)
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function toSet(items) {
  return new Set(items.map((item) => item.trim()).filter(Boolean))
}

function difference(left, right) {
  const out = []
  for (const item of left) {
    if (!right.has(item)) out.push(item)
  }
  return out.sort()
}

function main() {
  const beforeSync = toSet(diffChangedFiles(SYNCED_PATHS))

  process.stdout.write('[sync-check] Running theme sync...\n')
  execSync('node scripts/sync-themes.mjs', { stdio: 'inherit' })

  const afterSync = toSet(diffChangedFiles(SYNCED_PATHS))
  const introduced = difference(afterSync, beforeSync)

  if (introduced.length > 0) {
    process.stderr.write('\n[sync-check] Generated files drift detected after sync.\n')
    process.stderr.write('[sync-check] Stage/update these files before committing:\n')
    for (const file of introduced) {
      process.stderr.write(`  - ${file}\n`)
    }
    process.stderr.write('\nRun: pnpm run sync && git add <files> && commit again.\n')
    process.exit(1)
  }

  process.stdout.write('[sync-check] OK: generated artifacts are in sync.\n')
}

main()
