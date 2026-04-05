import fs from 'node:fs'
import path from 'node:path'

import { productData } from '../data/product'

export type FitFlavorId = (typeof productData.flavors)[number]['id']
export type FitClimateId = 'dark' | 'darkSoft' | 'light' | 'lightSoft'

type ThemeTokenValue =
  | string
  | {
      foreground?: string
    }

type ThemeJson = {
  colors?: Record<string, string>
  semanticTokenColors?: Record<string, ThemeTokenValue>
}

export type ThemePaletteSwatchId = 'surface' | 'keyword' | 'function' | 'property' | 'type'

export type ThemePaletteSwatch = {
  id: ThemePaletteSwatchId
  color: string
}

export type ThemePaletteTheme = {
  climateId: FitClimateId
  climateLabel: string
  label: string
  surface: string
  foreground: string
  accent: string
  swatches: ThemePaletteSwatch[]
}

export type ThemePaletteFlavor = {
  flavorId: FitFlavorId
  name: string
  summary: string
  isPublished: boolean
  isDefault: boolean
  isActive: boolean
  defaultClimateId: FitClimateId
  themes: ThemePaletteTheme[]
}

export const climateOrder = ['dark', 'darkSoft', 'light', 'lightSoft'] as const

function getThemeAbsolutePath(themePath: string): string {
  return path.resolve(process.cwd(), themePath.replace(/^\.\//, ''))
}

function readThemeJson(themePath: string): ThemeJson {
  const filePath = getThemeAbsolutePath(themePath)
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ThemeJson
}

function getTokenForeground(value: ThemeTokenValue | undefined, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value
  if (value && typeof value === 'object' && typeof value.foreground === 'string' && value.foreground.trim()) {
    return value.foreground
  }
  return fallback
}

function getThemePalette(themePath: string): Omit<ThemePaletteTheme, 'climateId' | 'climateLabel' | 'label'> {
  const theme = readThemeJson(themePath)
  const colors = theme.colors || {}
  const semantic = theme.semanticTokenColors || {}

  const surface = colors['editor.background'] || '#1f1f1f'
  const foreground = colors['editor.foreground'] || '#d0d0d0'
  const accent =
    colors['editorCursor.foreground'] ||
    colors['button.background'] ||
    colors['focusBorder'] ||
    foreground

  return {
    surface,
    foreground,
    accent,
    swatches: [
      {
        id: 'surface',
        color: surface,
      },
      {
        id: 'keyword',
        color: getTokenForeground(semantic.keyword, colors['editorCursor.foreground'] || foreground),
      },
      {
        id: 'function',
        color: getTokenForeground(semantic.function, colors['editorInfo.foreground'] || foreground),
      },
      {
        id: 'property',
        color: getTokenForeground(semantic.property, colors['terminal.ansiGreen'] || foreground),
      },
      {
        id: 'type',
        color: getTokenForeground(semantic.type, colors['terminal.ansiYellow'] || foreground),
      },
    ],
  }
}

function getThemeMeta(flavorId: FitFlavorId, climateId: FitClimateId) {
  return productData.extension.themeCatalog.find(
    (entry) => entry.schemeId === flavorId && entry.variantId === climateId,
  )
}

export function getDefaultThemeSelection(): { flavorId: FitFlavorId; climateId: FitClimateId } {
  const flavor =
    productData.flavors.find((item) => item.isActive) ||
    productData.flavors.find((item) => item.isDefault) ||
    productData.flavors[0]

  return {
    flavorId: flavor.id as FitFlavorId,
    climateId: flavor.defaultVariant as FitClimateId,
  }
}

export const themePaletteCatalog: ThemePaletteFlavor[] = productData.flavors.map((flavor) => ({
  flavorId: flavor.id as FitFlavorId,
  name: flavor.shortName || flavor.name,
  summary: flavor.summary,
  isPublished: flavor.isPublished,
  isDefault: flavor.isDefault,
  isActive: flavor.isActive,
  defaultClimateId: flavor.defaultVariant as FitClimateId,
  themes: climateOrder
    .map((climateId) => {
      const meta = getThemeMeta(flavor.id as FitFlavorId, climateId)
      if (!meta) return null
      return {
        climateId,
        climateLabel: meta.climateLabel,
        label: meta.label,
        ...getThemePalette(meta.path),
      }
    })
    .filter((theme): theme is ThemePaletteTheme => Boolean(theme)),
}))
