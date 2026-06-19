// The Obsidian platform emitter. It reuses the pure CSS renderer from
// scripts/generate-obsidian-themes.mjs while leaving file writes in the generator.

import { OBSIDIAN_THEME_FILES, buildVariantCssById } from '../../generate-obsidian-themes.mjs'

/** @type {import('../types.mjs').Emitter} */
export const obsidianEmitter = {
  name: 'obsidian',
  consumes: ['tokenSets', 'obsidian'],

  // `maps` is the output of buildGeneratedPlatformTokenMaps(model).
  emit(maps) {
    // Emit only the variants present in the (possibly variant-scoped) maps; a full
    // build has every variant, so this stays byte-identical.
    return Object.entries(OBSIDIAN_THEME_FILES)
      .filter(([variantId]) => maps.tokenSets?.[variantId])
      .map(([variantId, path]) => ({ path, content: buildVariantCssById(variantId, maps) }))
  },
}
