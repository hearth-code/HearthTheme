import { execSync } from 'node:child_process'

const SYNCED_PATHS = [
  'themes',
  'public/themes',
  'extension/themes',
  'src/data/tokens.ts',
  'src/styles/theme-vars.css',
  'docs/theme-baseline.md',
  'extension/package.json',
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

function main() {
  process.stdout.write('[sync-check] Running theme sync...\n')
  execSync('node scripts/sync-themes.mjs', { stdio: 'inherit' })

  const changed = diffChangedFiles(SYNCED_PATHS)
  if (changed.length > 0) {
    process.stderr.write('\n[sync-check] Generated files drift detected after sync.\n')
    process.stderr.write('[sync-check] Stage/update these files before committing:\n')
    for (const file of changed) {
      process.stderr.write(`  - ${file}\n`)
    }
    process.stderr.write('\nRun: pnpm run sync && git add <files> && commit again.\n')
    process.exit(1)
  }

  process.stdout.write('[sync-check] OK: generated artifacts are in sync.\n')
}

main()
