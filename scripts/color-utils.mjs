export function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max)
}

export function normalizeHex(hex) {
  if (typeof hex !== 'string') return null
  const value = hex.trim().toLowerCase()
  if (/^#[0-9a-f]{3}$/.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
  }
  if (/^#[0-9a-f]{4}$/.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}${value[4]}${value[4]}`
  }
  if (/^#[0-9a-f]{6}$/.test(value) || /^#[0-9a-f]{8}$/.test(value)) {
    return value
  }
  return null
}

export function hexToRgba(hex) {
  const normalized = normalizeHex(hex)
  if (!normalized) return null

  const raw = normalized.slice(1)
  if (raw.length === 6) {
    return {
      r: Number.parseInt(raw.slice(0, 2), 16),
      g: Number.parseInt(raw.slice(2, 4), 16),
      b: Number.parseInt(raw.slice(4, 6), 16),
      a: 255,
      hasAlpha: false,
    }
  }

  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
    a: Number.parseInt(raw.slice(6, 8), 16),
    hasAlpha: true,
  }
}

function toHexByte(value) {
  return Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0')
}

export function rgbaToHex({ r, g, b, a = 255, hasAlpha = false }) {
  const rgb = `${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`
  if (!hasAlpha) return `#${rgb}`
  return `#${rgb}${toHexByte(a)}`
}

export function hexToRgb(hex) {
  const rgba = hexToRgba(hex)
  if (!rgba) return null
  return [rgba.r, rgba.g, rgba.b]
}

export function toLinear(channel) {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function fromLinear(channel) {
  const c = clamp(channel, 0, 1)
  const value = c <= 0.0031308 ? 12.92 * c : 1.055 * (c ** (1 / 2.4)) - 0.055
  return value * 255
}

export function rgbToXyz([r, g, b]) {
  const rl = toLinear(r)
  const gl = toLinear(g)
  const bl = toLinear(b)
  return [
    rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375,
    rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175,
    rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041,
  ]
}

export function xyzToLab([x, y, z]) {
  const xr = x / 0.95047
  const yr = y / 1.0
  const zr = z / 1.08883

  const f = (t) => (t > 0.008856 ? t ** (1 / 3) : 7.787 * t + 16 / 116)
  const fx = f(xr)
  const fy = f(yr)
  const fz = f(zr)

  return [
    116 * fy - 16,
    500 * (fx - fy),
    200 * (fy - fz),
  ]
}

export function labToXyz([l, a, b]) {
  const fy = (l + 16) / 116
  const fx = a / 500 + fy
  const fz = fy - b / 200

  const fInv = (t) => {
    const t3 = t ** 3
    return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787
  }

  const xr = fInv(fx)
  const yr = fInv(fy)
  const zr = fInv(fz)

  return [xr * 0.95047, yr * 1.0, zr * 1.08883]
}

export function xyzToRgb([x, y, z]) {
  const rl = x * 3.2404542 + y * -1.5371385 + z * -0.4985314
  const gl = x * -0.969266 + y * 1.8760108 + z * 0.041556
  const bl = x * 0.0556434 + y * -0.2040259 + z * 1.0572252
  return [
    fromLinear(rl),
    fromLinear(gl),
    fromLinear(bl),
  ]
}

export function luminance(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const [r, g, b] = rgb.map(toLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a, b) {
  const l1 = luminance(a)
  const l2 = luminance(b)
  if (l1 == null || l2 == null) return null
  const hi = Math.max(l1, l2)
  const lo = Math.min(l1, l2)
  return (hi + 0.05) / (lo + 0.05)
}

export function deltaE(hexA, hexB) {
  const rgbA = hexToRgb(hexA)
  const rgbB = hexToRgb(hexB)
  if (!rgbA || !rgbB) return null
  const [l1, a1, b1] = xyzToLab(rgbToXyz(rgbA))
  const [l2, a2, b2] = xyzToLab(rgbToXyz(rgbB))
  return Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2)
}

export function rgbToHsl(input) {
  const rgb = Array.isArray(input) ? input : hexToRgb(input)
  if (!rgb) return null
  const [r, g, b] = rgb
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255

  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min

  let h = 0
  const l = (max + min) / 2
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))

  if (delta !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6)
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2)
    else h = 60 * ((rn - gn) / delta + 4)
  }
  if (h < 0) h += 360

  return { h, s, l }
}

export function hslToRgb({ h, s, l }) {
  const hue = ((Number(h) % 360) + 360) % 360
  const sat = clamp(Number(s), 0, 1)
  const light = clamp(Number(l), 0, 1)

  const c = (1 - Math.abs(2 * light - 1)) * sat
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = light - c / 2

  let r1 = 0
  let g1 = 0
  let b1 = 0

  if (hue < 60) {
    r1 = c
    g1 = x
  } else if (hue < 120) {
    r1 = x
    g1 = c
  } else if (hue < 180) {
    g1 = c
    b1 = x
  } else if (hue < 240) {
    g1 = x
    b1 = c
  } else if (hue < 300) {
    r1 = x
    b1 = c
  } else {
    r1 = c
    b1 = x
  }

  return [
    (r1 + m) * 255,
    (g1 + m) * 255,
    (b1 + m) * 255,
  ]
}

export function hslToHex(hsl) {
  const [r, g, b] = hslToRgb(hsl)
  return rgbaToHex({ r, g, b, hasAlpha: false })
}

export function hueDistance(a, b) {
  const diff = Math.abs(a - b)
  return Math.min(diff, 360 - diff)
}

export function isHueInBand(hue, hueMin, hueMax) {
  if (hue == null) return false
  if (hueMin <= hueMax) return hue >= hueMin && hue <= hueMax
  return hue >= hueMin || hue <= hueMax
}

export function nearestHueOnBand(hue, hueMin, hueMax) {
  if (isHueInBand(hue, hueMin, hueMax)) return hue
  const toMin = hueDistance(hue, hueMin)
  const toMax = hueDistance(hue, hueMax)
  return toMin <= toMax ? hueMin : hueMax
}

export function hexHue(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  return rgbToHsl(rgb).h
}

export function labToLch([l, a, b]) {
  const c = Math.sqrt(a ** 2 + b ** 2)
  let h = Math.atan2(b, a) * (180 / Math.PI)
  if (h < 0) h += 360
  return [l, c, h]
}

export function lchToLab([l, c, h]) {
  const radians = (h * Math.PI) / 180
  return [l, c * Math.cos(radians), c * Math.sin(radians)]
}

export function mixHex(a, b, t) {
  const rgbA = hexToRgb(a)
  const rgbB = hexToRgb(b)
  if (!rgbA || !rgbB) return a
  const ratio = clamp(t, 0, 1)
  return rgbaToHex({
    r: rgbA[0] + (rgbB[0] - rgbA[0]) * ratio,
    g: rgbA[1] + (rgbB[1] - rgbA[1]) * ratio,
    b: rgbA[2] + (rgbB[2] - rgbA[2]) * ratio,
    hasAlpha: false,
  })
}
