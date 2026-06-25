import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { buildColorLanguageModel, getExportedSiteTokenKeys } from '../scripts/color-system/build.mjs'
import { buildGeneratedPlatformTokenMaps } from '../scripts/color-system/artifacts.mjs'
import { buildVscodeThemes } from '../scripts/generate-theme-variants.mjs'
import { compile } from '../scripts/theme-engine/compile.mjs'
import { vscodeEmitter } from '../scripts/theme-engine/emit/vscode.mjs'

function sortFiles(files) {
  return [...files].sort((a, b) => a.path.localeCompare(b.path))
}

test('bundled browser worker matches the Node engine build output', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'hearththeme-browser-bundle-'))
  const bundlePath = join(tmp, 'theme-forge-worker.mjs')

  try {
    execFileSync(
      'node_modules/.bin/rollup',
      ['scripts/theme-engine/browser-worker.mjs', '--format', 'esm', '--file', bundlePath, '--silent'],
      { cwd: process.cwd(), stdio: 'pipe' },
    )

    const bundleSource = readFileSync(bundlePath, 'utf8')
    assert.doesNotMatch(bundleSource, /from ['"](?:node:)?fs['"]/)
    assert.doesNotMatch(bundleSource, /readFileSync/)

    const browserWorker = await import(`${pathToFileURL(bundlePath).href}?t=${Date.now()}`)
    const model = buildColorLanguageModel()
    const { themes, outputPaths } = buildVscodeThemes({ writeReferenceFiles: false, log: null })
    const exportedSiteTokenKeys = getExportedSiteTokenKeys()

    const browserMaps = browserWorker.buildBrowserThemeMaps({
      model,
      themes,
      themeFiles: outputPaths,
      exportedSiteTokenKeys,
    })
    const nodeMaps = buildGeneratedPlatformTokenMaps(model, { themes })
    assert.deepEqual(browserMaps, nodeMaps)

    const browserFiles = browserWorker.buildBrowserThemeFiles({
      model,
      themes,
      themeFiles: outputPaths,
      exportedSiteTokenKeys,
    })
    const nodeFiles = compile({ model, themes, variant: null, emitters: [vscodeEmitter], verify: null })
    assert.deepEqual(sortFiles(browserFiles), sortFiles(nodeFiles))
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})
