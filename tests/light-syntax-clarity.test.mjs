import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { contrastRatio, hexHue, hueDistance, normalizeHex } from '../scripts/color-utils.mjs'

const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'))

const roleAdapters = readJson('color-system/framework/adapters.json').roles
const scopesByRole = new Map(roleAdapters.map((role) => [role.id, role.scopes || []]))

function toScopes(entry) {
  if (!entry?.scope) return []
  return Array.isArray(entry.scope) ? entry.scope : [entry.scope]
}

function getRoleColor(theme, roleId) {
  const expectedScopes = scopesByRole.get(roleId) || []
  let best = null

  for (const entry of theme.tokenColors || []) {
    const entryScopes = toScopes(entry)
    const matchCount = entryScopes.filter((scope) => expectedScopes.includes(scope)).length
    const color = normalizeHex(entry.settings?.foreground)
    if (!matchCount || !color) continue

    const candidate = {
      color,
      ratio: matchCount / entryScopes.length,
      matchCount,
      scopeCount: entryScopes.length,
    }
    const isBetter = !best ||
      candidate.ratio > best.ratio ||
      (candidate.ratio === best.ratio && candidate.matchCount > best.matchCount) ||
      (candidate.ratio === best.ratio && candidate.matchCount === best.matchCount && candidate.scopeCount < best.scopeCount)

    if (isBetter) best = candidate
  }

  return best?.color || null
}

test('guarded light syntax lanes stay distinct from their editor surfaces', () => {
  const expectedGuards = ['ember:type', 'moss:string', 'moss:tag']
  const actualGuards = []

  for (const schemeId of ['ember', 'moss']) {
    const contract = readJson(`color-system/schemes/${schemeId}/color-contract.json`)
    const theme = readJson(`themes/${schemeId}-light.json`)
    const background = normalizeHex(theme.colors['editor.background'])

    for (const lane of Object.values(contract.signalLanes || {})) {
      const thresholds = lane.byVariant?.light
      if (!thresholds) continue

      for (const roleId of lane.roles || []) {
        actualGuards.push(`${schemeId}:${roleId}`)
        const color = getRoleColor(theme, roleId)
        assert.ok(color, `${schemeId} light ${roleId} color exists`)

        if (thresholds.minContrast != null) {
          const contrast = contrastRatio(color, background)
          assert.ok(
            contrast >= thresholds.minContrast,
            `${schemeId} light ${roleId} contrast ${contrast.toFixed(2)} < ${thresholds.minContrast}`,
          )
        }

        if (thresholds.minBackgroundHueDistance != null) {
          const distance = hueDistance(hexHue(color), hexHue(background))
          assert.ok(
            distance >= thresholds.minBackgroundHueDistance,
            `${schemeId} light ${roleId} background hue distance ${distance.toFixed(1)} < ${thresholds.minBackgroundHueDistance}`,
          )
        }
      }
    }
  }

  assert.deepEqual(actualGuards.sort(), expectedGuards.sort())
})
