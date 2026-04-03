import { readFileSync } from 'fs'
import { buildColorLanguageModel } from './color-system/build.mjs'
import {
  COLOR_SYSTEM_ACTIVE_PRODUCT_PATH,
  COLOR_SYSTEM_ACTIVE_SCHEME_PATH,
  COLOR_SYSTEM_ADAPTERS_PATH,
  COLOR_SYSTEM_COMPATIBILITY_BOUNDARIES_PATH,
  COLOR_SYSTEM_FOUNDATION_PATH,
  COLOR_SYSTEM_FEEDBACK_RULES_PATH,
  COLOR_SYSTEM_GUIDANCE_RULES_PATH,
  COLOR_SYSTEM_INTERFACE_RULES_PATH,
  COLOR_SYSTEM_PRODUCT_PATH,
  COLOR_SYSTEM_PRODUCT_PREVIEW_PATH,
  COLOR_SYSTEM_PRODUCT_RELEASE_PATH,
  COLOR_SYSTEM_INTERACTION_RULES_PATH,
  COLOR_SYSTEM_SCHEME_PATH,
  COLOR_SYSTEM_SEMANTIC_RULES_PATH,
  COLOR_SYSTEM_SURFACE_RULES_PATH,
  COLOR_SYSTEM_TAXONOMY_PATH,
  COLOR_SYSTEM_TERMINAL_RULES_PATH,
  COLOR_SYSTEM_TUNING_PATH,
  COLOR_SYSTEM_VARIANT_KNOBS_PATH,
  COLOR_SYSTEM_VARIANT_PROFILES_PATH,
  COLOR_SYSTEM_VSCODE_CHROME_CONTRACT_PATH,
} from './color-system.mjs'

const HEX_RE = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i

const TOP_LAYER_JSON_PATHS = [
  COLOR_SYSTEM_ACTIVE_PRODUCT_PATH,
  COLOR_SYSTEM_ACTIVE_SCHEME_PATH,
  COLOR_SYSTEM_PRODUCT_PATH,
  COLOR_SYSTEM_PRODUCT_PREVIEW_PATH,
  COLOR_SYSTEM_PRODUCT_RELEASE_PATH,
  COLOR_SYSTEM_SCHEME_PATH,
  COLOR_SYSTEM_TAXONOMY_PATH,
  COLOR_SYSTEM_FOUNDATION_PATH,
  COLOR_SYSTEM_SURFACE_RULES_PATH,
  COLOR_SYSTEM_GUIDANCE_RULES_PATH,
  COLOR_SYSTEM_TERMINAL_RULES_PATH,
  COLOR_SYSTEM_INTERFACE_RULES_PATH,
  COLOR_SYSTEM_INTERACTION_RULES_PATH,
  COLOR_SYSTEM_FEEDBACK_RULES_PATH,
  COLOR_SYSTEM_SEMANTIC_RULES_PATH,
  COLOR_SYSTEM_VARIANT_KNOBS_PATH,
  COLOR_SYSTEM_VARIANT_PROFILES_PATH,
]

const NO_DESIGN_HEX_PATHS = [
  COLOR_SYSTEM_PRODUCT_PATH,
  COLOR_SYSTEM_PRODUCT_PREVIEW_PATH,
  COLOR_SYSTEM_PRODUCT_RELEASE_PATH,
  COLOR_SYSTEM_ADAPTERS_PATH,
  COLOR_SYSTEM_COMPATIBILITY_BOUNDARIES_PATH,
  COLOR_SYSTEM_VSCODE_CHROME_CONTRACT_PATH,
  COLOR_SYSTEM_TUNING_PATH,
]

const PRODUCT_ALLOWED_CHANNEL_KEYS = new Set(['website', 'vscode', 'obsidian', 'openvsx'])

const NO_OUTPUT_ESCAPE_PATHS = [
  COLOR_SYSTEM_SURFACE_RULES_PATH,
  COLOR_SYSTEM_GUIDANCE_RULES_PATH,
  COLOR_SYSTEM_TERMINAL_RULES_PATH,
  COLOR_SYSTEM_INTERFACE_RULES_PATH,
  COLOR_SYSTEM_INTERACTION_RULES_PATH,
  COLOR_SYSTEM_FEEDBACK_RULES_PATH,
]

const FORBIDDEN_TOP_LAYER_KEYS = new Set([
  'bindings',
  'chromeBaseline',
  'colors',
  'contributes',
  'includeInReport',
  'obsidian',
  'obsidianVar',
  'outputPath',
  'packageName',
  'requireTokenCoverage',
  'rolePhilosophy',
  'scopes',
  'semanticKeys',
  'semanticTokenColors',
  'templatePath',
  'tokenColors',
  'vscode',
  'vscodeColor',
  'vscodeSemantic',
  'web',
  'webToken',
  'website',
])

function fail(message) {
  console.error(`[FAIL] ${message}`)
  process.exit(1)
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    fail(`Unable to read ${path}: ${error.message}`)
  }
}

function walkJson(value, visit, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkJson(item, visit, `${path}[${index}]`))
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`
    visit({ key, value: child, path: childPath })
    walkJson(child, visit, childPath)
  }
}

function auditTopLayerKeys(path) {
  const allowProductChannelKeys = path.startsWith('products/')
  const data = readJson(path)
  walkJson(data, ({ key, path: keyPath }) => {
    if (FORBIDDEN_TOP_LAYER_KEYS.has(key) && !(allowProductChannelKeys && PRODUCT_ALLOWED_CHANNEL_KEYS.has(key))) {
      fail(`${path}: top-layer file must not define platform/mapping key "${key}" at ${keyPath}`)
    }
    if (key.includes('.')) {
      fail(`${path}: top-layer file must not define dotted platform field "${key}" at ${keyPath}`)
    }
    if (key.startsWith('--')) {
      fail(`${path}: top-layer file must not define CSS variable key "${key}" at ${keyPath}`)
    }
  })
}

function auditNoDesignHex(path) {
  const data = readJson(path)
  walkJson(data, ({ value, path: valuePath }) => {
    if (typeof value === 'string' && HEX_RE.test(value.trim())) {
      fail(`${path}: calibration/contract file must not own direct design hex "${value}" at ${valuePath}`)
    }
  })
}

function auditNoOutputEscape(path) {
  const data = readJson(path)
  walkJson(data, ({ key, path: keyPath }) => {
    if (key === 'output') {
      fail(`${path}: surface/interaction rules must not use derive.output escape hatches at ${keyPath}`)
    }
  })
}

function main() {
  buildColorLanguageModel()

  for (const path of TOP_LAYER_JSON_PATHS) {
    auditTopLayerKeys(path)
  }

  for (const path of NO_DESIGN_HEX_PATHS) {
    auditNoDesignHex(path)
  }

  for (const path of NO_OUTPUT_ESCAPE_PATHS) {
    auditNoOutputEscape(path)
  }

  console.log('[PASS] Source-layer audit passed.')
}

main()
