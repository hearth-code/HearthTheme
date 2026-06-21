import {
  clamp,
  contrastRatio,
  deltaE,
  hexHue,
  hexToRgb,
  hexToRgba,
  hslToHex,
  hueDistance,
  isHueInBand,
  labToLch,
  labToXyz,
  lchToLab,
  mixHex,
  nearestHueOnBand,
  normalizeHex,
  rgbToHsl,
  rgbToXyz,
  rgbaToHex,
  xyzToLab,
  xyzToRgb,
} from '../color-utils.mjs'

// Constraint-solving for chrome / interaction colours.
//
// The authored colour (`anchor`) carries the aesthetic intent. A constraint
// expresses a HARD requirement the colour must meet against another resolved
// colour (e.g. "stay >= 3:1 against the canvas"). The solver keeps the anchor
// untouched when it already satisfies every constraint; otherwise it nudges
// ONLY the lightness (preserving the authored hue + chroma, the way a human
// "deepens" or "lifts" a tone) to the nearest tone that satisfies all of them.
//
// This replaces hand-pinned literals + prose comments ("light is deepened so
// the ring clears 3:1") with an executable rule: the value is correct by
// construction and re-solves if the surface under it ever moves.

function hexToLab(hex) {
  return xyzToLab(rgbToXyz(hexToRgb(hex)))
}

function labToHex([l, a, b]) {
  const [r, g, bChannel] = xyzToRgb(labToXyz([l, a, b]))
  return rgbaToHex({ r, g, b: bChannel })
}

export function blendColorOverBackground(colorHex, bgHex) {
  const state = hexToRgba(colorHex)
  const bg = hexToRgba(bgHex)
  if (!state || !bg) return colorHex
  if (!state.hasAlpha) {
    return rgbaToHex({ r: state.r, g: state.g, b: state.b, hasAlpha: false })
  }
  const alpha = state.a / 255
  return rgbaToHex({
    r: state.r * alpha + bg.r * (1 - alpha),
    g: state.g * alpha + bg.g * (1 - alpha),
    b: state.b * alpha + bg.b * (1 - alpha),
    hasAlpha: false,
  })
}

export function constraintSatisfied(hex, constraint) {
  if (constraint.kind === 'minContrast') {
    const ratio = contrastRatio(hex, constraint.bg)
    return ratio != null && ratio >= constraint.ratio
  }
  if (constraint.kind === 'minCompositeContrast') {
    const ratio = contrastRatio(blendColorOverBackground(hex, constraint.bg), constraint.bg)
    return ratio != null && ratio >= constraint.ratio
  }
  if (constraint.kind === 'hueInBand') {
    const hue = hexHue(hex)
    return hue != null && isHueInBand(hue, constraint.hueMin, constraint.hueMax)
  }
  if (constraint.kind === 'maxDeltaE') {
    const distance = deltaE(hex, constraint.from)
    return distance != null && distance <= constraint.max
  }
  if (constraint.kind === 'minSeparation') {
    const distance = deltaE(hex, constraint.from)
    return distance != null && distance >= constraint.min
  }
  if (constraint.kind === 'maxSeparation') {
    const distance = deltaE(hex, constraint.from)
    return distance != null && distance <= constraint.max
  }
  throw new Error(`solveConstrainedColor: unknown constraint kind "${String(constraint.kind)}"`)
}

