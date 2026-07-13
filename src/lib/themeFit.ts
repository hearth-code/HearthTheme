import fs from 'node:fs'
import path from 'node:path'

import { productData } from '../data/product'

export type FitThemeId = string

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
  themeId: FitThemeId
  schemeId: string
  variantId: string
  label: string
  summary: string
  surface: string
  foreground: string
  accent: string
  uiTheme: 'vs' | 'vs-dark'
  isDefault: boolean
  swatches: ThemePaletteSwatch[]
}

const fullThemeCatalog = productData.extension.themeCatalog.map((theme) => {
  const flavor = productData.flavors.find((entry) => entry.id === theme.schemeId)
  const publicTheme = productData.themes.find(
    (entry) => entry.schemeId === theme.schemeId && entry.variantId === theme.variantId,
  )
  const id = `${theme.schemeId}-${theme.variantId}`
  return {
    id,
    schemeId: theme.schemeId,
    variantId: theme.variantId,
    label: theme.label,
    summary: publicTheme?.summary || theme.label,
    uiTheme: theme.uiTheme,
    path: theme.path,
    isDefault:
      Boolean(flavor?.isDefault) &&
      String(flavor?.defaultVariant || '') === String(theme.variantId || ''),
  }
})

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

function getThemePalette(themePath: string): Omit<ThemePaletteTheme, 'themeId' | 'schemeId' | 'variantId' | 'label' | 'summary' | 'uiTheme' | 'isDefault'> {
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

export function getDefaultThemeSelection(): { themeId: FitThemeId } {
  const theme = fullThemeCatalog.find((item) => item.isDefault) || fullThemeCatalog[0]

  return {
    themeId: theme.id as FitThemeId,
  }
}

export const themePaletteCatalog: ThemePaletteTheme[] = fullThemeCatalog.map((theme) => ({
  themeId: theme.id as FitThemeId,
  schemeId: theme.schemeId,
  variantId: theme.variantId,
  label: theme.label,
  summary: theme.summary,
  uiTheme: theme.uiTheme,
  isDefault: Boolean(theme.isDefault),
  ...getThemePalette(theme.path),
}))
