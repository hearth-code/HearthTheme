import {
  clamp,
  contrastRatio,
  hexToRgb,
  labToXyz,
  normalizeHex,
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

function constraintSatisfied(hex, constraint) {
  if (constraint.kind === 'minContrast') {
    const ratio = contrastRatio(hex, constraint.bg)
    return ratio != null && ratio >= constraint.ratio
  }
  throw new Error(`solveConstrainedColor: unknown constraint kind "${String(constraint.kind)}"`)
}

function constraintMargin(hex, constraint) {
  if (constraint.kind === 'minContrast') {
    return (contrastRatio(hex, constraint.bg) ?? 0) - constraint.ratio
  }
  return 0
}

function worstMargin(hex, constraints) {
  return Math.min(...constraints.map((constraint) => constraintMargin(hex, constraint)))
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

  const [anchorL, a, b] = hexToLab(anchorHex)
  for (let delta = lightnessStep; delta <= 100; delta += lightnessStep) {
    const candidates = []
    for (const direction of [1, -1]) {
      const lightness = clamp(anchorL + direction * delta, 0, 100)
      const hex = labToHex([lightness, a, b])
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
      `(${constraints.map((c) => `${c.kind}>=${c.ratio} vs ${c.bg}`).join(', ')})`,
  )
}
