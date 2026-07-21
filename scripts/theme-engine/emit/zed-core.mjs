export const ZED_THEME_SCHEMA_URL = 'https://zed.dev/schema/themes/v0.2.0.json'

const COLOR_RE = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i
const FONT_WEIGHTS = new Set([100, 200, 300, 400, 500, 600, 700, 800, 900])
const FONT_STYLES = new Set(['normal', 'italic', 'oblique'])

const ROLE_STYLE_PROBES = Object.freeze({
  comment: ['comment'],
  keyword: ['keyword'],
  operator: ['keyword.operator'],
  punctuation: ['punctuation'],
  function: ['entity.name.function'],
  property: ['variable.other.property', 'meta.property-name'],
  string: ['string'],
  number: ['constant.numeric'],
  type: ['entity.name.type', 'support.type'],
  variable: ['variable.other.readwrite', 'variable'],
  parameter: ['variable.parameter'],
  tag: ['entity.name.tag'],
})

const SYNTAX_GROUPS = Object.freeze([
  { token: 'comment', role: 'comment', captures: ['comment', 'comment.doc'] },
  { token: 'keyword', role: 'keyword', captures: ['keyword', 'preproc'] },
  { token: 'operator', role: 'operator', captures: ['operator'] },
  {
    token: 'punctuation',
    role: 'punctuation',
    captures: [
      'punctuation',
      'punctuation.bracket',
      'punctuation.delimiter',
      'punctuation.list_marker',
      'punctuation.special',
    ],
  },
  { token: 'fn', role: 'function', captures: ['function', 'constructor'] },
  { token: 'property', role: 'property', captures: ['property', 'attribute', 'label'] },
  {
    token: 'string',
    role: 'string',
    captures: ['string', 'string.escape', 'string.regex', 'string.special', 'string.special.symbol'],
  },
  {
    token: 'number',
    role: 'number',
    captures: ['number', 'constant', 'constant.builtin', 'boolean', 'enum', 'variant'],
  },
  { token: 'type', role: 'type', captures: ['type', 'type.builtin'] },
  { token: 'variable', role: 'variable', captures: ['variable', 'variable.special'] },
  { token: 'parameter', role: 'parameter', captures: ['variable.parameter'] },
  { token: 'tag', role: 'tag', captures: ['tag', 'tag.doctype'] },
])

export const ZED_REQUIRED_STYLE_KEYS = Object.freeze([
  'background',
  'surface.background',
  'text',
  'border',
  'editor.background',
  'editor.foreground',
  'editor.gutter.background',
  'editor.line_number',
  'terminal.background',
  'terminal.foreground',
  'syntax',
])

function requireColor(tokens, key, label) {
  const value = String(tokens?.[key] ?? '').trim().toLowerCase()
  if (!COLOR_RE.test(value)) {
    throw new Error(`zed emitter: ${label} is missing valid token "${key}"`)
  }
  return value
}

function withAlpha(color, alpha) {
  const rgb = color.slice(0, 7)
  return `${rgb}${alpha}`.toLowerCase()
}

function toScopes(entry) {
  if (!entry?.scope) return []
  return Array.isArray(entry.scope) ? entry.scope : [entry.scope]
}

function findRoleFontStyle(theme, role) {
  const probes = ROLE_STYLE_PROBES[role] ?? []
  for (const probe of probes) {
    const entry = (theme?.tokenColors ?? []).find((candidate) => toScopes(candidate).includes(probe))
    const value = String(entry?.settings?.fontStyle ?? '').trim()
    if (value) return value
  }
  return ''
}

function buildHighlightStyle(color, vscodeFontStyle = '') {
  const words = new Set(String(vscodeFontStyle).split(/\s+/).filter(Boolean))
  const style = { color }
  if (words.has('italic')) style.font_style = 'italic'
  if (words.has('bold')) style.font_weight = 700
  return style
}

