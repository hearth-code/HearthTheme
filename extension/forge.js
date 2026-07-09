'use strict'

// In-editor Theme Forge: a webview that runs the same browser engine as the
// website (extension/media/forge-worker.js, built by scripts/generate-forge-webview.mjs),
// lets the user tune the primary accent live, and on Apply writes the
// resulting themes as theme-scoped colorCustomizations onto the ACTIVE scheme's
// dark AND light variants. Scoping to the active scheme keeps the other scheme
// untouched and avoids painting one scheme's colors onto the other; covering both
// dark+light means the custom look survives a dark/light switch. Reset removes
// exactly the blocks Forge wrote, mirroring the disableItalics override pattern
// in extension.js.

// The themes Forge can paint onto, grouped by scheme, with their dark/light kind
// so the matching generated variant is applied to each.
const HEARTHCODE_THEMES = [
  { label: 'HearthCode Moss Dark', scheme: 'moss', kind: 'dark' },
  { label: 'HearthCode Moss Light', scheme: 'moss', kind: 'light' },
  { label: 'HearthCode Ember Dark', scheme: 'ember', kind: 'dark' },
  { label: 'HearthCode Ember Light', scheme: 'ember', kind: 'light' },
]
const OUR_KEYS = HEARTHCODE_THEMES.map((theme) => `[${theme.label}]`)
// Combined theme-scoped keys earlier Forge builds wrote (Apply used to paint both
// schemes' dark/light together). Apply no longer writes these, but Reset must
// still clear them so users upgrading from an old build don't get Moss and Ember
// stuck sharing one override. NOT the disableItalics all-four key — that's a
// separate feature Reset must leave alone.
const LEGACY_KEYS = [
  '[HearthCode Moss Dark][HearthCode Ember Dark]',
  '[HearthCode Moss Light][HearthCode Ember Light]',
]
const RESET_KEYS = [...OUR_KEYS, ...LEGACY_KEYS]

// Each target maps a generated theme onto one customization setting. `config` is
// the configuration section, `key` the setting within it, `pick` extracts the
// block from a theme JSON object.
const APPLY_TARGETS = [
  { config: 'workbench', key: 'colorCustomizations', pick: (theme) => theme.colors || {} },
  {
    config: 'editor',
    key: 'tokenColorCustomizations',
    pick: (theme) => ({ textMateRules: Array.isArray(theme.tokenColors) ? theme.tokenColors : [] }),
  },
  {
    config: 'editor',
    key: 'semanticTokenColorCustomizations',
    pick: (theme) => ({ enabled: true, rules: theme.semanticTokenColors || {} }),
  },
]

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// Extract a seed color from a deep-link URI (vscode://<publisher>.<name>/forge?color=xxx).
// Returns a normalized `#rrggbb`, or null when absent/malformed. Pure — takes a
// { query } shape so it's testable without a real vscode.Uri.
function parseSeedColor(uri) {
  try {
    const query = uri && typeof uri.query === 'string' ? uri.query : ''
    const raw = new URLSearchParams(query).get('color')
    if (!raw) return null
    const hex = raw.trim().replace(/^#/, '').toLowerCase()
    return /^[0-9a-f]{6}$/.test(hex) ? `#${hex}` : null
  } catch (error) {
    return null
  }
}

// Group the worker's emitted theme files by their declared type. Each file is
// { path, content } where content is a VS Code theme JSON string carrying a
// "type": "dark" | "light" field.
function parseThemesByType(files) {
  const byType = {}
  for (const file of Array.isArray(files) ? files : []) {
    let theme
    try {
      theme = JSON.parse(file.content)
    } catch (error) {
      throw new Error(`Theme Forge: could not parse theme file "${file && file.path}": ${error.message}`)
    }
    if (theme && (theme.type === 'dark' || theme.type === 'light')) {
      byType[theme.type] = theme
    }
  }
  if (!byType.dark || !byType.light) {
    throw new Error('Theme Forge: expected both a dark and a light theme in the applied output')
  }
  return byType
}

// Build the per-target customization ops that paint a scheme's dark+light themes,
// e.g. { config, key, set: { "[HearthCode Moss Dark]": <darkBlock>,
// "[HearthCode Moss Light]": <lightBlock> } }.
function buildSchemeBlocks(themesByType, scheme) {
  const labels = HEARTHCODE_THEMES.filter((theme) => theme.scheme === scheme)
  return APPLY_TARGETS.map((target) => ({
    config: target.config,
    key: target.key,
    set: Object.fromEntries(
      labels.map(({ label, kind }) => [`[${label}]`, target.pick(themesByType[kind])]),
    ),
  }))
}

// Merge into an existing setting value: apply `set` (themeKey → block), drop
// `remove` keys, preserve everything else (the user's own blocks for other
// themes). Returns the next value, or undefined when nothing is left so the
// setting can be cleared entirely.
function mergeGlobalSection(globalValue, { set = {}, remove = [] } = {}) {
  const base = isPlainObject(globalValue) ? globalValue : {}
  const next = { ...base }
  for (const [themeKey, block] of Object.entries(set)) {
    next[themeKey] = block
  }
  for (const themeKey of remove) {
    delete next[themeKey]
  }
  return Object.keys(next).length > 0 ? next : undefined
}

// --- VS Code runtime ---
// `vscode` is injected by activate() (the generated entry passes the module it
// already required) so the pure helpers above stay importable in tests without a
// real vscode module.
let vscode = null

async function writeSections(ops) {
  for (const { config, key, set, remove } of ops) {
    const section = vscode.workspace.getConfiguration(config)
    const inspected = section.inspect(key)
    const globalValue = inspected && isPlainObject(inspected.globalValue) ? inspected.globalValue : {}
    const next = mergeGlobalSection(globalValue, { set, remove })
    if (JSON.stringify(globalValue) === JSON.stringify(next ?? {})) continue
    await section.update(key, next, vscode.ConfigurationTarget.Global)
  }
}

function activeThemeLabel() {
  return vscode.workspace.getConfiguration('workbench').get('colorTheme')
}

async function applyForgeOverride(files) {
  const label = activeThemeLabel()
  const entry = HEARTHCODE_THEMES.find((theme) => theme.label === label)
  if (!entry) {
    throw new Error('switch to a HearthCode theme (Moss or Ember, Dark or Light) first, then Apply')
  }
  await writeSections(buildSchemeBlocks(parseThemesByType(files), entry.scheme))
  return entry.scheme
}

async function clearForgeOverride() {
  await writeSections(
    APPLY_TARGETS.map((target) => ({ config: target.config, key: target.key, set: {}, remove: RESET_KEYS })),
  )
}

function nonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < 32; i += 1) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

