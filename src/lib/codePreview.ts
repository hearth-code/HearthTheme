import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { createHighlighter, type Highlighter, type ThemeRegistrationRaw } from "shiki"

import { productData } from "../data/product"
import {
  previewSampleFiles,
  type PreviewFileKey,
} from "./codePreviewSamples"

export type PreviewThemeId = string

type PreviewTheme = {
  name: string
  type: 'dark' | 'light'
  colors: Record<string, string>
  tokenColors: Array<{
    scope?: string | string[]
    settings?: { foreground?: string }
  }>
  semanticTokenColors?: Record<
    string,
    string | { foreground?: string; fontStyle?: string }
  >
}

const fullPreviewThemeCatalog = productData.extension.themeCatalog.map((theme) => {
  const flavor = productData.flavors.find((entry) => entry.id === theme.schemeId)
  const publicTheme = productData.themes.find(
    (entry) => entry.schemeId === theme.schemeId && entry.variantId === theme.variantId,
  )
  return {
    id: `${theme.schemeId}-${theme.variantId}`,
    schemeId: theme.schemeId,
    variantId: theme.variantId,
    label: theme.label,
    tabLabel: theme.tabLabel || theme.label,
    summary: publicTheme?.summary || theme.label,
    uiTheme: theme.uiTheme,
    path: theme.path,
    isDefaultTheme:
      Boolean(flavor?.isDefault) &&
      String(flavor?.defaultVariant || '') === String(theme.variantId || ''),
  }
})

type PreviewThemeCatalogEntry = (typeof fullPreviewThemeCatalog)[number]

type PreviewThemeMap = Record<PreviewThemeId, PreviewTheme>

export type PreviewThemeState = {
  label: string
  panelBg: string
  stripBg: string
  stripColor: string
  stripBorder: string
  toolbarBg: string
  toolbarBorder: string
  tabColor: string
  tabHoverColor: string
  tabActiveColor: string
  switchColor: string
  switchHoverColor: string
  switchActiveColor: string
  editorFg: string
  gutterColor: string
  gutterActiveColor: string
  lineHighlightBg: string
  paper: boolean
}

export type PreviewRenderMap = Record<PreviewFileKey, Record<PreviewThemeId, string>>

export const DEFAULT_PREVIEW_FILE: PreviewFileKey = 'ts'
export const DEFAULT_PREVIEW_THEME_ID = (
  fullPreviewThemeCatalog.find((theme) => theme.isDefaultTheme)?.id ||
  fullPreviewThemeCatalog[0]?.id
) as PreviewThemeId

export const previewTabs = [
  { key: 'ts', label: 'index.ts' },
  { key: 'py', label: 'main.py' },
  { key: 'go', label: 'server.go' },
  { key: 'rs', label: 'main.rs' },
  { key: 'java', label: 'App.java' },
  { key: 'bash', label: 'build.sh' },
] as const

export const previewThemeTabs = fullPreviewThemeCatalog.map((theme) => ({
  key: theme.id as PreviewThemeId,
  label: theme.tabLabel || theme.label,
  description: theme.summary,
}))

const previewThemeIds = previewThemeTabs.map((tab) => tab.key)

function getThemeMeta(themeId: PreviewThemeId): PreviewThemeCatalogEntry {
  const meta = fullPreviewThemeCatalog.find((entry) => entry.id === themeId)
  if (!meta) {
    throw new Error(`CodePreview: missing theme metadata for "${themeId}"`)
  }
  return meta
}

