import { renderChromeFiles } from './chrome-core.mjs'

export function createChromeEmitter({ schemeId, schemeName, version }) {
  if (!schemeId || !schemeName || !version) {
    throw new Error('createChromeEmitter: schemeId, schemeName and version are required')
  }
  return {
    name: `chrome:${schemeId}`,
    consumes: ['tokenSets'],
    emit(maps) {
      return renderChromeFiles({ schemeId, schemeName, version, tokenSets: maps.tokenSets })
    },
  }
}
