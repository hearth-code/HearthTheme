import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { contrastRatio } from '../scripts/color-utils.mjs'
import { buildZedExtensionFiles } from '../scripts/generate-zed-themes.mjs'
import { validateZedThemeFamily, ZED_THEME_SCHEMA_URL } from '../scripts/theme-engine/emit/zed-core.mjs'

const files = buildZedExtensionFiles()
const themeFiles = files.filter((file) => file.path.startsWith('zed/extension/themes/'))

test('Zed generator emits one manifest and four variants in two theme families', () => {
  assert.equal(files.length, 3)
  assert.equal(themeFiles.length, 2)
  assert.deepEqual(
    new Set(themeFiles.flatMap((file) => JSON.parse(file.content).themes.map((theme) => theme.name))),
    new Set([
      'HearthCode Moss Dark',
      'HearthCode Moss Light',
      'HearthCode Ember Dark',
      'HearthCode Ember Light',
    ]),
  )
})

test('Zed outputs match committed generated files byte-for-byte', () => {
  for (const file of files) {
    assert.equal(file.content, fs.readFileSync(file.path, 'utf8'), file.path)
  }
})

test('Zed theme families satisfy the v0.2.0 contract and preserve syntax emphasis', () => {
  for (const file of themeFiles) {
    const family = JSON.parse(file.content)
    assert.equal(family.$schema, ZED_THEME_SCHEMA_URL)
    assert.deepEqual(validateZedThemeFamily(family), [], file.path)
    assert.deepEqual(new Set(family.themes.map((theme) => theme.appearance)), new Set(['dark', 'light']))
    for (const theme of family.themes) {
      assert.equal(theme.style.syntax.comment.font_style, 'italic', theme.name)
      assert.equal(theme.style.syntax.keyword.font_weight, 700, theme.name)
      assert.ok(theme.style.syntax.function.color, theme.name)
      assert.ok(theme.style.syntax.property.color, theme.name)
      assert.ok(theme.style.syntax['variable.parameter'].color, theme.name)
    }
  }
})

test('Zed shell and editor foreground pairs retain readable contrast', () => {
  for (const file of themeFiles) {
    const family = JSON.parse(file.content)
    for (const theme of family.themes) {
      const style = theme.style
      const pairs = [
        ['shell text', style.text, style.background, 4.5],
        ['muted shell text', style['text.muted'], style.background, 4.5],
        ['editor text', style['editor.foreground'], style['editor.background'], 4.5],
        ['hover text', style.text, style['element.hover'], 4.5],
        ['status text', style.text, style['status_bar.background'], 4.5],
      ]
      for (const [label, foreground, background, floor] of pairs) {
        assert.ok(
          contrastRatio(foreground, background) >= floor,
          `${theme.name}: ${label} must remain >= ${floor}:1`,
        )
      }
    }
  }
})

test('Zed integrated terminal receives all sixteen ANSI colors', () => {
  const ansiKeys = [
    'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
    'bright_black', 'bright_red', 'bright_green', 'bright_yellow',
    'bright_blue', 'bright_magenta', 'bright_cyan', 'bright_white',
  ]
  for (const file of themeFiles) {
    for (const theme of JSON.parse(file.content).themes) {
      for (const key of ansiKeys) {
        assert.match(theme.style[`terminal.ansi.${key}`], /^#[0-9a-f]{6}$/i, `${theme.name}: ${key}`)
      }
    }
  }
})
