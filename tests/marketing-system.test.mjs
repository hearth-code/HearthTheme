import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import sharp from 'sharp'
import { loadColorProductManifest, loadColorProductPreviewConfig } from '../scripts/color-system.mjs'
import { loadMarketingAssetSpec } from '../scripts/marketing/asset-spec.mjs'
import { assertSemanticRiftLayout, buildSemanticRiftLayout, buildTornPaperGeometry, renderDistressedText, renderMaterialTexture, renderTornPaperSeam } from '../scripts/marketing/template-components.mjs'
import { buildObsidianHeroSvg, buildObsidianScreenshotSvg } from '../scripts/render-obsidian-screenshot.mjs'

const EXPECTED_MASTER_ASSETS = [
  'extension/images/editor-moss-dark-light.png',
  'extension/images/family-overview.png',
  'extension/images/theme-forge-workflow.png',
  'public/previews/family-overview.png',
  'docs/marketing/direction-atlas.png',
  'docs/marketing/platform-coverage.png',
  'docs/marketing/moss-surfaces.png',
  'docs/marketing/exports/github-social.png',
  'docs/marketing/exports/family-square.png',
  'docs/marketing/exports/family-portrait.png',
  'docs/marketing/exports/family-story.png',
  'docs/marketing/exports/ember-square.png',
  'docs/marketing/exports/moss-square.png',
  'zed/images/hearthcode-zed.png',
  'terminal/hearthcode-terminal.png',
  'docs/marketing/obsidian-hero.png',
  'obsidian/app-theme/screenshot.png',
  'public/og-hearth.png',
]

