import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { deltaE, hexHue, hueDistance, normalizeHex } from '../scripts/color-utils.mjs'

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function tokenRoleColor(theme, scope) {
  for (const entry of theme.tokenColors || []) {
    const scopes = Array.isArray(entry.scope) ? entry.scope : [entry.scope]
    if (!scopes.includes(scope)) continue
    const color = typeof entry.settings === 'string' ? entry.settings : entry.settings?.foreground
    if (normalizeHex(color)) return normalizeHex(color)
  }
  return null
}

test('Ember properties stay olive while strings occupy a distinct warm literal lane', () => {
  for (const variant of ['dark', 'light']) {
    const theme = readJson(`themes/ember-${variant}.json`)
    const property = normalizeHex(
      typeof theme.semanticTokenColors?.property === 'string'
        ? theme.semanticTokenColors.property
        : theme.semanticTokenColors?.property?.foreground,
    )
    const string = tokenRoleColor(theme, 'string')

    assert.ok(property, `Ember ${variant} property color exists`)
    assert.ok(string, `Ember ${variant} string color exists`)

    const propertyHue = hexHue(property)
    const stringHue = hexHue(string)
    const roleHueDistance = hueDistance(propertyHue, stringHue)
    const roleDeltaE = deltaE(property, string)

    assert.ok(propertyHue >= 60 && propertyHue <= 90, `Ember ${variant} property hue ${propertyHue.toFixed(1)} must stay olive`)
    assert.ok(stringHue >= 28 && stringHue <= 45, `Ember ${variant} string hue ${stringHue.toFixed(1)} must occupy the warm literal lane`)
    assert.ok(roleHueDistance >= 30, `Ember ${variant} property/string hue distance ${roleHueDistance.toFixed(1)} < 30`)
    assert.ok(roleDeltaE >= 24, `Ember ${variant} property/string deltaE ${roleDeltaE.toFixed(1)} < 24`)
  }
})
