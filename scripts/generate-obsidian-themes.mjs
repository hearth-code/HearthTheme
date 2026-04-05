import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { pathToFileURL } from 'url'
import { buildColorLanguageModel } from './color-system/build.mjs'
import { buildGeneratedPlatformTokenMaps } from './color-system/artifacts.mjs'
import { getObsidianThemeOutputFiles, getThemeOutputFiles, loadColorProductPreviewConfig, loadColorSystemVariants } from './color-system.mjs'

const COLOR_LANGUAGE_MODEL = buildColorLanguageModel()
export const THEME_FILES = getThemeOutputFiles()
export const OBSIDIAN_THEME_FILES = getObsidianThemeOutputFiles()
const PREVIEW = loadColorProductPreviewConfig()
const VARIANTS = loadColorSystemVariants().variants

export const VARIANT_META = Object.fromEntries(
  VARIANTS.map((variant) => [
    variant.id,
    {
      label: `${PREVIEW.variantNames[variant.id]} (Obsidian)`,
      cssFile: String(OBSIDIAN_THEME_FILES[variant.id] || '').split('/').pop(),
      modeClass: variant.type === 'dark' ? '.theme-dark' : '.theme-light',
    },
  ])
)

const OUTPUT_DIR = 'obsidian/themes'

export function writeIfChanged(path, content) {
  if (existsSync(path)) {
    const prev = readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
    const next = content.replace(/\r\n/g, '\n')
    if (prev === next) return false
  }
  writeFileSync(path, content)
  return true
}

function normalizeHex(hex) {
  if (typeof hex !== 'string') return null
  const value = hex.trim().toLowerCase()
  if (/^#[0-9a-f]{3}$/.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
  }
  if (/^#[0-9a-f]{6}$/.test(value)) return value
  if (/^#[0-9a-f]{8}$/.test(value)) return value.slice(0, 7)
  return null
}

function hexToRgb(hex) {
  const normalized = normalizeHex(hex)
  if (!normalized) throw new Error(`Invalid hex: ${hex}`)
  const raw = normalized.slice(1)
  return [
    Number.parseInt(raw.slice(0, 2), 16),
    Number.parseInt(raw.slice(2, 4), 16),
    Number.parseInt(raw.slice(4, 6), 16),
  ]
}

function toHexByte(value) {
  return Math.round(Math.min(Math.max(value, 0), 255)).toString(16).padStart(2, '0')
}

function rgbToHex([r, g, b]) {
  return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`
}

function mixHex(a, b, t) {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  const ratio = Math.min(Math.max(t, 0), 1)
  return rgbToHex([
    ar + (br - ar) * ratio,
    ag + (bg - ag) * ratio,
    ab + (bb - ab) * ratio,
  ])
}

function alpha(hex, value) {
  const [r, g, b] = hexToRgb(hex)
  const v = Number(value).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  return `rgb(${r} ${g} ${b} / ${v})`
}

function srgbToLinear(channel) {
  const normalized = channel / 255
  if (normalized <= 0.04045) return normalized / 12.92
  return ((normalized + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex)
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}

function pickContrastText(backgroundHex) {
  const darkText = '#1b1712'
  const lightText = '#f5eee4'
  return relativeLuminance(backgroundHex) > 0.34 ? darkText : lightText
}

function assertTokenSet(id, tokenSet) {
  for (const [key, value] of Object.entries(tokenSet)) {
    if (!value) {
      throw new Error(`Missing required token \"${id}.${key}\" while generating Obsidian themes.`)
    }
  }
}

