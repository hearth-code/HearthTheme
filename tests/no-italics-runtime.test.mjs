import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

import { buildNoItalicsOverride, NO_ITALICS_SETTING_ID } from '../scripts/generate-no-italics-override.mjs'

const require = createRequire(import.meta.url)
const Module = require('node:module')
const RUNTIME_PATH = require.resolve('../extension/extension.js')

const OVERRIDE = buildNoItalicsOverride()
const THEME_KEY = OVERRIDE.themeKey
const TOKEN_BLOCK = OVERRIDE.settings['editor.tokenColorCustomizations'][THEME_KEY]
const SEMANTIC_BLOCK = OVERRIDE.settings['editor.semanticTokenColorCustomizations'][THEME_KEY]

function makeVscodeStub({ editorGlobals = {}, settingValue = false } = {}) {
  const state = {
    editorGlobals: structuredClone(editorGlobals),
    settingValue,
    updates: [],
    listeners: [],
  }
  const stub = {
    ConfigurationTarget: { Global: 1 },
    workspace: {
      getConfiguration(section) {
        if (section === 'editor') {
          return {
            inspect(key) {
              return { globalValue: state.editorGlobals[key] }
            },
            async update(key, value, target) {
              state.updates.push({ key, value, target })
              if (value === undefined) delete state.editorGlobals[key]
              else state.editorGlobals[key] = value
            },
          }
        }
        return {
          get(id) {
            return id === NO_ITALICS_SETTING_ID ? state.settingValue : undefined
          },
        }
      },
      onDidChangeConfiguration(listener) {
        state.listeners.push(listener)
        return { dispose() {} }
      },
    },
  }
  return { stub, state }
}

function loadRuntime(stub) {
  const originalLoad = Module._load
  Module._load = function (request, parent, isMain) {
    if (request === 'vscode') return stub
    return originalLoad.call(this, request, parent, isMain)
  }
  try {
    delete require.cache[RUNTIME_PATH]
    return require(RUNTIME_PATH)
  } finally {
    Module._load = originalLoad
    delete require.cache[RUNTIME_PATH]
  }
}

async function settle() {
  await new Promise((resolve) => setImmediate(resolve))
}

async function setSetting(state, value) {
  state.settingValue = value
  for (const listener of state.listeners) {
    listener({ affectsConfiguration: (section) => section === NO_ITALICS_SETTING_ID })
  }
  await settle()
}

test('activation with the toggle off leaves user settings untouched', async () => {
  const manual = { [THEME_KEY]: { textMateRules: [{ scope: ['comment'], settings: { fontStyle: '' } }] } }
  const { stub, state } = makeVscodeStub({
    editorGlobals: { tokenColorCustomizations: structuredClone(manual) },
    settingValue: false,
  })
  const runtime = loadRuntime(stub)
  runtime.activate({ subscriptions: [] })
  await settle()

  assert.equal(state.updates.length, 0, 'no settings writes may happen while the toggle is off')
  assert.deepEqual(state.editorGlobals.tokenColorCustomizations, manual, 'a manually pasted override must survive activation')
})

test('enabling merges the override and preserves unrelated customizations', async () => {
  const { stub, state } = makeVscodeStub({
    editorGlobals: { tokenColorCustomizations: { comments: '#ff0000' } },
    settingValue: false,
  })
  const runtime = loadRuntime(stub)
  runtime.activate({ subscriptions: [] })
  await settle()

  await setSetting(state, true)

  assert.deepEqual(state.editorGlobals.tokenColorCustomizations, {
    comments: '#ff0000',
    [THEME_KEY]: TOKEN_BLOCK,
  })
  assert.deepEqual(state.editorGlobals.semanticTokenColorCustomizations, {
    [THEME_KEY]: SEMANTIC_BLOCK,
  })
})

test('disabling removes the override and drops settings that become empty', async () => {
  const { stub, state } = makeVscodeStub({
    editorGlobals: { tokenColorCustomizations: { comments: '#ff0000' } },
    settingValue: true,
  })
  const runtime = loadRuntime(stub)
  runtime.activate({ subscriptions: [] })
  await settle()
  assert.deepEqual(state.editorGlobals.tokenColorCustomizations[THEME_KEY], TOKEN_BLOCK)

  await setSetting(state, false)

  assert.deepEqual(
    state.editorGlobals.tokenColorCustomizations,
    { comments: '#ff0000' },
    'unrelated customizations must survive the cleanup'
  )
  assert.equal(
    'semanticTokenColorCustomizations' in state.editorGlobals,
    false,
    'a block holding only our override must be removed entirely'
  )
})

test('re-activation while enabled is idempotent', async () => {
  const { stub, state } = makeVscodeStub({ settingValue: true })
  const runtime = loadRuntime(stub)
  runtime.activate({ subscriptions: [] })
  await settle()
  const writesAfterFirstActivation = state.updates.length
  assert.ok(writesAfterFirstActivation > 0, 'first activation must apply the override')

  state.listeners.length = 0
  const second = loadRuntime(stub)
  second.activate({ subscriptions: [] })
  await settle()

  assert.equal(state.updates.length, writesAfterFirstActivation, 'unchanged override must not be rewritten')
})
