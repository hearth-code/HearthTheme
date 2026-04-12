import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'
import { EXTENSION_PACKAGE_DIR, REPO_ROOT, resolveRepoPath } from './paths.mjs'

const ROOT = REPO_ROOT
const DEFAULT_SCHEME_ID = 'moss'
const DEFAULT_PRODUCT_ID = 'moss-local'
const DEFAULT_OUTPUT_DIR = 'local-builds'
const DEFAULT_LOCAL_ITERATION = '1'
const PACK_CANDIDATES = [
  ['pnpm', ['dlx', '@vscode/vsce', 'package', '--no-dependencies']],
  ['pnpm', ['exec', 'vsce', 'package', '--no-dependencies']],
  ['npx', ['vsce', 'package', '--no-dependencies']],
]

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true })
}

function removeEmptyDir(path) {
  if (!existsSync(path)) return
  if (readdirSync(path).length > 0) return
  rmSync(path, { recursive: true, force: true })
}

function resolveRepoFilePath(path) {
  const normalized = String(path || '').replace(/^[.][\\/]/, '')
  return join(ROOT, ...normalized.split(/[\\/]+/).filter(Boolean))
}

function run(command, args, { cwd = ROOT, env = process.env, label = `${command} ${args.join(' ')}` } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  const status = result.status ?? 1
  if (status !== 0) {
    throw new Error(`Command failed (${status}): ${label}`)
  }
}

