import { readFileSync } from 'fs'

const SOURCE_PATH = 'color-system/framework/obsidian-style-settings.json'

// Body classes that the Style Settings toggles add/remove. The plugin uses each
// toggle's `id` verbatim as the class name, so these must match the source ids.
const NO_ITALICS_CLASS = 'hearthcode-no-italics'
const MONO_NOTES_CLASS = 'hearthcode-mono-notes'

export function loadStyleSettingsSource(path = SOURCE_PATH) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

// Style Settings parses the block as YAML. We always single-quote string scalars
// (doubling any embedded quote) so the output is valid regardless of punctuation,
// and emit booleans/numbers bare so `default: false` and `min: 30` keep their type.
function quoteYaml(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function formatScalar(value) {
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return quoteYaml(value)
}

function serializeSetting(setting) {
  const lines = []
  Object.entries(setting).forEach(([key, value], index) => {
    const lead = index === 0 ? '  - ' : '    '
    if (Array.isArray(value)) {
      lines.push(`${lead}${key}:`)
      for (const item of value) {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          // A list of mappings, e.g. variable-select options: { label, value }.
          Object.entries(item).forEach(([itemKey, itemValue], itemIndex) => {
            const itemLead = itemIndex === 0 ? '      - ' : '        '
            lines.push(`${itemLead}${itemKey}: ${formatScalar(itemValue)}`)
          })
        } else {
          lines.push(`      - ${formatScalar(item)}`)
        }
      }
    } else {
      lines.push(`${lead}${key}: ${formatScalar(value)}`)
    }
  })
  return lines.join('\n')
}

export function buildSettingsComment(source) {
  if (!source || !Array.isArray(source.settings) || source.settings.length === 0) {
    throw new Error('build-obsidian-style-settings: source has no settings')
  }
  const yaml = [
    `name: ${formatScalar(source.name)}`,
    `id: ${formatScalar(source.id)}`,
    'settings:',
    ...source.settings.map(serializeSetting),
  ].join('\n')
  return ['/* @settings', '', yaml, '', '*/'].join('\n')
}

// The "Disable comment italics" override is DERIVED from the theme's own italic
// rules so it can never go stale: we mirror every `font-style: italic` selector,
// strip its `.theme-dark`/`.theme-light` mode prefix (collapsing the two modes
// into one rule), and re-scope it under the toggle's body class. That adds one
// class plus the body element over the originals, so it wins on specificity
// without `!important` (the generated theme uses none).
function buildNoItalicsCss(builtCss) {
  const selectors = new Set()
  const blockRe = /([^{}]+)\{([^{}]*)\}/g
  let match
  while ((match = blockRe.exec(builtCss)) !== null) {
    if (!/font-style:\s*italic/i.test(match[2])) continue
    const selectorText = match[1].replace(/\/\*[\s\S]*?\*\//g, '')
    for (const raw of selectorText.split(',')) {
      const selector = raw.trim().replace(/^\.theme-(?:dark|light)\s+/, '')
      if (selector) selectors.add(`body.${NO_ITALICS_CLASS} ${selector}`)
    }
  }
  if (selectors.size === 0) return ''
  return `${[...selectors].sort().join(',\n')} {\n  font-style: normal;\n}`
}

function buildMonoNotesCss() {
  return `body.${MONO_NOTES_CLASS} {\n  --font-text: var(--font-monospace);\n}`
}

// Read the flat var declarations of the first `.theme-<mode> { ... }` root block.
function readModeVars(builtCss, mode) {
  const start = builtCss.search(new RegExp(`(?:^|\\n)\\.theme-${mode} \\{`))
  if (start < 0) return {}
  const open = builtCss.indexOf('{', start)
  const close = builtCss.indexOf('}', open)
  const body = builtCss.slice(open + 1, close)
  const vars = {}
  for (const match of body.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/gi)) {
    vars[match[1]] = match[2].trim()
  }
  return vars
}

// Curated accent presets. Rather than hardcode which vars carry the accent, we
// DERIVE them from the theme: every var painted with the default accent or its
// hover value (--interactive-accent, --text-accent, --link-color,
// --checkbox-color-hover, --list-marker-color-collapsed, ...) is re-painted with
// the preset, so a preset can never miss a var the theme later starts accenting.
// The on-accent ink is only --text-on-accent — its near-black/near-white value is
// not distinctive enough to match by value safely. Each block is scoped
// body + preset + mode so it wins on specificity without `!important`.
function buildAccentPresetCss(source, builtCss) {
  const presets = source.accentPresets || {}
  if (Object.keys(presets).length === 0) return ''

  const offered = new Set()
  for (const setting of source.settings || []) {
    for (const option of setting.options || []) {
      offered.add(typeof option === 'object' ? option.value : option)
    }
  }

  const rolesByMode = {}
  for (const mode of ['dark', 'light']) {
    const vars = readModeVars(builtCss, mode)
    const accent = vars['--interactive-accent']
    const hover = vars['--interactive-accent-hover']
    if (!accent || !hover || !vars['--text-on-accent']) {
      throw new Error(`build-obsidian-style-settings: could not read default accent vars for .theme-${mode}`)
    }
    // Checkboxes carry the semantic task-done color (--hearth-task-done), not the
    // accent. But --checkbox-color-hover happens to share the default accent-hover
    // value, so exclude the whole --checkbox-* family from the value-matched swap —
    // otherwise a checked box (done green) and its hover (accent) would diverge.
    const isAccentVar = (name) => !name.startsWith('--checkbox-')
    rolesByMode[mode] = {
      accent: Object.keys(vars).filter((name) => isAccentVar(name) && vars[name] === accent),
      hover: Object.keys(vars).filter((name) => isAccentVar(name) && vars[name] === hover),
      ink: ['--text-on-accent'],
    }
  }

  const blocks = []
  for (const [className, modes] of Object.entries(presets)) {
    if (!offered.has(className)) {
      throw new Error(`build-obsidian-style-settings: accent preset "${className}" is not offered by any select option`)
    }
    for (const mode of ['dark', 'light']) {
      const quad = modes[mode]
      if (!quad) continue
      const roles = rolesByMode[mode]
      const decls = [
        ...roles.accent.map((name) => `  ${name}: ${quad.accent};`),
        ...roles.hover.map((name) => `  ${name}: ${quad.hover};`),
        ...roles.ink.map((name) => `  ${name}: ${quad.ink};`),
      ]
      blocks.push(`body.${className}.theme-${mode} {\n${decls.join('\n')}\n}`)
    }
  }
  return blocks.join('\n\n')
}

export function buildStyleSettingsCss(source, builtCss) {
  const ids = new Set((source.settings || []).map((setting) => setting.id))
  const blocks = ['/* Style Settings overrides (consumed by the @settings controls above). */']

  if (ids.has(MONO_NOTES_CLASS)) blocks.push(buildMonoNotesCss())

  if (ids.has(NO_ITALICS_CLASS)) {
    const css = buildNoItalicsCss(builtCss)
    if (!css) {
      throw new Error(
        `build-obsidian-style-settings: "${NO_ITALICS_CLASS}" is declared but the theme has no italic rules to neutralize`
      )
    }
    blocks.push(css)
  }

  const accentCss = buildAccentPresetCss(source, builtCss)
  if (accentCss) blocks.push(accentCss)

  return blocks.join('\n\n')
}
