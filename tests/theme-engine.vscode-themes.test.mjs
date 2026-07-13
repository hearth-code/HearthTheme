import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { loadFoundationPalette } from '../scripts/color-system.mjs'
import { buildColorLanguageModel } from '../scripts/color-system/build.mjs'
import { buildGeneratedPlatformTokenMaps } from '../scripts/color-system/artifacts.mjs'
import { buildVscodeThemes, generateThemeVariants } from '../scripts/generate-theme-variants-node.mjs'
import { compile } from '../scripts/theme-engine/compile.mjs'
import { vscodeEmitter } from '../scripts/theme-engine/emit/vscode.mjs'

// Migration step 2 (plan §11): buildGeneratedPlatformTokenMaps can derive the
// platform maps from in-memory theme objects (buildVscodeThemes) instead of
// re-reading the committed themes/*.json. Proving the in-memory path equals the
// disk path is the byte-identical bridge for steps 3-4, where the engine produces
// the theme instead of re-serializing a file it already wrote.

test('buildVscodeThemes returns the calibrated theme objects keyed by variant', () => {
  const { themes } = buildVscodeThemes()
  assert.ok(themes.dark && themes.light, 'dark + light theme objects present')
  for (const id of ['dark', 'light']) {
    assert.ok(themes[id].colors && Array.isArray(themes[id].tokenColors), `${id} looks like a theme`)
  }
})

test('injecting in-memory themes yields maps identical to reading them from disk', () => {
  const model = buildColorLanguageModel()
  const fromDisk = buildGeneratedPlatformTokenMaps(model)
  const fromMemory = buildGeneratedPlatformTokenMaps(model, { themes: buildVscodeThemes().themes })
  assert.deepEqual(fromMemory, fromDisk)
})

// Migration step 3 (plan §11): compile() can drive the VS Code theme from the
// in-memory build (engine-produced) rather than re-serializing a committed file.
test('compile drives vscode themes from in-memory buildVscodeThemes, byte-identical to committed', () => {
  const files = compile({ themes: buildVscodeThemes().themes, emitters: [vscodeEmitter] })
  const mossDark = files.find((f) => f.path === 'themes/moss-dark.json')
  assert.ok(mossDark, 'compile produced the moss-dark theme via the engine')
  assert.equal(mossDark.content, fs.readFileSync('themes/moss-dark.json', 'utf8'))
})

test('buildVscodeThemes can preview without writing reference files', () => {
  const { themes } = buildVscodeThemes({
    writeReferenceFiles: false,
    writeReferenceJson() {
      throw new Error('preview mode must not write reference docs')
    },
    log: null,
  })

  assert.ok(themes.dark && themes.light, 'preview still returns calibrated themes')
})

test('generateThemeVariants preview mode skips every write path', () => {
  const throwingWriter = () => {
    throw new Error('preview mode must not write files')
  }

  const { themes } = generateThemeVariants({
    preview: true,
    writeJsonFile: throwingWriter,
    writeReferenceJson: throwingWriter,
    log: null,
  })

  assert.ok(themes.dark && themes.light, 'preview still returns calibrated themes')
})

test('generateThemeVariants can build a non-active scheme in process', () => {
  const writes = []
  const referenceWrites = []
  const { outputPaths, themes, warnings } = generateThemeVariants({
    schemeId: 'ember',
    writeReferenceFiles: false,
    writeSemanticSnapshot: false,
    writeJsonFile(path) {
      writes.push(path)
      return false
    },
    writeReferenceJson(path) {
      referenceWrites.push(path)
      return false
    },
    log: null,
  })

  assert.deepEqual(outputPaths, {
    dark: 'themes/ember-dark.json',
    light: 'themes/ember-light.json',
  })
  assert.deepEqual(writes, ['themes/ember-dark.json', 'themes/ember-light.json'])
  assert.deepEqual(referenceWrites, [])
  assert.ok(themes.dark && themes.light, 'ember themes are built in memory')
  assert.deepEqual(
    warnings.filter((warning) => warning.includes('emitted readability drift review required')),
    [],
    'Ember Light emitted roles stay inside the authored-to-output drift budget',
  )
})

test('foundation overrides reach in-memory VS Code calibration', () => {
  const foundation = structuredClone(loadFoundationPalette())
  foundation.families.spark.tones.base.dark = '#3a86ff'

  const base = buildVscodeThemes({ writeReferenceFiles: false, log: null }).themes
  const shifted = buildVscodeThemes({
    overrides: { foundation },
    writeReferenceFiles: false,
    log: null,
  }).themes

  const readKeyword = (theme) => {
    const value = theme.semanticTokenColors.keyword
    return typeof value === 'string' ? value : value?.foreground
  }

  assert.notEqual(readKeyword(shifted.dark), readKeyword(base.dark))
})
