import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { inflateRawSync } from 'node:zlib'
import { buildTelegramThemeFiles } from '../scripts/generate-telegram-themes.mjs'

const IDS = ['ember-dark', 'ember-light', 'moss-dark', 'moss-light']

function readStoredZip(buffer) {
  const entries = new Map()
  let offset = 0
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const method = buffer.readUInt16LE(offset + 8)
    const size = buffer.readUInt32LE(offset + 18)
    const nameLength = buffer.readUInt16LE(offset + 26)
    const extraLength = buffer.readUInt16LE(offset + 28)
    const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString('utf8')
    const start = offset + 30 + nameLength + extraLength
    const data = buffer.subarray(start, start + size)
    entries.set(name, method === 0 ? data : inflateRawSync(data))
    offset = start + size
  }
  return entries
}

test('Telegram themes ship Desktop and iOS files for all four variants, matching the committed files', () => {
  const files = buildTelegramThemeFiles()
  assert.deepEqual(
    files.map((file) => file.path).sort(),
    [
      ...IDS.map((id) => `telegram/desktop/hearthcode-${id}.tdesktop-theme`),
      ...IDS.map((id) => `telegram/ios/hearthcode-${id}.tgios-theme`),
    ].sort(),
  )
  for (const file of files) {
    const expected = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, 'utf8')
    assert.ok(fs.readFileSync(file.path).equals(expected), `${file.path} is stale; run pnpm run sync`)
  }
})

test('Telegram Desktop themes are zips with a full color palette and a tiled background', () => {
  const keys = new Set(JSON.parse(fs.readFileSync('scripts/theme-engine/emit/telegram-desktop-keys.json', 'utf8')).keys.map(([key]) => key))
  for (const file of buildTelegramThemeFiles().filter((entry) => entry.path.endsWith('.tdesktop-theme'))) {
    const entries = readStoredZip(file.content)
    assert.deepEqual([...entries.keys()].sort(), ['colors.tdesktop-theme', 'tiled.png'], file.path)
    const png = entries.get('tiled.png')
    assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG', `${file.path}: tiled.png is not a PNG`)
    const lines = entries.get('colors.tdesktop-theme').toString('utf8').split('\n').filter((line) => line && !line.startsWith('//'))
    assert.ok(lines.length > 400, `${file.path}: only ${lines.length} colors`)
    for (const line of lines) {
      const match = line.match(/^(\w+): (#[0-9a-f]{6}(?:[0-9a-f]{2})?);$/)
      assert.ok(match, `${file.path}: bad line "${line}"`)
      assert.ok(keys.has(match[1]), `${file.path}: unknown key ${match[1]}`)
    }
    // Dark themes must not keep Telegram's white defaults anywhere in the chat surface.
    if (file.path.includes('-dark')) {
      const colors = Object.fromEntries(lines.map((line) => line.slice(0, -1).split(': ')))
      for (const key of ['windowBg', 'dialogsBg', 'msgInBg', 'msgOutBg', 'historyComposeAreaBg', 'boxBg', 'menuBg', 'emojiPanBg']) {
        assert.ok(colors[key] && colors[key] !== '#ffffff', `${file.path}: ${key} is ${colors[key]}`)
      }
    }
  }
})

test('Telegram iOS themes are valid indented theme files based on a built-in theme', () => {
  for (const file of buildTelegramThemeFiles().filter((entry) => entry.path.endsWith('.tgios-theme'))) {
    const isDark = file.path.includes('-dark')
    const lines = file.content.split('\n').filter((line) => line && !line.startsWith('//'))
    assert.match(lines[0], /^name: HearthCode (Moss|Ember) (Dark|Light)$/)
    assert.equal(lines[1], `basedOn: ${isDark ? 'night' : 'day'}`)
    assert.equal(lines[2], `dark: ${isDark}`)
    for (const line of lines) {
      const match = line.match(/^((?: {2})*)(\w+):(?: (.+))?$/)
      assert.ok(match, `${file.path}: bad line "${line}"`)
    }
    // iOS silently drops a theme when a grouped color is written as a single value.
    for (const grouped of ['shareButtonBg', 'shareButtonStroke', 'shareButtonFg', 'dateText']) {
      assert.ok(!lines.some((line) => new RegExp(`^ {4}${grouped}: \\S`).test(line)), `${file.path}: ${grouped} must be a withWp/withoutWp group`)
    }
    for (const avatar of ['pinnedArchiveAvatar', 'unpinnedArchiveAvatar']) {
      const index = lines.findIndex((line) => line.trim() === `${avatar}:`)
      assert.equal(lines[index + 1]?.trim(), 'background:', `${file.path}: ${avatar}.background must be a top/bottom gradient`)
    }
    for (const required of ['  tabBar:', '  bg: ', 'chatList:', '    incoming:', '    outgoing:', '  defaultWallpaper: ']) {
      assert.ok(lines.some((line) => line.startsWith(required)), `${file.path}: missing ${required.trim()}`)
    }
  }
})
