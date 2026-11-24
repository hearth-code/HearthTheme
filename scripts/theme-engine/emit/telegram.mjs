import { renderTelegramFiles } from './telegram-core.mjs'

export function createTelegramEmitter({ schemeId, schemeName }) {
  if (!schemeId || !schemeName) {
    throw new Error('createTelegramEmitter: schemeId and schemeName are required')
  }
  return {
    name: `telegram:${schemeId}`,
    consumes: ['tokenSets', 'themes'],
    emit(maps) {
      const workbench = Object.fromEntries(
        Object.entries(maps.themes ?? {}).map(([variantId, theme]) => [variantId, theme?.colors]),
      )
      return renderTelegramFiles({ schemeId, schemeName, tokenSets: maps.tokenSets, workbench })
    },
  }
}
