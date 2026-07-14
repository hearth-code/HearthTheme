import {
  COLOR_SYSTEM_SCHEME_ID,
  loadColorSchemeManifest,
} from '../../color-system.mjs'
import { renderTerminalFiles } from './terminal-core.mjs'

export function createTerminalEmitter({ schemeId, schemeName }) {
  if (!schemeId || !schemeName) {
    throw new Error('createTerminalEmitter: schemeId and schemeName are required')
  }

  return {
    name: `terminal:${schemeId}`,
    consumes: ['tokenSets'],
    emit(maps) {
      return renderTerminalFiles({
        schemeId,
        schemeName,
        tokenSets: maps.tokenSets,
      })
    },
  }
}

const activeScheme = loadColorSchemeManifest(COLOR_SYSTEM_SCHEME_ID)

export const terminalEmitter = createTerminalEmitter({
  schemeId: activeScheme.id,
  schemeName: activeScheme.name,
})
