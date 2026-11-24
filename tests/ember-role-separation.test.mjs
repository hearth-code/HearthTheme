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

test('Ember properties stay sage-olive while strings occupy a distinct warm literal lane', () => {
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

    assert.ok(propertyHue >= 80 && propertyHue <= 110, `Ember ${variant} property hue ${propertyHue.toFixed(1)} must stay sage-olive`)
    assert.ok(stringHue >= 28 && stringHue <= 45, `Ember ${variant} string hue ${stringHue.toFixed(1)} must occupy the warm literal lane`)
    assert.ok(roleHueDistance >= 30, `Ember ${variant} property/string hue distance ${roleHueDistance.toFixed(1)} < 30`)
    assert.ok(roleDeltaE >= 24, `Ember ${variant} property/string deltaE ${roleDeltaE.toFixed(1)} < 24`)
  }
})

test('Ember keeps orange for control flow: tags and methods sit in cool lanes', () => {
  for (const variant of ['dark', 'light']) {
    const theme = readJson(`themes/ember-${variant}.json`)
    const keyword = tokenRoleColor(theme, 'keyword')
    const tag = tokenRoleColor(theme, 'entity.name.tag')
    const method = tokenRoleColor(theme, 'entity.name.function.member')
    const fn = tokenRoleColor(theme, 'entity.name.function')

    for (const [role, color] of [['tag', tag], ['method', method]]) {
      assert.ok(color, `Ember ${variant} ${role} color exists`)
      assert.ok(hueDistance(hexHue(color), hexHue(keyword)) >= 90, `Ember ${variant} ${role} hue must sit well away from keyword orange`)
    }
    assert.ok(deltaE(fn, tag) >= 12, `Ember ${variant} function/tag deltaE ${deltaE(fn, tag).toFixed(1)} < 12`)
    assert.ok(deltaE(fn, method) >= 10, `Ember ${variant} function/method deltaE ${deltaE(fn, method).toFixed(1)} < 10`)
  }
})
