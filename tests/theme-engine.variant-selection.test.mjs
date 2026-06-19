import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { compile } from '../scripts/theme-engine/compile.mjs'
import { webEmitter } from '../scripts/theme-engine/emit/web.mjs'
import { vscodeEmitter } from '../scripts/theme-engine/emit/vscode.mjs'
import { obsidianEmitter } from '../scripts/theme-engine/emit/obsidian.mjs'

// Variant selection happens at EMIT time: compile() always builds the full model
// (so model validation + lineage stay complete), then scopes the emitted artifacts
// to the chosen variant. The default selector (every variant) is identity, so the
// production build stays byte-identical.

test('default compile emits every variant (web tokens byte-identical to committed)', () => {
  const [tokensFile] = compile({ emitters: [webEmitter] })
  assert.equal(tokensFile.content, fs.readFileSync('src/data/tokens.ts', 'utf8'))
})

test('an array selector naming every variant is identity (byte-identical)', () => {
  const [tokensFile] = compile({ variant: [{ id: 'dark' }, { id: 'light' }], emitters: [webEmitter] })
  assert.equal(tokensFile.content, fs.readFileSync('src/data/tokens.ts', 'utf8'))
})

test('selecting one variant scopes the web emitter output to it', () => {
  const files = compile({ variant: 'dark', emitters: [webEmitter] })
  const tokensFile = files.find((f) => f.path === 'src/data/tokens.ts')
  assert.ok(tokensFile)
  assert.match(tokensFile.content, /\n {2}"dark": \{/) // top-level dark present
  assert.ok(!/\n {2}"light": \{/.test(tokensFile.content), 'top-level light scoped out')
})

test('selecting one variant scopes the vscode emitter to that theme file', () => {
  const paths = compile({ variant: 'dark', emitters: [vscodeEmitter] }).map((f) => f.path)
  assert.ok(paths.includes('themes/moss-dark.json'))
  assert.ok(!paths.includes('themes/moss-light.json'))
})

test('selecting one variant scopes the obsidian emitter to that css file', () => {
  const paths = compile({ variant: 'dark', emitters: [obsidianEmitter] }).map((f) => f.path)
  assert.ok(paths.includes('obsidian/themes/moss-dark.css'))
  assert.ok(!paths.includes('obsidian/themes/moss-light.css'))
})

test('an unknown variant selector throws loudly (no silent empty output)', () => {
  assert.throws(
    () => compile({ variant: 'no-such-variant', emitters: [webEmitter, vscodeEmitter] }),
    /unknown variant selector/,
  )
})
