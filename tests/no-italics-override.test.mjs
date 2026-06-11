import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

import { buildProductMetadata } from '../scripts/product-metadata.mjs'
import { NO_ITALICS_SETTING_ID } from '../scripts/generate-no-italics-override.mjs'

const DOC_PATH = 'docs/disable-italics.md'
const RUNTIME_PATH = 'extension/extension.js'
const EXTENSION_PACKAGE_PATH = 'extension/package.json'

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
  const match = doc.match(/```json\n(\{[\s\S]*?)\n```/)
  assert.ok(match, `${DOC_PATH} must contain a fenced json object snippet`)
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

test('runtime toggle ships the same override the doc describes', () => {
  const doc = readFileSync(DOC_PATH, 'utf8')
  const snippet = extractSnippet(doc)
  const runtime = readFileSync(RUNTIME_PATH, 'utf8')

  const checked = spawnSync(process.execPath, ['--check', RUNTIME_PATH], { encoding: 'utf8' })
  assert.equal(checked.status, 0, `${RUNTIME_PATH} must be valid JavaScript: ${checked.stderr}`)

  const themeKeyMatch = runtime.match(/const THEME_KEY = ("(?:[^"\\]|\\.)*")/)
  assert.ok(themeKeyMatch, `${RUNTIME_PATH} must embed THEME_KEY`)
  const themeKey = JSON.parse(themeKeyMatch[1])

  const settingIdMatch = runtime.match(/const SETTING_ID = ("(?:[^"\\]|\\.)*")/)
  assert.ok(settingIdMatch, `${RUNTIME_PATH} must embed SETTING_ID`)
  assert.equal(JSON.parse(settingIdMatch[1]), NO_ITALICS_SETTING_ID)

  const overrideMatch = runtime.match(/const OVERRIDE_BY_EDITOR_KEY = (\{[\s\S]*?\n\})\n/)
  assert.ok(overrideMatch, `${RUNTIME_PATH} must embed OVERRIDE_BY_EDITOR_KEY`)
  const override = JSON.parse(overrideMatch[1])

  assert.deepEqual(
    override.tokenColorCustomizations,
    snippet['editor.tokenColorCustomizations'][themeKey],
    'runtime tokenColorCustomizations payload must match the documented snippet'
  )
  assert.deepEqual(
    override.semanticTokenColorCustomizations,
    snippet['editor.semanticTokenColorCustomizations'][themeKey],
    'runtime semanticTokenColorCustomizations payload must match the documented snippet'
  )

  assert.ok(doc.includes(`\`${NO_ITALICS_SETTING_ID}\``), `${DOC_PATH} must document the setting id`)
})

test('extension manifest wires the runtime toggle', () => {
  const pkg = JSON.parse(readFileSync(EXTENSION_PACKAGE_PATH, 'utf8'))
  assert.equal(pkg.main, './extension.js')
  assert.equal(pkg.browser, './extension.js')
  assert.deepEqual(pkg.activationEvents, ['onStartupFinished'])
  const property = pkg.contributes?.configuration?.properties?.[NO_ITALICS_SETTING_ID]
  assert.ok(property, `manifest must contribute the ${NO_ITALICS_SETTING_ID} setting`)
  assert.equal(property.type, 'boolean')
  assert.equal(property.default, false)
})
