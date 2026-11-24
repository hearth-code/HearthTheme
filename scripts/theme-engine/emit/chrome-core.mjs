import { contrastRatio, hexToRgba, normalizeHex } from '../../color-utils.mjs'
import { compositeOpaque } from './terminal-core.mjs'

const VARIANT_ORDER = ['dark', 'light']

// Chrome theme text must stay readable on the surface it sits on.
export const CHROME_TEXT_PAIRS = [
  ['tab_text', 'toolbar', 4.5],
  ['toolbar_text', 'toolbar', 4.5],
  ['bookmark_text', 'toolbar', 4.5],
  ['omnibox_text', 'omnibox_background', 4.5],
  ['ntp_text', 'ntp_background', 4.5],
  ['ntp_link', 'ntp_background', 3],
  ['tab_background_text', 'frame', 4.5],
  ['tab_background_text_inactive', 'frame_inactive', 3],
  ['toolbar_button_icon', 'toolbar', 3],
]

function requireHex(tokens, key, label) {
  const value = normalizeHex(tokens?.[key])
  if (!value) throw new Error(`chrome emitter: ${label} is missing valid token "${key}"`)
  return value
}

function rgb(hex) {
  const { r, g, b } = hexToRgba(hex)
  return [Math.round(r), Math.round(g), Math.round(b)]
}

export function buildChromePalette({ variantId, tokens, label }) {
  const bg = requireHex(tokens, 'bg', label)
  const solid = (key) => compositeOpaque(requireHex(tokens, key, label), bg)
  // Dark: the tab strip is the deepest shell, the active tab and toolbar lift one
  // step to the shell band, and the omnibox sits as an inset well on the canvas.
  // Light: the tab strip is the shaded shell, the toolbar is the bright canvas,
  // and the omnibox is a soft line-highlight well.
  const isDark = variantId === 'dark'
  const frame = solid('sidebar')
  const toolbar = isDark ? solid('shellBand') : bg
  const omnibox = isDark ? bg : solid('lineBg')
  return {
    frame,
    frame_inactive: frame,
    frame_incognito: solid('shellRaised'),
    frame_incognito_inactive: solid('shellRaised'),
    background_tab: frame,
    background_tab_inactive: frame,
    toolbar,
    toolbar_text: solid('fg'),
    toolbar_button_icon: solid('shellSupport'),
    tab_text: solid('fg'),
    tab_background_text: solid('shellSupport'),
    tab_background_text_inactive: solid('shellMuted'),
    bookmark_text: solid('shellSupport'),
    omnibox_background: omnibox,
    omnibox_text: solid('fg'),
    ntp_background: bg,
    ntp_text: solid('fg'),
    ntp_link: solid('info'),
    ntp_header: frame,
    button_background: solid('navActiveFill'),
  }
}

export function chromeContrastReport(palette) {
  return CHROME_TEXT_PAIRS.map(([text, surface, min]) => ({
    text,
    surface,
    min,
    ratio: contrastRatio(palette[text], palette[surface]),
  }))
}

export function renderChromeFiles({ schemeId, schemeName, version, tokenSets }) {
  return VARIANT_ORDER.filter((variantId) => tokenSets?.[variantId]).map((variantId) => {
    const variantName = variantId === 'dark' ? 'Dark' : 'Light'
    const label = `HearthCode ${schemeName} ${variantName}`
    const palette = buildChromePalette({ variantId, tokens: tokenSets[variantId], label })
    for (const { text, surface, min, ratio } of chromeContrastReport(palette)) {
      if (!(ratio >= min)) {
        throw new Error(`chrome emitter: ${label} ${text} on ${surface} contrast ${ratio?.toFixed(2)} < ${min}`)
      }
    }
    const manifest = {
      manifest_version: 3,
      name: label,
      version,
      description: `${label}: the HearthCode ${schemeName} color language for Chrome tabs, toolbar and new tab page. Generated from https://github.com/hearth-code/HearthTheme.`,
      theme: {
        colors: Object.fromEntries(Object.entries(palette).map(([key, hex]) => [key, rgb(hex)])),
        properties: { ntp_background_alignment: 'bottom' },
      },
    }
    return {
      path: `chrome/hearthcode-${schemeId}-${variantId}/manifest.json`,
      content: `${JSON.stringify(manifest, null, 2).replace(/\[\s+(\d+),\s+(\d+),\s+(\d+)\s+\]/g, '[$1, $2, $3]')}\n`,
    }
  })
}