export function constraintMargin(hex, constraint) {
  if (constraint.kind === 'minContrast') {
    return (contrastRatio(hex, constraint.bg) ?? 0) - constraint.ratio
  }
  if (constraint.kind === 'minCompositeContrast') {
    return (contrastRatio(blendColorOverBackground(hex, constraint.bg), constraint.bg) ?? 0) - constraint.ratio
  }
  if (constraint.kind === 'hueInBand') {
    const hue = hexHue(hex)
    if (hue == null) return Number.NEGATIVE_INFINITY
    if (isHueInBand(hue, constraint.hueMin, constraint.hueMax)) {
      return Math.min(hueDistance(hue, constraint.hueMin), hueDistance(hue, constraint.hueMax))
    }
    return -hueDistance(hue, nearestHueOnBand(hue, constraint.hueMin, constraint.hueMax))
  }
  if (constraint.kind === 'maxDeltaE') {
    const distance = deltaE(hex, constraint.from)
    return distance == null ? Number.NEGATIVE_INFINITY : constraint.max - distance
  }
  if (constraint.kind === 'minSeparation') {
    const distance = deltaE(hex, constraint.from)
    return distance == null ? Number.NEGATIVE_INFINITY : distance - constraint.min
  }
  if (constraint.kind === 'maxSeparation') {
    const distance = deltaE(hex, constraint.from)
    return distance == null ? Number.NEGATIVE_INFINITY : constraint.max - distance
  }
  throw new Error(`solveConstrainedColor: unknown constraint kind "${String(constraint.kind)}"`)
}

function worstMargin(hex, constraints) {
  return Math.min(...constraints.map((constraint) => constraintMargin(hex, constraint)))
}

function describeConstraint(constraint) {
  if (constraint.kind === 'minContrast' || constraint.kind === 'minCompositeContrast') {
    return `${constraint.kind}>=${constraint.ratio} vs ${constraint.bg}`
  }
  if (constraint.kind === 'hueInBand') {
    return `hueInBand ${constraint.hueMin}-${constraint.hueMax}`
  }
  if (constraint.kind === 'maxDeltaE') {
    return `maxDeltaE<=${constraint.max} from ${constraint.from}`
  }
  if (constraint.kind === 'minSeparation') {
    return `minSeparation>=${constraint.min} from ${constraint.from}`
  }
  if (constraint.kind === 'maxSeparation') {
    return `maxSeparation<=${constraint.max} from ${constraint.from}`
  }
  return String(constraint.kind)
}

export function solveConstrainedColor({ anchor, constraints, lightnessStep = 0.5 }) {
  const anchorHex = normalizeHex(anchor)
  if (!anchorHex) {
    throw new Error(`solveConstrainedColor: invalid anchor "${String(anchor)}"`)
  }
  if (!Array.isArray(constraints) || constraints.length === 0) {
    return { color: anchorHex, adjusted: false }
  }
  if (constraints.every((constraint) => constraintSatisfied(anchorHex, constraint))) {
    return { color: anchorHex, adjusted: false }
  }

  // The lightness search round-trips through Lab, which carries no alpha. Re-attach
  // the authored anchor's alpha to every candidate so a translucent overlay stays
  // translucent instead of silently flattening into a solid fill; the composite
  // constraint still measures the candidate over its background and pulls it into
  // range. (hexToLab already ignores alpha, so the lightness axis is unaffected.)
  const anchorRgba = hexToRgba(anchorHex)
  const withAnchorAlpha = (opaqueHex) => {
    if (!anchorRgba?.hasAlpha) return opaqueHex
    const { r, g, b: blue } = hexToRgba(opaqueHex)
    return rgbaToHex({ r, g, b: blue, a: anchorRgba.a, hasAlpha: true })
  }

  const [anchorL, a, b] = hexToLab(anchorHex)
  for (let delta = lightnessStep; delta <= 100; delta += lightnessStep) {
    const candidates = []
    for (const direction of [1, -1]) {
      const lightness = clamp(anchorL + direction * delta, 0, 100)
      const hex = withAnchorAlpha(labToHex([lightness, a, b]))
      if (constraints.every((constraint) => constraintSatisfied(hex, constraint))) {
        candidates.push(hex)
      }
    }
    if (candidates.length > 0) {
      // Both directions sit the same lightness distance from the anchor; pick
      // the one with the most comfortable worst-case margin.
      candidates.sort((x, y) => worstMargin(y, constraints) - worstMargin(x, constraints))
      return { color: candidates[0], adjusted: true }
    }
  }

  throw new Error(
    `solveConstrainedColor: no lightness of anchor ${anchorHex} satisfies all constraints ` +
      `(${constraints.map((constraint) => describeConstraint(constraint)).join(', ')})`,
  )
}