function buildSyntax(tokens, vscodeTheme) {
  const syntax = {}
  for (const group of SYNTAX_GROUPS) {
    const color = requireColor(tokens, group.token, `syntax.${group.role}`)
    const style = buildHighlightStyle(color, findRoleFontStyle(vscodeTheme, group.role))
    for (const capture of group.captures) syntax[capture] = { ...style }
  }

  const foreground = requireColor(tokens, 'fg', 'syntax.primary')
  const info = requireColor(tokens, 'info', 'syntax.link')
  const note = requireColor(tokens, 'note', 'syntax.hint')
  syntax.primary = { color: foreground }
  syntax.embedded = { color: foreground }
  syntax.hint = { color: note }
  syntax.predictive = { color: note }
  syntax.link_text = { color: info }
  syntax.link_uri = { color: info, font_style: 'italic' }
  syntax.emphasis = { color: foreground, font_style: 'italic' }
  syntax['emphasis.strong'] = { color: foreground, font_weight: 700 }
  syntax.title = { color: requireColor(tokens, 'keyword', 'syntax.title'), font_weight: 700 }
  syntax['text.literal'] = { color: requireColor(tokens, 'string', 'syntax.text.literal') }
  return syntax
}

function feedbackStyle(style, name, color) {
  style[name] = color
  style[`${name}.background`] = withAlpha(color, '1a')
  style[`${name}.border`] = withAlpha(color, '66')
}

function buildPlayers(colors) {
  return [...new Set(colors)].map((color) => ({
    cursor: color,
    background: color,
    selection: withAlpha(color, '3d'),
  }))
}

