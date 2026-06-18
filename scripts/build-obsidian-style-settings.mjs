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

export function buildStyleSettingsCss(source, builtCss) {
  const ids = new Set((source.settings || []).map((setting) => setting.id))
  const blocks = ['/* Style Settings overrides (consumed by the @settings toggles above). */']

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

  return blocks.join('\n\n')
}
