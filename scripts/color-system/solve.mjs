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

function labChroma(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const [, a, b] = hexToLab(hex)
  return Math.sqrt(a ** 2 + b ** 2)
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
  if (constraint.kind === 'maxChroma') {
    const chroma = labChroma(hex)
    return chroma != null && chroma <= constraint.max
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
  if (constraint.kind === 'maxChroma') {
    const chroma = labChroma(hex)
    return chroma == null ? Number.NEGATIVE_INFINITY : constraint.max - chroma
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
  if (constraint.kind === 'maxChroma') {
    return `maxChroma<=${constraint.max}`
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

// Solver for a role chroma ceiling. The cap is a hard upper bound on Lab chroma:
// an under-cap colour is returned untouched, an over-cap one has its chroma
// scaled straight down to the cap on its own hue and lightness (the minimal move
// that satisfies the bound). Unlike the earlier soft budget, it never desaturates
// a colour that is already within the cap.
export function solveChromaCeilingColor({ anchor, maxChroma }) {
  const anchorHex = normalizeHex(anchor)
  if (!anchorHex) {
    throw new Error(`solveChromaCeilingColor: invalid anchor "${String(anchor)}"`)
  }
  if (maxChroma == null) {
    return { color: anchorHex, adjusted: false }
  }
  const constraint = { kind: 'maxChroma', max: maxChroma }
  if (constraintSatisfied(anchorHex, constraint)) {
    return { color: anchorHex, adjusted: false }
  }

  const [l, a, b] = hexToLab(anchorHex)
  const chroma = Math.sqrt(a ** 2 + b ** 2)
  if (!(chroma > 0)) {
    return { color: anchorHex, adjusted: false }
  }
  let scale = maxChroma / chroma
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const next = labToHex([l, a * scale, b * scale])
    if (constraintSatisfied(next, constraint)) {
      return { color: next, adjusted: next.toLowerCase() !== anchorHex.toLowerCase() }
    }
    scale *= 0.98
  }

  throw new Error(`solveChromaCeilingColor: no candidate of anchor ${anchorHex} satisfies ${describeConstraint(constraint)}`)
}

function ratioError(actual, target) {
  if (!actual || !target) return Infinity
  return Math.abs(Math.log(actual) - Math.log(target))
}

function median(values) {
  if (!values || values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

function quantile(sortedValues, q) {
  if (!sortedValues || sortedValues.length === 0) return null
  const index = Math.floor(clamp(q, 0, 1) * (sortedValues.length - 1))
  return sortedValues[index]
}

function roleSeparationBoostFactor(roleProfile, roleId) {
  const map = roleProfile?.boostFactorByRole || {}
  if (roleId == null) return map._unmapped ?? map._default ?? 1
  return map[roleId] ?? map._default ?? 1
}

function roleSeparationLightnessLift(roleProfile, roleId) {
  const map = roleProfile?.lightnessLiftByRole || {}
  if (roleId == null) return map._unmapped ?? map._default ?? 0
  return map[roleId] ?? map._default ?? 0
}

function scaleColorChromaForGlobalSeparation(hex, chromaFactor, lightnessLift = 0, maxChroma = null) {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex
  const [l, a, b] = xyzToLab(rgbToXyz(rgb))
  let nextA = a * chromaFactor
  let nextB = b * chromaFactor
  if (maxChroma != null) {
    const chroma = Math.sqrt(nextA ** 2 + nextB ** 2)
    if (chroma > maxChroma && chroma > 0) {
      const scale = maxChroma / chroma
      nextA *= scale
      nextB *= scale
    }
  }
  const boosted = [clamp(l + lightnessLift, 0, 100), nextA, nextB]
  const [r, g, blue] = xyzToRgb(labToXyz(boosted))
  return rgbaToHex({ r, g, b: blue, hasAlpha: false })
}

function validateGlobalSeparationConstraint(constraint) {
  if (!constraint || constraint.kind !== 'globalSeparation') {
    throw new Error(
      `solveGlobalSeparationConstraint: expected globalSeparation constraint, got "${String(constraint?.kind)}"`,
    )
  }
}

export function computeGlobalSeparationStats(tokenEntries, { baselineDeltaE = 8 } = {}) {
  const colors = []
  for (const entry of tokenEntries || []) {
    const darkColor = normalizeHex(entry?.baselineColor ?? entry?.darkColor)
    const variantColor = normalizeHex(entry?.color ?? entry?.variantColor)
    if (!darkColor || !variantColor) continue
    colors.push({ darkColor, variantColor })
  }

  const ratios = []
  for (let i = 0; i < colors.length; i += 1) {
    for (let j = i + 1; j < colors.length; j += 1) {
      const darkDE = deltaE(colors[i].darkColor, colors[j].darkColor)
      const variantDE = deltaE(colors[i].variantColor, colors[j].variantColor)
      if (!darkDE || !variantDE) continue
      if (darkDE < baselineDeltaE) continue
      ratios.push(variantDE / darkDE)
    }
  }

  const sorted = [...ratios].sort((a, b) => a - b)

  return {
    pairCount: sorted.length,
    medianRatio: median(sorted),
    p10Ratio: quantile(sorted, 0.1),
    p25Ratio: quantile(sorted, 0.25),
    p75Ratio: quantile(sorted, 0.75),
  }
}

export function globalSeparationConstraintSatisfied(stats, constraint) {
  validateGlobalSeparationConstraint(constraint)
  if (!stats || !constraint.target) return true
  if (stats.pairCount === 0 || stats.medianRatio == null) return true

  const tolerance = Math.max(0, constraint.tolerance ?? 0)
  const { target } = constraint
  if (target.median != null && stats.medianRatio < (target.median - tolerance)) return false
  if (target.p25 != null && (stats.p25Ratio == null || stats.p25Ratio < (target.p25 - tolerance))) return false
  if (target.p10 != null && (stats.p10Ratio == null || stats.p10Ratio < (target.p10 - tolerance))) return false
  return true
}

export function globalSeparationConstraintMargin(stats, constraint) {
  validateGlobalSeparationConstraint(constraint)
  if (!stats || !constraint.target) return Infinity
  if (stats.pairCount === 0 || stats.medianRatio == null) return Infinity

  const tolerance = Math.max(0, constraint.tolerance ?? 0)
  const margins = []
  if (constraint.target.median != null) margins.push(stats.medianRatio - (constraint.target.median - tolerance))
  if (constraint.target.p25 != null) {
    margins.push((stats.p25Ratio ?? Number.NEGATIVE_INFINITY) - (constraint.target.p25 - tolerance))
  }
  if (constraint.target.p10 != null) {
    margins.push((stats.p10Ratio ?? Number.NEGATIVE_INFINITY) - (constraint.target.p10 - tolerance))
  }
  return margins.length === 0 ? Infinity : Math.min(...margins)
}

function boostGlobalSeparationEntries(entries, boostContext, initialStats) {
  const { constraint, roleProfile, boostProfile, deficitProfile } = boostContext
  const medianDeficit = constraint.target?.median
    ? constraint.target.median / Math.max(initialStats.medianRatio, deficitProfile.ratioFloorMedian)
    : 1
  const p25Deficit = constraint.target?.p25 && initialStats.p25Ratio
    ? constraint.target.p25 / Math.max(initialStats.p25Ratio, deficitProfile.ratioFloorP25)
    : 1
  const p10Deficit = constraint.target?.p10 && initialStats.p10Ratio
    ? constraint.target.p10 / Math.max(initialStats.p10Ratio, deficitProfile.ratioFloorP10)
    : 1
  const deficit = Math.max(medianDeficit, p25Deficit, p10Deficit)
  const neededFactor = clamp(deficit, deficitProfile.minNeededFactor, boostProfile?.maxNeededFactor ?? 1.45)
  const roleBoostScale = boostProfile?.roleBoostScale ?? 1
  const lightnessLiftScale = boostProfile?.lightnessLiftScale ?? 1
  const maxChroma = boostProfile?.maxChroma ?? null

  return entries.map((entry) => {
    const current = normalizeHex(entry?.color)
    if (!current) return entry
    const localFactor = 1 + (neededFactor - 1) * roleSeparationBoostFactor(roleProfile, entry.roleId) * roleBoostScale
    const baseLift = roleSeparationLightnessLift(roleProfile, entry.roleId)
    const lift = baseLift * lightnessLiftScale
    return {
      ...entry,
      color: scaleColorChromaForGlobalSeparation(current, localFactor, lift, maxChroma),
    }
  })
}

export function solveGlobalSeparationConstraint({
  tokenEntries,
  semanticEntries = [],
  constraint,
  roleProfile = {},
  boostProfile = {},
  defaultMaxBoostRounds = 6,
  deficitProfile = {},
}) {
  validateGlobalSeparationConstraint(constraint)

  let tokens = (tokenEntries || []).map((entry) => ({ ...entry }))
  let semantics = (semanticEntries || []).map((entry) => ({ ...entry }))
  const profile = {
    ratioFloorMedian: 0.2,
    ratioFloorP25: 0.15,
    ratioFloorP10: 0.1,
    minNeededFactor: 1.03,
    ...deficitProfile,
  }
  const maxRounds = boostProfile.maxBoostRounds ?? defaultMaxBoostRounds
  const boostContext = {
    constraint,
    roleProfile,
    boostProfile,
    deficitProfile: profile,
  }
  const telemetry = []

  let stats = computeGlobalSeparationStats(tokens, { baselineDeltaE: constraint.baselineDeltaE ?? 8 })
  for (let round = 0; round < maxRounds; round += 1) {
    if (globalSeparationConstraintSatisfied(stats, constraint)) break
    if (stats.pairCount === 0 || stats.medianRatio == null) break

    const before = stats
    tokens = boostGlobalSeparationEntries(tokens, boostContext, before)
    semantics = boostGlobalSeparationEntries(semantics, boostContext, before)
    stats = computeGlobalSeparationStats(tokens, { baselineDeltaE: constraint.baselineDeltaE ?? 8 })

    if (stats.medianRatio != null) {
      telemetry.push({
        round: round + 1,
        before,
        after: stats,
      })
    }
  }

  return {
    tokenEntries: tokens,
    semanticEntries: semantics,
    stats,
    telemetry,
    satisfied: globalSeparationConstraintSatisfied(stats, constraint),
    margin: globalSeparationConstraintMargin(stats, constraint),
  }
}

// Solver for light-theme readability. A light variant must re-find a tone that is
// legible against BOTH the canvas (bg) and the body text (fg): hard contrast
// floors for both references, plus soft targets that steer the bg/fg contrasts
// toward the dark theme's feel while limiting drift and (optionally) anchoring
// lightness. It walks a lightness x chroma-scale grid and scores each satisfying
// candidate. If the declared floors cannot be satisfied, it throws instead of
// emitting a silent bad color.
export function solveReadabilityColor({ anchor, bg, fg, targetBgContrast, targetFgContrast, options = {}, search = {} }) {
  const anchorHex = normalizeHex(anchor)
  if (!anchorHex) {
    throw new Error(`solveReadabilityColor: invalid anchor "${String(anchor)}"`)
  }
  const bgHex = normalizeHex(bg)
  const fgHex = normalizeHex(fg)
  if (!bgHex || !fgHex) {
    throw new Error('solveReadabilityColor: requires resolved bg and fg colors')
  }
  const baseLab = hexToLab(anchorHex)

  const bgPow = options.bgPow ?? 1.0
  const fgPow = options.fgPow ?? 1.0
  const minContrast = options.minContrast ?? 3.0
  const minL = options.minL ?? 4
  const maxL = options.maxL ?? 96
  const minScale = options.minScale ?? 0.72
  const maxScale = options.maxScale ?? 1.7
  const wBg = options.wBg ?? 0.62
  const wFg = options.wFg ?? 0.30
  const wDrift = options.wDrift ?? 0.08
  const targetL = options.targetL ?? null
  const wL = options.wL ?? 0
  const minFgContrast = options.minFgContrast ?? 1.02
  const scaleStep = search.scaleStep
  const driftDivisor = search.driftDivisor
  const lightnessPenaltyDivisor = search.lightnessPenaltyDivisor

  const effectiveBgTarget = Math.max(minContrast, targetBgContrast ** bgPow)
  const effectiveFgTarget = Math.max(minFgContrast, targetFgContrast ** fgPow)
  const constraints = [
    { kind: 'minContrast', bg: bgHex, ratio: minContrast },
    { kind: 'minContrast', bg: fgHex, ratio: minFgContrast },
  ]

  let bestHex = null
  let bestScore = Infinity
  for (let l = minL; l <= maxL; l += 1) {
    for (let scale = minScale; scale <= maxScale; scale += scaleStep) {
      const candidate = labToHex([l, baseLab[1] * scale, baseLab[2] * scale])
      const candidateBgContrast = contrastRatio(candidate, bgHex)
      const candidateFgContrast = contrastRatio(candidate, fgHex)
      if (!candidateBgContrast || !candidateFgContrast) continue
      if (!constraints.every((constraint) => constraintSatisfied(candidate, constraint))) continue

      const bgError = ratioError(candidateBgContrast, effectiveBgTarget)
      const fgError = ratioError(candidateFgContrast, effectiveFgTarget)
      const drift = (deltaE(candidate, anchorHex) ?? 0) / driftDivisor
      const lightnessPenalty = targetL == null ? 0 : Math.abs(l - targetL) / lightnessPenaltyDivisor
      const score = bgError * wBg + fgError * wFg + drift * wDrift + lightnessPenalty * wL

      if (score < bestScore) {
        bestScore = score
        bestHex = candidate
      }
    }
  }

  if (!bestHex) {
    throw new Error(
      `solveReadabilityColor: no candidate of anchor ${anchorHex} satisfies all constraints ` +
        `(${constraints.map((constraint) => describeConstraint(constraint)).join(', ')})`,
    )
  }

  return { color: bestHex, adjusted: bestHex.toLowerCase() !== anchorHex.toLowerCase() }
}