function buildVars(tokens, platformVars = {}) {
  const accent = tokens.cursor
  const accentHover = mixHex(accent, tokens.fg, 0.18)
  const accentSoft = alpha(accent, 0.18)
  const bgSecondary = platformVars['--background-secondary'] ?? mixHex(tokens.sidebar, tokens.bg, 0.5)
  const bgSecondaryAlt = platformVars['--background-secondary-alt'] ?? mixHex(tokens.lineBg, tokens.bg, 0.4)
  const borderHover = alpha(tokens.border, 0.48)
  const borderFocus = platformVars['--background-modifier-border-focus'] ?? alpha(accent, 0.46)
  const codeBackground = alpha(mixHex(tokens.border, tokens.bg, 0.45), 0.38)
  const linkUnresolved = mixHex(tokens.comment, tokens.keyword, 0.22)
  const feedbackNote = platformVars['--hearth-feedback-note'] ?? tokens.property
  const feedbackInfo = platformVars['--hearth-feedback-info'] ?? tokens.fn
  const feedbackSuccess = platformVars['--text-success'] ?? tokens.string
  const feedbackWarning = platformVars['--text-warning'] ?? tokens.number
  const feedbackError = platformVars['--text-error'] ?? tokens.keyword
  const guide = platformVars['--hearth-guide'] ?? tokens.guide
  const guideActive = platformVars['--hearth-guide-active'] ?? tokens.guideActive
  const guideInk = platformVars['--hearth-guide-ink'] ?? tokens.guideInk
  const whitespace = platformVars['--hearth-whitespace'] ?? tokens.whitespace
  const bracketWarm = platformVars['--hearth-bracket-warm'] ?? tokens.bracketWarm
  const bracketBright = platformVars['--hearth-bracket-bright'] ?? tokens.bracketBright
  const bracketCool = platformVars['--hearth-bracket-cool'] ?? tokens.bracketCool
  const bracketMatchFill = platformVars['--hearth-bracket-match-fill'] ?? tokens.bracketMatchFill
  const bracketMatchStroke = platformVars['--hearth-bracket-match-stroke'] ?? tokens.bracketMatchStroke
  const shellBand = platformVars['--hearth-shell-band'] ?? tokens.shellBand
  const accentHoverFill = platformVars['--hearth-accent-hover'] ?? tokens.accentHover
  const onStatusInk = platformVars['--hearth-on-status'] ?? tokens.onStatus
  const navActiveInk = platformVars['--hearth-nav-active-ink'] ?? tokens.navActiveInk
  const terminalBlack = platformVars['--hearth-terminal-black'] ?? tokens.terminalBlack
  const terminalRed = platformVars['--hearth-terminal-red'] ?? tokens.terminalRed
  const terminalGreen = platformVars['--hearth-terminal-green'] ?? tokens.terminalGreen
  const terminalYellow = platformVars['--hearth-terminal-yellow'] ?? tokens.terminalYellow
  const terminalBlue = platformVars['--hearth-terminal-blue'] ?? tokens.terminalBlue
  const terminalMagenta = platformVars['--hearth-terminal-magenta'] ?? tokens.terminalMagenta
  const terminalCyan = platformVars['--hearth-terminal-cyan'] ?? tokens.terminalCyan
  const terminalWhite = platformVars['--hearth-terminal-white'] ?? tokens.terminalWhite
  const terminalBrightBlack = platformVars['--hearth-terminal-bright-black'] ?? tokens.terminalBrightBlack
  const terminalBrightRed = platformVars['--hearth-terminal-bright-red'] ?? tokens.terminalBrightRed
  const terminalBrightGreen = platformVars['--hearth-terminal-bright-green'] ?? tokens.terminalBrightGreen
  const terminalBrightYellow = platformVars['--hearth-terminal-bright-yellow'] ?? tokens.terminalBrightYellow
  const terminalBrightBlue = platformVars['--hearth-terminal-bright-blue'] ?? tokens.terminalBrightBlue
  const terminalBrightMagenta = platformVars['--hearth-terminal-bright-magenta'] ?? tokens.terminalBrightMagenta
  const terminalBrightCyan = platformVars['--hearth-terminal-bright-cyan'] ?? tokens.terminalBrightCyan
  const terminalBrightWhite = platformVars['--hearth-terminal-bright-white'] ?? tokens.terminalBrightWhite
  const h1 = tokens.keyword
  const h2 = tokens.fn
  const h3 = tokens.property
  const h4 = tokens.string
  const h5 = tokens.number
  const h6 = mixHex(tokens.comment, tokens.fg, 0.4)
  const calloutNote = feedbackNote
  const calloutTip = feedbackSuccess
  const calloutWarning = feedbackWarning
  const calloutDanger = feedbackError

  return {
    '--background-primary': platformVars['--background-primary'] ?? tokens.bg,
    '--background-primary-alt': platformVars['--background-primary-alt'] ?? tokens.lineBg,
    '--background-secondary': bgSecondary,
    '--background-secondary-alt': bgSecondaryAlt,
    '--background-modifier-border': platformVars['--background-modifier-border'] ?? alpha(tokens.border, 0.72),
    '--background-modifier-border-hover': borderHover,
    '--background-modifier-border-focus': borderFocus,
    '--background-modifier-form-field': alpha(tokens.border, 0.22),
    '--background-modifier-hover': platformVars['--background-modifier-hover'] ?? platformVars['--interactive-hover'] ?? alpha(tokens.border, 0.28),
    '--background-modifier-active-hover': platformVars['--background-modifier-active-hover'] ?? alpha(accent, 0.26),
    '--background-modifier-box-shadow': alpha(tokens.bg, 0.6),
    '--background-modifier-success': alpha(tokens.string, 0.24),
    '--background-modifier-error': alpha(tokens.keyword, 0.2),
    '--background-modifier-error-hover': alpha(tokens.keyword, 0.3),
    '--background-modifier-message': accentSoft,
    '--background-modifier-cover': alpha(tokens.bg, 0.72),
    '--text-normal': platformVars['--text-normal'] ?? tokens.fg,
    '--text-muted': platformVars['--text-muted'] ?? mixHex(tokens.comment, tokens.fg, 0.36),
    '--text-faint': platformVars['--text-faint'] ?? mixHex(tokens.comment, tokens.bg, 0.28),
    '--text-accent': accent,
    '--text-accent-hover': accentHover,
    '--text-on-accent': platformVars['--text-on-accent'] ?? pickContrastText(accent),
    '--text-success': feedbackSuccess,
    '--text-warning': feedbackWarning,
    '--text-error': feedbackError,
    '--hearth-feedback-note': feedbackNote,
    '--hearth-feedback-info': feedbackInfo,
    '--hearth-guide': guide,
    '--hearth-guide-active': guideActive,
    '--hearth-guide-ink': guideInk,
    '--hearth-whitespace': whitespace,
    '--hearth-bracket-warm': bracketWarm,
    '--hearth-bracket-bright': bracketBright,
    '--hearth-bracket-cool': bracketCool,
    '--hearth-bracket-match-fill': bracketMatchFill,
    '--hearth-bracket-match-stroke': bracketMatchStroke,
    '--hearth-shell-band': shellBand,
    '--hearth-accent-hover': accentHoverFill,
    '--hearth-on-status': onStatusInk,
    '--hearth-nav-active-ink': navActiveInk,
    '--hearth-terminal-black': terminalBlack,
    '--hearth-terminal-red': terminalRed,
    '--hearth-terminal-green': terminalGreen,
    '--hearth-terminal-yellow': terminalYellow,
    '--hearth-terminal-blue': terminalBlue,
    '--hearth-terminal-magenta': terminalMagenta,
    '--hearth-terminal-cyan': terminalCyan,
    '--hearth-terminal-white': terminalWhite,
    '--hearth-terminal-bright-black': terminalBrightBlack,
    '--hearth-terminal-bright-red': terminalBrightRed,
    '--hearth-terminal-bright-green': terminalBrightGreen,
    '--hearth-terminal-bright-yellow': terminalBrightYellow,
    '--hearth-terminal-bright-blue': terminalBrightBlue,
    '--hearth-terminal-bright-magenta': terminalBrightMagenta,
    '--hearth-terminal-bright-cyan': terminalBrightCyan,
    '--hearth-terminal-bright-white': terminalBrightWhite,
    '--text-highlight-bg': alpha(tokens.selection, 0.34),
    '--text-selection': platformVars['--text-selection'] ?? alpha(tokens.selection, 0.42),
    '--interactive-normal': alpha(tokens.border, 0.2),
    '--interactive-hover': platformVars['--interactive-hover'] ?? alpha(tokens.border, 0.3),
    '--interactive-accent': platformVars['--interactive-accent'] ?? accent,
    '--interactive-accent-hover': accentHover,
    '--scrollbar-bg': alpha(tokens.bg, 0.24),
    '--scrollbar-thumb-bg': alpha(tokens.border, 0.5),
    '--scrollbar-active-thumb-bg': alpha(tokens.border, 0.72),
    '--link-color': accent,
    '--link-color-hover': accentHover,
    '--link-unresolved-color': linkUnresolved,
    '--code-background': codeBackground,
    '--blockquote-border-color': alpha(tokens.property, 0.46),
    '--blockquote-color': mixHex(tokens.comment, tokens.fg, 0.42),
    '--hr-color': alpha(tokens.border, 0.7),
    '--tag-color': tokens.type,
    '--tag-color-hover': tokens.fg,
    '--tag-background': alpha(tokens.type, 0.14),
    '--tag-background-hover': alpha(tokens.type, 0.22),
    '--table-border-color': alpha(tokens.border, 0.58),
    '--table-header-border-color': alpha(tokens.border, 0.76),
    '--list-marker-color': mixHex(tokens.number, tokens.fg, 0.35),
    '--h1-color': h1,
    '--h2-color': h2,
    '--h3-color': h3,
    '--h4-color': h4,
    '--h5-color': h5,
    '--h6-color': h6,
    '--hearth-inline-code': mixHex(tokens.number, tokens.fg, 0.4),
    '--hearth-callout-note-bg': alpha(calloutNote, 0.12),
    '--hearth-callout-note-border': alpha(calloutNote, 0.5),
    '--hearth-callout-tip-bg': alpha(calloutTip, 0.12),
    '--hearth-callout-tip-border': alpha(calloutTip, 0.5),
    '--hearth-callout-warning-bg': alpha(calloutWarning, 0.14),
    '--hearth-callout-warning-border': alpha(calloutWarning, 0.56),
    '--hearth-callout-danger-bg': alpha(calloutDanger, 0.14),
    '--hearth-callout-danger-border': alpha(calloutDanger, 0.56),
    '--code-normal': tokens.variable,
    '--code-comment': tokens.comment,
    '--code-function': tokens.fn,
    '--code-keyword': tokens.keyword,
    '--code-operator': tokens.operator,
    '--code-property': tokens.property,
    '--code-string': tokens.string,
    '--code-tag': tokens.tag,
    '--code-value': tokens.number,
    '--code-important': tokens.type,
  }
}

