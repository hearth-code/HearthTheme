import { spawnSync } from 'node:child_process'

const result = spawnSync(process.execPath, ['scripts/audit-scheme-release-contract.mjs', '--scheme', 'moss'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

if (result.error) {
  console.error(`[FAIL] ${result.error.message}`)
  process.exit(1)
}

process.exit(result.status ?? 1)
