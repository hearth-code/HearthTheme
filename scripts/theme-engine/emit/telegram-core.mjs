import { createRequire } from 'module'
import { crc32 } from 'zlib'
import { contrastRatio, hexToRgba, mixHex, normalizeHex, rgbaToHex } from '../../color-utils.mjs'
import { compositeOpaque } from './terminal-core.mjs'

const require = createRequire(import.meta.url)
const DESKTOP_KEYS = require('./telegram-desktop-keys.json').keys

const VARIANT_ORDER = ['dark', 'light']

// Text that must stay readable on the surface it sits on, checked on every build.
export const TELEGRAM_TEXT_PAIRS = [
  ['text', 'window', 4.5],
  ['text', 'list', 4.5],
  ['text', 'inBubble', 4.5],
  ['text', 'outBubble', 4.5],
  ['sub', 'list', 3],
  ['inDate', 'inBubble', 3],
  ['outDate', 'outBubble', 3],
  ['accentText', 'window', 4.5],
  ['inLink', 'inBubble', 4.5],
  ['outLink', 'outBubble', 4.5],
  ['onAccent', 'accent', 4.5],
  ['activeInk', 'activeFill', 4.5],
  ['danger', 'window', 3],
  ['serviceText', 'serviceBg', 4.5],
]

function requireHex(source, key, label) {
  const value = normalizeHex(source?.[key])
  if (!value) throw new Error(`telegram emitter: ${label} is missing valid color "${key}"`)
  return value
}

function alpha(hex, opacity) {
  const color = hexToRgba(hex)
  return rgbaToHex({ ...color, a: Math.round(opacity * 255), hasAlpha: true })
}

// Move a color toward the text ink until it reaches the contrast floor on a surface.
function readableOn(color, surface, ink, min) {
  let result = color
  for (let step = 1; step <= 20 && contrastRatio(result, surface) < min; step += 1) {
    result = mixHex(color, ink, step / 20)
  }
  return result
}

const PEER_SLOTS = [
  'terminalRed',
  'terminalGreen',
  'terminalYellow',
  'terminalBlue',
  'terminalMagenta',
  'terminalBrightMagenta',
  'terminalCyan',
  'warning',
]

// One shared chat palette per variant. Desktop and iOS both render from it, so a
// message bubble or unread badge looks the same on every Telegram client.
export function buildTelegramPalette({ variantId, tokens, workbench, label }) {
  const isDark = variantId === 'dark'
  const bg = requireHex(tokens, 'bg', label)
  const solid = (key) => compositeOpaque(requireHex(tokens, key, label), bg)
  const accent = compositeOpaque(requireHex(workbench, 'button.background', label), bg)
  const onAccent = compositeOpaque(requireHex(workbench, 'button.foreground', label), accent)
  const text = solid('fg')

  // Dark: the chat canvas is the editor surface, lists and the composer sit on the
  // deeper shell, incoming bubbles lift to the shell band.
  // Light: the canvas is the shaded shell, lists and bubbles are the bright paper.
  const window = bg
  const canvas = isDark ? bg : solid('sidebar')
  const list = isDark ? solid('sidebar') : bg
  const panel = isDark ? solid('sidebar') : bg
  const inBubble = isDark ? solid('shellBand') : bg
  const outBubble = mixHex(inBubble, accent, isDark ? 0.2 : 0.16)
  const sub = solid('shellSupport')
  const accentText = readableOn(accent, window, text, 4.5)
  const danger = readableOn(solid('terminalRed'), window, text, 3)

  const peers = PEER_SLOTS.map((key) => readableOn(solid(key), inBubble, text, 3))
  const avatarTint = isDark ? solid('sidebar') : '#ffffff'
  const avatars = PEER_SLOTS.map((key) => mixHex(solid(key), avatarTint, isDark ? 0 : 0.08))
  const avatarInk = isDark ? solid('sidebar') : bg

  return {
    isDark,
    canvas,
    window,
    list,
    panel,
    hover: solid('navInactiveFill'),
    activeFill: solid('navActiveFill'),
    activeInk: solid('navActiveInk'),
    raised: solid('shellRaised'),
    border: solid('border'),
    text,
    bold: solid('navActiveInk'),
    sub,
    muted: solid('shellMuted'),
    subtle: solid('shellSubtle'),
    accent,
    accentOver: compositeOpaque(requireHex(tokens, 'accentHover', label), bg),
    accentRipple: mixHex(accent, isDark ? '#000000' : '#ffffff', 0.18),
    onAccent,
    accentText,
    accentSoft: mixHex(window, accent, isDark ? 0.18 : 0.2),
    inBubble,
    inBubbleSelected: mixHex(inBubble, accent, 0.28),
    outBubble,
    outBubbleSelected: mixHex(outBubble, accent, 0.22),
    inDate: readableOn(solid('shellMuted'), inBubble, text, 3),
    outDate: readableOn(mixHex(solid('shellMuted'), accent, 0.35), outBubble, text, 3),
    inLink: readableOn(accent, inBubble, text, 4.5),
    outLink: readableOn(accent, outBubble, text, 4.5),
    outAccent: readableOn(accent, outBubble, text, 3),
    mono: readableOn(solid('string'), inBubble, text, 4.5),
    outMono: readableOn(solid('string'), outBubble, text, 4.5),
    serviceBg: alpha(isDark ? solid('shellRaised') : solid('shellSupport'), isDark ? 0.86 : 0.78),
    serviceBgSolid: compositeOpaque(alpha(isDark ? solid('shellRaised') : solid('shellSupport'), isDark ? 0.86 : 0.78), canvas),
    serviceText: isDark ? solid('navActiveInk') : bg,
    success: readableOn(solid('success'), inBubble, text, 3),
    outSuccess: readableOn(solid('success'), outBubble, text, 3),
    warning: solid('warning'),
    danger,
    dangerSoft: mixHex(window, danger, 0.16),
    info: solid('info'),
    selection: compositeOpaque(requireHex(tokens, 'selection', label), bg),
    peers,
    avatars,
    avatarInk,
  }
}

