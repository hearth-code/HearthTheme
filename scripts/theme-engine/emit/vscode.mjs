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
    return Object.entries(THEME_FILES).map(([variantId, path]) => {
      const theme = maps.themes?.[variantId]
      if (!theme) {
        throw new Error(`vscodeEmitter: missing theme payload for variant "${variantId}"`)
      }
      return { path, content: renderVscodeThemeJson(theme) }
    })
  },
}