// Grid for the role-lane hue solve. A role colour can rotate its hue (into the
// declared lane) while trading saturation and lightness. The search runs in HSL
// because that is the space the lane membership is judged in (rgbToHsl hue), so
// a candidate's realized hue equals the chosen hue exactly. Lightness shifts are
// on the 0..1 HSL scale (~the old +-8 on a 0..100 axis).
const HUE_LANE_GRID = {
  lightnessShifts: [-0.08, -0.04, 0, 0.04, 0.08],
  saturationScales: [0.82, 0.9, 1, 1.1],
  hueShifts: [-6, -3, 0, 3, 6],
}

function hueBandFromConstraints(constraints) {
  const band = constraints.find((constraint) => constraint.kind === 'hueInBand')
  return band ? { hueMin: band.hueMin, hueMax: band.hueMax } : null
}

// Multi-axis solver for hue-lane constraints. The anchor carries the authored
// intent; when it already satisfies every constraint it is returned untouched.
// Otherwise the solver rotates the hue toward the declared lane and trades
// saturation/lightness, picking the candidate with the least perceptual drift
// from the anchor (a small hue-distance term breaks ties). Throws when the lane
// plus the other declared constraints cannot be jointly satisfied.
//
// Candidates are generated in HSL — the same space the hue lane is judged in
// (rgbToHsl hue) and audited in (review-moss-visual). Building in HSL makes a
// candidate's realized hue equal the chosen hue exactly, so an in-band target
// lands in band by construction. The earlier LCH generation seeded hue in a
// different space, so realized HSL hue almost never fell in the lane and the
// adjust path could not satisfy hueInBand at all.
export function solveHueLaneColor({ anchor, constraints, grid = HUE_LANE_GRID }) {
  const anchorHex = normalizeHex(anchor)
  if (!anchorHex) {
    throw new Error(`solveHueLaneColor: invalid anchor "${String(anchor)}"`)
  }
  if (!Array.isArray(constraints) || constraints.length === 0) {
    return { color: anchorHex, adjusted: false }
  }
  if (constraints.every((constraint) => constraintSatisfied(anchorHex, constraint))) {
    return { color: anchorHex, adjusted: false }
  }

  const band = hueBandFromConstraints(constraints)
  if (!band) {
    throw new Error('solveHueLaneColor: requires a hueInBand constraint to seed the hue search')
  }

  const seed = rgbToHsl(anchorHex)
  const seedHue = seed.h
  const targetHue = nearestHueOnBand(seedHue, band.hueMin, band.hueMax)

  let bestHex = null
  let bestScore = Number.POSITIVE_INFINITY
  for (const lightnessShift of grid.lightnessShifts) {
    for (const saturationScale of grid.saturationScales) {
      for (const hueShift of grid.hueShifts) {
        const candidateHue = (((targetHue + hueShift) % 360) + 360) % 360
        if (!isHueInBand(candidateHue, band.hueMin, band.hueMax)) continue
        const candidateHex = hslToHex({
          h: candidateHue,
          s: clamp(seed.s * saturationScale, 0, 1),
          l: clamp(seed.l + lightnessShift, 0.06, 0.94),
        })
        if (!constraints.every((constraint) => constraintSatisfied(candidateHex, constraint))) continue

        const realizedHue = hexHue(candidateHex)
        const drift = deltaE(candidateHex, anchorHex) ?? 0
        const score = drift * 0.86 + hueDistance(realizedHue, seedHue) * 0.14
        if (score < bestScore) {
          bestScore = score
          bestHex = candidateHex
        }
      }
    }
  }

  if (!bestHex) {
    throw new Error(
      `solveHueLaneColor: no candidate of anchor ${anchorHex} satisfies all constraints ` +
        `(${constraints.map((constraint) => describeConstraint(constraint)).join(', ')})`,
    )
  }

  return { color: bestHex, adjusted: bestHex.toLowerCase() !== anchorHex.toLowerCase() }
}

