import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const forge = require('../extension/forge.js')

const darkTheme = {
  name: 'Moss Dark',
  type: 'dark',
  colors: { 'editor.background': '#111410', 'editor.foreground': '#e5dfd4' },
  tokenColors: [{ scope: 'comment', settings: { foreground: '#756f66' } }],
  semanticTokenColors: { class: { foreground: '#8fc06b' } },
}
const lightTheme = {
  name: 'Moss Light',
  type: 'light',
  colors: { 'editor.background': '#f6f1e7', 'editor.foreground': '#2a2722' },
  tokenColors: [{ scope: 'comment', settings: { foreground: '#9b948a' } }],
  semanticTokenColors: { class: { foreground: '#4f7a34' } },
}

const filesFrom = (...themes) =>
  themes.map((theme) => ({ path: `${theme.type}.json`, content: JSON.stringify(theme) }))

const MOSS_DARK_KEY = '[HearthCode Moss Dark]'
const MOSS_LIGHT_KEY = '[HearthCode Moss Light]'

test('parseThemesByType groups by declared theme type', () => {
  const byType = forge.parseThemesByType(filesFrom(darkTheme, lightTheme))
  assert.equal(byType.dark.name, 'Moss Dark')
  assert.equal(byType.light.name, 'Moss Light')
})

test('parseThemesByType requires both dark and light', () => {
  assert.throws(() => forge.parseThemesByType(filesFrom(darkTheme)), /both a dark and a light/)
})

test('buildSchemeBlocks paints both dark and light of the active scheme', () => {
  const ops = forge.buildSchemeBlocks({ dark: darkTheme, light: lightTheme }, 'moss')
  const byKey = Object.fromEntries(ops.map((op) => [op.key, op]))

  const workbench = byKey['colorCustomizations']
  assert.equal(workbench.config, 'workbench')
  assert.deepEqual(workbench.set[MOSS_DARK_KEY], darkTheme.colors)
  assert.deepEqual(workbench.set[MOSS_LIGHT_KEY], lightTheme.colors)

  const token = byKey['tokenColorCustomizations']
  assert.equal(token.config, 'editor')
  assert.deepEqual(token.set[MOSS_DARK_KEY], { textMateRules: darkTheme.tokenColors })
  assert.deepEqual(token.set[MOSS_LIGHT_KEY], { textMateRules: lightTheme.tokenColors })

  const semantic = byKey['semanticTokenColorCustomizations']
  assert.deepEqual(semantic.set[MOSS_DARK_KEY], { enabled: true, rules: darkTheme.semanticTokenColors })
  assert.deepEqual(semantic.set[MOSS_LIGHT_KEY], { enabled: true, rules: lightTheme.semanticTokenColors })

  // the other scheme is left out entirely
  assert.equal('[HearthCode Ember Dark]' in workbench.set, false)
})

test('all four HearthCode themes are scopable targets', () => {
  assert.deepEqual(
    forge.OUR_KEYS,
    ['[HearthCode Moss Dark]', '[HearthCode Moss Light]', '[HearthCode Ember Dark]', '[HearthCode Ember Light]'],
  )
})

test('mergeGlobalSection applies our block while preserving the user’s own', () => {
  const userKey = '[Some Other Theme]'
  const existing = { [userKey]: { 'editor.background': '#000000' } }

  const next = forge.mergeGlobalSection(existing, { set: { [MOSS_DARK_KEY]: { a: 1 } } })
  assert.deepEqual(next[userKey], existing[userKey], 'user block preserved')
  assert.deepEqual(next[MOSS_DARK_KEY], { a: 1 })
})

test('mergeGlobalSection (reset) removes only our blocks', () => {
  const userKey = '[Some Other Theme]'
  const existing = {
    [userKey]: { 'editor.background': '#000000' },
    [MOSS_DARK_KEY]: { a: 1 },
    '[HearthCode Ember Light]': { b: 2 },
  }

  const next = forge.mergeGlobalSection(existing, { remove: forge.OUR_KEYS })
  assert.deepEqual(next, { [userKey]: existing[userKey] }, 'only user block remains')
})

test('mergeGlobalSection returns undefined when nothing remains', () => {
  const existing = { [MOSS_DARK_KEY]: { a: 1 } }
  assert.equal(forge.mergeGlobalSection(existing, { remove: forge.OUR_KEYS }), undefined)
})
