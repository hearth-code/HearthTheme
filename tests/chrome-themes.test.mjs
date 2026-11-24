import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildChromeThemeFiles } from '../scripts/generate-chrome-themes.mjs'
import { CHROME_TEXT_PAIRS } from '../scripts/theme-engine/emit/chrome-core.mjs'
import { contrastRatio } from '../scripts/color-utils.mjs'

const toHex = ([r, g, b]) => `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`

test('Chrome themes ship all four Moss/Ember variants and match the committed files', () => {
  const files = buildChromeThemeFiles()
  assert.deepEqual(
    files.map((file) => file.path).sort(),
    ['ember-dark', 'ember-light', 'moss-dark', 'moss-light'].map((id) => `chrome/hearthcode-${id}/manifest.json`),
  )
  for (const file of files) {
    assert.equal(fs.readFileSync(file.path, 'utf8'), file.content, `${file.path} is stale; run pnpm run sync`)
  }
})

test('Chrome theme manifests are valid MV3 themes with readable text', () => {
  const version = JSON.parse(fs.readFileSync('releases/color-language.json', 'utf8')).version
  for (const file of buildChromeThemeFiles()) {
    const manifest = JSON.parse(file.content)
    assert.equal(manifest.manifest_version, 3)
    assert.equal(manifest.version, version)
    assert.match(manifest.name, /^HearthCode (Moss|Ember) (Dark|Light)$/)
    const colors = manifest.theme.colors
    for (const [key, value] of Object.entries(colors)) {
      assert.ok(Array.isArray(value) && value.length === 3 && value.every((n) => Number.isInteger(n) && n >= 0 && n <= 255), `${manifest.name} ${key} must be an RGB triple`)
    }
    for (const [text, surface, min] of CHROME_TEXT_PAIRS) {
      const ratio = contrastRatio(toHex(colors[text]), toHex(colors[surface]))
      assert.ok(ratio >= min, `${manifest.name}: ${text} on ${surface} contrast ${ratio.toFixed(2)} < ${min}`)
    }
  }
})