function renderVars(modeClass, vars) {
  const lines = [`${modeClass} {`]
  for (const key of Object.keys(vars).sort()) {
    lines.push(`  ${key}: ${vars[key]};`)
  }
  lines.push('}', '')
  return lines.join('\n')
}

function renderSyntaxSelectors(modeClass) {
  return `${modeClass} .cm-s-obsidian span.cm-comment,
${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-comment {
  color: var(--code-comment);
  font-style: italic;
}

${modeClass} .cm-s-obsidian span.cm-keyword,
${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-keyword {
  color: var(--code-keyword);
}

${modeClass} .cm-s-obsidian span.cm-operator,
${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-operator {
  color: var(--code-operator);
}

${modeClass} .cm-s-obsidian span.cm-string,
${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-string {
  color: var(--code-string);
}

${modeClass} .cm-s-obsidian span.cm-number,
${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-number {
  color: var(--code-value);
}

${modeClass} .cm-s-obsidian span.cm-def,
${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-def,
${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-variable-2 {
  color: var(--code-function);
}

${modeClass} .cm-s-obsidian span.cm-variable,
${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-variable {
  color: var(--code-normal);
}

${modeClass} .cm-s-obsidian span.cm-property,
${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-property {
  color: var(--code-property);
}

${modeClass} .cm-s-obsidian span.cm-type,
${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-type {
  color: var(--code-important);
}

${modeClass} .cm-s-obsidian span.cm-tag,
${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-tag {
  color: var(--code-tag);
}

${modeClass} .cm-s-obsidian span.cm-atom,
${modeClass} .cm-s-obsidian span.cm-builtin,
${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-atom,
${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-builtin,
${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-meta,
${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-qualifier {
  color: var(--code-important);
}

${modeClass} .cm-s-obsidian span.cm-attribute,
${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-attribute,
${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-variable-3 {
  color: var(--code-property);
}

${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-link {
  color: var(--text-accent);
  text-decoration-color: var(--text-accent);
}

${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-url {
  color: var(--text-muted);
}

${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-quote {
  color: var(--code-comment);
}

${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-strong {
  color: var(--h2-color);
}

${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-em {
  color: var(--h4-color);
}

${modeClass} .markdown-preview-view pre code .hljs-comment {
  color: var(--code-comment);
}

${modeClass} .markdown-preview-view pre code .hljs-keyword,
${modeClass} .markdown-preview-view pre code .hljs-selector-tag {
  color: var(--code-keyword);
}

${modeClass} .markdown-preview-view pre code .hljs-built_in,
${modeClass} .markdown-preview-view pre code .hljs-type,
${modeClass} .markdown-preview-view pre code .hljs-class,
${modeClass} .markdown-preview-view pre code .hljs-meta {
  color: var(--code-important);
}

${modeClass} .markdown-preview-view pre code .hljs-function,
${modeClass} .markdown-preview-view pre code .hljs-title.function_ {
  color: var(--code-function);
}

${modeClass} .markdown-preview-view pre code .hljs-attr,
${modeClass} .markdown-preview-view pre code .hljs-property {
  color: var(--code-property);
}

${modeClass} .markdown-preview-view pre code .hljs-variable,
${modeClass} .markdown-preview-view pre code .hljs-template-variable {
  color: var(--code-normal);
}

${modeClass} .markdown-preview-view pre code .hljs-string,
${modeClass} .markdown-preview-view pre code .hljs-title {
  color: var(--code-string);
}

${modeClass} .markdown-preview-view pre code .hljs-number,
${modeClass} .markdown-preview-view pre code .hljs-literal,
${modeClass} .markdown-preview-view pre code .hljs-operator {
  color: var(--code-value);
}
`
}

