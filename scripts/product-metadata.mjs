import { getReleaseVersion } from './release-metadata.mjs'
import {
  getThemeMetaListForSchemeId,
  loadColorProductManifest,
  loadColorProductPreviewConfig,
  loadColorProductReleaseConfig,
  loadColorSchemeManifestById,
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

function buildThemeLabel(flavorLabel, climateLabel) {
  return [String(flavorLabel || '').trim(), String(climateLabel || '').trim()].filter(Boolean).join(' ')
}

function toPublicThemeCatalog(entries) {
  return entries.map((entry, index) => ({
    id: entry.id || `${entry.schemeId}-${entry.variantId}`,
    schemeId: entry.schemeId,
    variantId: entry.variantId,
    flavorLabel: entry.flavorLabel,
    climateLabel: entry.climateLabel,
    label: entry.label,
    tabLabel: entry.tabLabel || entry.label,
    summary: entry.summary || entry.label,
    uiTheme: entry.uiTheme,
    path: entry.path,
    isDefaultTheme: entry.isDefaultTheme === true || index === 0,
    isDark: entry.isDark ?? entry.uiTheme === 'vs-dark',
  }))
}

function buildFeaturedThemeCatalog(product, flavors) {
  if (!Array.isArray(product.featuredThemes) || product.featuredThemes.length === 0) return []

  return product.featuredThemes.map((entry) => {
    const flavor = flavors.find((item) => item.id === entry.schemeId)
    const variant = getThemeMetaListForSchemeId(entry.schemeId).find((item) => item.id === entry.variantId)
    if (!flavor || !variant) {
      throw new Error(`buildProductMetadata: missing featured theme source for "${entry.id}"`)
    }
    return {
      id: entry.id,
      schemeId: entry.schemeId,
      variantId: entry.variantId,
      flavorLabel: flavor.pickerName,
      climateLabel: variant.climateLabel,
      label: entry.label,
      tabLabel: buildThemeLabel(flavor.previewPrefix, variant.climateLabel),
      summary: entry.summary,
      uiTheme: variant.type === 'dark' ? 'vs-dark' : 'vs',
      path: `./${String(variant.path || '').replace(/\\/g, '/')}`,
      isDefaultTheme: entry.isDefault === true,
      isDark: variant.type === 'dark',
    }
  })
}

export function buildProductMetadata() {
  const product = loadColorProductManifest()
  const preview = loadColorProductPreviewConfig()
  const releaseConfig = loadColorProductReleaseConfig()
  const releaseVersion = getReleaseVersion()
  const repositoryUrl = trimTrailingSlash(product.repository.url)
  const websiteUrl = trimTrailingSlash(product.websiteUrl)
  const marketplaceItemName = `${releaseConfig.vscodeExtension.publisher}.${releaseConfig.vscodeExtension.name}`
  const wordmark = splitBrandWordmark(product.name)
  const brand = product.brand || {
    id: product.id,
    name: product.name,
    displayName: product.displayName,
    summary: product.summary,
  }
  const flavorIds = product.brandFlavorIds.length > 0 ? product.brandFlavorIds : product.supportedSchemeIds
  const featuredFlavorIds = [...new Set(flavorIds.filter((schemeId) => product.supportedSchemeIds.includes(schemeId)))]
  const featuredFlavorIdSet = new Set(featuredFlavorIds)
  const flavors = flavorIds.map((schemeId) => {
    const manifest = loadColorSchemeManifestById(schemeId)
    const flavorWordmark = splitBrandWordmark(manifest.name)
    const configuredNames = product.flavorNames?.[schemeId] || {}
    const pickerName = configuredNames.picker || flavorWordmark.primary || manifest.name
    const themePrefix = configuredNames.theme || pickerName
    const previewPrefix = configuredNames.preview || pickerName
    return {
      id: manifest.id,
      name: manifest.name,
      shortName: pickerName,
      pickerName,
      themePrefix,
      previewPrefix,
      wordmark: flavorWordmark,
      headline: manifest.headline,
      summary: manifest.summary,
      defaultVariant: manifest.defaultVariant,
      isDefault: manifest.id === product.defaultSchemeId,
      isFeatured: featuredFlavorIdSet.has(manifest.id),
      isPublished: product.supportedSchemeIds.includes(manifest.id),
    }
  })
  const defaultFlavor = flavors.find((flavor) => flavor.isDefault) || flavors[0] || null
  const themeCatalog = flavors.flatMap((flavor) => (
    getThemeMetaListForSchemeId(flavor.id).map((variant) => ({
      variantId: variant.id,
      schemeId: flavor.id,
      flavorLabel: flavor.pickerName,
      climateLabel: variant.climateLabel,
      label: buildThemeLabel(flavor.themePrefix, variant.climateLabel),
      tabLabel: buildThemeLabel(flavor.previewPrefix, variant.climateLabel),
      uiTheme: variant.type === 'dark' ? 'vs-dark' : 'vs',
      path: `./${String(variant.path || '').replace(/\\/g, '/')}`,
      isFeaturedFlavor: flavor.isFeatured,
      isDefaultFlavor: flavor.isDefault,
      isPublishedFlavor: flavor.isPublished,
    }))
  ))
  const featuredThemeCatalog = buildFeaturedThemeCatalog(product, flavors)
  const publishedThemeCatalog = themeCatalog.filter((entry) => entry.isPublishedFlavor)
  const extensionThemeCatalog = toPublicThemeCatalog(publishedThemeCatalog)
  const publicThemeCatalog = featuredThemeCatalog.length > 0
    ? toPublicThemeCatalog(featuredThemeCatalog)
    : toPublicThemeCatalog(publishedThemeCatalog)
  const defaultPreviewThemeLabel =
    extensionThemeCatalog.find(
      (entry) => entry.schemeId === product.defaultSchemeId && entry.variantId === releaseConfig.vscodeExtension.previewVariantId,
    )?.label
    || extensionThemeCatalog.find((entry) => entry.variantId === releaseConfig.vscodeExtension.previewVariantId)?.label
    || preview.variantNames[releaseConfig.vscodeExtension.previewVariantId]
  const vscodeDevFlavorUrls = Object.fromEntries(
    flavors
      .map((flavor) => {
        const label =
          extensionThemeCatalog.find(
            (entry) => entry.schemeId === flavor.id && entry.variantId === releaseConfig.vscodeExtension.previewVariantId,
          )?.label
          || extensionThemeCatalog.find((entry) => entry.schemeId === flavor.id && entry.variantId === flavor.defaultVariant)?.label
          || extensionThemeCatalog.find((entry) => entry.schemeId === flavor.id)?.label

        if (!label) return null
        return [
          flavor.id,
          `https://vscode.dev/theme/${marketplaceItemName}/${encodeURIComponent(label)}`,
        ]
      })
      .filter(Boolean),
  )
  const flavorLinks = Object.fromEntries(
    flavors.map((flavor) => [
      flavor.id,
      {
        philosophyUrl: `${repositoryUrl}/blob/main/color-system/schemes/${flavor.id}/philosophy.md`,
        schemeUrl: `${repositoryUrl}/blob/main/color-system/schemes/${flavor.id}/scheme.json`,
      },
    ]),
  )

  return {
    product: {
      ...product,
      wordmark,
    },
    brand,
    defaultFlavor: defaultFlavor
      ? {
          id: defaultFlavor.id,
          name: defaultFlavor.name,
          headline: defaultFlavor.headline,
          summary: defaultFlavor.summary,
        }
      : null,
    featuredFlavorIds,
    flavors,
    themes: publicThemeCatalog,
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
      defaultPreviewThemeLabel,
      themeCatalog,
      themes: extensionThemeCatalog.map((variant) => ({
        label: variant.label,
        uiTheme: variant.uiTheme,
        path: variant.path,
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
      sitePreviewUrl: websiteUrl,
      vscodeDevUrl: websiteUrl,
      vscodeDevFlavorUrls,
      repositoryUrl,
      issuesUrl: `${repositoryUrl}/issues`,
      releasesUrl: `${repositoryUrl}/releases`,
      changelogUrl: `${repositoryUrl}/blob/main/extension/CHANGELOG.md`,
      licenseUrl: `${repositoryUrl}/blob/main/LICENSE`,
      docsRootUrl: `${repositoryUrl}/blob/main/docs`,
      repoBlobRootUrl: `${repositoryUrl}/blob/main`,
      repoTreeRootUrl: `${repositoryUrl}/tree/main`,
      philosophyUrl: `${repositoryUrl}/tree/main/color-system/schemes`,
      schemeUrl: `${repositoryUrl}/tree/main/color-system/schemes`,
      flavorLinks,
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