function loadTheme(themeId: PreviewThemeId): PreviewTheme {
  const meta = getThemeMeta(themeId)
  const themePath = resolve(process.cwd(), String(meta.path).replace(/^\.\//, ''))
  const raw = JSON.parse(readFileSync(themePath, 'utf8'))
  return {
    ...raw,
    name: meta.label,
    type: meta.uiTheme === 'vs' ? 'light' : 'dark',
  } as PreviewTheme
}

function getTokenColor(theme: PreviewTheme, scopes: string[]): string | null {
  let bestColor: string | null = null
  let bestRatio = -1
  let bestCount = -1
  let bestScopeLength = Number.POSITIVE_INFINITY

  for (const entry of theme.tokenColors || []) {
    const entryScopes = (Array.isArray(entry.scope) ? entry.scope : [entry.scope]).map((scope) => String(scope || ''))
    const matchCount = entryScopes.filter((scope) => scopes.includes(scope)).length
    if (matchCount === 0) continue
    if (!entry.settings?.foreground) continue

    const ratio = matchCount / entryScopes.length
    const isBetter =
      ratio > bestRatio ||
      (ratio === bestRatio && matchCount > bestCount) ||
      (ratio === bestRatio && matchCount === bestCount && entryScopes.length < bestScopeLength)

    if (!isBetter) continue

    bestColor = entry.settings.foreground
    bestRatio = ratio
    bestCount = matchCount
    bestScopeLength = entryScopes.length
  }

  return bestColor
}

function requireThemeColor(value: string | undefined, key: string): string {
  if (!value) {
    throw new Error(`CodePreview: missing required theme color "${key}"`)
  }
  return value
}

function getPanelPalette(theme: PreviewTheme) {
  const bg = requireThemeColor(theme.colors?.['editor.background'], 'editor.background')
  const fg = requireThemeColor(theme.colors?.['editor.foreground'], 'editor.foreground')
  const sidebar = theme.colors?.['sideBar.background'] || bg
  const comment =
    getTokenColor(theme, ['comment']) ||
    fg ||
    theme.colors?.['editorLineNumber.foreground'] ||
    sidebar
  const variable =
    getTokenColor(theme, ['variable', 'variable.other.readwrite']) ||
    fg ||
    comment
  return { bg, fg, sidebar, comment, variable }
}

function buildPreviewThemeState(theme: PreviewTheme): PreviewThemeState {
  const palette = getPanelPalette(theme)
  const isLight = theme.type === 'light'
  return {
    label: theme.name,
    panelBg: palette.bg,
    stripBg: palette.sidebar,
    stripColor: palette.comment,
    stripBorder: isLight
      ? 'var(--hearth-preview-strip-border-light)'
      : 'var(--hearth-preview-strip-border-dark)',
    toolbarBg: palette.sidebar,
    toolbarBorder: isLight
      ? 'var(--hearth-preview-strip-border-light)'
      : 'var(--hearth-preview-strip-border-dark)',
    tabColor: palette.comment,
    tabHoverColor: palette.variable,
    tabActiveColor: isLight ? palette.variable : palette.fg,
    switchColor: palette.comment,
    switchHoverColor: palette.variable,
    switchActiveColor: isLight ? palette.variable : palette.fg,
    editorFg: palette.fg,
    gutterColor:
      theme.colors?.['editorLineNumber.foreground'] ||
      palette.comment,
    gutterActiveColor:
      theme.colors?.['editorLineNumber.activeForeground'] ||
      palette.fg,
    lineHighlightBg:
      theme.colors?.['editor.lineHighlightBackground'] ||
      (isLight ? '#ece4da' : '#2b2723'),
    paper: isLight,
  }
}

const previewThemes = Object.fromEntries(
  previewThemeIds.map((themeId) => [themeId, loadTheme(themeId)]),
) as PreviewThemeMap

export const previewThemeStateById = Object.fromEntries(
  previewThemeIds.map((themeId) => [themeId, buildPreviewThemeState(previewThemes[themeId])]),
) as Record<PreviewThemeId, PreviewThemeState>

const previewLangMap: Record<PreviewFileKey, string> = {
  ts: 'typescript',
  py: 'python',
  go: 'go',
  rs: 'rust',
  java: 'java',
  bash: 'bash',
}

export function getPreviewRootStyle(themeId: PreviewThemeId = DEFAULT_PREVIEW_THEME_ID) {
  const initial =
    previewThemeStateById[themeId] ||
    previewThemeStateById[DEFAULT_PREVIEW_THEME_ID]
  return [
    `--preview-toolbar-bg: ${initial.toolbarBg}`,
    `--preview-toolbar-border: ${initial.toolbarBorder}`,
    `--preview-tab-color: ${initial.tabColor}`,
    `--preview-tab-hover-color: ${initial.tabHoverColor}`,
    `--preview-tab-active-color: ${initial.tabActiveColor}`,
    `--preview-switch-color: ${initial.switchColor}`,
    `--preview-switch-hover-color: ${initial.switchHoverColor}`,
    `--preview-switch-active-color: ${initial.switchActiveColor}`,
    `--preview-panel-bg: ${initial.panelBg}`,
    `--preview-strip-bg: ${initial.stripBg}`,
    `--preview-strip-color: ${initial.stripColor}`,
    `--preview-strip-border-color: ${initial.stripBorder}`,
    `--preview-editor-fg: ${initial.editorFg}`,
    `--preview-gutter-color: ${initial.gutterColor}`,
    `--preview-gutter-active-color: ${initial.gutterActiveColor}`,
    `--preview-line-highlight-bg: ${initial.lineHighlightBg}`,
  ].join('; ')
}

function escapeHtml(value: string): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

// The sample text is the source of truth; the hand-annotated roles that used to
// drive coloring are gone — Shiki tokenizes the reconstructed source with the
// real TextMate grammar, so token boundaries (punctuation, brackets, operators,
// member access) match what the editor actually produces.
function getSampleSource(fileKey: PreviewFileKey): string {
  return previewSampleFiles[fileKey].lines
    .map((segments) => segments.map((segment) => segment.text).join(''))
    .join('\n')
}

// Shiki loads only the six sample languages and the four shipped themes (keyed
// by preview theme id). Grammar tokenization only — VS Code's LSP-driven
// semantic layer isn't reproduced here, which matches a real editor with
// semantic highlighting off.
const SHIKI_FONT_ITALIC = 1
const SHIKI_FONT_BOLD = 2
const SHIKI_FONT_UNDERLINE = 4

let highlighterPromise: Promise<Highlighter> | null = null

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: previewThemeIds.map((themeId) => ({
        ...(previewThemes[themeId] as unknown as ThemeRegistrationRaw),
        name: themeId,
      })),
      langs: Object.values(previewLangMap),
    })
  }
  return highlighterPromise
}