function renderMarkdownSelectors(modeClass) {
  return `${modeClass} .markdown-rendered h1,
${modeClass} .markdown-source-view.mod-cm6 .cm-header.cm-header-1,
${modeClass} .markdown-source-view.mod-cm6 .HyperMD-header-1 {
  color: var(--h1-color);
}

${modeClass} .markdown-rendered h2,
${modeClass} .markdown-source-view.mod-cm6 .cm-header.cm-header-2,
${modeClass} .markdown-source-view.mod-cm6 .HyperMD-header-2 {
  color: var(--h2-color);
}

${modeClass} .markdown-rendered h3,
${modeClass} .markdown-source-view.mod-cm6 .cm-header.cm-header-3,
${modeClass} .markdown-source-view.mod-cm6 .HyperMD-header-3 {
  color: var(--h3-color);
}

${modeClass} .markdown-rendered h4,
${modeClass} .markdown-source-view.mod-cm6 .cm-header.cm-header-4,
${modeClass} .markdown-source-view.mod-cm6 .HyperMD-header-4 {
  color: var(--h4-color);
}

${modeClass} .markdown-rendered h5,
${modeClass} .markdown-source-view.mod-cm6 .cm-header.cm-header-5,
${modeClass} .markdown-source-view.mod-cm6 .HyperMD-header-5 {
  color: var(--h5-color);
}

${modeClass} .markdown-rendered h6,
${modeClass} .markdown-source-view.mod-cm6 .cm-header.cm-header-6,
${modeClass} .markdown-source-view.mod-cm6 .HyperMD-header-6 {
  color: var(--h6-color);
}

${modeClass} .markdown-rendered a,
${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-link {
  color: var(--link-color);
}

${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-hmd-internal-link,
${modeClass} .markdown-rendered .internal-link.is-unresolved {
  color: var(--link-unresolved-color);
}

${modeClass} .markdown-rendered blockquote {
  border-inline-start-color: var(--blockquote-border-color);
  color: var(--blockquote-color);
}

${modeClass} .markdown-rendered hr {
  border-color: var(--hr-color);
}

${modeClass} .markdown-rendered ul > li::marker,
${modeClass} .markdown-rendered ol > li::marker,
${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-formatting-list {
  color: var(--list-marker-color);
}

${modeClass} .markdown-rendered :not(pre) > code,
${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-inline-code {
  color: var(--hearth-inline-code);
  background-color: var(--code-background);
  border-radius: 4px;
}

${modeClass} .markdown-rendered pre,
${modeClass} .markdown-rendered pre code {
  background-color: var(--code-background);
}

${modeClass} .markdown-rendered table {
  border-color: var(--table-border-color);
}

${modeClass} .markdown-rendered th {
  border-color: var(--table-header-border-color);
}

${modeClass} .markdown-rendered td {
  border-color: var(--table-border-color);
}

${modeClass} .tag,
${modeClass} a.tag {
  color: var(--tag-color);
  background-color: var(--tag-background);
  border: 1px solid var(--background-modifier-border);
}

${modeClass} .tag:hover,
${modeClass} a.tag:hover {
  color: var(--tag-color-hover);
  background-color: var(--tag-background-hover);
}

${modeClass} input[type='checkbox'] {
  accent-color: var(--interactive-accent);
}
`
}