export function buildZedStyle(tokens, vscodeTheme) {
  const bg = requireColor(tokens, 'bg', 'editor background')
  const fg = requireColor(tokens, 'fg', 'editor foreground')
  const sidebar = requireColor(tokens, 'sidebar', 'application background')
  const panel = requireColor(tokens, 'lineBg', 'panel background')
  const border = requireColor(tokens, 'border', 'border')
  const guide = requireColor(tokens, 'guide', 'guide')
  const guideActive = requireColor(tokens, 'guideActive', 'active guide')
  const whitespace = requireColor(tokens, 'whitespace', 'invisible characters')
  const status = requireColor(tokens, 'status', 'accent')
  const cursor = requireColor(tokens, 'cursor', 'cursor')
  const selection = requireColor(tokens, 'selection', 'selection')
  const shellInk = requireColor(tokens, 'shellInk', 'shell text')
  const supportInk = requireColor(tokens, 'shellSupport', 'muted shell text')
  const mutedInk = requireColor(tokens, 'shellMuted', 'disabled shell text')
  const subtleInk = requireColor(tokens, 'shellSubtle', 'placeholder shell text')
  const shellRaised = requireColor(tokens, 'shellRaised', 'raised surface')
  const shellBand = requireColor(tokens, 'shellBand', 'shell band')
  const navActiveFill = requireColor(tokens, 'navActiveFill', 'active navigation')
  const navInactiveFill = requireColor(tokens, 'navInactiveFill', 'inactive navigation')
  const navActiveInk = requireColor(tokens, 'navActiveInk', 'active navigation text')
  const lineNo = requireColor(tokens, 'lineNo', 'line number')
  const terminalBrightWhite = requireColor(tokens, 'terminalBrightWhite', 'terminal bright foreground')
  const accentColors = [
    cursor,
    status,
    requireColor(tokens, 'bracketWarm', 'warm bracket'),
    requireColor(tokens, 'bracketBright', 'bright bracket'),
    requireColor(tokens, 'bracketCool', 'cool bracket'),
    requireColor(tokens, 'info', 'info'),
    requireColor(tokens, 'success', 'success'),
    requireColor(tokens, 'warning', 'warning'),
    requireColor(tokens, 'error', 'error'),
  ]

  const style = {
    'background.appearance': 'opaque',
    background: sidebar,
    'surface.background': shellBand,
    'elevated_surface.background': shellRaised,
    border,
    'border.variant': guide,
    'border.focused': status,
    'border.selected': cursor,
    'border.transparent': '#00000000',
    'border.disabled': border,
    'pane_group.border': border,
    'pane.focused_border': status,
    'panel.focused_border': status,
    'element.background': navInactiveFill,
    'element.hover': navActiveFill,
    'element.active': navActiveFill,
    'element.selected': navActiveFill,
    'element.disabled': navInactiveFill,
    'drop_target.background': withAlpha(cursor, '40'),
    'ghost_element.background': '#00000000',
    'ghost_element.hover': navInactiveFill,
    'ghost_element.active': navActiveFill,
    'ghost_element.selected': navActiveFill,
    'ghost_element.disabled': '#00000000',
    text: shellInk,
    'text.muted': supportInk,
    'text.placeholder': subtleInk,
    'text.disabled': mutedInk,
    'text.accent': requireColor(tokens, 'keyword', 'accent text'),
    icon: shellInk,
    'icon.muted': supportInk,
    'icon.disabled': mutedInk,
    'icon.placeholder': subtleInk,
    'icon.accent': requireColor(tokens, 'keyword', 'accent icon'),
    // Zed exposes the status-bar fill but no paired foreground token. Keep the
    // fill inside the shell surface family so the shared `text` color remains
    // readable; the stronger status color is still used for focus/accent cues.
    'status_bar.background': shellBand,
    'title_bar.background': sidebar,
    'title_bar.inactive_background': sidebar,
    'toolbar.background': shellBand,
    'tab_bar.background': sidebar,
    'tab.inactive_background': sidebar,
    'tab.active_background': bg,
    'search.match_background': selection,
    'panel.background': sidebar,
    'scrollbar.thumb.background': withAlpha(supportInk, '4d'),
    'scrollbar.thumb.hover_background': withAlpha(supportInk, '80'),
    'scrollbar.thumb.border': withAlpha(border, 'b3'),
    'scrollbar.track.background': '#00000000',
    'scrollbar.track.border': border,
    'editor.background': bg,
    'editor.foreground': fg,
    'editor.gutter.background': bg,
    'editor.subheader.background': panel,
    'editor.active_line.background': panel,
    'editor.highlighted_line.background': panel,
    'editor.line_number': lineNo,
    'editor.active_line_number': navActiveInk,
    'editor.invisible': whitespace,
    'editor.wrap_guide': withAlpha(guide, '66'),
    'editor.active_wrap_guide': guideActive,
    'editor.indent_guide': guide,
    'editor.indent_guide_active': guideActive,
    'editor.document_highlight.bracket_background': requireColor(tokens, 'bracketMatchFill', 'bracket match'),
    'editor.document_highlight.read_background': selection,
    'editor.document_highlight.write_background': withAlpha(status, '42'),
    'terminal.background': bg,
    'terminal.foreground': fg,
    'terminal.bright_foreground': terminalBrightWhite,
    'terminal.dim_foreground': mutedInk,
    'terminal.ansi.background': bg,
    'terminal.ansi.black': requireColor(tokens, 'terminalBlack', 'terminal black'),
    'terminal.ansi.red': requireColor(tokens, 'terminalRed', 'terminal red'),
    'terminal.ansi.green': requireColor(tokens, 'terminalGreen', 'terminal green'),
    'terminal.ansi.yellow': requireColor(tokens, 'terminalYellow', 'terminal yellow'),
    'terminal.ansi.blue': requireColor(tokens, 'terminalBlue', 'terminal blue'),
    'terminal.ansi.magenta': requireColor(tokens, 'terminalMagenta', 'terminal magenta'),
    'terminal.ansi.cyan': requireColor(tokens, 'terminalCyan', 'terminal cyan'),
    'terminal.ansi.white': requireColor(tokens, 'terminalWhite', 'terminal white'),
    'terminal.ansi.bright_black': requireColor(tokens, 'terminalBrightBlack', 'terminal bright black'),
    'terminal.ansi.bright_red': requireColor(tokens, 'terminalBrightRed', 'terminal bright red'),
    'terminal.ansi.bright_green': requireColor(tokens, 'terminalBrightGreen', 'terminal bright green'),
    'terminal.ansi.bright_yellow': requireColor(tokens, 'terminalBrightYellow', 'terminal bright yellow'),
    'terminal.ansi.bright_blue': requireColor(tokens, 'terminalBrightBlue', 'terminal bright blue'),
    'terminal.ansi.bright_magenta': requireColor(tokens, 'terminalBrightMagenta', 'terminal bright magenta'),
    'terminal.ansi.bright_cyan': requireColor(tokens, 'terminalBrightCyan', 'terminal bright cyan'),
    'terminal.ansi.bright_white': terminalBrightWhite,
    accents: [...new Set(accentColors)],
    players: buildPlayers(accentColors),
    syntax: buildSyntax(tokens, vscodeTheme),
  }

  const note = requireColor(tokens, 'note', 'note feedback')
  const info = requireColor(tokens, 'info', 'info feedback')
  const success = requireColor(tokens, 'success', 'success feedback')
  const warning = requireColor(tokens, 'warning', 'warning feedback')
  const error = requireColor(tokens, 'error', 'error feedback')
  for (const name of ['hint', 'hidden', 'ignored', 'predictive', 'unreachable']) feedbackStyle(style, name, note)
  for (const name of ['info', 'renamed']) feedbackStyle(style, name, info)
  for (const name of ['success', 'created']) feedbackStyle(style, name, success)
  for (const name of ['warning', 'modified', 'conflict']) feedbackStyle(style, name, warning)
  for (const name of ['error', 'deleted']) feedbackStyle(style, name, error)

  return style
}