export function telegramContrastReport(palette) {
  return TELEGRAM_TEXT_PAIRS.map(([text, surface, min]) => ({
    text,
    surface,
    min,
    ratio: contrastRatio(palette[text], palette[surface] ?? compositeOpaque(palette[surface], palette.canvas)),
  }))
}

function assertReadable(palette, label) {
  for (const { text, surface, min, ratio } of telegramContrastReport(palette)) {
    if (!(ratio >= min)) {
      throw new Error(`telegram emitter: ${label} ${text} on ${surface} contrast ${ratio?.toFixed(2)} < ${min}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Telegram Desktop (.tdesktop-theme): a zip with colors.tdesktop-theme + tiled.png.
// Keys we do not set keep Telegram's own value; keys whose default points at
// another key are resolved against our values, so nothing light leaks into dark.

function desktopAssignments(p) {
  const shadow = p.isDark ? '#000000' : '#3a2f22'
  const values = {
    windowBg: p.window,
    windowFg: p.text,
    windowBgOver: p.hover,
    windowBgRipple: p.activeFill,
    windowSubTextFg: p.sub,
    windowSubTextFgOver: p.sub,
    windowBoldFg: p.bold,
    windowBoldFgOver: p.bold,
    windowBgActive: p.accent,
    windowFgActive: p.onAccent,
    windowActiveTextFg: p.accentText,
    windowShadowFg: shadow,
    windowShadowFgFallback: p.hover,
    shadowFg: alpha(shadow, p.isDark ? 0.3 : 0.1),
    slideFadeOutBg: alpha(shadow, 0.24),
    imageBgTransparent: p.window,
    activeButtonBgOver: p.accentOver,
    activeButtonBgRipple: p.accentRipple,
    activeButtonSecondaryFg: alpha(p.onAccent, 0.72),
    activeLineFg: p.accent,
    activeLineFgError: p.danger,
    lightButtonBgOver: p.accentSoft,
    lightButtonBgRipple: mixHex(p.accentSoft, p.accent, 0.15),
    attentionButtonFg: p.danger,
    attentionButtonFgOver: p.danger,
    attentionButtonBgOver: p.dangerSoft,
    attentionButtonBgRipple: mixHex(p.dangerSoft, p.danger, 0.15),
    menuIconFg: p.muted,
    menuIconFgOver: p.sub,
    menuSubmenuArrowFg: p.sub,
    menuFgDisabled: p.subtle,
    menuSeparatorFg: p.border,
    scrollBarBg: alpha(p.text, 0.3),
    scrollBarBgOver: alpha(p.text, 0.45),
    scrollBg: alpha(p.text, 0.08),
    scrollBgOver: alpha(p.text, 0.14),
    smallCloseIconFg: p.subtle,
    smallCloseIconFgOver: p.muted,
    placeholderFgActive: p.subtle,
    inputBorderFg: p.border,
    filterInputBorderFg: p.accent,
    checkboxFg: p.muted,
    botKbPrimaryBg: alpha(p.accent, 0.85),
    botKbDangerBg: alpha(p.danger, 0.85),
    botKbSuccessBg: alpha(p.success, 0.85),
    botKbInlinePrimaryBg: alpha(p.accent, 0.7),
    botKbInlineDangerBg: alpha(p.danger, 0.7),
    botKbInlineSuccessBg: alpha(p.success, 0.7),
    sliderBgInactive: p.border,
    tooltipBg: p.raised,
    tooltipFg: p.text,
    tooltipBorderFg: p.border,
    titleShadow: alpha(shadow, 0.03),
    titleBg: p.list,
    titleBgActive: p.list,
    titleButtonFg: p.muted,
    titleButtonBgOver: p.hover,
    titleButtonFgOver: p.sub,
    titleFg: p.muted,
    titleFgActive: p.sub,
    trayCounterBg: p.accent,
    trayCounterBgMute: p.muted,
    trayCounterFg: p.onAccent,
    layerBg: alpha(shadow, 0.5),
    boxTextFgGood: p.success,
    boxTextFgError: p.danger,
    boxTitleFg: p.bold,
    boxTitleAdditionalFg: p.sub,
    paymentsTipActive: p.success,
    callArrowFg: p.success,
    callArrowMissedFg: p.danger,
    introBg: p.window,
    dialogsBg: p.list,
    dialogsDraftFg: p.danger,
    dialogsSendingIconFg: p.muted,
    dialogsSentIconFg: p.success,
    dialogsUnreadBgMuted: p.subtle,
    dialogsOnlineBadgeFg: p.success,
    dialogsSentIconFgOver: p.success,
    dialogsBgActive: p.activeFill,
    dialogsNameFgActive: p.activeInk,
    dialogsDateFgActive: p.sub,
    dialogsTextFgActive: p.sub,
    dialogsTextFgServiceActive: p.accentText,
    dialogsDraftFgActive: p.danger,
    dialogsSendingIconFgActive: p.muted,
    dialogsSentIconFgActive: p.success,
    dialogsOnlineBadgeFgActive: p.success,
    dialogsVerifiedIconBgActive: p.accent,
    dialogsVerifiedIconFgActive: p.onAccent,
    dialogsUnreadBgActive: p.accent,
    dialogsUnreadBgMutedActive: p.subtle,
    dialogsUnreadFgActive: p.onAccent,
    dialogsScamFgActive: p.danger,
    dialogsRippleBgActive: p.hover,
    dialogsMentionIconFg: p.accent,
    dialogsReactionIconFg: p.danger,
    dialogsPollIconFg: p.peers[4],
    searchedTextMatchBg: alpha(p.warning, 0.45),
    searchedTextMatchFg: p.text,
    searchedTextCurrentMatchBg: p.accent,
    searchedTextCurrentMatchFg: p.onAccent,
    emojiPanCategories: p.window,
    emojiPanHeaderBg: alpha(p.window, 0.95),
    emojiIconFg: p.muted,
    emojiSubIconFgActive: p.bold,
    stickerPreviewBg: alpha(p.window, 0.7),
    historyOutIconFg: p.outSuccess,
    historyOutIconFgSelected: p.outSuccess,
    historySendingOutIconFg: p.outDate,
    historySendingInIconFg: p.inDate,
    historyCallArrowInFg: p.success,
    historyCallArrowInFgSelected: p.success,
    historyUnreadBarBg: p.panel,
    historyUnreadBarFg: p.accentText,
    historyForwardChooseBg: alpha(shadow, 0.3),
    historyPeerUserpicFg: p.avatarInk,
    historyPeerArchiveUserpicBg: p.muted,
    historyScrollBarBg: alpha(p.text, 0.3),
    historyScrollBarBgOver: alpha(p.text, 0.45),
    historyScrollBg: alpha(p.text, 0.08),
    historyScrollBgOver: alpha(p.text, 0.14),
    msgInBg: p.inBubble,
    msgInBgSelected: p.inBubbleSelected,
    msgOutBg: p.outBubble,
    msgOutBgSelected: p.outBubbleSelected,
    msgSelectOverlay: alpha(p.accent, 0.3),
    msgStickerOverlay: alpha(p.accent, 0.5),
    msgInServiceFg: p.inLink,
    msgInServiceFgSelected: p.inLink,
    msgOutServiceFg: p.outLink,
    msgOutServiceFgSelected: p.outLink,
    msgInShadow: alpha(shadow, p.isDark ? 0.4 : 0.12),
    msgInShadowSelected: alpha(shadow, p.isDark ? 0.4 : 0.12),
    msgOutShadow: alpha(shadow, p.isDark ? 0.4 : 0.12),
    msgOutShadowSelected: alpha(shadow, p.isDark ? 0.4 : 0.12),
    msgInDateFg: p.inDate,
    msgInDateFgSelected: p.inDate,
    msgOutDateFg: p.outDate,
    msgOutDateFgSelected: p.outDate,
    msgServiceFg: p.serviceText,
    msgServiceBg: p.serviceBg,
    msgServiceBgSelected: alpha(p.accent, 0.6),
    msgInReplyBarColor: p.accent,
    msgInReplyBarSelColor: p.accent,
    msgOutReplyBarColor: p.outAccent,
    msgOutReplyBarSelColor: p.outAccent,
    msgInMonoFg: p.mono,
    msgOutMonoFg: p.outMono,
    msgDateImgBg: alpha(shadow, 0.45),
    msgDateImgBgOver: alpha(shadow, 0.6),
    msgDateImgBgSelected: alpha(p.accent, 0.6),
    msgFileThumbLinkInFg: p.inLink,
    msgFileThumbLinkInFgSelected: p.inLink,
    msgFileThumbLinkOutFg: p.outLink,
    msgFileThumbLinkOutFgSelected: p.outLink,
    msgFileInBg: p.accent,
    msgFileInBgOver: p.accentOver,
    msgFileInBgSelected: p.accentOver,
    msgFileOutBg: p.outAccent,
    msgFileOutBgSelected: p.outAccent,
    historyFileInIconFg: p.onAccent,
    historyFileInIconFgSelected: p.onAccent,
    historyFileOutIconFg: p.outBubble,
    historyFileOutIconFgSelected: p.outBubbleSelected,
    historyFileThumbIconFg: p.onAccent,
    historyFileThumbIconFgSelected: p.onAccent,
    msgFile1Bg: p.peers[3],
    msgFile1BgDark: p.peers[3],
    msgFile1BgOver: p.peers[3],
    msgFile1BgSelected: p.peers[3],
    msgFile2Bg: p.peers[1],
    msgFile2BgDark: p.peers[1],
    msgFile2BgOver: p.peers[1],
    msgFile2BgSelected: p.peers[1],
    msgFile3Bg: p.peers[0],
    msgFile3BgDark: p.peers[0],
    msgFile3BgOver: p.peers[0],
    msgFile3BgSelected: p.peers[0],
    msgFile4Bg: p.peers[2],
    msgFile4BgDark: p.peers[2],
    msgFile4BgOver: p.peers[2],
    msgFile4BgSelected: p.peers[2],
    msgWaveformInActive: p.accent,
    msgWaveformInActiveSelected: p.accent,
    msgWaveformInInactive: p.border,
    msgWaveformInInactiveSelected: p.border,
    msgWaveformOutActive: p.outAccent,
    msgWaveformOutActiveSelected: p.outAccent,
    msgWaveformOutInactive: mixHex(p.outBubble, p.outAccent, 0.35),
    msgWaveformOutInactiveSelected: mixHex(p.outBubble, p.outAccent, 0.35),
    msgBotKbOverBgAdd: alpha(p.text, 0.12),
    msgBotKbRippleBg: alpha(shadow, 0.12),
    toastBg: alpha(p.raised, 0.95),
    toastFg: p.text,
    historyToDownShadow: alpha(shadow, 0.25),
    overviewCheckBg: alpha(shadow, 0.25),
    overviewPhotoSelectOverlay: alpha(p.accent, 0.2),
    profileStatusFgOver: p.sub,
    notificationSampleCloseFg: p.subtle,
    notificationSampleTextFg: p.subtle,
    notificationSampleNameFg: p.muted,
    mainMenuCoverBg: p.list,
    mainMenuCloudBg: p.accent,
    mainMenuCloudFg: p.onAccent,
    notificationsBoxScreenBg: p.accent,
    mediaPlayerDisabledFg: p.subtle,
    spellUnderline: alpha(p.danger, 0.6),
    sideBarBg: p.list,
    sideBarBgActive: p.activeFill,
    sideBarBgRipple: p.hover,
    sideBarTextFg: p.sub,
    sideBarTextFgActive: p.activeInk,
    sideBarIconFg: p.muted,
    sideBarIconFgActive: p.accentText,
    sideBarBadgeBg: p.accent,
    sideBarBadgeBgMuted: p.subtle,
    sideBarBadgeFg: p.onAccent,
    rankAdminFg: p.success,
    rankOwnerFg: p.peers[4],
    currencyFg: p.accentText,
    historyComposeAreaBg: p.panel,
    historyPinnedBg: p.panel,
    historyReplyBg: p.panel,
    historyComposeButtonBg: p.panel,
    historyToDownBg: p.panel,
    historySendIconFg: p.accent,
    historySendIconFgOver: p.accentOver,
    topBarBg: p.panel,
    emojiPanBg: p.window,
    mediaPlayerBg: p.panel,
    mainMenuBg: p.window,
  }

  p.peers.forEach((color, index) => {
    const slot = index + 1
    values[`historyPeer${slot}NameFg`] = color
    values[`historyPeer${slot}UserpicBg`] = p.avatars[index]
    values[`historyPeer${slot}UserpicBg2`] = mixHex(p.avatars[index], p.isDark ? '#000000' : p.text, 0.14)
  })
  ;['settingsIconBg1', 'settingsIconBg2', 'settingsIconBg3', 'settingsIconBg4', 'settingsIconBg5', 'settingsIconBg6', 'settingsIconBg8']
    .forEach((key, index) => {
      values[key] = [p.avatars[0], p.avatars[1], p.avatars[7], p.avatars[6], p.avatars[3], p.avatars[4], p.avatars[2]][index]
    })
  values.settingsIconBgArchive = p.muted
  values.settingsIconFg = p.avatarInk
  return values
}

export function resolveDesktopPalette(palette) {
  const assigned = desktopAssignments(palette)
  const known = new Set(DESKTOP_KEYS.map(([key]) => key))
  for (const key of Object.keys(assigned)) {
    if (!known.has(key)) throw new Error(`telegram emitter: unknown Telegram Desktop key "${key}"`)
  }
  const resolved = new Map()
  for (const [key, reference, fallback] of DESKTOP_KEYS) {
    if (assigned[key]) resolved.set(key, assigned[key])
    else if (reference && resolved.has(reference)) resolved.set(key, resolved.get(reference))
    else if (fallback && resolved.has(fallback)) resolved.set(key, resolved.get(fallback))
  }
  return resolved
}

function renderDesktopColors(palette, label) {
  const lines = [`// ${label}`, '// Auto-generated by scripts/sync-themes.mjs. Do not edit.', '']
  for (const [key, value] of resolveDesktopPalette(palette)) {
    lines.push(`${key}: ${value};`)
  }
  return `${lines.join('\n')}\n`
}

// --- tiny deterministic PNG + zip writers (stored blocks, fixed timestamps) ---

function u32(value) {
  const buffer = Buffer.alloc(4)
  buffer.writeUInt32BE(value >>> 0)
  return buffer
}

function pngChunk(type, data) {
  const head = Buffer.from(type, 'ascii')
  return Buffer.concat([u32(data.length), head, data, u32(crc32(Buffer.concat([head, data])))])
}

function adler32(buffer) {
  let a = 1
  let b = 0
  for (const byte of buffer) {
    a = (a + byte) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}

function storedZlib(raw) {
  const blocks = []
  for (let offset = 0; offset < raw.length || offset === 0; offset += 65535) {
    const chunk = raw.subarray(offset, offset + 65535)
    const last = offset + 65535 >= raw.length ? 1 : 0
    const header = Buffer.alloc(5)
    header[0] = last
    header.writeUInt16LE(chunk.length, 1)
    header.writeUInt16LE(~chunk.length & 0xffff, 3)
    blocks.push(header, chunk)
    if (last) break
  }
  return Buffer.concat([Buffer.from([0x78, 0x01]), ...blocks, u32(adler32(raw))])
}

export function solidPng(hex, size = 16) {
  const { r, g, b } = hexToRgba(hex)
  const row = Buffer.alloc(1 + size * 3)
  for (let x = 0; x < size; x += 1) row.set([r, g, b], 1 + x * 3)
  const raw = Buffer.concat(Array.from({ length: size }, () => row))
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr.set([8, 2, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', storedZlib(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

const DOS_DATE = (0 << 9) | (1 << 5) | 1 // 1980-01-01

export function storedZip(entries) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const { name, data } of entries) {
    const nameBuffer = Buffer.from(name, 'utf8')
    const crc = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(10, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(DOS_DATE, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuffer.length, 26)
    local.writeUInt16LE(0, 28)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(10, 6)
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(DOS_DATE, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBuffer.length, 28)
    central.writeUInt32LE(offset, 42)
    locals.push(local, nameBuffer, data)
    centrals.push(central, nameBuffer)
    offset += local.length + nameBuffer.length + data.length
  }
  const centralBuffer = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralBuffer.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, centralBuffer, end])
}

// ---------------------------------------------------------------------------
// Telegram iOS (.tgios-theme): indented key/value text. Keys we leave out fall
// back to the built-in theme named by basedOn.

const hex6 = (value) => value.replace('#', '').toLowerCase()
function ios(value) {
  const color = hexToRgba(value)
  if (!color.hasAlpha || color.a === 255) return hex6(value).slice(0, 6)
  // iOS reads 8-digit colors as AARRGGBB.
  return `${color.a.toString(16).padStart(2, '0')}${hex6(value).slice(0, 6)}`
}

// Some iOS colors are pairs: one for chats with a wallpaper, one without.
const variable = (value) => ({ withWp: value, withoutWp: value })

function iosTree(p, label) {
  const statusBar = p.isDark ? 'white' : 'black'
  const bubble = (bg, selected) => ({
    bg: ios(bg),
    highlightedBg: ios(selected),
    stroke: ios(bg),
  })
  const parted = (side) => {
    const isOut = side === 'out'
    const surface = isOut ? p.outBubble : p.inBubble
    const link = isOut ? p.outLink : p.inLink
    const accent = isOut ? p.outAccent : p.accent
    const date = isOut ? p.outDate : p.inDate
    return {
      bubble: {
        withWp: bubble(surface, isOut ? p.outBubbleSelected : p.inBubbleSelected),
        withoutWp: bubble(surface, isOut ? p.outBubbleSelected : p.inBubbleSelected),
      },
      primaryText: ios(p.text),
      secondaryText: ios(date),
      linkText: ios(link),
      linkHighlight: ios(alpha(accent, 0.3)),
      scam: ios(p.danger),
      textHighlight: ios(alpha(p.warning, 0.45)),
      accentText: ios(link),
      accentControl: ios(accent),
      accentControlDisabled: ios(date),
      mediaActiveControl: ios(accent),
      mediaInactiveControl: ios(mixHex(surface, accent, 0.35)),
      mediaControlInnerBg: ios(surface),
      pendingActivity: ios(date),
      fileTitle: ios(p.text),
      fileDescription: ios(date),
      fileDuration: ios(date),
      mediaPlaceholder: ios(mixHex(surface, p.text, 0.08)),
      textSelection: ios(alpha(accent, 0.3)),
      textSelectionKnob: ios(accent),
    }
  }

  return {
    name: label,
    basedOn: p.isDark ? 'night' : 'day',
    dark: p.isDark ? 'true' : 'false',
    intro: {
      statusBar,
      primaryText: ios(p.text),
      accentText: ios(p.accentText),
      disabledText: ios(p.subtle),
      startButton: ios(p.accent),
      dot: ios(p.subtle),
    },
    passcode: {
      bg: { top: ios(p.list), bottom: ios(p.window) },
      button: ios(p.raised),
    },
    root: {
      statusBar,
      tabBar: {
        background: ios(p.panel),
        separator: ios(p.border),
        icon: ios(p.muted),
        selectedIcon: ios(p.accentText),
        text: ios(p.muted),
        selectedText: ios(p.accentText),
        badgeBackground: ios(p.danger),
        badgeStroke: ios(p.danger),
        badgeText: ios(p.window),
      },
      navBar: {
        button: ios(p.accentText),
        disabledButton: ios(p.subtle),
        primaryText: ios(p.text),
        secondaryText: ios(p.sub),
        control: ios(p.muted),
        accentText: ios(p.accentText),
        background: ios(p.panel),
        opaqueBackground: ios(p.panel),
        separator: ios(p.border),
        badgeFill: ios(p.danger),
        badgeStroke: ios(p.danger),
        badgeText: ios(p.window),
        segmentedBg: ios(p.hover),
        segmentedFg: ios(p.raised),
        segmentedText: ios(p.text),
        segmentedDivider: ios(p.border),
      },
      searchBar: {
        background: ios(p.panel),
        accent: ios(p.accentText),
        inputFill: ios(p.hover),
        inputText: ios(p.text),
        inputPlaceholderText: ios(p.muted),
        inputIcon: ios(p.muted),
        inputClearButton: ios(p.muted),
        separator: ios(p.border),
      },
      keyboard: p.isDark ? 'dark' : 'light',
    },
    list: {
      blocksBg: ios(p.isDark ? p.list : p.canvas),
      modalBlocksBg: ios(p.isDark ? p.list : p.canvas),
      plainBg: ios(p.window),
      modalPlainBg: ios(p.window),
      primaryText: ios(p.text),
      secondaryText: ios(p.sub),
      disabledText: ios(p.subtle),
      accent: ios(p.accentText),
      highlighted: ios(p.accentText),
      destructive: ios(p.danger),
      placeholderText: ios(p.muted),
      itemBlocksBg: ios(p.window),
      itemModalBlocksBg: ios(p.window),
      itemHighlightedBg: ios(p.hover),
      blocksSeparator: ios(p.border),
      plainSeparator: ios(p.border),
      disclosureArrow: ios(p.subtle),
      sectionHeaderText: ios(p.sub),
      freeText: ios(p.sub),
      freeTextError: ios(p.danger),
      freeTextSuccess: ios(p.success),
      freeMonoIcon: ios(p.muted),
      switch: {
        frame: ios(p.border),
        handle: ios(p.isDark ? p.text : p.window),
        content: ios(p.accent),
        positive: ios(p.success),
        negative: ios(p.danger),
      },
      disclosureActions: {
        neutral1: { bg: ios(p.accent), fg: ios(p.onAccent) },
        neutral2: { bg: ios(p.raised), fg: ios(p.text) },
        destructive: { bg: ios(p.danger), fg: ios(p.window) },
        constructive: { bg: ios(p.success), fg: ios(p.window) },
        accent: { bg: ios(p.accent), fg: ios(p.onAccent) },
        warning: { bg: ios(p.warning), fg: ios(p.window) },
        inactive: { bg: ios(p.hover), fg: ios(p.sub) },
      },
      check: { bg: ios(p.accent), stroke: ios(p.muted), fg: ios(p.onAccent) },
      controlSecondary: ios(p.muted),
      freeInputField: {
        bg: ios(p.hover),
        stroke: ios(p.border),
        placeholder: ios(p.muted),
        primary: ios(p.text),
        control: ios(p.muted),
      },
      mediaPlaceholder: ios(p.hover),
      scrollIndicator: ios(alpha(p.text, 0.3)),
      pageIndicatorInactive: ios(p.subtle),
      inputClearButton: ios(p.muted),
    },
    chatList: {
      bg: ios(p.list),
      itemSeparator: ios(p.border),
      itemBg: ios(p.list),
      pinnedItemBg: ios(p.hover),
      itemHighlightedBg: ios(p.activeFill),
      pinnedItemHighlightedBg: ios(p.activeFill),
      itemSelectedBg: ios(p.activeFill),
      title: ios(p.bold),
      secretTitle: ios(p.success),
      dateText: ios(p.sub),
      authorName: ios(p.bold),
      messageText: ios(p.sub),
      messageHighlightedText: ios(p.text),
      messageDraftText: ios(p.danger),
      checkmark: ios(p.success),
      pendingIndicator: ios(p.muted),
      failedFill: ios(p.danger),
      failedFg: ios(p.window),
      muteIcon: ios(p.subtle),
      unreadBadgeActiveBg: ios(p.accent),
      unreadBadgeActiveText: ios(p.onAccent),
      unreadBadgeInactiveBg: ios(p.subtle),
      unreadBadgeInactiveText: ios(p.list),
      pinnedBadge: ios(p.subtle),
      pinnedSearchBar: ios(p.hover),
      regularSearchBar: ios(p.hover),
      sectionHeaderBg: ios(p.panel),
      sectionHeaderText: ios(p.sub),
      verifiedIconBg: ios(p.accent),
      verifiedIconFg: ios(p.onAccent),
      secretIcon: ios(p.success),
      pinnedArchiveAvatar: { background: { top: ios(p.accent), bottom: ios(p.accent) }, foreground: ios(p.onAccent) },
      unpinnedArchiveAvatar: { background: { top: ios(p.muted), bottom: ios(p.muted) }, foreground: ios(p.list) },
      onlineDot: ios(p.success),
    },
    chat: {
      defaultWallpaper: ios(p.canvas),
      message: {
        incoming: parted('in'),
        outgoing: parted('out'),
        freeform: {
          withWp: { bg: ios(p.inBubble), highlightedBg: ios(p.inBubbleSelected), stroke: ios(p.inBubble) },
          withoutWp: { bg: ios(p.inBubble), highlightedBg: ios(p.inBubbleSelected), stroke: ios(p.inBubble) },
        },
        infoPrimaryText: ios(p.text),
        infoLinkText: ios(p.inLink),
        outgoingCheck: ios(p.outSuccess),
        mediaDateAndStatusBg: ios(alpha(p.isDark ? '#000000' : '#3a2f22', 0.45)),
        mediaDateAndStatusText: 'ffffff',
        shareButtonBg: variable(ios(p.serviceBg)),
        shareButtonStroke: variable(ios(p.serviceBg)),
        shareButtonFg: variable(ios(p.serviceText)),
        mediaOverlayControl: { bg: ios(alpha('#000000', 0.45)), fg: 'ffffff' },
        selectionControl: { bg: ios(p.accent), stroke: ios(p.muted), fg: ios(p.onAccent) },
        deliveryFailed: { bg: ios(p.danger), fg: ios(p.window) },
        mediaHighlightOverlay: ios(alpha(p.window, 0.6)),
      },
      serviceMessage: {
        components: {
          withDefaultWp: {
            bg: ios(p.serviceBg),
            primaryText: ios(p.serviceText),
            linkHighlight: ios(alpha(p.serviceText, 0.2)),
            scam: ios(p.danger),
            dateFillStatic: ios(p.serviceBg),
            dateFillFloat: ios(p.serviceBg),
          },
          withCustomWp: {
            bg: ios(p.serviceBg),
            primaryText: ios(p.serviceText),
            linkHighlight: ios(alpha(p.serviceText, 0.2)),
            scam: ios(p.danger),
            dateFillStatic: ios(p.serviceBg),
            dateFillFloat: ios(p.serviceBg),
          },
        },
        unreadBarBg: ios(p.panel),
        unreadBarStroke: ios(p.border),
        unreadBarText: ios(p.accentText),
        dateText: variable(ios(p.serviceText)),
      },
      inputPanel: {
        panelBg: ios(p.panel),
        panelBgNoWallpaper: ios(p.panel),
        panelSeparator: ios(p.border),
        panelControlAccent: ios(p.accentText),
        panelControl_v2: ios(p.muted),
        panelControlDisabled: ios(p.subtle),
        panelControlDestructive: ios(p.danger),
        inputBg: ios(p.isDark ? p.window : p.hover),
        inputStroke: ios(p.border),
        inputPlaceholder_v2: ios(p.muted),
        inputText_v2: ios(p.text),
        inputControl_v2: ios(p.muted),
        actionControlBg: ios(p.accent),
        actionControlFg: ios(p.onAccent),
        primaryText: ios(p.text),
        secondaryText: ios(p.sub),
        mediaRecordDot: ios(p.danger),
        mediaRecordControl: {
          button: ios(p.accent),
          micLevel: ios(alpha(p.accent, 0.2)),
          activeIcon: ios(p.onAccent),
        },
      },
      inputMediaPanel: {
        panelSeparator: ios(p.border),
        panelIcon: ios(p.muted),
        panelHighlightedIconBg: ios(p.hover),
        panelHighlightedIcon: ios(p.text),
        stickersBg: ios(p.panel),
        stickersSectionText: ios(p.sub),
        stickersSearchBg: ios(p.hover),
        stickersSearchPlaceholder: ios(p.muted),
        stickersSearchPrimary: ios(p.text),
        stickersSearchControl: ios(p.muted),
        gifsBg: ios(p.panel),
        bg: ios(p.panel),
      },
      inputButtonPanel: {
        panelBg: ios(p.panel),
        panelSeparator: ios(p.border),
        buttonBg: ios(p.raised),
        buttonHighlight: ios(p.hover),
        buttonStroke: ios(p.raised),
        buttonHighlightedBg: ios(p.activeFill),
        buttonHighlightedStroke: ios(p.activeFill),
        buttonText: ios(p.text),
      },
      historyNav: {
        bg: ios(p.panel),
        stroke: ios(p.border),
        fg: ios(p.muted),
        badgeBg: ios(p.accent),
        badgeStroke: ios(p.accent),
        badgeText: ios(p.onAccent),
      },
    },
    actionSheet: {
      dim: ios(alpha('#000000', 0.5)),
      bgType: p.isDark ? 'dark' : 'light',
      opaqueItemBg: ios(p.window),
      itemBg: ios(alpha(p.window, 0.92)),
      opaqueItemHighlightedBg: ios(p.hover),
      itemHighlightedBg: ios(alpha(p.hover, 0.92)),
      opaqueItemSeparator: ios(p.border),
      standardActionText: ios(p.accentText),
      destructiveActionText: ios(p.danger),
      disabledActionText: ios(p.subtle),
      primaryText: ios(p.text),
      secondaryText: ios(p.sub),
      controlAccent: ios(p.accentText),
      inputBg: ios(p.hover),
      inputHollowBg: ios(p.window),
      inputBorder: ios(p.border),
      inputPlaceholder: ios(p.muted),
      inputText: ios(p.text),
      inputClearButton: ios(p.muted),
      checkContent: ios(p.onAccent),
    },
    contextMenu: {
      dim: ios(alpha('#000000', 0.4)),
      background: ios(alpha(p.window, 0.94)),
      itemSeparator: ios(p.border),
      sectionSeparator: ios(p.list),
      itemBg: ios(alpha(p.window, 0)),
      itemHighlightedBg: ios(alpha(p.hover, 0.9)),
      primary: ios(p.text),
      secondary: ios(p.sub),
      destructive: ios(p.danger),
      badgeFill: ios(p.accent),
      badgeForeground: ios(p.onAccent),
      badgeInactiveFill: ios(p.subtle),
      badgeInactiveForeground: ios(p.window),
      extractedTint: ios(alpha(p.window, 0.6)),
    },
    notification: {
      bg: ios(p.window),
      primaryText: ios(p.text),
      expanded: {
        bgType: p.isDark ? 'dark' : 'light',
        navBar: {
          background: ios(p.panel),
          primaryText: ios(p.text),
          control: ios(p.muted),
          separator: ios(p.border),
        },
      },
    },
  }
}

export function renderIosTheme(tree) {
  const lines = []
  const walk = (node, depth) => {
    for (const [key, value] of Object.entries(node)) {
      const indent = '  '.repeat(depth)
      if (value && typeof value === 'object') {
        lines.push(`${indent}${key}:`)
        walk(value, depth + 1)
      } else {
        lines.push(`${indent}${key}: ${value}`)
      }
    }
  }
  walk(tree, 0)
  return `${lines.join('\n')}\n`
}

export function renderTelegramFiles({ schemeId, schemeName, tokenSets, workbench }) {
  const files = []
  for (const variantId of VARIANT_ORDER.filter((id) => tokenSets?.[id])) {
    const label = `HearthCode ${schemeName} ${variantId === 'dark' ? 'Dark' : 'Light'}`
    const palette = buildTelegramPalette({
      variantId,
      tokens: tokenSets[variantId],
      workbench: workbench?.[variantId],
      label,
    })
    assertReadable(palette, label)
    const slug = `hearthcode-${schemeId}-${variantId}`
    const colors = renderDesktopColors(palette, label)
    files.push(
      {
        path: `telegram/desktop/${slug}.tdesktop-theme`,
        content: storedZip([
          { name: 'colors.tdesktop-theme', data: Buffer.from(colors, 'utf8') },
          { name: 'tiled.png', data: solidPng(palette.canvas) },
        ]),
      },
      {
        path: `telegram/ios/${slug}.tgios-theme`,
        content: `// ${label}\n// Auto-generated by scripts/sync-themes.mjs. Do not edit.\n${renderIosTheme(iosTree(palette, label))}`,
      },
    )
  }
  return files
}
