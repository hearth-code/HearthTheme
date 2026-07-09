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

test('parseSeedColor reads a deep-link color and normalizes it to #rrggbb', () => {
  assert.equal(forge.parseSeedColor({ query: 'color=8fc06b' }), '#8fc06b')
  assert.equal(forge.parseSeedColor({ query: 'color=8FC06B' }), '#8fc06b', 'lowercased')
  assert.equal(forge.parseSeedColor({ query: 'color=%238fc06b' }), '#8fc06b', 'tolerates an encoded leading #')
  assert.equal(forge.parseSeedColor({ query: 'foo=1&color=3b82f6' }), '#3b82f6', 'picks the color param')
})

test('parseSeedColor returns null for missing or malformed colors', () => {
  assert.equal(forge.parseSeedColor({ query: '' }), null, 'no param')
  assert.equal(forge.parseSeedColor({ query: 'color=' }), null, 'empty')
  assert.equal(forge.parseSeedColor({ query: 'color=nothex' }), null, 'non-hex')
  assert.equal(forge.parseSeedColor({ query: 'color=abc' }), null, 'too short')
  assert.equal(forge.parseSeedColor({}), null, 'no query field')
  assert.equal(forge.parseSeedColor(null), null, 'no uri')
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

test('reset clears legacy combined keys (old builds) but not the disableItalics key', () => {
  const userKey = '[Some Other Theme]'
  const italics = '[HearthCode Moss Dark][HearthCode Moss Light][HearthCode Ember Dark][HearthCode Ember Light]'
  const existing = {
    [userKey]: { a: 1 },
    [italics]: { textMateRules: [] },
    '[HearthCode Moss Dark]': { x: 1 },
    '[HearthCode Moss Dark][HearthCode Ember Dark]': { y: 1 }, // legacy Forge block
    '[HearthCode Moss Light][HearthCode Ember Light]': { z: 1 }, // legacy Forge block
  }
  const next = forge.mergeGlobalSection(existing, { remove: forge.RESET_KEYS })
  assert.deepEqual(next, { [userKey]: { a: 1 }, [italics]: { textMateRules: [] } })
})

test('mergeGlobalSection returns undefined when nothing remains', () => {
  const existing = { [MOSS_DARK_KEY]: { a: 1 } }
  assert.equal(forge.mergeGlobalSection(existing, { remove: forge.OUR_KEYS }), undefined)
})

// --- Apply → Reset round trip ---
// A minimal vscode stub whose settings store mirrors the Global configuration
// target: inspect() exposes the stored global value, update() writes it and
// clears the key entirely when the value is undefined — the same contract
// writeSections in extension/forge.js relies on.

const ITALICS_KEY = '[HearthCode Moss Dark][HearthCode Moss Light][HearthCode Ember Dark][HearthCode Ember Light]'

function makeVscodeStub(initialGlobals) {
  const state = { globals: structuredClone(initialGlobals), commands: {} }
  const stub = {
    ConfigurationTarget: { Global: 1 },
    commands: {
      registerCommand(id, handler) {
        state.commands[id] = handler
        return { dispose() {} }
      },
    },
    window: {
      showInformationMessage() {},
      showErrorMessage(message) {
        throw new Error(`unexpected error message: ${message}`)
      },
    },
    workspace: {
      getConfiguration(section) {
        return {
          get() {
            return undefined
          },
          inspect(key) {
            return { globalValue: state.globals[section]?.[key] }
          },
          async update(key, value) {
            if (value === undefined) delete state.globals[section][key]
            else state.globals[section][key] = value
          },
        }
      },
    },
  }
  return { stub, state }
}

function activateForge(initialGlobals) {
  const { stub, state } = makeVscodeStub(initialGlobals)
  forge.activate({ subscriptions: [] }, stub)
  return { stub, state }
}

// Simulate Apply: write the scheme blocks through the same merge-then-update
// path clearForgeOverride uses, against the stub's Global settings store.
async function simulateApply(stub, files, scheme) {
  const ops = forge.buildSchemeBlocks(forge.parseThemesByType(files), scheme)
  for (const { config, key, set } of ops) {
    const section = stub.workspace.getConfiguration(config)
    const inspected = section.inspect(key)
    const next = forge.mergeGlobalSection(inspected.globalValue, { set })
    await section.update(key, next, 1)
  }
}

// Settings as a user might already have them: their own theme block in every
// Forge-touched setting, plus the disableItalics override, none of which
// Apply or Reset may disturb.
function userGlobals() {
  return {
    workbench: {
      colorCustomizations: { '[Some Other Theme]': { 'editor.background': '#000000' } },
    },
    editor: {
      tokenColorCustomizations: {
        '[Some Other Theme]': { comments: '#ff0000' },
        [ITALICS_KEY]: { textMateRules: [] },
      },
      semanticTokenColorCustomizations: {
        '[Some Other Theme]': { enabled: true, rules: {} },
        [ITALICS_KEY]: { enabled: true, rules: { class: { italic: false } } },
      },
    },
  }
}

for (const { label, scheme } of forge.HEARTHCODE_THEMES) {
  test(`Apply → Reset round trip restores the initial settings (active: ${label})`, async () => {
    const initial = userGlobals()
    const { stub, state } = activateForge(initial)

    await simulateApply(stub, filesFrom(darkTheme, lightTheme), scheme)
    assert.notDeepEqual(state.globals, initial, 'Apply must actually change the settings')
    const schemeName = scheme === 'moss' ? 'Moss' : 'Ember'
    assert.deepEqual(
      state.globals.workbench.colorCustomizations[`[HearthCode ${schemeName} Dark]`],
      darkTheme.colors,
      'Apply paints the active scheme dark variant',
    )

    await state.commands['hearthcode.resetForge']()
    assert.deepEqual(state.globals, initial, 'Reset must leave zero diff against the initial settings')
  })
}

test('Reset also clears legacy combined keys left by old Forge builds', async () => {
  const initial = userGlobals()
  const polluted = structuredClone(initial)
  for (const legacyKey of ['[HearthCode Moss Dark][HearthCode Ember Dark]', '[HearthCode Moss Light][HearthCode Ember Light]']) {
    polluted.workbench.colorCustomizations[legacyKey] = { 'editor.background': '#123456' }
    polluted.editor.tokenColorCustomizations[legacyKey] = { textMateRules: [] }
    polluted.editor.semanticTokenColorCustomizations[legacyKey] = { enabled: true, rules: {} }
  }
  const { state } = activateForge(polluted)

  await state.commands['hearthcode.resetForge']()
  assert.deepEqual(state.globals, initial, 'Reset must scrub legacy keys while keeping user and italics blocks')
})
