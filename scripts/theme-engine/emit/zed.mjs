import { buildZedStyle, renderZedThemeFamily } from './zed-core.mjs'

export function createZedEmitter({ familyName, author, themeNames, outputPath }) {
  if (!familyName || !author || !outputPath) {
    throw new Error('createZedEmitter: familyName, author, and outputPath are required')
  }

  return {
    name: `zed:${familyName}`,
    consumes: ['tokenSets', 'themes'],
    emit(maps) {
      const themes = Object.entries(maps.tokenSets ?? {}).map(([variantId, tokens]) => {
        const appearance = maps.themes?.[variantId]?.type ?? variantId
        if (appearance !== 'dark' && appearance !== 'light') {
          throw new Error(`zed emitter: unsupported appearance for variant "${variantId}"`)
        }
        const name = String(themeNames?.[variantId] ?? '').trim()
        if (!name) throw new Error(`zed emitter: missing theme name for variant "${variantId}"`)
        return {
          name,
          appearance,
          style: buildZedStyle(tokens, maps.themes?.[variantId]),
        }
      })

      return [{
        path: outputPath,
        content: renderZedThemeFamily({ name: familyName, author, themes }),
      }]
    },
  }
}
