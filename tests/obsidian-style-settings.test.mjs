import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  loadStyleSettingsSource,
  buildSettingsComment,
  buildStyleSettingsCss,
} from '../scripts/build-obsidian-style-settings.mjs'

const APP_THEME_CSS = 'obsidian/app-theme/theme.css'

// Minimal canonical root blocks so buildStyleSettingsCss can derive accent vars.
const THEME_ROOTS = [
  '.theme-dark { --interactive-accent: #8bb49e; --interactive-accent-hover: #98b69f; --text-on-accent: #191815; }',
  '.theme-light { --interactive-accent: #486a59; --interactive-accent-hover: #445f50; --text-on-accent: #faf5ef; }',
].join('\n')

function extractSettingsBlock(css) {
  const match = css.match(/\/\* @settings\n([\s\S]*?)\n\*\//)
  return match ? match[1] : null
}

// Collect every selector that carries `font-style: italic`, flattened the same
// way the override is (mode prefix stripped) so we can compare like-for-like.
function italicSelectors(css) {
  const selectors = new Set()
  const blockRe = /([^{}]+)\{([^{}]*)\}/g
  let match
  while ((match = blockRe.exec(css)) !== null) {
    if (!/font-style:\s*italic/i.test(match[2])) continue
    for (const raw of match[1].replace(/\/\*[\s\S]*?\*\//g, '').split(',')) {
      const selector = raw.trim().replace(/^\.theme-(?:dark|light)\s+/, '')
      if (selector) selectors.add(selector)
    }
  }
  return selectors
}

test('source declares a valid Style Settings surface', () => {
  const source = loadStyleSettingsSource()
  assert.equal(source.name, 'HearthCode')
  assert.equal(source.id, 'hearthcode')
  assert.ok(Array.isArray(source.settings) && source.settings.length > 0)
  for (const setting of source.settings) {
    assert.ok(setting.id, 'every setting needs an id')
    assert.ok(setting.type, `setting "${setting.id}" needs a type`)
  }
})

test('@settings comment is well-formed and lists every declared knob', () => {
  const source = loadStyleSettingsSource()
  const comment = buildSettingsComment(source)
  assert.ok(comment.startsWith('/* @settings'), 'must open the Style Settings block')
  assert.ok(comment.trimEnd().endsWith('*/'), 'must close the comment')
  assert.match(comment, /name: 'HearthCode'/)
  assert.match(comment, /id: 'hearthcode'/)
  for (const setting of source.settings) {
    assert.ok(comment.includes(`id: '${setting.id}'`), `block must declare ${setting.id}`)
  }
})

test('no-italics override is derived, mode-flattened, and !important-free', () => {
  const source = loadStyleSettingsSource()
  const builtCss = [
    THEME_ROOTS,
    '.theme-dark .cm-comment { color: #aaa; font-style: italic; }',
    '.theme-light .cm-comment { color: #555; font-style: italic; }',
  ].join('\n')
  const css = buildStyleSettingsCss(source, builtCss)
  assert.ok(css.includes('body.hearthcode-no-italics .cm-comment'), 'scopes under the toggle class')
  assert.match(css, /font-style:\s*normal/, 'turns italics off')
  assert.ok(
    !css.includes('.theme-dark .cm-comment') && !css.includes('.theme-light .cm-comment'),
    'flattens the mode prefix off the no-italics override',
  )
  assert.ok(!css.includes('!important'), 'wins on specificity without !important')
  const occurrences = css.split('body.hearthcode-no-italics .cm-comment').length - 1
  assert.equal(occurrences, 1, 'identical dark/light selectors collapse to one rule')
})

test('mono-notes knob maps notes to the configured monospace font', () => {
  const source = loadStyleSettingsSource()
  const css = buildStyleSettingsCss(source, [THEME_ROOTS, '.theme-dark .cm-comment { font-style: italic; }'].join('\n'))
  assert.ok(css.includes('body.hearthcode-mono-notes'))
  assert.ok(css.includes('--font-text: var(--font-monospace)'))
})

test('variable-select options support {label, value} mappings', () => {
  const comment = buildSettingsComment({
    name: 'X',
    id: 'x',
    settings: [
      {
        id: 'hearth-callout-bg-opacity',
        title: 'Callout background',
        type: 'variable-select',
        default: '0.11',
        options: [
          { label: 'Quiet', value: '0.07' },
          { label: 'Medium', value: '0.11' },
        ],
      },
    ],
  })
  assert.match(comment, /options:/)
  assert.match(comment, /- label: 'Quiet'/)
  assert.match(comment, /value: '0.07'/)
  assert.match(comment, /default: '0.11'/)
})

test('declaring the no-italics knob with no italics to neutralize throws', () => {
  const source = loadStyleSettingsSource()
  assert.throws(
    () => buildStyleSettingsCss(source, '.theme-dark .cm-comment { color: #aaa; }'),
    /no italic rules/i,
  )
})

test('shipped theme.css embeds the block and covers every italic selector (never stale)', () => {
  const css = readFileSync(APP_THEME_CSS, 'utf8')
  const block = extractSettingsBlock(css)
  assert.ok(block, 'theme.css must embed the @settings block')

  const source = loadStyleSettingsSource()
  for (const setting of source.settings) {
    assert.ok(block.includes(`id: '${setting.id}'`), `theme.css @settings must list ${setting.id}`)
  }

  for (const selector of italicSelectors(css)) {
    assert.ok(
      css.includes(`body.hearthcode-no-italics ${selector}`),
      `theme.css must neutralize italic selector "${selector}" under the toggle`,
    )
  }
})

// WCAG relative-luminance contrast, mirroring scripts/audit-ink-contrast.mjs.
function contrast(a, b) {
  const lum = (hex) => {
    const ch = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
  }
  const l1 = lum(a)
  const l2 = lum(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

function modeBackground(css, mode) {
  // Anchor on the canonical `\n.theme-<mode> {` root block, not the compound
  // `body.hearthcode-accent-*.theme-<mode>` preset selectors that precede it.
  const match = css.match(
    new RegExp(`\\n\\.theme-${mode} \\{[\\s\\S]*?--background-primary:\\s*(#[0-9a-fA-F]{6})`),
  )
  assert.ok(match, `theme.css must set --background-primary for .theme-${mode}`)
  return match[1]
}

test('every accent preset clears AA 4.5:1 for ink-on-fill and link-on-background', () => {
  const css = readFileSync(APP_THEME_CSS, 'utf8')
  const { accentPresets = {} } = loadStyleSettingsSource()
  assert.ok(Object.keys(accentPresets).length > 0, 'expected at least one accent preset')

  const bg = { dark: modeBackground(css, 'dark'), light: modeBackground(css, 'light') }

  for (const [className, modes] of Object.entries(accentPresets)) {
    for (const mode of ['dark', 'light']) {
      const quad = modes[mode]
      assert.ok(quad, `${className} must define the ${mode} quad`)
      const pairs = {
        'ink/fill': contrast(quad.ink, quad.accent),
        'ink/hover': contrast(quad.ink, quad.hover),
        'link/bg': contrast(quad.accent, bg[mode]),
        'hover/bg': contrast(quad.hover, bg[mode]),
      }
      for (const [label, ratio] of Object.entries(pairs)) {
        assert.ok(ratio >= 4.5, `${className}/${mode} ${label} is ${ratio.toFixed(2)}, below 4.5`)
      }
      const block = css.match(new RegExp(`body\\.${className}\\.theme-${mode} \\{([^}]*)\\}`))
      assert.ok(block, `theme.css must ship ${className} for ${mode}`)
      // The preset sets only the accent SOURCE (+ ink); links, accent text, and
      // markers cascade via var(--interactive-accent) wired in the canonical block.
      assert.ok(
        block[1].includes(`--interactive-accent: ${quad.accent};`),
        `${className}/${mode} must set the accent source`,
      )
      assert.ok(
        block[1].includes(`--interactive-accent-hover: ${quad.hover};`),
        `${className}/${mode} must set the accent-hover source`,
      )
      assert.ok(
        block[1].includes(`--text-on-accent: ${quad.ink};`),
        `${className}/${mode} must set the on-accent ink`,
      )
      // checkboxes use the task-done color, not the accent — the swap must leave them be
      assert.ok(
        !block[1].includes('--checkbox-'),
        `${className}/${mode} must not repaint checkbox (task-done) colors`,
      )
    }
  }
})

test('every accent preset is offered by a class-select option', () => {
  const source = loadStyleSettingsSource()
  const offered = new Set()
  for (const setting of source.settings) {
    for (const option of setting.options || []) {
      offered.add(typeof option === 'object' ? option.value : option)
    }
  }
  for (const className of Object.keys(source.accentPresets || {})) {
    assert.ok(offered.has(className), `${className} must be a class-select option`)
  }
})

test('accent-derived vars cascade from var(--interactive-accent) in both modes', () => {
  const css = readFileSync(APP_THEME_CSS, 'utf8')
  for (const mode of ['dark', 'light']) {
    const root = css.match(new RegExp(`\\n\\.theme-${mode} \\{([\\s\\S]*?)\\n\\}`))
    assert.ok(root, `theme.css must have a canonical .theme-${mode} block`)
    const body = root[1]
    for (const name of ['--text-accent', '--link-color', '--list-marker-color-collapsed']) {
      assert.ok(
        body.includes(`${name}: var(--interactive-accent);`),
        `${mode} ${name} must reference the accent source`,
      )
    }
    for (const name of ['--text-accent-hover', '--link-color-hover']) {
      assert.ok(
        body.includes(`${name}: var(--interactive-accent-hover);`),
        `${mode} ${name} must reference the accent-hover source`,
      )
    }
    // the task-done checkbox keeps its semantic color, never references the accent
    assert.ok(
      !body.includes('--checkbox-color: var(--interactive-accent'),
      `${mode} checkbox must keep its task-done color, not the accent`,
    )
  }
})
