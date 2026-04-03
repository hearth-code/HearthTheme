import { getReleaseVersion } from './release-metadata.mjs'
import {
  getThemeOutputFiles,
  loadColorProductManifest,
  loadColorProductPreviewConfig,
  loadColorProductReleaseConfig,
  loadColorSchemeManifest,
  loadColorSystemVariants,
} from './color-system.mjs'

function trimTrailingSlash(value) {
  return String(value || '').trim().replace(/\/+$/, '')
}

function getHostLabel(url) {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return String(url || '').trim()
  }
}

function splitBrandWordmark(name) {
  const full = String(name || '').trim()
  if (!full) {
    return {
      full: '',
      primary: '',
      secondary: '',
    }
  }

  const spaced = full
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/\s+/)
    .filter(Boolean)

  if (spaced.length >= 2) {
    return {
      full,
      primary: spaced.slice(0, -1).join(' '),
      secondary: spaced.slice(-1).join(' '),
    }
  }

  return {
    full,
    primary: full,
    secondary: '',
  }
}

function toMetaPrefix(id) {
  const normalized = String(id || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  return normalized || 'product'
}

export function buildProductMetadata() {
  const product = loadColorProductManifest()
  const preview = loadColorProductPreviewConfig()
  const releaseConfig = loadColorProductReleaseConfig()
  const scheme = loadColorSchemeManifest()
  const variants = loadColorSystemVariants().variants
  const themeOutputFiles = getThemeOutputFiles()
  const releaseVersion = getReleaseVersion()
  const repositoryUrl = trimTrailingSlash(product.repository.url)
  const websiteUrl = trimTrailingSlash(product.websiteUrl)
  const marketplaceItemName = `${releaseConfig.vscodeExtension.publisher}.${releaseConfig.vscodeExtension.name}`
  const previewThemeLabel = preview.variantNames[releaseConfig.vscodeExtension.previewVariantId]
  const wordmark = splitBrandWordmark(product.name)

  return {
    product: {
      ...product,
      wordmark,
    },
    scheme: {
      id: scheme.id,
      name: scheme.name,
      headline: scheme.headline,
    },
    preview,
    release: {
      version: releaseVersion,
    },
    site: {
      titleSuffix: product.name,
      titleDescriptor: releaseConfig.site.titleDescriptor,
      defaultTitle: `${product.name} — ${releaseConfig.site.titleDescriptor}`,
      authorName: product.author.name,
      metaPrefix: toMetaPrefix(product.id),
      hostLabel: getHostLabel(websiteUrl),
      ogImagePath: releaseConfig.site.ogImagePath,
      ogImageAlt: `${product.displayName} preview`,
      wordmark,
    },
    extension: {
      name: releaseConfig.vscodeExtension.name,
      publisher: releaseConfig.vscodeExtension.publisher,
      itemName: marketplaceItemName,
      displayName: product.displayName,
      description: releaseConfig.vscodeExtension.description,
      categories: releaseConfig.vscodeExtension.categories,
      keywords: releaseConfig.vscodeExtension.keywords,
      icon: releaseConfig.vscodeExtension.icon,
      license: releaseConfig.vscodeExtension.license,
      qna: releaseConfig.vscodeExtension.qna,
      engines: releaseConfig.vscodeExtension.engines,
      galleryBannerTheme: releaseConfig.vscodeExtension.galleryBanner.theme,
      previewVariantId: releaseConfig.vscodeExtension.previewVariantId,
      previewThemeLabel,
      themes: variants.map((variant) => ({
        label: preview.variantNames[variant.id],
        uiTheme: variant.type === 'dark' ? 'vs-dark' : 'vs',
        path: `./${String(themeOutputFiles[variant.id] || '').replace(/\\/g, '/')}`,
      })),
    },
    obsidian: {
      ...releaseConfig.obsidianAppTheme,
      releaseUrl: `${repositoryUrl}/releases`,
    },
    links: {
      websiteUrl,
      marketplaceUrl: `https://marketplace.visualstudio.com/items?itemName=${marketplaceItemName}`,
      openVsxUrl: `https://open-vsx.org/extension/${releaseConfig.vscodeExtension.publisher}/${releaseConfig.vscodeExtension.name}`,
      vscodeDevUrl: `https://vscode.dev/theme/${marketplaceItemName}/${encodeURIComponent(previewThemeLabel)}`,
      repositoryUrl,
      issuesUrl: `${repositoryUrl}/issues`,
      releasesUrl: `${repositoryUrl}/releases`,
      changelogUrl: `${repositoryUrl}/blob/main/extension/CHANGELOG.md`,
      licenseUrl: `${repositoryUrl}/blob/main/LICENSE`,
      docsRootUrl: `${repositoryUrl}/blob/main/docs`,
      repoBlobRootUrl: `${repositoryUrl}/blob/main`,
      repoTreeRootUrl: `${repositoryUrl}/tree/main`,
      philosophyUrl: `${repositoryUrl}/blob/main/color-system/schemes/${scheme.id}/philosophy.md`,
      schemeUrl: `${repositoryUrl}/blob/main/color-system/schemes/${scheme.id}/scheme.json`,
      specUrl: `${repositoryUrl}/blob/main/docs/color-language-spec.md`,
      baselineUrl: `${repositoryUrl}/blob/main/docs/theme-baseline.md`,
      tuningUrl: `${repositoryUrl}/blob/main/docs/color-system-tuning.md`,
      reportUrl: `${repositoryUrl}/blob/main/docs/color-language-report.md`,
      contractChecklistUrl: `${repositoryUrl}/blob/main/docs/color-language-contract-checklist.md`,
      contractReviewUrl: `${repositoryUrl}/blob/main/docs/color-language-contract-review.md`,
      sourceColorSystemUrl: `${repositoryUrl}/tree/main/color-system`,
      docsEnUrl: `${websiteUrl}/docs`,
      docsZhUrl: `${websiteUrl}/zh/docs`,
      docsJaUrl: `${websiteUrl}/ja/docs`,
    },
  }
}
