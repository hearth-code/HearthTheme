import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { pathToFileURL } from 'url'
import { buildColorLanguageModel } from './color-system/build.mjs'
import { buildGeneratedPlatformTokenMaps } from './color-system/artifacts.mjs'
import { getObsidianThemeOutputFiles, getThemeOutputFiles, loadColorSchemeManifest, loadColorSystemVariants } from './color-system.mjs'

const COLOR_LANGUAGE_MODEL = buildColorLanguageModel()
export const THEME_FILES = getThemeOutputFiles()
export const OBSIDIAN_THEME_FILES = getObsidianThemeOutputFiles()
const SCHEME = loadColorSchemeManifest()
const VARIANTS = loadColorSystemVariants().variants

export const VARIANT_META = Object.fromEntries(
  VARIANTS.map((variant) => [
    variant.id,
    {
      // Derive the header label from the active scheme (Moss/Ember) so moss-*.css
      // is not stamped with the product preview's hardcoded "Ember" variantNames.
      label: `${SCHEME.name} ${variant.climateLabel || variant.name} (Obsidian)`,
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
  const lightText = '#faf5ef'
  return relativeLuminance(backgroundHex) > 0.34 ? darkText : lightText
}

function contrastRatio(aHex, bHex) {
  const la = relativeLuminance(aHex)
  const lb = relativeLuminance(bHex)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

// On-accent ink for Obsidian's accent fill. The shared onAccentInk literal is tuned
// for warm ochre chrome (VS Code buttons, badges) and is correct for most accent
// fills, so we keep each scheme's intentional literal whenever it clears AA. It only
// fails when the fill is a DEEP accent — moss-light's sage #486a59 leaves the dark
// literal at ~3:1 — and there we derive a contrasting ink from the fill's luminance.
function onAccentInkForFill(literalInk, accentHex) {
  if (literalInk && contrastRatio(literalInk, accentHex) >= 4.5) return literalInk
  return pickContrastText(accentHex)
}

function toRgbTriplet(hex) {
  return hexToRgb(hex).join(', ')
}

function buildMarkdownUiVars(tokens, accent, tones) {
  const surface = mixHex(tokens.lineBg, tokens.bg, 0.18)
  const surfaceSoft = mixHex(tokens.lineBg, tokens.bg, 0.42)
  const edge = mixHex(tokens.border, tokens.comment, 0.22)
  const listLevel1 = mixHex(tokens.comment, tokens.property, 0.32)
  const listLevel2 = mixHex(tokens.comment, tokens.fn, 0.28)
  const listLevel3 = mixHex(tokens.comment, tokens.number, 0.3)
  const inlineInk = mixHex(tokens.number, tokens.fg, 0.4)
  const codeSlab = mixHex(tokens.lineBg, tokens.bg, 0.12)
  const quoteRail = mixHex(tokens.property, tokens.comment, 0.24)
  const quoteInk = mixHex(tokens.comment, tokens.fg, 0.34)
  const checkboxBackground = mixHex(tokens.lineBg, tokens.bg, 0.34)
  const calloutDefault = tones.info
  const calloutTodo = mixHex(accent, tones.info, 0.36)
  const calloutQuestion = mixHex(tones.warning, tones.error, 0.24)
  const calloutExample = mixHex(tokens.number, tokens.terminalMagenta, 0.2)
  const calloutQuote = mixHex(tokens.comment, tokens.border, 0.22)

  return {
    surface: alpha(surface, 0.88),
    surfaceMuted: alpha(surfaceSoft, 0.72),
    border: alpha(edge, 0.54),
    borderSoft: alpha(edge, 0.28),
    quoteRail: alpha(quoteRail, 0.68),
    quoteInk,
    listLevel1,
    listLevel2,
    listLevel3,
    inlineInk,
    codeSlab: alpha(codeSlab, 0.9),
    codeEdge: alpha(edge, 0.42),
    checkboxBackground: alpha(checkboxBackground, 0.9),
    checkboxBorder: alpha(listLevel1, 0.68),
    checkboxBorderHover: alpha(mixHex(listLevel1, accent, 0.32), 0.86),
    taskDone: mixHex(tones.success, tokens.lineBg, 0.08),
    taskProgress: tones.info,
    taskQuestion: calloutQuestion,
    taskImportant: tones.warning,
    taskCancelled: tones.error,
    taskDeferred: mixHex(tokens.comment, tokens.fg, 0.16),
    taskDoneText: mixHex(tokens.comment, tokens.fg, 0.22),
    taskProgressText: mixHex(tones.info, tokens.fg, 0.44),
    taskQuestionText: mixHex(calloutQuestion, tokens.fg, 0.42),
    taskImportantText: mixHex(tones.warning, tokens.fg, 0.4),
    taskCancelledText: mixHex(tones.error, tokens.fg, 0.46),
    taskDeferredText: mixHex(tokens.comment, tokens.fg, 0.34),
    calloutDefault,
    calloutInfo: tones.info,
    calloutTodo,
    calloutTip: tones.success,
    calloutSuccess: tones.success,
    calloutQuestion,
    calloutWarning: tones.warning,
    calloutFail: tones.error,
    calloutError: tones.error,
    calloutBug: tones.error,
    calloutExample,
    calloutQuote,
  }
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
  // Scrollbar thumb: warm the neutral border toward the comment tone so the slim
  // thumb reads as part of the palette instead of a cold gray bar; hover deepens.
  const scrollbarThumb = mixHex(tokens.border, tokens.comment, 0.3)
  const scrollbarThumbActive = mixHex(tokens.border, tokens.comment, 0.5)
  const linkUnresolved = mixHex(tokens.comment, tokens.keyword, 0.22)
  const feedbackNote = platformVars['--hearth-feedback-note'] ?? tokens.property
  const feedbackInfo = platformVars['--hearth-feedback-info'] ?? tokens.fn
  const feedbackSuccess = platformVars['--text-success'] ?? tokens.string
  const feedbackWarning = platformVars['--hearth-terminal-yellow'] ?? tokens.terminalYellow
  const feedbackError = platformVars['--hearth-terminal-red'] ?? tokens.terminalRed
  const markdown = buildMarkdownUiVars(tokens, accent, {
    note: feedbackNote,
    info: feedbackInfo,
    success: feedbackSuccess,
    warning: feedbackWarning,
    error: feedbackError,
  })
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
    // Accent-derived vars reference the single source (--interactive-accent), so a
    // Style Settings accent preset overrides only the source + its hover and links,
    // accent text, and collapsed list markers all cascade. Semantic colors that are
    // NOT the accent (e.g. the task-done checkbox) stay literal and never follow it.
    '--text-accent': 'var(--interactive-accent)',
    '--text-accent-hover': 'var(--interactive-accent-hover)',
    '--text-on-accent': onAccentInkForFill(platformVars['--text-on-accent'], accent),
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
    '--scrollbar-bg': 'transparent',
    '--scrollbar-thumb-bg': alpha(scrollbarThumb, 0.5),
    '--scrollbar-active-thumb-bg': alpha(scrollbarThumbActive, 0.85),
    '--link-color': 'var(--interactive-accent)',
    '--link-color-hover': 'var(--interactive-accent-hover)',
    '--link-unresolved-color': linkUnresolved,
    '--code-background': 'var(--hearth-md-code-surface)',
    '--blockquote-background-color': 'var(--hearth-md-surface-muted)',
    '--blockquote-border-color': markdown.quoteRail,
    '--blockquote-border-thickness': '3px',
    '--blockquote-color': markdown.quoteInk,
    '--hr-color': alpha(tokens.border, 0.7),
    '--tag-color': tokens.type,
    '--tag-color-hover': tokens.fg,
    '--tag-background': alpha(tokens.type, 0.14),
    '--tag-background-hover': alpha(tokens.type, 0.22),
    '--table-border-color': alpha(tokens.border, 0.58),
    '--table-header-border-color': alpha(tokens.border, 0.76),
    '--list-marker-color': markdown.listLevel1,
    '--list-marker-color-hover': markdown.listLevel2,
    '--list-marker-color-collapsed': 'var(--interactive-accent)',
    '--list-spacing': '0.14em',
    '--checkbox-radius': '4px',
    '--checkbox-size': '15px',
    '--checkbox-marker-color': onAccentInkForFill(platformVars['--text-on-accent'], markdown.taskDone),
    '--checkbox-color': markdown.taskDone,
    '--checkbox-color-hover': accentHover,
    '--checkbox-border-color': markdown.checkboxBorder,
    '--checkbox-border-color-hover': markdown.checkboxBorderHover,
    '--checkbox-margin-inline-start': '0',
    '--checklist-done-decoration': 'line-through',
    '--checklist-done-color': markdown.taskDoneText,
    '--callout-default': toRgbTriplet(markdown.calloutDefault),
    '--callout-info': toRgbTriplet(markdown.calloutInfo),
    '--callout-todo': toRgbTriplet(markdown.calloutTodo),
    '--callout-tip': toRgbTriplet(markdown.calloutTip),
    '--callout-success': toRgbTriplet(markdown.calloutSuccess),
    '--callout-question': toRgbTriplet(markdown.calloutQuestion),
    '--callout-warning': toRgbTriplet(markdown.calloutWarning),
    '--callout-fail': toRgbTriplet(markdown.calloutFail),
    '--callout-error': toRgbTriplet(markdown.calloutError),
    '--callout-bug': toRgbTriplet(markdown.calloutBug),
    '--callout-example': toRgbTriplet(markdown.calloutExample),
    '--callout-quote': toRgbTriplet(markdown.calloutQuote),
    '--callout-border-width': '1px',
    '--callout-border-opacity': '0.5',
    '--callout-radius': '8px',
    '--callout-padding': '0.72em 0.9em',
    '--callout-content-padding': '0.48em 0 0',
    '--callout-content-background': 'transparent',
    '--h1-color': h1,
    '--h2-color': h2,
    '--h3-color': h3,
    '--h4-color': h4,
    '--h5-color': h5,
    '--h6-color': h6,
    '--hearth-md-surface': markdown.surface,
    '--hearth-md-surface-muted': markdown.surfaceMuted,
    '--hearth-md-border': markdown.border,
    '--hearth-md-border-soft': markdown.borderSoft,
    '--hearth-md-block-gap': '1em',
    '--hearth-md-list-level-1': markdown.listLevel1,
    '--hearth-md-list-level-2': markdown.listLevel2,
    '--hearth-md-list-level-3': markdown.listLevel3,
    '--hearth-md-inline-code': markdown.inlineInk,
    '--hearth-md-code-surface': markdown.codeSlab,
    '--hearth-md-code-border': markdown.codeEdge,
    '--hearth-task-background': markdown.checkboxBackground,
    '--hearth-task-done': markdown.taskDone,
    '--hearth-task-progress': markdown.taskProgress,
    '--hearth-task-question': markdown.taskQuestion,
    '--hearth-task-important': markdown.taskImportant,
    '--hearth-task-cancelled': markdown.taskCancelled,
    '--hearth-task-deferred': markdown.taskDeferred,
    '--hearth-task-progress-text': markdown.taskProgressText,
    '--hearth-task-question-text': markdown.taskQuestionText,
    '--hearth-task-important-text': markdown.taskImportantText,
    '--hearth-task-cancelled-text': markdown.taskCancelledText,
    '--hearth-task-deferred-text': markdown.taskDeferredText,
    '--hearth-callout-bg-opacity': '0.11',
    '--hearth-callout-border-opacity': '0.58',
    '--hearth-callout-rail-opacity': '0.72',
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
  /* CJK fonts have no true italic cut; suppress the synthesized fake oblique
     (renders upright) while real Latin italic faces still slant. Bold synthesis
     is left intact for keywords. */
  font-synthesis-style: none;
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

/* Bold/italic are intentionally NOT recolored in the editor: the reading view
   leaves them at text color, so coloring them here (formerly h2/h4) made edit
   and preview diverge. Keep them as weight/slant only; enforced by obsidian-audit. */

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
  return `${modeClass} .markdown-rendered blockquote,
${modeClass} .markdown-rendered pre,
${modeClass} .markdown-rendered table,
${modeClass} .callout {
  margin-block: var(--hearth-md-block-gap);
}

${modeClass} .markdown-rendered h1,
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
  border-inline-start-width: var(--blockquote-border-thickness);
  background-color: var(--blockquote-background-color);
  color: var(--blockquote-color);
  border-radius: 0 7px 7px 0;
  box-shadow: inset 0 0 0 1px var(--hearth-md-border-soft);
  padding: 0.55em 0.9em;
}

${modeClass} .markdown-source-view.mod-cm6 .HyperMD-quote {
  background-color: var(--blockquote-background-color);
  border-inline-start: var(--blockquote-border-thickness) solid var(--blockquote-border-color);
  box-shadow: inset 0 0 0 1px var(--hearth-md-border-soft);
  color: var(--blockquote-color);
}

${modeClass} .markdown-rendered hr {
  border-color: var(--hr-color);
}

${modeClass} .markdown-rendered ul > li::marker,
${modeClass} .markdown-rendered ol > li::marker,
${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-formatting-list {
  color: var(--list-marker-color);
  font-variant-numeric: tabular-nums;
}

${modeClass} .markdown-rendered ul ul > li::marker,
${modeClass} .markdown-rendered ol ol > li::marker,
${modeClass} .markdown-rendered ul ol > li::marker,
${modeClass} .markdown-rendered ol ul > li::marker {
  color: var(--hearth-md-list-level-2);
}

${modeClass} .markdown-rendered ul ul ul > li::marker,
${modeClass} .markdown-rendered ol ol ol > li::marker,
${modeClass} .markdown-rendered ul ol ul > li::marker,
${modeClass} .markdown-rendered ol ul ol > li::marker {
  color: var(--hearth-md-list-level-3);
}

${modeClass} .markdown-rendered ul > li > .list-bullet:after {
  background-color: var(--hearth-md-list-level-1);
  border: none;
  border-radius: 50%;
  width: 0.34em;
  height: 0.34em;
}

${modeClass} .markdown-rendered ul ul > li > .list-bullet:after {
  background-color: transparent;
  border: 1px solid var(--hearth-md-list-level-2);
  border-radius: 50%;
  width: 0.42em;
  height: 0.42em;
}

${modeClass} .markdown-rendered ul ul ul > li > .list-bullet:after {
  background-color: var(--hearth-md-list-level-3);
  border: none;
  border-radius: 1px;
  width: 0.5em;
  height: 0.12em;
}

${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-formatting-list-ul {
  color: var(--hearth-md-list-level-1);
}

${modeClass} .markdown-source-view.mod-cm6 .HyperMD-list-line-2 .cm-formatting-list,
${modeClass} .markdown-source-view.mod-cm6 .HyperMD-list-line-3 .cm-formatting-list {
  color: var(--hearth-md-list-level-2);
}

${modeClass} .markdown-source-view.mod-cm6 .HyperMD-list-line-4 .cm-formatting-list,
${modeClass} .markdown-source-view.mod-cm6 .HyperMD-list-line-5 .cm-formatting-list {
  color: var(--hearth-md-list-level-3);
}

${modeClass} .markdown-rendered :not(pre) > code {
  color: var(--hearth-md-inline-code);
  background-color: var(--code-background);
  border: 1px solid var(--hearth-md-code-border);
  border-radius: 5px;
  padding: 0.05em 0.34em;
}

${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-inline-code {
  color: var(--hearth-md-inline-code);
  background-color: var(--code-background);
  border-radius: 5px;
}

${modeClass} .markdown-rendered pre {
  background-color: var(--hearth-md-code-surface);
  border: 1px solid var(--hearth-md-code-border);
  border-radius: 8px;
}

${modeClass} .markdown-rendered pre code {
  background-color: transparent;
}

${modeClass} .markdown-source-view.mod-cm6 .HyperMD-codeblock {
  background-color: var(--hearth-md-code-surface);
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

${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-hashtag {
  color: var(--tag-color);
  background-color: var(--tag-background);
  border-block: 1px solid var(--background-modifier-border);
  padding-block: 0.05em;
}

${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-hashtag-begin {
  border-inline-start: 1px solid var(--background-modifier-border);
  border-start-start-radius: 5px;
  border-end-start-radius: 5px;
  padding-inline-start: 0.34em;
}

${modeClass} .markdown-source-view.mod-cm6 .cm-line .cm-hashtag-end {
  border-inline-end: 1px solid var(--background-modifier-border);
  border-start-end-radius: 5px;
  border-end-end-radius: 5px;
  padding-inline-end: 0.34em;
}

${modeClass} input[type='checkbox'] {
  inline-size: var(--checkbox-size);
  block-size: var(--checkbox-size);
  margin-inline-start: var(--checkbox-margin-inline-start);
  accent-color: var(--checkbox-color);
  vertical-align: -0.12em;
}

${modeClass} input[type='checkbox']:checked {
  accent-color: var(--hearth-task-done);
}

${modeClass} input[type='checkbox']:hover {
  accent-color: var(--checkbox-color-hover);
}

${modeClass} li.task-list-item[data-task='x'],
${modeClass} li.task-list-item[data-task='X'],
${modeClass} .markdown-source-view.mod-cm6 .HyperMD-task-line[data-task='x'],
${modeClass} .markdown-source-view.mod-cm6 .HyperMD-task-line[data-task='X'] {
  color: var(--checklist-done-color);
  text-decoration: var(--checklist-done-decoration);
}

${modeClass} li.task-list-item[data-task='/'],
${modeClass} li.task-list-item[data-task='-'],
${modeClass} .markdown-source-view.mod-cm6 .HyperMD-task-line[data-task='/'],
${modeClass} .markdown-source-view.mod-cm6 .HyperMD-task-line[data-task='-'] {
  color: var(--hearth-task-progress-text);
  text-decoration: none;
}

${modeClass} li.task-list-item[data-task='/'] .task-list-item-checkbox,
${modeClass} li.task-list-item[data-task='-'] .task-list-item-checkbox,
${modeClass} .markdown-source-view.mod-cm6 .HyperMD-task-line[data-task='/'] .task-list-item-checkbox,
${modeClass} .markdown-source-view.mod-cm6 .HyperMD-task-line[data-task='-'] .task-list-item-checkbox {
  accent-color: var(--hearth-task-progress);
}

${modeClass} li.task-list-item[data-task='?'],
${modeClass} .markdown-source-view.mod-cm6 .HyperMD-task-line[data-task='?'] {
  color: var(--hearth-task-question-text);
  text-decoration: none;
}

${modeClass} li.task-list-item[data-task='?'] .task-list-item-checkbox,
${modeClass} .markdown-source-view.mod-cm6 .HyperMD-task-line[data-task='?'] .task-list-item-checkbox {
  accent-color: var(--hearth-task-question);
}

${modeClass} li.task-list-item[data-task='!'],
${modeClass} .markdown-source-view.mod-cm6 .HyperMD-task-line[data-task='!'] {
  color: var(--hearth-task-important-text);
  text-decoration: none;
}

${modeClass} li.task-list-item[data-task='!'] .task-list-item-checkbox,
${modeClass} .markdown-source-view.mod-cm6 .HyperMD-task-line[data-task='!'] .task-list-item-checkbox {
  accent-color: var(--hearth-task-important);
}

${modeClass} li.task-list-item[data-task='~'],
${modeClass} .markdown-source-view.mod-cm6 .HyperMD-task-line[data-task='~'] {
  color: var(--hearth-task-cancelled-text);
  text-decoration: none;
}

${modeClass} li.task-list-item[data-task='~'] .task-list-item-checkbox,
${modeClass} .markdown-source-view.mod-cm6 .HyperMD-task-line[data-task='~'] .task-list-item-checkbox {
  accent-color: var(--hearth-task-cancelled);
}

${modeClass} li.task-list-item[data-task='>'],
${modeClass} .markdown-source-view.mod-cm6 .HyperMD-task-line[data-task='>'] {
  color: var(--hearth-task-deferred-text);
  text-decoration: none;
}

${modeClass} li.task-list-item[data-task='>'] .task-list-item-checkbox,
${modeClass} .markdown-source-view.mod-cm6 .HyperMD-task-line[data-task='>'] .task-list-item-checkbox {
  accent-color: var(--hearth-task-deferred);
}
`
}

function renderCalloutSelectors(modeClass) {
  return `${modeClass} .callout {
  border: var(--callout-border-width) solid rgba(var(--callout-color), var(--hearth-callout-border-opacity));
  border-inline-start-width: 4px;
  border-radius: var(--callout-radius);
  background-color: rgba(var(--callout-color), var(--hearth-callout-bg-opacity));
  box-shadow: inset 0 0 0 1px var(--hearth-md-border-soft);
  padding: var(--callout-padding);
}

${modeClass} .callout .callout-title {
  color: rgb(var(--callout-color));
}

${modeClass} .callout .callout-icon .svg-icon {
  color: rgb(var(--callout-color));
}

${modeClass} .callout .callout-content {
  color: var(--text-normal);
}

${modeClass} .callout[data-callout='note'] {
  --callout-color: var(--callout-default);
}

${modeClass} .callout[data-callout='todo'],
${modeClass} .callout[data-callout='accent'] {
  --callout-color: var(--callout-todo);
}

${modeClass} .callout[data-callout='tip'],
${modeClass} .callout[data-callout='hint'],
${modeClass} .callout[data-callout='success'] {
  --callout-color: var(--callout-success);
}

${modeClass} .callout[data-callout='info'],
${modeClass} .callout[data-callout='abstract'],
${modeClass} .callout[data-callout='summary'],
${modeClass} .callout[data-callout='tldr'] {
  --callout-color: var(--callout-info);
}

${modeClass} .callout[data-callout='question'],
${modeClass} .callout[data-callout='help'],
${modeClass} .callout[data-callout='faq'] {
  --callout-color: var(--callout-question);
}

${modeClass} .callout[data-callout='warning'],
${modeClass} .callout[data-callout='caution'],
${modeClass} .callout[data-callout='attention'] {
  --callout-color: var(--callout-warning);
}

${modeClass} .callout[data-callout='danger'],
${modeClass} .callout[data-callout='error'],
${modeClass} .callout[data-callout='failure'],
${modeClass} .callout[data-callout='fail'],
${modeClass} .callout[data-callout='missing'],
${modeClass} .callout[data-callout='bug'] {
  --callout-color: var(--callout-error);
}

${modeClass} .callout[data-callout='example'] {
  --callout-color: var(--callout-example);
}

${modeClass} .callout[data-callout='quote'],
${modeClass} .callout[data-callout='cite'] {
  --callout-color: var(--callout-quote);
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

function renderScrollbarSelectors(modeClass) {
  return `${modeClass} ::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

${modeClass} ::-webkit-scrollbar-track,
${modeClass} ::-webkit-scrollbar-corner {
  background-color: var(--scrollbar-bg);
}

${modeClass} ::-webkit-scrollbar-thumb {
  background-color: var(--scrollbar-thumb-bg);
  border: 2px solid transparent;
  background-clip: padding-box;
  border-radius: 6px;
}

${modeClass} ::-webkit-scrollbar-thumb:hover,
${modeClass} ::-webkit-scrollbar-thumb:active {
  background-color: var(--scrollbar-active-thumb-bg);
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

  return `${header.join('\n')}${renderVars(meta.modeClass, vars)}${renderSyntaxSelectors(meta.modeClass)}${renderMarkdownSelectors(meta.modeClass)}${renderCalloutSelectors(meta.modeClass)}${renderUiSelectors(meta.modeClass)}${renderScrollbarSelectors(meta.modeClass)}`
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
