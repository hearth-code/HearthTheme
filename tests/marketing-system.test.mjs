import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import sharp from 'sharp'
import { loadColorProductManifest, loadColorProductPreviewConfig } from '../scripts/color-system.mjs'

const EXPECTED_MASTER_ASSETS = [
  'extension/images/editor-moss-dark-light.png',
  'extension/images/family-overview.png',
  'extension/images/theme-forge-workflow.png',
  'public/previews/family-overview.png',
  'docs/marketing/direction-atlas.png',
  'docs/marketing/platform-coverage.png',
  'docs/marketing/moss-surfaces.png',
  'public/og-hearth.png',
]

test('marketing availability describes the actual product boundary', () => {
  const product = loadColorProductManifest()
  const availability = product.channelAvailability
  const fullFamilyChannels = ['vscode', 'openvsx', 'zed', 'terminal']

  for (const channelId of fullFamilyChannels) {
    assert.deepEqual(availability[channelId].schemeIds, ['ember', 'moss'])
    assert.deepEqual(availability[channelId].variantIds, ['dark', 'light'])
  }

  assert.deepEqual(availability.obsidian.schemeIds, ['moss'])
  assert.deepEqual(availability.obsidian.variantIds, ['dark', 'light'])
  assert.deepEqual(availability.vscode.capabilityIds, ['theme-forge'])
  assert.deepEqual(availability.terminal.capabilityIds, ['five-formats'])
  assert.deepEqual(availability.obsidian.capabilityIds, ['style-settings'])
})

test('marketing direction names Ember and Moss without promoting Amber to a theme', () => {
  const product = loadColorProductManifest()
  const marketingGuide = readFileSync('docs/marketing/README.md', 'utf8')

  assert.deepEqual(product.supportedSchemeIds, ['moss', 'ember'])
  assert.match(marketingGuide, /theme directions are \*\*Ember\*\* and \*\*Moss\*\*/)
  assert.match(marketingGuide, /\*\*Amber\*\* is an Obsidian accent preset/)
})

test('preview copy carries the Color Field Guide message hierarchy', () => {
  const preview = loadColorProductPreviewConfig()

  assert.equal(preview.headline, 'Two directions. Four calibrated themes.')
  assert.equal(preview.marketing.familyHeadline, 'EMBER / MOSS')
  assert.equal(preview.marketing.familySubheadline, 'FOUR THEMES. ONE COLOR LANGUAGE.')
  assert.match(preview.marketing.directionHeadline, /Warmth or structure/)
  assert.match(preview.marketing.platformHeadline, /Where each direction ships/)
  assert.match(preview.marketing.mossSurfaceHeadline, /Same roles/)

  assert.equal(preview.samples.editors.language, 'typescript')
  assert.ok(preview.samples.editors.lines.includes('  mode: "{mode}",'))
  assert.equal(preview.samples.editors.lines.at(-1), '};')
  assert.equal(preview.samples.obsidian.language, 'markdown')
  assert.equal(preview.samples.terminal.lines[0], '$ pnpm run verify')
  assert.deepEqual(preview.samples.forge.lines, [
    'Choose direction',
    'Pick seed',
    'Preview Dark + Light',
    'Apply',
    'Restore original theme',
  ])
})

function sourceSha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

async function loadRgbPixelCounts(path) {
  const { data, info } = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  return (hex, channelTolerance = 0) => {
    const normalized = hex.replace('#', '')
    const target = [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16))
    let count = 0
    for (let index = 0; index < data.length; index += info.channels) {
      if (
        Math.abs(data[index] - target[0]) <= channelTolerance
        && Math.abs(data[index + 1] - target[1]) <= channelTolerance
        && Math.abs(data[index + 2] - target[2]) <= channelTolerance
      ) {
        count += 1
      }
    }
    return count
  }
}

test('preview manifest owns every canonical marketing asset', async () => {
  const manifest = JSON.parse(readFileSync('reports/preview-manifest.json', 'utf8'))
  const outputs = Object.values(manifest)
    .filter((entry) => entry && typeof entry === 'object' && Array.isArray(entry.outputs))
    .flatMap((entry) => entry.outputs)

  for (const asset of EXPECTED_MASTER_ASSETS) {
    assert.ok(outputs.includes(asset), `${asset} must be listed in reports/preview-manifest.json`)
    assert.ok(existsSync(asset), `${asset} must exist`)
  }

  const og = await sharp('public/og-hearth.png').metadata()
  assert.equal(og.width, 1200)
  assert.equal(og.height, 630)
})

test('marketing colors are traceable to shipped theme files and faithful PNG pixels', async () => {
  const manifest = JSON.parse(readFileSync('reports/preview-manifest.json', 'utf8'))
  const contract = manifest.colorFidelity
  const countFamilyPixels = await loadRgbPixelCounts('extension/images/family-overview.png')
  const countOgPixels = await loadRgbPixelCounts('public/og-hearth.png')

  assert.equal(manifest.schemaVersion, 5)
  assert.equal(manifest.renderer, 'semantic-rift-v2')
  assert.equal(contract.policy, 'theme-source-only-v1')
  assert.deepEqual(Object.keys(contract.themes).sort(), ['ember-dark', 'ember-light', 'moss-dark', 'moss-light'])

  for (const [themeId, entry] of Object.entries(contract.themes)) {
    const source = JSON.parse(readFileSync(entry.source, 'utf8'))
    const serializedSource = JSON.stringify(source).toLowerCase()

    assert.equal(entry.sourceSha256, sourceSha256(entry.source), `${themeId} source hash must be current`)
    assert.equal(entry.colors.surface, source.colors['editor.background'])
    assert.equal(entry.colors.foreground, source.colors['editor.foreground'])
    assert.ok(countFamilyPixels(entry.colors.surface) > 10_000, `${themeId} surface must appear exactly in the family PNG`)
    assert.ok(countOgPixels(entry.colors.surface) > 10_000, `${themeId} surface must appear exactly in the OG PNG`)

    for (const role of ['keyword', 'function', 'type', 'string', 'property', 'operator']) {
      const color = entry.colors[role]
      assert.match(color, /^#[0-9a-f]{6}$/)
      assert.ok(serializedSource.includes(`\"${color}\"`), `${themeId} ${role} must exist verbatim in its shipped theme`)
      // librsvg/libvips can round a source channel by one unit while writing an
      // opaque PNG. The manifest/source equality above remains exact; this
      // tolerance covers only that 8-bit rasterization boundary.
      assert.ok(countFamilyPixels(color, 1) > 100, `${themeId} ${role} must appear faithfully in the family PNG`)
    }
  }
})

test('retired preview filenames do not return', () => {
  for (const retired of [
    'extension/images/preview-contrast-v2.png',
    'extension/images/preview-editor-hero.png',
    'extension/images/preview-forge-workflow.png',
    'public/previews/preview-contrast-v2.png',
  ]) {
    assert.equal(existsSync(retired), false, `${retired} should remain retired`)
  }
})
