import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

import {
  getThemeMetaListForSchemeId,
  getThemeOutputFilesForSchemeId,
  loadActiveProductContext,
  loadActiveSchemeContext,
  loadColorProductManifest,
} from '../scripts/color-system.mjs'

test('active product declares concrete supported theme outputs', () => {
  const activeProduct = loadActiveProductContext()
  const activeScheme = loadActiveSchemeContext()
  const product = loadColorProductManifest()
  const semantic = JSON.parse(readFileSync('color-system/semantic.json', 'utf8'))

  assert.equal(activeProduct.productId, 'hearthcode')
  assert.equal(activeScheme.schemeId, 'moss')
  assert.deepEqual(new Set(product.supportedSchemeIds), new Set(['ember', 'moss']))
  assert.equal(
    semantic.generatedFrom.scheme,
    `color-system/schemes/${activeScheme.schemeId}/scheme.json`
  )

  for (const schemeId of product.supportedSchemeIds) {
    const outputFiles = Object.values(getThemeOutputFilesForSchemeId(schemeId))
    const meta = getThemeMetaListForSchemeId(schemeId)

    assert.equal(outputFiles.length, 4)
    assert.equal(meta.length, 4)

    for (const path of outputFiles) {
      assert.ok(existsSync(path), `missing generated theme: ${path}`)
      const theme = JSON.parse(readFileSync(path, 'utf8'))
      assert.equal(typeof theme.name, 'string')
      assert.ok(theme.colors && typeof theme.colors === 'object')
      assert.ok(Array.isArray(theme.tokenColors))
    }
  }
})