function renderWebviewHtml(webview, context, seedColor) {
  const media = (name) => webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', name))
  const uiUri = media('forge-ui.js')
  const workerUri = media('forge-worker.js')
  const sourceUri = media('source.json')
  const n = nonce()
  const csp = [
    "default-src 'none'",
    `img-src ${webview.cspSource} data:`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `font-src ${webview.cspSource}`,
    `script-src 'nonce-${n}'`,
    `worker-src ${webview.cspSource} blob:`,
    `connect-src ${webview.cspSource}`,
  ].join('; ')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>HearthCode Theme Forge</title>
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 16px; }
  h1 { font-size: 1.2rem; margin: 0 0 4px; }
  .sub { color: var(--vscode-descriptionForeground); margin: 0 0 16px; font-size: 0.85rem; }
  .picker { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
  .picker label { font-size: 0.9rem; font-weight: 600; }
  .picker input[type=color] { width: 56px; height: 40px; padding: 0; border: 1px solid var(--vscode-widget-border, #8884); border-radius: 6px; background: none; cursor: pointer; }
  .picker output { font-family: var(--vscode-editor-font-family); font-size: 0.8rem; color: var(--vscode-descriptionForeground); }
  .actions { display: flex; align-items: center; gap: 8px; margin: 12px 0 16px; }
  button { font: inherit; padding: 6px 14px; border: 1px solid var(--vscode-button-border, transparent); border-radius: 4px; cursor: pointer; }
  #forge-apply { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  #forge-reset { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  button:disabled { opacity: 0.5; cursor: default; }
  #forge-accent { width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--vscode-widget-border, #8884); margin-left: auto; }
  #forge-status { font-size: 0.8rem; color: var(--vscode-descriptionForeground); min-height: 1.2em; }
  #forge-preview { margin-top: 12px; border: 1px solid var(--vscode-widget-border, #8884); border-radius: 6px; overflow: hidden; aspect-ratio: 2/1; }
  #forge-preview svg { display: block; width: 100%; height: 100%; }
</style>
</head>
<body>
<h1>Theme Forge</h1>
<p class="sub">Pick a primary color — Forge moves the accent lane and editor chrome while preserving HearthCode's authored syntax structure, contrast, and separation. Apply paints your active HearthCode scheme, dark and light (switch to Moss or Ember first); Reset restores them.</p>

<div class="picker">
  <label for="forge-color">Primary color</label>
  <input id="forge-color" type="color" value="#8fc06b" disabled />
  <output id="forge-readout">hue 120° · saturation 100%</output>
  <span id="forge-accent" aria-hidden="true" style="margin-left:auto"></span>
</div>

<div class="actions">
  <button id="forge-apply" disabled>Apply in editor</button>
  <button id="forge-reset" disabled>Reset</button>
</div>
<div id="forge-status">Loading engine…</div>
<div id="forge-preview"></div>

<script nonce="${n}">
  window.__FORGE__ = ${JSON.stringify({ workerUri: workerUri.toString(), sourceUri: sourceUri.toString(), seedColor: seedColor || null })};
  function forgeStatus(text) { var s = document.getElementById('forge-status'); if (s) s.textContent = text; }
  document.addEventListener('securitypolicyviolation', function (e) {
    forgeStatus('Blocked by CSP: ' + e.violatedDirective + ' → ' + e.blockedURI);
  });
  window.addEventListener('error', function (e) {
    forgeStatus('Load error: ' + (e && (e.message || (e.target && e.target.src)) || 'unknown'));
  });
  window.addEventListener('unhandledrejection', function (e) {
    forgeStatus('Error: ' + (e && e.reason && (e.reason.message || e.reason) || 'unknown'));
  });
</script>
<script type="module" nonce="${n}" src="${uiUri}"></script>
</body>
</html>`
}

let panel = null

function openForge(context, seedColor) {
  if (panel) {
    panel.reveal(vscode.ViewColumn.Active)
    // Already open: hand the new seed to the live webview instead of rebuilding it.
    if (seedColor) panel.webview.postMessage({ type: 'seed', color: seedColor })
    return
  }
  panel = vscode.window.createWebviewPanel('hearthcodeForge', 'Theme Forge', vscode.ViewColumn.Active, {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
  })
  panel.webview.html = renderWebviewHtml(panel.webview, context, seedColor)
  panel.webview.onDidReceiveMessage(async (message) => {
    if (!message || message.type !== 'apply') return
    // Defense in depth behind the webview's own gate: a recolored result carries a
    // quality report from the engine (same contract as the shipped themes); an
    // unverified one must never reach the user's settings.
    if (message.quality && message.quality.verified !== true) {
      vscode.window.showErrorMessage('Theme Forge: this color failed the quality gate — pick another shade.')
      return
    }
    try {
      const scheme = await applyForgeOverride(message.files)
      const schemeName = scheme.charAt(0).toUpperCase() + scheme.slice(1)
      vscode.window.showInformationMessage(`Theme Forge applied to HearthCode ${schemeName} (dark + light). Run "HearthCode: Reset Theme Forge" to restore.`)
    } catch (error) {
      vscode.window.showErrorMessage(`Theme Forge could not apply: ${error instanceof Error ? error.message : String(error)}`)
    }
  })
  panel.onDidDispose(() => {
    panel = null
  })
}

async function resetForge() {
  try {
    await clearForgeOverride()
    vscode.window.showInformationMessage('Theme Forge customizations removed.')
  } catch (error) {
    vscode.window.showErrorMessage(`Theme Forge could not reset: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function activate(context, vscodeApi) {
  vscode = vscodeApi || require('vscode')
  context.subscriptions.push(
    vscode.commands.registerCommand('hearthcode.openForge', () => openForge(context)),
    vscode.commands.registerCommand('hearthcode.resetForge', () => resetForge()),
  )
  // Deep link: opening vscode://hearth-code.hearth-theme/forge?color=xxx from the
  // website lands the user in Forge pre-loaded with that palette (they still click
  // Apply — a link must not silently rewrite settings). Guarded so the pure-helper
  // tests can activate() against a minimal vscode stub.
  if (typeof vscode.window?.registerUriHandler === 'function') {
    context.subscriptions.push(
      vscode.window.registerUriHandler({
        handleUri(uri) {
          openForge(context, parseSeedColor(uri))
        },
      }),
    )
  }
}

function deactivate() {
  panel = undefined
}

module.exports = {
  activate,
  deactivate,
  // exported for tests
  HEARTHCODE_THEMES,
  OUR_KEYS,
  RESET_KEYS,
  APPLY_TARGETS,
  parseThemesByType,
  buildSchemeBlocks,
  mergeGlobalSection,
  parseSeedColor,
}