test('material texture primitives are deterministic and palette-injected', () => {
  const textureArgs = {
    id: 'test-paper',
    ink: '#d3c9b8',
    width: 320,
    height: 180,
    seed: 17,
    intensity: 0.8,
  }
  const firstTexture = renderMaterialTexture(textureArgs)
  const secondTexture = renderMaterialTexture(textureArgs)
  const distressed = renderDistressedText({
    id: 'test-title',
    text: 'EMBER',
    x: 20,
    y: 40,
    fill: '#d15b41',
    wear: '#211d1a',
    fontSize: 96,
    seed: 23,
  })

  assert.equal(firstTexture, secondTexture)
  assert.match(firstTexture, /patternUnits="userSpaceOnUse"/)
  assert.match(firstTexture, /#d3c9b8/)
  assert.match(distressed, />EMBER<\/text>/)
  assert.match(distressed, /#d15b41/)
  assert.match(distressed, /#211d1a/)
})

test('torn paper geometry and fibers are deterministic and palette-injected', () => {
  const geometryArgs = {
    controlPoints: [{ x: 280, y: 0 }, { x: 190, y: 180 }, { x: 120, y: 360 }],
    seed: 31,
    paperWidth: 22,
  }
  const firstGeometry = buildTornPaperGeometry(geometryArgs)
  const secondGeometry = buildTornPaperGeometry(geometryArgs)
  const firstSeam = renderTornPaperSeam({
    id: 'test-rift',
    geometry: firstGeometry,
    paper: '#d3c9b8',
    warmInk: '#ca5b41',
    coolInk: '#93ce75',
    shadowInk: '#1f1a17',
    seed: 37,
  })
  const secondSeam = renderTornPaperSeam({
    id: 'test-rift',
    geometry: secondGeometry,
    paper: '#d3c9b8',
    warmInk: '#ca5b41',
    coolInk: '#93ce75',
    shadowInk: '#1f1a17',
    seed: 37,
  })

  assert.deepEqual(firstGeometry, secondGeometry)
  assert.equal(firstSeam, secondSeam)
  assert.doesNotMatch(firstSeam, /feGaussianBlur/)
  assert.match(firstSeam, /test-rift-abrasion/)
  assert.match(firstSeam, /#d3c9b8/)
  assert.match(firstSeam, /#ca5b41/)
  assert.match(firstSeam, /#93ce75/)
  assert.match(firstSeam, /#1f1a17/)
})

test('wide rift keeps scheme labels on their own fields, aligns Moss with its proof column, and makes code prominent', () => {
  const firstLayout = buildSemanticRiftLayout({ width: 1600, height: 900 })
  const secondLayout = buildSemanticRiftLayout({ width: 1600, height: 900 })

  assert.deepEqual(firstLayout, secondLayout)
  assert.doesNotThrow(() => assertSemanticRiftLayout(firstLayout))
  assert.equal(firstLayout.title.mossX, firstLayout.sample.rightX)
  assert.ok(firstLayout.sample.fontSize >= 30)
})

test('family campaign titles use the field split instead of a slash glyph', () => {
  const generatorSource = readFileSync('scripts/generate-preview-images.mjs', 'utf8')

  assert.doesNotMatch(generatorSource, /rift-title-slash/)
  assert.doesNotMatch(generatorSource, /family-lockup-slash/)
  assert.doesNotMatch(generatorSource, /text: "EMBER\/"/)
})

test('platform proofs keep real channel boundaries while Obsidian stays Moss-only and product-first', () => {
  const generatorSource = readFileSync('scripts/generate-preview-images.mjs', 'utf8')
  const themeCss = readFileSync('obsidian/app-theme/theme.css', 'utf8')
  const obsidianScreenshot = buildObsidianScreenshotSvg(themeCss)
  const obsidianHero = buildObsidianHeroSvg(themeCss)
  const obsidianReadme = readFileSync('obsidian/mirror-README.md', 'utf8')

  assert.match(generatorSource, /GENERATED ZED SPECIMEN · 4 THEMES/)
  assert.match(generatorSource, /HEARTHCODE TERMINAL/)
  assert.match(generatorSource, /5 FORMATS · 4 THEMES/)
  assert.match(generatorSource, /buildZedSampleLines/)
  assert.match(generatorSource, /text: `"\$\{meta\.schemeId\}"`/)
  assert.doesNotMatch(generatorSource, /kicker: channelKicker/)
  assert.doesNotMatch(generatorSource, /subheadline: channelSubheading/)
  assert.doesNotMatch(obsidianScreenshot, /moss-rift/)
  assert.doesNotMatch(obsidianHero, /moss-rift/)
  assert.match(obsidianScreenshot, />DARK<\/text>/)
  assert.match(obsidianScreenshot, /obsidian-community-mode-cut/)
  assert.match(obsidianHero, /obsidian-hero-mode-cut/)
  assert.match(obsidianHero, /clipPath/)
  assert.match(obsidianHero, /width="1552" height="852"/)
  assert.doesNotMatch(obsidianHero, /obsidian-dark-card/)
  assert.doesNotMatch(obsidianHero, /obsidian-light-card/)
  assert.doesNotMatch(obsidianHero, />MOSS<\/text>/)
  assert.doesNotMatch(obsidianHero, />OBSIDIAN<\/text>/)
  assert.match(obsidianHero, />DARK<\/text>/)
  assert.match(obsidianHero, />LIGHT<\/text>/)
  assert.doesNotMatch(obsidianHero, /EMBER/)
  assert.match(obsidianReadme, /Moss turns color into reading order/)
})

test('attraction and product-proof templates do not inherit the field-guide wrapper', () => {
  const generatorSource = readFileSync('scripts/generate-preview-images.mjs', 'utf8')
  const attractionStart = generatorSource.indexOf('function renderEditorialSquareSvg')
  const attractionEnd = generatorSource.indexOf('function renderFamilyAssetSvg')
  const directionStart = generatorSource.indexOf('function renderDirectionCardSvg')
  const directionEnd = generatorSource.indexOf('function renderZedUnifiedProof')
  const channelStart = generatorSource.indexOf('function renderChannelProofSvg')
  const channelEnd = generatorSource.indexOf('function renderAvailabilityCell')
  const attractionTemplates = generatorSource.slice(attractionStart, attractionEnd)
  const directionTemplate = generatorSource.slice(directionStart, directionEnd)
  const channelTemplate = generatorSource.slice(channelStart, channelEnd)

  assert.doesNotMatch(attractionTemplates, /renderFieldGuideGrid/)
  assert.doesNotMatch(attractionTemplates, /renderRegistrationMarks/)
  assert.doesNotMatch(directionTemplate, /renderFieldGuideGrid/)
  assert.doesNotMatch(directionTemplate, /renderRegistrationMarks/)
  assert.doesNotMatch(channelTemplate, /renderFieldGuideGrid/)
  assert.doesNotMatch(channelTemplate, /renderFamilyLockup/)
})

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

test('preview copy carries the Semantic Materials message hierarchy', () => {
  const preview = loadColorProductPreviewConfig()

  assert.equal(preview.headline, 'Two directions. Four calibrated themes.')
  assert.equal(preview.marketing.familyHeadline, 'EMBER / MOSS')
  assert.equal(preview.marketing.familySubheadline, 'WARMTH OR STRUCTURE. MEANING STAYS CLEAR.')
  assert.match(preview.marketing.directionHeadline, /Warmth or structure/)
  assert.match(preview.marketing.platformHeadline, /Where each direction ships/)
  assert.match(preview.marketing.mossSurfaceHeadline, /Same roles/)
  assert.deepEqual(Object.keys(preview.marketing.directions).sort(), ['ember', 'moss'])
  assert.equal(preview.marketing.directions.ember.sampleString, '"ember"')
  assert.equal(preview.marketing.directions.moss.sampleString, '"moss"')

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

test('public entry copy carries one message while preserving platform truth', () => {
  const en = JSON.parse(readFileSync('src/i18n/en.json', 'utf8'))
  const zh = JSON.parse(readFileSync('src/i18n/zh.json', 'utf8'))
  const ja = JSON.parse(readFileSync('src/i18n/ja.json', 'utf8'))
  const release = JSON.parse(readFileSync('products/hearthcode/release.json', 'utf8'))
  const rootReadme = readFileSync('README.md', 'utf8')
  const rootReadmeZh = readFileSync('README.zh-CN.md', 'utf8')
  const rootReadmeJa = readFileSync('README.ja.md', 'utf8')
  const zedReadme = readFileSync('zed/mirror-README.md', 'utf8')
  const terminalReadme = readFileSync('terminal/README.md', 'utf8')
  const obsidianReadme = readFileSync('obsidian/mirror-README.md', 'utf8')

  assert.match(en['hero.subtitle'], /^Warmth or structure\. Meaning stays clear\./)
  assert.match(zh['hero.subtitle'], /^温暖或秩序，语义始终清晰。/)
  assert.match(ja['hero.subtitle'], /^温もりか、構造か。意味は明瞭なまま。/)
  assert.match(rootReadme, /\*\*Warmth or structure\. Meaning stays clear\.\*\*/)
  assert.match(rootReadmeZh, /\*\*温暖或秩序，语义始终清晰。\*\*/)
  assert.match(rootReadmeJa, /\*\*温もりか、構造か。意味は明瞭なまま。\*\*/)
  assert.match(release.vscodeExtension.description, /^Warmth or structure/)
  assert.match(release.zedExtension.description, /Warm Ember or structured Moss/)
  assert.match(zedReadme, /paired for Zed/)
  assert.match(terminalReadme, /same semantic palette across five terminal formats/i)
  assert.match(obsidianReadme, /Moss turns color into reading order/)
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
  const generatedOutputs = Object.values(manifest)
    .filter((entry) => entry && typeof entry === 'object' && Array.isArray(entry.outputs))
    .flatMap((entry) => entry.outputs)
  const managedOutputs = (manifest.managedAssets || []).flatMap((entry) => entry.outputs || [])
  const outputs = [...generatedOutputs, ...managedOutputs]

  for (const asset of EXPECTED_MASTER_ASSETS) {
    assert.ok(outputs.includes(asset), `${asset} must be listed in reports/preview-manifest.json`)
    assert.ok(existsSync(asset), `${asset} must exist`)
  }

  const og = await sharp('public/og-hearth.png').metadata()
  assert.equal(og.width, 1200)
  assert.equal(og.height, 630)
})

test('marketing asset matrix owns templates, formats, channels, and output dimensions', async () => {
  const spec = loadMarketingAssetSpec()
  const manifest = JSON.parse(readFileSync('reports/preview-manifest.json', 'utf8'))
  const specOutputs = [...spec.assets, ...spec.managedAssets].flatMap((asset) => asset.outputs).sort()
  const manifestOutputs = [
    ...Object.values(manifest)
      .filter((entry) => entry && typeof entry === 'object' && Array.isArray(entry.outputs))
      .flatMap((entry) => entry.outputs),
    ...(manifest.managedAssets || []).flatMap((entry) => entry.outputs || []),
  ].sort()

  assert.equal(spec.brandSystem, 'semantic-materials-v1')
  assert.equal(spec.renderer, 'semantic-materials-v1')
  assert.deepEqual(manifestOutputs, specOutputs)
  assert.deepEqual(spec.formats['github-social'], { width: 1280, height: 640, safeInset: 48 })
  assert.deepEqual(spec.formats['social-square'], { width: 1200, height: 1200, safeInset: 64 })
  assert.deepEqual(spec.formats['social-portrait'], { width: 1080, height: 1350, safeInset: 64 })
  assert.deepEqual(spec.formats['social-story'], { width: 1080, height: 1920, safeInset: 72 })

  const generatedById = Object.fromEntries(spec.assets.map((asset) => [asset.id, asset]))
  assert.equal(generatedById['family-readme'].composition, 'semantic-rift-wide')
  assert.equal(generatedById['github-social'].composition, 'semantic-rift-wide')
  assert.equal(generatedById['site-og'].composition, 'semantic-rift-wide')
  assert.equal(generatedById['family-square'].composition, 'editorial-square')
  assert.equal(generatedById['family-portrait'].composition, 'stacked-directions')
  assert.equal(generatedById['family-story'].composition, 'campaign-story')
  assert.equal(generatedById['ember-square'].schemeId, 'ember')
  assert.equal(generatedById['moss-square'].schemeId, 'moss')
  assert.equal(generatedById['zed-platform'].channelId, 'zed')
  assert.equal(generatedById['terminal-platform'].channelId, 'terminal')

  for (const asset of [...spec.assets, ...spec.managedAssets]) {
    for (const output of asset.outputs) {
      assert.ok(existsSync(output), `${output} must exist`)
      if (!asset.format) continue
      const metadata = await sharp(output).metadata()
      const format = spec.formats[asset.format]
      assert.equal(metadata.width, format.width, `${output} width`)
      assert.equal(metadata.height, format.height, `${output} height`)
    }
  }
})

test('marketing colors are traceable to shipped theme files and faithful PNG pixels', async () => {
  const manifest = JSON.parse(readFileSync('reports/preview-manifest.json', 'utf8'))
  const contract = manifest.colorFidelity
  const countFamilyPixels = await loadRgbPixelCounts('extension/images/family-overview.png')
  const countOgPixels = await loadRgbPixelCounts('public/og-hearth.png')
  const responsiveFamilyCounters = await Promise.all([
    'docs/marketing/exports/github-social.png',
    'docs/marketing/exports/family-square.png',
    'docs/marketing/exports/family-portrait.png',
    'docs/marketing/exports/family-story.png',
  ].map(loadRgbPixelCounts))

  assert.equal(manifest.schemaVersion, 6)
  assert.equal(manifest.renderer, 'semantic-materials-v1')
  assert.equal(manifest.brandSystem.id, 'semantic-materials-v1')
  assert.equal(manifest.brandSystem.sourceSha256, sourceSha256(manifest.brandSystem.source))
  assert.equal(manifest.brandSystem.templateComponentsSourceSha256, sourceSha256(manifest.brandSystem.templateComponentsSource))
  assert.equal(manifest.assetSpec.sourceSha256, sourceSha256(manifest.assetSpec.source))
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
    for (const countPixels of responsiveFamilyCounters) {
      assert.ok(countPixels(entry.colors.surface) > 10_000, `${themeId} surface must appear exactly in every responsive family export`)
    }

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

test('channel READMEs use their generated platform proof instead of generic artwork', () => {
  const zedReadme = readFileSync('zed/mirror-README.md', 'utf8')
  const terminalReadme = readFileSync('terminal/README.md', 'utf8')
  const rootReadmes = ['README.md', 'README.zh-CN.md', 'README.ja.md'].map((path) => readFileSync(path, 'utf8'))

  assert.match(zedReadme, /\.\/images\/hearthcode-zed\.png/)
  assert.match(terminalReadme, /\.\/hearthcode-terminal\.png/)
  for (const readme of rootReadmes) {
    assert.match(readme, /\.\/docs\/marketing\/direction-atlas\.png/)
    assert.match(readme, /\.\/extension\/images\/theme-forge-workflow\.png/)
  }
})
