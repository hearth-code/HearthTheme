import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildColorLanguageModel } from '../scripts/color-system/build.mjs'
import { compile } from '../scripts/theme-engine/compile.mjs'
import { colorDomain } from '../scripts/theme-engine/domain-color/index.mjs'
import { vscodeEmitter } from '../scripts/theme-engine/emit/vscode.mjs'
import { webEmitter } from '../scripts/theme-engine/emit/web.mjs'

// Phase 6 / T6.1: the single generic entry assembles emitter plugins over the
// resolved model and returns the terminal artifacts. Proven by reproducing a
// committed output byte-for-byte through compile() — "run it, get the files".

test('compile assembles emitters over the resolved model into files', () => {
  const files = compile({ emitters: [webEmitter] })
  const tokensFile = files.find((f) => f.path === 'src/data/tokens.ts')
  assert.ok(tokensFile, 'web emitter produced the tokens file')
  assert.equal(tokensFile.content, fs.readFileSync('src/data/tokens.ts', 'utf8'))
})

test('compile with no emitters produces no files', () => {
  assert.deepEqual(compile({ emitters: [] }), [])
})

test('compile threads source, domain, and variant through the source adapter', () => {
  const model = buildColorLanguageModel()
  const variant = { id: 'dark' }
  let seen = null

  const files = compile({
    source: {
      buildModel(options) {
        seen = options
        return model
      },
    },
    domain: colorDomain,
    variant,
    emitters: [webEmitter],
  })

  assert.equal(seen.domain, colorDomain)
  assert.equal(seen.variant, variant)
  assert.ok(files.some((file) => file.path === 'src/data/tokens.ts'))
})

test('compile runs the verify stage before returning files', () => {
  let verified = false
  compile({
    emitters: [],
    verify({ model, maps, emitters }) {
      verified = Boolean(model?.platformTokenMaps && maps?.web && Array.isArray(emitters))
    },
  })
  assert.equal(verified, true)
})

test('compile can emit the active VS Code theme JSON byte-for-byte', () => {
  const files = compile({ emitters: [vscodeEmitter] })
  const mossDark = files.find((file) => file.path === 'themes/moss-dark.json')

  assert.ok(mossDark, 'vscode emitter produced moss-dark theme JSON')
  assert.equal(mossDark.content, fs.readFileSync('themes/moss-dark.json', 'utf8'))
})

test('compile defaults to the configured active emitters', () => {
  const paths = compile().map((file) => file.path)

  assert.ok(paths.includes('src/data/tokens.ts'))
  assert.ok(paths.includes('themes/moss-dark.json'))
  assert.ok(paths.includes('obsidian/themes/moss-dark.css'))
})