function renderCalloutSelectors(modeClass) {
  return `${modeClass} .callout {
  border: 1px solid var(--background-modifier-border);
}

${modeClass} .callout .callout-title {
  color: var(--text-normal);
}

${modeClass} .callout[data-callout='note'] {
  border-color: var(--hearth-callout-note-border);
  background-color: var(--hearth-callout-note-bg);
}

${modeClass} .callout[data-callout='tip'],
${modeClass} .callout[data-callout='success'] {
  border-color: var(--hearth-callout-tip-border);
  background-color: var(--hearth-callout-tip-bg);
}

${modeClass} .callout[data-callout='warning'],
${modeClass} .callout[data-callout='caution'] {
  border-color: var(--hearth-callout-warning-border);
  background-color: var(--hearth-callout-warning-bg);
}

${modeClass} .callout[data-callout='danger'],
${modeClass} .callout[data-callout='error'],
${modeClass} .callout[data-callout='bug'] {
  border-color: var(--hearth-callout-danger-border);
  background-color: var(--hearth-callout-danger-bg);
}
`
}

function renderUiSelectors(modeClass) {
  return `${modeClass} .workspace-tab-header.is-active {
  border-color: var(--interactive-accent);
}

${modeClass} .workspace-tab-header.is-active .workspace-tab-header-inner {
  color: var(--text-normal);
}

${modeClass} .nav-file-title.is-active,
${modeClass} .tree-item-self.is-clickable:hover,
${modeClass} .suggestion-item.is-selected {
  background-color: var(--background-modifier-active-hover);
}

${modeClass} .cm-active,
${modeClass} .markdown-source-view.mod-cm6 .cm-active.cm-line {
  background-color: var(--background-modifier-hover);
}

${modeClass} .status-bar-item:hover {
  background-color: var(--background-modifier-hover);
}
`
}

