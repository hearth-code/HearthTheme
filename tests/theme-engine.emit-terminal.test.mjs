import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildTerminalThemeFiles } from '../scripts/generate-terminal-themes.mjs'

const files = buildTerminalThemeFiles()

test('terminal generator emits four variants across five formats', () => {
  assert.equal(files.length, 18)
  assert.equal(files.filter((file) => file.path.startsWith('terminal/warp/')).length, 4)
  assert.equal(files.filter((file) => file.path.startsWith('terminal/kitty/')).length, 4)
  assert.equal(files.filter((file) => file.path.startsWith('terminal/alacritty/')).length, 4)
  assert.equal(files.filter((file) => file.path.startsWith('terminal/iterm2/')).length, 4)
  assert.equal(files.filter((file) => file.path.startsWith('terminal/windows-terminal/')).length, 2)
})

test('terminal outputs match committed generated files byte-for-byte', () => {
  for (const file of files) {
    assert.equal(file.content, fs.readFileSync(file.path, 'utf8'), file.path)
  }
})

test('Windows Terminal outputs are valid two-variant color schemes', () => {
  const windowsFiles = files.filter((file) => file.path.startsWith('terminal/windows-terminal/'))
  for (const file of windowsFiles) {
    const parsed = JSON.parse(file.content)
    assert.equal(parsed.schemes.length, 2, file.path)
    for (const scheme of parsed.schemes) {
      assert.match(scheme.name, /^HearthCode (Moss|Ember) (Dark|Light)$/)
      for (const value of Object.values(scheme).filter((entry) => String(entry).startsWith('#'))) {
        assert.match(value, /^#[0-9a-f]{6}$/i, `${file.path}: ${value}`)
      }
    }
  }
})

test('terminal formats include all ANSI slots and opaque colors', () => {
  for (const file of files) {
    assert.doesNotMatch(file.content, /#[0-9a-f]{8}\b/i, file.path)
    if (file.path.includes('/warp/')) {
      assert.match(file.content, /terminal_colors:\n  bright:/)
      assert.match(file.content, /  normal:/)
    }
    if (file.path.includes('/kitty/')) {
      assert.match(file.content, /^color0 /m)
      assert.match(file.content, /^color15 /m)
    }
    if (file.path.includes('/alacritty/')) {
      assert.match(file.content, /\[colors\.normal\]/)
      assert.match(file.content, /\[colors\.bright\]/)
    }
    if (file.path.includes('/iterm2/')) {
      assert.match(file.content, /<key>Ansi 0 Color<\/key>/)
      assert.match(file.content, /<key>Ansi 15 Color<\/key>/)
    }
  }
})
