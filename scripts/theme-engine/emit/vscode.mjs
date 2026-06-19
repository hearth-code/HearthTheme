// The VS Code platform emitter. It wraps the pure "theme object -> JSON bytes"
// part of scripts/generate-theme-variants.mjs behind the Emitter contract.

import { getThemeOutputFiles } from '../../color-system.mjs'

const THEME_FILES = getThemeOutputFiles()

export function renderVscodeThemeJson(theme) {
  return `${JSON.stringify(theme, null, 4)}\n`
}

/** @type {import('../types.mjs').Emitter} */
export const vscodeEmitter = {
  name: 'vscode',
  consumes: ['themes', 'vscode'],

  // `maps` is the output of buildGeneratedPlatformTokenMaps(model).
  emit(maps) {
    // Emit only the variants present in the (possibly variant-scoped) maps; a full
    // build has every variant, so this stays byte-identical.
    return Object.entries(THEME_FILES)
      .filter(([variantId]) => maps.themes?.[variantId])
      .map(([variantId, path]) => ({ path, content: renderVscodeThemeJson(maps.themes[variantId]) }))
  },
}