function renderThemeCss(meta, themePath, vars) {
  const header = [
    '/* Auto-generated by scripts/generate-obsidian-themes.mjs - DO NOT EDIT */',
    `/* Variant: ${meta.label} */`,
    `/* Source: ${themePath} */`,
    '',
  ]

  return `${header.join('\n')}${renderVars(meta.modeClass, vars)}${renderSyntaxSelectors(meta.modeClass)}${renderMarkdownSelectors(meta.modeClass)}${renderCalloutSelectors(meta.modeClass)}${renderUiSelectors(meta.modeClass)}`
}

export function buildVariantCssById(id, generatedPlatformMaps = buildGeneratedPlatformTokenMaps(COLOR_LANGUAGE_MODEL)) {
  const path = THEME_FILES[id]
  const meta = VARIANT_META[id]
  if (!path || !meta) throw new Error(`Unknown Obsidian variant id: ${id}`)

  const tokens = generatedPlatformMaps.tokenSets[id]
  assertTokenSet(id, tokens)
  const vars = buildVars(tokens, generatedPlatformMaps.obsidian?.[id] || {})
  return renderThemeCss(meta, path, vars)
}

export function generateObsidianThemes() {
  mkdirSync(OUTPUT_DIR, { recursive: true })
  const generatedPlatformMaps = buildGeneratedPlatformTokenMaps(COLOR_LANGUAGE_MODEL)

  let changed = 0
  for (const id of Object.keys(THEME_FILES)) {
    const meta = VARIANT_META[id]
    const css = buildVariantCssById(id, generatedPlatformMaps)
    const outPath = `${OUTPUT_DIR}/${meta.cssFile}`
    const didChange = writeIfChanged(outPath, css)
    if (didChange) changed += 1
    console.log(`${didChange ? '✓ updated' : '- unchanged'} ${outPath}`)
  }

  return changed
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    generateObsidianThemes()
  } catch (error) {
    console.error(`[FAIL] ${error.message}`)
    process.exit(1)
  }
}
