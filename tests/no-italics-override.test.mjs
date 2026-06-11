import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { buildProductMetadata } from '../scripts/product-metadata.mjs'

const DOC_PATH = 'docs/disable-italics.md'

function hasItalic(fontStyle) {
  return /\bitalic\b/i.test(String(fontStyle || ''))
}

function stripItalic(fontStyle) {
  return String(fontStyle || '')
    .split(/\s+/)
    .filter((token) => token && token.toLowerCase() !== 'italic')
    .join(' ')
}

function toScopeList(scope) {
  if (Array.isArray(scope)) return scope.map((entry) => String(entry).trim()).filter(Boolean)
  if (typeof scope === 'string') {
    return scope
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  }
  return []
}

function extractSnippet(doc) {
  const match = doc.match(/```json\n([\s\S]*?)\n```/)
  assert.ok(match, `${DOC_PATH} must contain a fenced json snippet`)
  return JSON.parse(match[1])
}

function loadPublishedThemes() {
  const metadata = buildProductMetadata()
  const themes = metadata.extension.themes
  assert.ok(Array.isArray(themes) && themes.length > 0, 'extension theme catalog must not be empty')
  return themes.map((entry) => ({
    label: entry.label,
    theme: JSON.parse(readFileSync(String(entry.path).replace(/^\.\//, ''), 'utf8')),
  }))
}

test('disable-italics doc neutralizes every italic rule in every published theme', () => {
  const doc = readFileSync(DOC_PATH, 'utf8')
  const snippet = extractSnippet(doc)
  const published = loadPublishedThemes()

  const labels = published.map((entry) => entry.label)
  const themeKey = labels.map((label) => `[${label}]`).join('')

  const tokenBlock = snippet['editor.tokenColorCustomizations']?.[themeKey]
  assert.ok(tokenBlock, `snippet must scope tokenColorCustomizations to "${themeKey}"`)
  const semanticBlock = snippet['editor.semanticTokenColorCustomizations']?.[themeKey]
  assert.ok(semanticBlock, `snippet must scope semanticTokenColorCustomizations to "${themeKey}"`)
  assert.equal(semanticBlock.enabled, true, 'semantic override block must be enabled')

  const overrideStyleByScope = new Map()
  for (const rule of tokenBlock.textMateRules || []) {
    assert.equal(
      hasItalic(rule?.settings?.fontStyle),
      false,
      `override rule "${rule?.name}" must not reintroduce italics`
    )
    for (const scope of toScopeList(rule.scope)) {
      overrideStyleByScope.set(scope, String(rule.settings.fontStyle))
    }
  }

  for (const { label, theme } of published) {
    for (const rule of theme.tokenColors || []) {
      const fontStyle = rule?.settings?.fontStyle
      if (!hasItalic(fontStyle)) continue
      for (const scope of toScopeList(rule.scope)) {
        assert.ok(
          overrideStyleByScope.has(scope),
          `${label}: italic scope "${scope}" missing from override snippet`
        )
        assert.equal(
          overrideStyleByScope.get(scope),
          stripItalic(fontStyle),
          `${label}: override for scope "${scope}" must keep non-italic styles intact`
        )
      }
    }

    const semanticEntries = theme.semanticTokenColors || {}
    for (const [selector, value] of Object.entries(semanticEntries)) {
      if (!value || typeof value !== 'object' || !hasItalic(value.fontStyle)) continue
      assert.deepEqual(
        semanticBlock.rules?.[selector],
        { italic: false },
        `${label}: semantic selector "${selector}" must be disabled in override snippet`
      )
    }
  }

  for (const label of labels) {
    assert.ok(doc.includes(`\`${label}\``), `${DOC_PATH} must mention theme label "${label}"`)
  }
})
