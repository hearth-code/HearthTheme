import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  loadStyleSettingsSource,
  buildSettingsComment,
  buildStyleSettingsCss,
} from '../scripts/build-obsidian-style-settings.mjs'

const APP_THEME_CSS = 'obsidian/app-theme/theme.css'

function extractSettingsBlock(css) {
  const match = css.match(/\/\* @settings\n([\s\S]*?)\n\*\//)
  return match ? match[1] : null
}

// Collect every selector that carries `font-style: italic`, flattened the same
// way the override is (mode prefix stripped) so we can compare like-for-like.
function italicSelectors(css) {
  const selectors = new Set()
  const blockRe = /([^{}]+)\{([^{}]*)\}/g
  let match
  while ((match = blockRe.exec(css)) !== null) {
    if (!/font-style:\s*italic/i.test(match[2])) continue
    for (const raw of match[1].replace(/\/\*[\s\S]*?\*\//g, '').split(',')) {
      const selector = raw.trim().replace(/^\.theme-(?:dark|light)\s+/, '')
      if (selector) selectors.add(selector)
    }
  }
  return selectors
}

test('source declares a valid Style Settings surface', () => {
  const source = loadStyleSettingsSource()
  assert.equal(source.name, 'HearthCode')
  assert.equal(source.id, 'hearthcode')
  assert.ok(Array.isArray(source.settings) && source.settings.length > 0)
  for (const setting of source.settings) {
    assert.ok(setting.id, 'every setting needs an id')
    assert.ok(setting.type, `setting "${setting.id}" needs a type`)
  }
})

test('@settings comment is well-formed and lists every declared knob', () => {
  const source = loadStyleSettingsSource()
  const comment = buildSettingsComment(source)
  assert.ok(comment.startsWith('/* @settings'), 'must open the Style Settings block')
  assert.ok(comment.trimEnd().endsWith('*/'), 'must close the comment')
  assert.match(comment, /name: 'HearthCode'/)
  assert.match(comment, /id: 'hearthcode'/)
  for (const setting of source.settings) {
    assert.ok(comment.includes(`id: '${setting.id}'`), `block must declare ${setting.id}`)
  }
})

test('no-italics override is derived, mode-flattened, and !important-free', () => {
  const source = loadStyleSettingsSource()
  const builtCss = [
    '.theme-dark .cm-comment { color: #aaa; font-style: italic; }',
    '.theme-light .cm-comment { color: #555; font-style: italic; }',
  ].join('\n')
  const css = buildStyleSettingsCss(source, builtCss)
  assert.ok(css.includes('body.hearthcode-no-italics .cm-comment'), 'scopes under the toggle class')
  assert.match(css, /font-style:\s*normal/, 'turns italics off')
  assert.ok(!css.includes('.theme-dark') && !css.includes('.theme-light'), 'flattens the mode prefix')
  assert.ok(!css.includes('!important'), 'wins on specificity without !important')
  const occurrences = css.split('body.hearthcode-no-italics .cm-comment').length - 1
  assert.equal(occurrences, 1, 'identical dark/light selectors collapse to one rule')
})

test('mono-notes knob maps notes to the configured monospace font', () => {
  const source = loadStyleSettingsSource()
  const css = buildStyleSettingsCss(source, '.theme-dark .cm-comment { font-style: italic; }')
  assert.ok(css.includes('body.hearthcode-mono-notes'))
  assert.ok(css.includes('--font-text: var(--font-monospace)'))
})

test('declaring the no-italics knob with no italics to neutralize throws', () => {
  const source = loadStyleSettingsSource()
  assert.throws(
    () => buildStyleSettingsCss(source, '.theme-dark .cm-comment { color: #aaa; }'),
    /no italic rules/i,
  )
})

test('shipped theme.css embeds the block and covers every italic selector (never stale)', () => {
  const css = readFileSync(APP_THEME_CSS, 'utf8')
  const block = extractSettingsBlock(css)
  assert.ok(block, 'theme.css must embed the @settings block')

  const source = loadStyleSettingsSource()
  for (const setting of source.settings) {
    assert.ok(block.includes(`id: '${setting.id}'`), `theme.css @settings must list ${setting.id}`)
  }

  for (const selector of italicSelectors(css)) {
    assert.ok(
      css.includes(`body.hearthcode-no-italics ${selector}`),
      `theme.css must neutralize italic selector "${selector}" under the toggle`,
    )
  }
})
