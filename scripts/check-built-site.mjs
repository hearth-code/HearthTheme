import { existsSync, readFileSync } from 'node:fs'

const REQUIRED_FILES = [
  'dist/index.html',
  'dist/docs/index.html',
  'dist/forge/index.html',
  'dist/zh/index.html',
  'dist/zh/docs/index.html',
  'dist/zh/forge/index.html',
  'dist/ja/index.html',
  'dist/ja/docs/index.html',
  'dist/ja/forge/index.html',
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
  'data-hero-variant',
  'data-variant-id="dark"',
  'data-variant-id="light"',
  'data-install="openvsx"',
  'data-install="zed"',
  'data-install="obsidian"',
  'data-install="terminal"',
  'href="https://zed.dev/extensions/hearthcode-theme"',
  'href="https://github.com/hearth-code/HearthTheme/tree/main/terminal"',
  'data-install-placement="hero"',
  'data-hero-forge-link',
  'data-forge-base="/forge"',
  'Continue in Theme Forge',
]) {
  if (!home.includes(expected)) fail(`Home page is missing ${expected}`)
}

const installAnchors = home.match(/<a\b[^>]*>/g) || []
const equalChannelIds = ['vscode', 'openvsx', 'zed', 'obsidian', 'terminal']
for (const placement of ['hero', 'final']) {
  const cards = installAnchors.filter((anchor) => (
    anchor.includes('install-channel-card')
    && anchor.includes(`data-install-placement="${placement}"`)
  ))
  const ids = cards.map((anchor) => anchor.match(/data-install="([^"]+)"/)?.[1]).sort()
  const expectedIds = [...equalChannelIds].sort()
  if (JSON.stringify(ids) !== JSON.stringify(expectedIds)) {
    fail(`${placement} install grid must contain one equal card for each editor channel`)
  }
  if (new Set(cards.map((anchor) => anchor.match(/class="([^"]+)"/)?.[1])).size !== 1) {
    fail(`${placement} install grid must use the same card class for every editor channel`)
  }
}

for (const legacyPriorityClass of ['hero-action--primary', 'final-install-primary']) {
  if (home.includes(legacyPriorityClass)) fail(`Home page still contains priority styling: ${legacyPriorityClass}`)
}

const forge = read('dist/forge/index.html')
for (const expected of [
  'data-quality-label="CONTRACT OK"',
  'Hue drives the palette.',
  'Nothing changes until you click Apply.',
]) {
  if (!forge.includes(expected)) fail(`Forge page is missing ${expected}`)
}

const previewData = JSON.parse(read('dist/code-preview-data.json'))
const rendered = previewData.rendered || {}
const expectedThemeIds = [
  'ember-dark',
  'ember-light',
  'moss-dark',
  'moss-light',
]
for (const [languageId, renderedByTheme] of Object.entries(rendered)) {
  for (const themeId of expectedThemeIds) {
    if (typeof renderedByTheme?.[themeId] !== 'string' || !renderedByTheme[themeId].includes('hearth-preview-code')) {
      fail(`Code preview data is missing ${languageId}/${themeId}`)
    }
  }
}

console.log('[PASS] Built site smoke check passed.')