export async function renderPreviewState(
  fileKey: PreviewFileKey,
  themeId: PreviewThemeId,
) {
  const theme = previewThemes[themeId]
  const editorFg = requireThemeColor(theme.colors?.['editor.foreground'], 'editor.foreground')
  const highlighter = await getHighlighter()

  const { tokens } = highlighter.codeToTokens(getSampleSource(fileKey), {
    lang: previewLangMap[fileKey],
    theme: themeId,
  })

  const lines = tokens
    .map((lineTokens, index) => {
      const code = lineTokens
        .map((token) => {
          if (!token.content) return ''
          const declarations = [`color: ${token.color || editorFg}`]
          const fontStyle = token.fontStyle ?? 0
          if (fontStyle & SHIKI_FONT_ITALIC) declarations.push('font-style: italic')
          if (fontStyle & SHIKI_FONT_BOLD) declarations.push('font-weight: 700')
          if (fontStyle & SHIKI_FONT_UNDERLINE) declarations.push('text-decoration: underline')
          return `<span class="hearth-preview-segment" style="${declarations.join('; ')}">${escapeHtml(token.content)}</span>`
        })
        .join('')

      return [
        `<div class="hearth-preview-line">`,
        `<span class="hearth-preview-gutter">${index + 1}</span>`,
        `<span class="hearth-preview-linecode">${code || '&nbsp;'}</span>`,
        `</div>`,
      ].join('')
    })
    .join('')

  return `<div class="hearth-preview-code" data-language="${previewLangMap[fileKey]}">${lines}</div>`
}

export async function buildPreviewRenderMap(): Promise<PreviewRenderMap> {
  const rendered = {} as PreviewRenderMap

  for (const fileKey of Object.keys(previewSampleFiles) as PreviewFileKey[]) {
    const themeRendered = {} as Record<PreviewThemeId, string>

    for (const themeId of previewThemeIds) {
      themeRendered[themeId] = await renderPreviewState(fileKey, themeId)
    }

    rendered[fileKey] = themeRendered
  }

  return rendered
}