function tryPack(cwd, outPath) {
  for (const [command, args] of PACK_CANDIDATES) {
    const result = spawnSync(command, [...args, '--out', outPath], {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
    if ((result.status ?? 1) === 0) return
  }
  throw new Error('VSIX packaging failed for all pack candidates')
}

function buildLocalVersion(baseVersion, schemeId, iteration = DEFAULT_LOCAL_ITERATION) {
  const normalizedIteration = String(iteration || DEFAULT_LOCAL_ITERATION).trim() || DEFAULT_LOCAL_ITERATION
  const suffix = `${String(schemeId || '').trim().toLowerCase()}-local.${normalizedIteration}`.replace(/[^a-z0-9.-]+/g, '-')
  return `${baseVersion}-${suffix}`
}

function buildReadme({ productData, version }) {
  const themeList = productData.extension.themes
    .map((theme) => `- ${theme.label}`)
    .join('\n')

  const flavorSummary = productData.defaultFlavor?.summary || productData.product.summary
  const flavorName = productData.defaultFlavor?.name || productData.product.name
  return `# ${productData.product.displayName}

Local preview package for ${flavorName}.

## Why this build

${flavorSummary}

## Included themes

${themeList}

## Install

1. In VS Code, run \`Extensions: Install from VSIX...\`
2. Choose this package
3. Select one of the themes listed above from the color theme picker

## Notes

- This is a local preview build and does not replace the public Marketplace release.
- Built from ${flavorName} flavor metadata at version \`${version}\`.
`
}

function buildPackageJson({ productData, version, bannerColor }) {
  return {
    name: productData.extension.name,
    displayName: productData.product.displayName,
    description: productData.extension.description,
    version,
    publisher: productData.extension.publisher,
    engines: { ...productData.extension.engines },
    categories: [...productData.extension.categories],
    keywords: [...productData.extension.keywords],
    galleryBanner: {
      color: bannerColor,
      theme: productData.extension.galleryBannerTheme,
    },
    icon: 'icon.png',
    homepage: productData.links.websiteUrl,
    repository: {
      type: 'git',
      url: productData.product.repository.url,
    },
    bugs: {
      url: productData.links.issuesUrl,
    },
    qna: productData.extension.qna,
    license: productData.extension.license,
    contributes: {
      themes: productData.extension.themes.map((theme) => ({
        label: theme.label,
        uiTheme: theme.uiTheme,
        path: theme.path,
      })),
    },
  }
}

async function loadProductRuntime(targetEnv) {
  Object.assign(process.env, targetEnv)
  const [{ buildProductMetadata }] = await Promise.all([
    import('./product-metadata.mjs'),
  ])
  return {
    productData: buildProductMetadata(),
  }
}

function copyThemes(themeMetaList, buildThemesDir) {
  const copied = []
  for (const theme of themeMetaList) {
    const source = resolveRepoFilePath(theme.path)
    const destination = join(buildThemesDir, String(theme.path).split(/[\\/]/).pop())
    if (!existsSync(source)) {
      throw new Error(`Missing generated theme file: ${source}`)
    }
    copyFileSync(source, destination)
    copied.push(source)
  }
  return copied
}

function getBannerColor(themeMetaList) {
  const darkTheme = themeMetaList.find((theme) => theme.uiTheme === 'vs-dark') || themeMetaList[0]
  const themeJson = readJson(resolveRepoFilePath(darkTheme.path))
  return String(themeJson?.colors?.['editor.background'] || '#1f1a17').trim() || '#1f1a17'
}

async function main() {
  const schemeId = String(process.argv[2] || DEFAULT_SCHEME_ID).trim()
  const productId = String(process.argv[3] || DEFAULT_PRODUCT_ID).trim()
  const outputDir = String(process.argv[4] || DEFAULT_OUTPUT_DIR).trim() || DEFAULT_OUTPUT_DIR
  const localIteration = String(process.argv[5] || DEFAULT_LOCAL_ITERATION).trim() || DEFAULT_LOCAL_ITERATION
  const activeScheme = readJson(join(ROOT, 'color-system', 'active-scheme.json'))
  const activeProduct = readJson(join(ROOT, 'products', 'active-product.json'))
  const targetEnv = {
    ...process.env,
    COLOR_SYSTEM_SCHEME_ID: schemeId,
    COLOR_SYSTEM_SCHEME_DIR: `color-system/schemes/${schemeId}`,
    COLOR_SYSTEM_PRODUCT_ID: productId,
    COLOR_SYSTEM_PRODUCT_DIR: `products/${productId}`,
  }

  const buildDir = join(ROOT, 'tmp', 'local-preview', schemeId)
  const buildThemesDir = join(buildDir, 'themes')
  const outDir = join(ROOT, outputDir)

  try {
    run(process.execPath, ['scripts/generate-theme-variants.mjs'], {
      env: targetEnv,
      label: `generate theme variants for ${schemeId}`,
    })

    const { productData } = await loadProductRuntime(targetEnv)
    const themeMetaList = productData.extension.themes
    const releaseMeta = readJson(join(ROOT, 'releases', 'color-language.json'))
    const version = buildLocalVersion(releaseMeta.version, schemeId, localIteration)
    const outPath = join(outDir, `${productData.extension.name}-${version}.vsix`)

    rmSync(buildDir, { recursive: true, force: true })
    ensureDir(buildThemesDir)
    ensureDir(outDir)

    copyThemes(themeMetaList, buildThemesDir)
    copyFileSync(resolveRepoPath(EXTENSION_PACKAGE_DIR, 'icon.png'), join(buildDir, 'icon.png'))
    copyFileSync(resolveRepoPath(EXTENSION_PACKAGE_DIR, 'LICENSE'), join(buildDir, 'LICENSE'))
    writeFileSync(join(buildDir, '.vscodeignore'), '*.vsix\n.vscode/**\n')
    writeFileSync(join(buildDir, 'README.md'), buildReadme({ productData, version }))
    writeFileSync(
      join(buildDir, 'package.json'),
      `${JSON.stringify(buildPackageJson({
        productData,
        version,
        bannerColor: getBannerColor(themeMetaList),
      }), null, 2)}\n`
    )

    rmSync(outPath, { force: true })
    tryPack(buildDir, outPath)
    console.log(`鉁?Local preview package created: ${outPath}`)
  } finally {
    rmSync(buildDir, { recursive: true, force: true })
    removeEmptyDir(join(ROOT, 'tmp', 'local-preview'))
    removeEmptyDir(join(ROOT, 'tmp'))

    if (schemeId !== String(activeScheme?.schemeId || '').trim()) {
      for (const suffix of ['dark', 'dark-soft', 'light', 'light-soft']) {
        rmSync(join(ROOT, 'themes', `${schemeId}-${suffix}.json`), { force: true })
      }
    }

    run(process.execPath, ['scripts/generate-theme-variants.mjs'], {
      env: {
        ...process.env,
        COLOR_SYSTEM_SCHEME_ID: String(activeScheme?.schemeId || '').trim(),
        COLOR_SYSTEM_SCHEME_DIR: String(activeScheme?.schemeDir || '').trim(),
        COLOR_SYSTEM_PRODUCT_ID: String(activeProduct?.productId || '').trim(),
        COLOR_SYSTEM_PRODUCT_DIR: String(activeProduct?.productDir || '').trim(),
      },
      label: 'restore active theme baseline',
    })
  }
}

main().catch((error) => {
  console.error(`鉂?${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
