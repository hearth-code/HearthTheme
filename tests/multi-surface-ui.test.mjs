import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/components/ui/MultiSurfaceSection.astro', 'utf8')
const locales = ['en', 'zh', 'ja'].map((lang) => ({
  lang,
  messages: JSON.parse(readFileSync(`src/i18n/${lang}.json`, 'utf8')),
}))

test('multi-surface previews contain real readable examples instead of empty skeleton bars', () => {
  assert.match(source, /class="surfaces-note-title"[^>]*>\s*\{t\(lang, 'surfaces\.obsidian\.preview\.title'\)\}/)
  assert.match(source, /class="surfaces-note-copy"[^>]*>\s*\{t\(lang, 'surfaces\.obsidian\.preview\.copy'\)\}/)
  assert.match(source, /class="surfaces-web-heading"[^>]*>\s*\{t\(lang, 'surfaces\.web\.preview\.title'\)\}/)
  assert.match(source, /class="surfaces-web-copy"[^>]*>\s*\{t\(lang, 'surfaces\.web\.preview\.copy'\)\}/)
  assert.doesNotMatch(source, /surfaces-mock--(?:note|web)[^>]*aria-hidden="true"/)
})

test('multi-surface preview examples are complete in every locale', () => {
  const keys = [
    'surfaces.obsidian.preview.eyebrow',
    'surfaces.obsidian.preview.title',
    'surfaces.obsidian.preview.copy',
    'surfaces.obsidian.preview.quote',
    'surfaces.obsidian.preview.tag',
    'surfaces.web.preview.eyebrow',
    'surfaces.web.preview.title',
    'surfaces.web.preview.copy',
    'surfaces.web.preview.code',
    'surfaces.web.preview.status',
  ]

  for (const { lang, messages } of locales) {
    for (const key of keys) {
      assert.equal(typeof messages[key], 'string', `${lang} is missing ${key}`)
      assert.notEqual(messages[key].trim(), '', `${lang} has an empty ${key}`)
    }
  }
})
