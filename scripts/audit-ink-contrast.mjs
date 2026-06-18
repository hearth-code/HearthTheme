import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { contrastRatio, normalizeHex } from './color-utils.mjs'
import { getObsidianThemeOutputFiles } from './color-system.mjs'

// WCAG 2.1 AA for normal-size text. Buttons, links, and badge labels are all
// normal-weight UI text, so they must clear 4.5:1 against the fill behind them.
// This gate exists because the hue/deltaE and editor-surface audits do NOT check
// ink-on-fill luminance contrast, which let a 3.8:1 light-mode accent button ship.
const AA_NORMAL = 4.5

const OBSIDIAN_APP_THEME = 'obsidian/app-theme/theme.css'
const VSCODE_THEME_DIR = 'themes'

const issues = []

function ratio(fill, ink) {
  const a = normalizeHex(stripAlpha(fill))
  const b = normalizeHex(stripAlpha(ink))
  if (!a || !b) return null
  return contrastRatio(a, b)
}

// These pairs are opaque in every shipped variant; if an alpha channel ever
// appears we compare the solid colour rather than silently mis-reporting.
function stripAlpha(hex) {
  if (typeof hex !== 'string') return hex
  const m = hex.trim().match(/^#([0-9a-fA-F]{6})[0-9a-fA-F]{2}$/)
  return m ? `#${m[1]}` : hex
}

function check(label, fill, ink) {
  if (!fill || !ink) return
  const r = ratio(fill, ink)
  if (r == null) return
  const status = r >= AA_NORMAL
  if (!status) {
    issues.push(`${label}: ${r.toFixed(2)}:1 (ink ${ink} on fill ${fill}) is below AA ${AA_NORMAL}:1`)
  }
  console.log(`  ${r >= AA_NORMAL ? 'ok  ' : 'FAIL'} ${r.toFixed(2)}:1  ${label}`)
}

function cssVars(block) {
  const vars = {}
  for (const m of block.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})/g)) {
    vars[m[1]] = m[2]
  }
  return vars
}

function auditObsidianBlock(label, vars) {
  console.log(`\n# Obsidian ${label}`)
  check(`${label} · accent button`, vars['--interactive-accent'], vars['--text-on-accent'])
  check(`${label} · accent button :hover`, vars['--interactive-accent-hover'], vars['--text-on-accent'])
  // --text-accent references var(--interactive-accent); audit the resolved source hex.
  check(`${label} · link text`, vars['--background-primary'], vars['--interactive-accent'])
}

function auditObsidian() {
  // Only the active scheme's Obsidian variants are generated and shipped (the
  // community theme is moss); non-active CSS in obsidian/themes/ is a stale leftover,
  // not a pipeline output. Audit the active outputs plus the packaged app-theme.
  for (const path of Object.values(getObsidianThemeOutputFiles())) {
    if (!existsSync(path)) continue
    const label = path.split('/').pop().replace(/\.css$/, '')
    auditObsidianBlock(label, cssVars(readFileSync(path, 'utf8')))
  }
  if (existsSync(OBSIDIAN_APP_THEME)) {
    const css = readFileSync(OBSIDIAN_APP_THEME, 'utf8')
    if (css.includes('.theme-light') && css.includes('.theme-dark')) {
      auditObsidianBlock('app-theme (dark)', cssVars(css.split('.theme-light')[0]))
      auditObsidianBlock('app-theme (light)', cssVars('.theme-light' + css.split('.theme-light')[1]))
    }
  }
}

function auditVscode() {
  if (!existsSync(VSCODE_THEME_DIR)) return
  for (const file of readdirSync(VSCODE_THEME_DIR).filter((f) => /-(light|dark)\.json$/.test(f)).sort()) {
    const colors = JSON.parse(readFileSync(join(VSCODE_THEME_DIR, file), 'utf8')).colors || {}
    const label = file.replace(/\.json$/, '')
    console.log(`\n# VS Code ${label}`)
    for (const key of ['button', 'badge', 'activityBarBadge']) {
      check(`${label} · ${key}`, colors[`${key}.background`], colors[`${key}.foreground`])
    }
  }
}

console.log('[ink-contrast] checking on-accent / link / chrome text against fills (AA 4.5:1)')
auditObsidian()
auditVscode()

if (issues.length > 0) {
  console.log(`\n[FAIL] ink contrast audit found ${issues.length} pair(s) below AA:`)
  for (const issue of issues) console.log(`  - ${issue}`)
  process.exit(1)
}
console.log('\n[PASS] all on-accent, link, and chrome text pairs clear AA 4.5:1.')
