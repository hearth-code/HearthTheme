import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildColorLanguageModel } from '../scripts/color-system/build.mjs'
import { buildGeneratedPlatformTokenMaps } from '../scripts/color-system/artifacts.mjs'
import { getObsidianThemeOutputFiles, getThemeOutputFiles } from '../scripts/color-system.mjs'
import { obsidianEmitter } from '../scripts/theme-engine/emit/obsidian.mjs'
import { vscodeEmitter } from '../scripts/theme-engine/emit/vscode.mjs'

function buildMaps() {
  return buildGeneratedPlatformTokenMaps(buildColorLanguageModel())
}

function assertByteExactFiles(files) {
  for (const file of files) {
    assert.equal(file.content, fs.readFileSync(file.path, 'utf8'), `${file.path} should be reproduced byte-for-byte`)
  }
}

test('the vscode emitter reproduces active committed theme JSON files byte-for-byte', () => {
  const files = vscodeEmitter.emit(buildMaps())

  assert.deepEqual(
    files.map((file) => file.path).sort(),
    Object.values(getThemeOutputFiles()).sort(),
  )
  assertByteExactFiles(files)
})

test('the obsidian emitter reproduces active committed theme CSS files byte-for-byte', () => {
  const files = obsidianEmitter.emit(buildMaps())

  assert.deepEqual(
    files.map((file) => file.path).sort(),
    Object.values(getObsidianThemeOutputFiles()).sort(),
  )
  assertByteExactFiles(files)
})

test('platform emitters declare their plugin contracts', () => {
  assert.equal(vscodeEmitter.name, 'vscode')
  assert.ok(Array.isArray(vscodeEmitter.consumes) && vscodeEmitter.consumes.includes('themes'))
  assert.equal(typeof vscodeEmitter.emit, 'function')

  assert.equal(obsidianEmitter.name, 'obsidian')
  assert.ok(Array.isArray(obsidianEmitter.consumes) && obsidianEmitter.consumes.includes('obsidian'))
  assert.equal(typeof obsidianEmitter.emit, 'function')
})
