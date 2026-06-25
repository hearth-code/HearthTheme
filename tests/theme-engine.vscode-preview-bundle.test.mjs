import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildColorLanguageModel } from '../scripts/color-system/build.mjs'
import {
  COLOR_SYSTEM_ACTIVE_SCHEME_DIR,
  COLOR_SYSTEM_SCHEME_ID,
  COLOR_SYSTEM_SEMANTIC_PATH,
  loadColorSchemeManifest,
  loadColorSystemTuning,
  loadColorSystemVariants,
  loadRoleAdapters,
} from '../scripts/color-system.mjs'
import { syncVscodeChromeReferenceFiles } from '../scripts/color-system/vscode-chrome.mjs'
import { buildVscodeThemes as buildNodeVscodeThemes } from '../scripts/generate-theme-variants-node.mjs'
import { buildVscodeThemes } from '../scripts/generate-theme-variants.mjs'

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function clone(value) {
  return structuredClone(value)
}

test('the VS Code calibration module bundles without fs loaders', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'hearththeme-vscode-calibration-bundle-'))
  const bundlePath = join(tmp, 'vscode-calibration.mjs')

  try {
    execFileSync(
      'node_modules/.bin/rollup',
      ['scripts/generate-theme-variants.mjs', '--format', 'esm', '--file', bundlePath, '--silent'],
      { cwd: process.cwd(), stdio: 'pipe' },
    )

    const bundleSource = readFileSync(bundlePath, 'utf8')
    assert.doesNotMatch(bundleSource, /from ['"](?:node:)?fs['"]/)
    assert.doesNotMatch(bundleSource, /readFileSync/)
    assert.doesNotMatch(bundleSource, /color-system\.mjs/)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
})

test('buildVscodeThemes runs fs-free with injected model and reference docs', () => {
  const model = buildColorLanguageModel()
  const variantSpec = loadColorSystemVariants()
  const referenceDocs = syncVscodeChromeReferenceFiles(model, variantSpec, {
    write: false,
    writeJson() {
      throw new Error('reference sync must not write')
    },
    log: null,
  })
  const injectedDocs = {
    ...referenceDocs,
    [`${COLOR_SYSTEM_ACTIVE_SCHEME_DIR}/color-contract.json`]: readJson(`${COLOR_SYSTEM_ACTIVE_SCHEME_DIR}/color-contract.json`),
  }

  const injected = buildVscodeThemes({
    model,
    colorScheme: loadColorSchemeManifest(),
    variantSpec,
    roleDefs: loadRoleAdapters(),
    tuning: loadColorSystemTuning(),
    schemeId: COLOR_SYSTEM_SCHEME_ID,
    activeSchemeDir: COLOR_SYSTEM_ACTIVE_SCHEME_DIR,
    semanticPath: COLOR_SYSTEM_SEMANTIC_PATH,
    referenceDocs,
    readJsonFile(path) {
      if (path in injectedDocs) return clone(injectedDocs[path])
      throw new Error(`preview path must not read ${path}`)
    },
    existsPath(path) {
      return path in injectedDocs
    },
    syncReferenceFiles() {
      throw new Error('preview path must use injected reference docs')
    },
    writeReferenceFiles: false,
    writeReferenceJson() {
      throw new Error('preview path must not write references')
    },
    log: null,
  })

  const node = buildNodeVscodeThemes({ model, writeReferenceFiles: false, log: null })
  assert.deepEqual(injected, node)
})
