import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// The chrome reference computation must be bundle-safe so the browser worker can
// recompute reference docs per primary-colour override without fs/loaders.
test('the VS Code chrome core bundles without fs loaders', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'hearththeme-vscode-chrome-core-'))
  const bundlePath = join(tmp, 'vscode-chrome-core.mjs')
  try {
    execFileSync(
      'node_modules/.bin/rollup',
      ['scripts/color-system/vscode-chrome-core.mjs', '--format', 'esm', '--file', bundlePath, '--silent'],
      { cwd: process.cwd(), stdio: 'pipe' },
    )
    const src = readFileSync(bundlePath, 'utf8')
    assert.doesNotMatch(src, /from ['"](?:node:)?fs['"]/)
    assert.doesNotMatch(src, /readFileSync/)
    assert.doesNotMatch(src, /color-system\.mjs/)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})