function validateHighlightStyle(value, path, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${path} must be an object`)
    return
  }
  if (value.color != null && !COLOR_RE.test(value.color)) errors.push(`${path}.color is not a valid hex color`)
  if (value.background_color != null && !COLOR_RE.test(value.background_color)) {
    errors.push(`${path}.background_color is not a valid hex color`)
  }
  if (value.font_style != null && !FONT_STYLES.has(value.font_style)) {
    errors.push(`${path}.font_style is not supported`)
  }
  if (value.font_weight != null && !FONT_WEIGHTS.has(value.font_weight)) {
    errors.push(`${path}.font_weight is not supported`)
  }
}

export function validateZedThemeFamily(family) {
  const errors = []
  if (!family || typeof family !== 'object' || Array.isArray(family)) return ['theme family must be an object']
  if (family.$schema !== ZED_THEME_SCHEMA_URL) errors.push(`$schema must be ${ZED_THEME_SCHEMA_URL}`)
  if (!String(family.name ?? '').trim()) errors.push('name is required')
  if (!String(family.author ?? '').trim()) errors.push('author is required')
  if (!Array.isArray(family.themes) || family.themes.length === 0) {
    errors.push('themes must be a non-empty array')
    return errors
  }

  const names = new Set()
  family.themes.forEach((theme, index) => {
    const path = `themes[${index}]`
    const name = String(theme?.name ?? '').trim()
    if (!name) errors.push(`${path}.name is required`)
    if (names.has(name)) errors.push(`${path}.name is duplicated: ${name}`)
    names.add(name)
    if (theme?.appearance !== 'dark' && theme?.appearance !== 'light') {
      errors.push(`${path}.appearance must be dark or light`)
    }
    if (!theme?.style || typeof theme.style !== 'object' || Array.isArray(theme.style)) {
      errors.push(`${path}.style must be an object`)
      return
    }
    for (const key of ZED_REQUIRED_STYLE_KEYS) {
      if (!(key in theme.style)) errors.push(`${path}.style is missing ${key}`)
    }
    for (const [key, value] of Object.entries(theme.style)) {
      const stylePath = `${path}.style.${key}`
      if (key === 'background.appearance') {
        if (!['opaque', 'transparent', 'blurred'].includes(value)) errors.push(`${stylePath} is invalid`)
      } else if (key === 'syntax') {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          errors.push(`${stylePath} must be an object`)
        } else {
          for (const [capture, highlight] of Object.entries(value)) {
            validateHighlightStyle(highlight, `${stylePath}.${capture}`, errors)
          }
        }
      } else if (key === 'accents') {
        if (!Array.isArray(value) || value.some((color) => !COLOR_RE.test(color))) {
          errors.push(`${stylePath} must be an array of hex colors`)
        }
      } else if (key === 'players') {
        if (!Array.isArray(value) || value.length === 0) {
          errors.push(`${stylePath} must be a non-empty array`)
        } else {
          value.forEach((player, playerIndex) => {
            for (const field of ['cursor', 'background', 'selection']) {
              if (!COLOR_RE.test(player?.[field] ?? '')) {
                errors.push(`${stylePath}[${playerIndex}].${field} is not a valid hex color`)
              }
            }
          })
        }
      } else if (value != null && !COLOR_RE.test(value)) {
        errors.push(`${stylePath} is not a valid hex color`)
      }
    }
  })
  return errors
}

export function renderZedThemeFamily({ name, author, themes }) {
  const family = {
    $schema: ZED_THEME_SCHEMA_URL,
    name,
    author,
    themes,
  }
  const errors = validateZedThemeFamily(family)
  if (errors.length > 0) throw new Error(`zed emitter: invalid theme family\n- ${errors.join('\n- ')}`)
  return `${JSON.stringify(family, null, 2)}\n`
}
