import { execSync } from 'node:child_process'

// Preview PNG bytes are not byte-stable across sharp/libvips builds, so the
// gate checks the deterministic input manifest only. The generator itself
// skips re-rendering when the manifest is unchanged, which keeps this check
// clean on every machine. PNGs are refreshed exactly when the manifest moves.
const PREVIEW_MANIFEST_PATHS = [
  'reports/preview-manifest.json',
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

function listDirty(paths) {
  const targetArgs = paths.map(shellEscape).join(' ')
  const changed = run(`git diff --name-only -- ${targetArgs}`)
  const untracked = run(`git ls-files --others --exclude-standard -- ${targetArgs}`)
  return [...changed.split(/\r?\n/), ...untracked.split(/\r?\n/)]
    .map((line) => line.trim())
    .filter(Boolean)
    .sort()
}

function main() {
  process.stdout.write('[preview-check] Running preview generation...\n')
  execSync('node scripts/generate-preview-images.mjs', { stdio: 'inherit' })

  const dirty = listDirty(PREVIEW_MANIFEST_PATHS)

  if (dirty.length > 0) {
    process.stderr.write('\n[preview-check] Preview manifest is out of sync with the staged tree.\n')
    process.stderr.write('[preview-check] Stage/update these files (plus regenerated preview images) before committing:\n')
    for (const file of dirty) {
      process.stderr.write(`  - ${file}\n`)
    }
    process.stderr.write('\nRun: pnpm run preview:generate && git add reports/preview-manifest.json extension/images public/previews docs/marketing public/og-hearth.png zed/images terminal/hearthcode-terminal.png\n')
    process.exit(1)
  }

  process.stdout.write('[preview-check] OK: preview assets are in sync.\n')
}

main()
