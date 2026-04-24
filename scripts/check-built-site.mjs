import { existsSync, readFileSync } from 'node:fs'

const REQUIRED_FILES = [
  'dist/index.html',
  'dist/docs/index.html',
  'dist/zh/index.html',
  'dist/zh/docs/index.html',
  'dist/ja/index.html',
  'dist/ja/docs/index.html',
  'dist/sitemap-index.xml',
  'dist/code-preview-data.json',
  'dist/themes/ember-dark.json',
  'dist/themes/ember-light.json',
  'dist/themes/moss-dark.json',
  'dist/themes/moss-light.json',
]

function fail(message) {
  console.error(`[FAIL] ${message}`)
  process.exit(1)
}

function read(path) {
  if (!existsSync(path)) fail(`Missing built file: ${path}`)
  return readFileSync(path, 'utf8')
}

for (const path of REQUIRED_FILES) {
  if (!existsSync(path)) fail(`Missing built file: ${path}`)
}

const home = read('dist/index.html')
for (const expected of [
  '<html lang="en">',
  'rel="canonical"',
  'property="og:title"',
  'name="twitter:card"',
  'hreflang="zh"',
  'hreflang="ja"',
]) {
  if (!home.includes(expected)) fail(`Home page is missing ${expected}`)
}

const previewData = JSON.parse(read('dist/code-preview-data.json'))
const rendered = previewData.rendered || {}
const expectedThemeIds = [
  'ember-dark',
  'ember-darkSoft',
  'ember-light',
  'ember-lightSoft',
  'moss-dark',
  'moss-darkSoft',
  'moss-light',
  'moss-lightSoft',
]
for (const [languageId, renderedByTheme] of Object.entries(rendered)) {
  for (const themeId of expectedThemeIds) {
    if (typeof renderedByTheme?.[themeId] !== 'string' || !renderedByTheme[themeId].includes('hearth-preview-code')) {
      fail(`Code preview data is missing ${languageId}/${themeId}`)
    }
  }
}

console.log('[PASS] Built site smoke check passed.')
