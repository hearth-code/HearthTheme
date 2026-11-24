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

function ruleColor(theme, scope) {
  const rule = theme.tokenColors.find((entry) => {
    const scopes = Array.isArray(entry.scope) ? entry.scope : [entry.scope]
    return scopes.includes(scope)
  })
  assert.ok(rule, `${theme.name}: no ${scope} rule`)
  return rule.settings.foreground.toLowerCase()
}

// Tokens that used to fall back to the plain foreground, with the lane they belong to.
const LANE_SAMPLES = [
  ['python', 'MAX_RETRIES = 3', 'MAX_RETRIES', 'constant.numeric'],
  ['rust', 'const LIMIT: usize = 1;', 'LIMIT', 'constant.numeric'],
  ['html', '<p>a &amp; b</p>', 'amp', 'constant.numeric'],
  ['rust', 'use std::collections::HashMap;', 'std', 'entity.name.type'],
  ['rust', '#[derive(Debug)]\nstruct A;', 'derive', 'meta.decorator'],
]

test('caps constants, entities, namespaces and attributes take their lanes', async () => {
  const themes = VARIANTS.map(loadTheme)
  const langs = [...new Set(LANE_SAMPLES.map(([lang]) => lang))]
  const highlighter = await createHighlighter({ themes, langs })
  try {
    for (const theme of themes) {
      for (const [lang, code, text, laneScope] of LANE_SAMPLES) {
        const tokens = highlighter.codeToTokensBase(code, { lang, theme: theme.name }).flat()
        const token = tokens.find((entry) => entry.content.trim() === text)
        assert.ok(token, `${theme.name}/${lang}: ${text} was not tokenized on its own`)
        assert.equal(token.color?.toLowerCase(), ruleColor(theme, laneScope), `${theme.name}/${lang}: ${text} should use the ${laneScope} lane`)
      }
    }
  } finally {
    highlighter.dispose()
  }
})

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
