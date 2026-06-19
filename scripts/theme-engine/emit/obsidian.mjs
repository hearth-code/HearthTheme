// The Obsidian platform emitter. It reuses the pure CSS renderer from
// scripts/generate-obsidian-themes.mjs while leaving file writes in the generator.

import { OBSIDIAN_THEME_FILES, buildVariantCssById } from '../../generate-obsidian-themes.mjs'

/** @type {import('../types.mjs').Emitter} */
export const obsidianEmitter = {
  name: 'obsidian',
  consumes: ['tokenSets', 'obsidian'],

  // `maps` is the output of buildGeneratedPlatformTokenMaps(model).
  emit(maps) {
    return Object.entries(OBSIDIAN_THEME_FILES).map(([variantId, path]) => ({
      path,
      content: buildVariantCssById(variantId, maps),
    }))
  },
}