// Grids for the near-foreground solve. A role colour must stay perceptually
// separated from the editor foreground (so syntax never blurs into prose) while
// still clearing the canvas. Two directions: when the colour is too FAR from the
// foreground (or under-contrasted) it is mixed toward the foreground; when it is
// too CLOSE it is pushed away by lifting chroma/lightness on its own hue.
const NEAR_FG_MIX_STEPS = 24
const NEAR_FG_PUSH_GRID = {
  chromaScales: [1.05, 1.12, 1.2, 1.32],
  lightnessShifts: [-8, -4, 0, 4, 8],
}

// Solver for the role-vs-foreground separation lane. The constraints declare the
// requirement (separation band against the foreground + canvas contrast); the
// objective steers toward `targetDeltaE` with a light drift penalty. The anchor
// is returned untouched when it already satisfies the band; throws when no
// candidate in the searched direction satisfies every constraint.
export function solveNearForegroundColor({ anchor, fg, bg, minDeltaE, maxDeltaE, minBgContrast, targetDeltaE }) {
  const anchorHex = normalizeHex(anchor)
  if (!anchorHex) {
    throw new Error(`solveNearForegroundColor: invalid anchor "${String(anchor)}"`)
  }
  const fgHex = normalizeHex(fg)
  const bgHex = normalizeHex(bg)
  if (!fgHex || !bgHex) {
    throw new Error('solveNearForegroundColor: requires resolved fg and bg colors')
  }

  const currentDelta = deltaE(anchorHex, fgHex)
  if (currentDelta == null) {
    throw new Error(`solveNearForegroundColor: cannot measure deltaE for anchor ${anchorHex}`)
  }
  const currentContrast = contrastRatio(anchorHex, bgHex) ?? 0
  const target = targetDeltaE ?? clamp((minDeltaE + maxDeltaE) / 2, minDeltaE, maxDeltaE)

  const constraints = [
    { kind: 'minSeparation', from: fgHex, min: minDeltaE },
    { kind: 'maxSeparation', from: fgHex, max: maxDeltaE },
    { kind: 'minContrast', bg: bgHex, ratio: minBgContrast },
  ]
  if (constraints.every((constraint) => constraintSatisfied(anchorHex, constraint))) {
    return { color: anchorHex, adjusted: false }
  }

  let bestHex = null
  let bestScore = Number.POSITIVE_INFINITY
  const consider = (candidateHex, driftWeight) => {
    if (!constraints.every((constraint) => constraintSatisfied(candidateHex, constraint))) return
    const nextDelta = deltaE(candidateHex, fgHex) ?? 0
    const drift = deltaE(candidateHex, anchorHex) ?? 0
    const score = Math.abs(nextDelta - target) + drift * driftWeight
    if (score < bestScore) {
      bestScore = score
      bestHex = candidateHex
    }
  }

  if (currentDelta > maxDeltaE || currentContrast < minBgContrast) {
    // Too far from the foreground (or under-contrasted): walk toward it.
    for (let step = 1; step <= NEAR_FG_MIX_STEPS; step += 1) {
      consider(mixHex(anchorHex, fgHex, step / NEAR_FG_MIX_STEPS), 0.05)
    }
  } else if (currentDelta < minDeltaE) {
    // Too close to the foreground: push away by lifting chroma/lightness on hue.
    const [seedL, seedC, seedHue] = labToLch(hexToLab(anchorHex))
    for (const chromaScale of NEAR_FG_PUSH_GRID.chromaScales) {
      for (const lightnessShift of NEAR_FG_PUSH_GRID.lightnessShifts) {
        const candidateHex = labToHex(lchToLab([
          clamp(seedL + lightnessShift, 6, 94),
          clamp(seedC * chromaScale, 2, 92),
          seedHue,
        ]))
        consider(candidateHex, 0.08)
      }
    }
  }

  if (!bestHex) {
    throw new Error(
      `solveNearForegroundColor: no candidate of anchor ${anchorHex} satisfies all constraints ` +
        `(${constraints.map((constraint) => describeConstraint(constraint)).join(', ')})`,
    )
  }

  return { color: bestHex, adjusted: bestHex.toLowerCase() !== anchorHex.toLowerCase() }
}
