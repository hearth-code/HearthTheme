import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { productData } from "../data/product"
import {
  previewSampleFiles,
  type PreviewFileKey,
  type PreviewSampleFile,
  type PreviewSegment,
  type PreviewSegmentRole,
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

type PreviewStyle = {
  color: string
  fontStyle: string
}

type PreviewRoleAdapter = {
  id: string
  scopes?: string[]
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

const previewRoleScopesById = (() => {
  const adaptersPath = resolve(process.cwd(), 'color-system/framework/adapters.json')
  const raw = JSON.parse(readFileSync(adaptersPath, 'utf8')) as { roles?: PreviewRoleAdapter[] }
  return Object.fromEntries(
    (raw.roles || []).map((role) => [role.id, Array.isArray(role.scopes) ? role.scopes : []]),
  ) as Record<string, string[]>
})()

function getRoleScopes(roleId: string, fallback: string[] = []): string[] {
  return previewRoleScopesById[roleId] || fallback
}

function normalizeHex(hex: string | undefined): string | null {
  const value = String(hex || '').trim()
  if (/^#[0-9a-f]{6}$/i.test(value)) return value
  if (/^#[0-9a-f]{8}$/i.test(value)) return value.slice(0, 7)
  return null
}

function normalizeStyleEntry(
  entry: string | { foreground?: string; fontStyle?: string } | undefined,
  fallbackColor: string,
  fallbackFontStyle = '',
): PreviewStyle {
  if (typeof entry === 'string') {
    return {
      color: normalizeHex(entry) || fallbackColor,
      fontStyle: fallbackFontStyle,
    }
  }

  if (!entry || typeof entry !== 'object') {
    return {
      color: fallbackColor,
      fontStyle: fallbackFontStyle,
    }
  }

  return {
    color: normalizeHex(entry.foreground) || fallbackColor,
    fontStyle: typeof entry.fontStyle === 'string' ? entry.fontStyle : fallbackFontStyle,
  }
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

function getTokenStyle(
  theme: PreviewTheme,
  scopes: string[],
  fallbackColor: string,
  fallbackFontStyle = '',
): PreviewStyle {
  let bestEntry: PreviewTheme['tokenColors'][number] | null = null
  let bestRatio = -1
  let bestCount = -1
  let bestScopeLength = Number.POSITIVE_INFINITY

  for (const entry of theme.tokenColors || []) {
    const entryScopes = (Array.isArray(entry.scope) ? entry.scope : [entry.scope]).map((scope) => String(scope || ''))
    const matchCount = entryScopes.filter((scope) => scopes.includes(scope)).length
    if (matchCount === 0) continue

    const ratio = matchCount / entryScopes.length
    const isBetter =
      ratio > bestRatio ||
      (ratio === bestRatio && matchCount > bestCount) ||
      (ratio === bestRatio && matchCount === bestCount && entryScopes.length < bestScopeLength)

    if (!isBetter) continue

    bestEntry = entry
    bestRatio = ratio
    bestCount = matchCount
    bestScopeLength = entryScopes.length
  }

  return bestEntry
    ? normalizeStyleEntry(bestEntry.settings, fallbackColor, fallbackFontStyle)
    : {
        color: fallbackColor,
        fontStyle: fallbackFontStyle,
      }
}

function getSemanticStyle(
  theme: PreviewTheme,
  key: string,
  fallbackColor: string,
  fallbackFontStyle = '',
): PreviewStyle {
  return normalizeStyleEntry(theme.semanticTokenColors?.[key], fallbackColor, fallbackFontStyle)
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

function defaultEditorStyle(theme: PreviewTheme): PreviewStyle {
  return {
    color: requireThemeColor(theme.colors?.['editor.foreground'], 'editor.foreground'),
    fontStyle: '',
  }
}

function resolvePreviewStyle(theme: PreviewTheme, role: PreviewSegmentRole = 'plain'): PreviewStyle {
  const editorStyle = defaultEditorStyle(theme)

  switch (role) {
    case 'comment':
      return getTokenStyle(
        theme,
        ['comment', 'punctuation.definition.comment'],
        editorStyle.color,
        'italic',
      )
    case 'decorator': {
      const fallback = getTokenStyle(theme, ['meta.annotation', 'entity.name.function.decorator'], editorStyle.color, 'italic')
      return getSemanticStyle(theme, 'decorator', fallback.color, fallback.fontStyle)
    }
    case 'keyword': {
      const fallback = getTokenStyle(
        theme,
        ['keyword', 'storage.type', 'storage.modifier', 'keyword.control'],
        editorStyle.color,
        'bold',
      )
      return getSemanticStyle(theme, 'keyword', fallback.color, fallback.fontStyle)
    }
    case 'operator':
      return getTokenStyle(theme, ['keyword.operator', 'keyword.operator.assignment'], editorStyle.color)
    case 'namespace': {
      const fallback = getTokenStyle(theme, ['entity.name.namespace', 'support.module'], editorStyle.color)
      return getSemanticStyle(theme, 'namespace', fallback.color, fallback.fontStyle)
    }
    case 'type': {
      const fallback = getTokenStyle(
        theme,
        [
          'entity.name.type',
          'entity.name.class',
          'storage.type.java',
          'storage.type.primitive.java',
          'entity.name.struct.rust',
          'entity.name.type.class',
          'support.type',
          'support.type.builtin',
          'support.class',
        ],
        editorStyle.color,
        'italic',
      )
      return getSemanticStyle(theme, 'type', fallback.color, fallback.fontStyle)
    }
    case 'function': {
      const fallback = getTokenStyle(
        theme,
        getRoleScopes('function', ['entity.name.function', 'support.function', 'meta.function-call.generic']),
        editorStyle.color,
      )
      return getSemanticStyle(theme, 'function', fallback.color, fallback.fontStyle)
    }
    case 'method': {
      const fallback = getTokenStyle(
        theme,
        getRoleScopes('method', ['meta.method-call entity.name.function']),
        editorStyle.color,
      )
      return getSemanticStyle(theme, 'method', fallback.color, fallback.fontStyle)
    }
    case 'function.defaultLibrary': {
      const fallback = resolvePreviewStyle(theme, 'function')
      return getSemanticStyle(theme, 'function.defaultLibrary', fallback.color, fallback.fontStyle)
    }
    case 'method.defaultLibrary': {
      const fallback = resolvePreviewStyle(theme, 'method')
      return getSemanticStyle(theme, 'method.defaultLibrary', fallback.color, fallback.fontStyle)
    }
    case 'variable': {
      const fallback = getTokenStyle(
        theme,
        ['variable', 'variable.other.readwrite', 'variable.other.constant'],
        editorStyle.color,
      )
      return getSemanticStyle(theme, 'variable', fallback.color, fallback.fontStyle)
    }
    case 'variable.readonly': {
      const fallback = resolvePreviewStyle(theme, 'variable')
      return getSemanticStyle(theme, 'variable.readonly', fallback.color, fallback.fontStyle)
    }
    case 'parameter': {
      const fallback = resolvePreviewStyle(theme, 'variable')
      return getSemanticStyle(theme, 'parameter', fallback.color, fallback.fontStyle)
    }
    case 'property': {
      const fallback = getTokenStyle(
        theme,
        [...getRoleScopes('property', ['variable.other.property', 'variable.other.member', 'meta.property-name', 'support.type.property-name']), 'meta.object-literal.key'],
        editorStyle.color,
      )
      return getSemanticStyle(theme, 'property', fallback.color, fallback.fontStyle)
    }
    case 'string':
      return getTokenStyle(theme, ['string', 'string.quoted', 'string.template', 'string.regexp'], editorStyle.color)
    case 'number':
      return getTokenStyle(
        theme,
        ['constant.numeric', 'constant.language.boolean', 'constant.language.null', 'constant.language.undefined'],
        editorStyle.color,
      )
    case 'plain':
    default:
      return editorStyle
  }
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

function renderSegment(theme: PreviewTheme, segment: PreviewSegment): string {
  const style = resolvePreviewStyle(theme, segment.role || 'plain')
  const declarations = [`color: ${style.color}`]
  if (style.fontStyle.includes('italic')) declarations.push('font-style: italic')
  if (style.fontStyle.includes('bold')) declarations.push('font-weight: 700')
  return `<span class="hearth-preview-segment" style="${declarations.join('; ')}">${escapeHtml(segment.text)}</span>`
}

function renderLine(
  theme: PreviewTheme,
  segments: PreviewSegment[],
  index: number,
): string {
  const code = segments.length
    ? segments.map((segment) => renderSegment(theme, segment)).join('')
    : '&nbsp;'

  return [
    `<div class="hearth-preview-line">`,
    `<span class="hearth-preview-gutter">${index + 1}</span>`,
    `<span class="hearth-preview-linecode">${code}</span>`,
    `</div>`,
  ].join('')
}

export async function renderPreviewState(
  fileKey: PreviewFileKey,
  themeId: PreviewThemeId,
) {
  const file = previewSampleFiles[fileKey]
  const theme = previewThemes[themeId]

  const lines = file.lines.map((segments, index) => renderLine(theme, segments, index)).join('')

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
