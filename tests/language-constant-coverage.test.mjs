import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHighlighter } from 'shiki'

// Many TextMate grammars scope booleans and null with a bare `constant.language.<lang>`
// instead of `constant.language.boolean` / `.null`. Without a generic `constant.language`
// rule those literals fall back to the editor foreground and read like plain variables.
// Tokenize real grammars and require every literal to take the value-lane color.

const VARIANTS = ['moss-dark', 'moss-light', 'ember-dark', 'ember-light']

const SAMPLES = {
  python: ['x = True or None', ['True', 'None']],
  json: ['{"a": true, "b": null}', ['true', 'null']],
  java: ['Object x = null; boolean b = true;', ['null', 'true']],
  php: ['<?php $x = null ?? true;', ['null', 'true']],
  c: ['bool b = true; void *p = NULL;', ['true', 'NULL']],
  cpp: ['auto p = nullptr; bool b = true;', ['nullptr', 'true']],
  rust: ['let b = true;', ['true']],
  ruby: ['x = nil || true', ['nil', 'true']],
  swift: ['let x: Int? = nil; let b = true', ['nil', 'true']],
  lua: ['local x = nil or true', ['nil', 'true']],
  typescript: ['const x = null ?? true', ['null', 'true']],
  go: ['var x = nil; b := true', ['nil', 'true']],
  yaml: ['a: true\nb: null', ['true', 'null']],
}

function loadTheme(id) {
  const theme = JSON.parse(fs.readFileSync(new URL(`../themes/${id}.json`, import.meta.url), 'utf8'))
  return { ...theme, name: id }
}

function valueLaneColor(theme) {
  const rule = theme.tokenColors.find((entry) => {
    const scopes = Array.isArray(entry.scope) ? entry.scope : [entry.scope]
    return scopes.includes('constant.numeric')
  })
  assert.ok(rule, `${theme.name}: no constant.numeric rule`)
  return rule.settings.foreground.toLowerCase()
}

test('boolean and null literals use the value lane across common grammars', async () => {
  const themes = VARIANTS.map(loadTheme)
  const highlighter = await createHighlighter({ themes, langs: Object.keys(SAMPLES) })
  try {
    for (const theme of themes) {
      const expected = valueLaneColor(theme)
      for (const [lang, [code, literals]] of Object.entries(SAMPLES)) {
        const tokens = highlighter.codeToTokensBase(code, { lang, theme: theme.name }).flat()
        for (const literal of literals) {
          const token = tokens.find((entry) => entry.content.trim() === literal)
          assert.ok(token, `${theme.name}/${lang}: literal ${literal} was not tokenized on its own`)
          assert.equal(
            token.color?.toLowerCase(),
            expected,
            `${theme.name}/${lang}: ${literal} should use the value lane ${expected}`,
          )
        }
      }
    }
  } finally {
    highlighter.dispose()
  }
})
