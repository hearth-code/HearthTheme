// The colour value domain — one concrete implementation of the generic
// `Domain` contract (scripts/theme-engine/types.mjs).
//
// Phase 1 of the extraction plan: this is a THIN WRAPPER over the primitives the
// current pipeline already uses (scripts/color-utils.mjs, color-system/solve.mjs),
// so it is provably equivalent and risk-free. It is additive — build.mjs is not
// re-pointed at it until Phase 3 (T3.1), where the transforms below replace the
// inline math in applyDerive / applyAbstractDerive 1:1.
//
// Value type V = a normalised hex string (e.g. "#b37f16" or "#cb9322a6").

import { clamp, contrastRatio, hexToRgba, mixHex, normalizeHex, rgbaToHex } from '../../color-utils.mjs'
import { solveConstrainedColor } from '../../color-system/solve.mjs'

/** Strip an alpha channel: #RRGGBBAA -> #RRGGBB. Mirrors build.mjs toOpaqueHex. */
export function toOpaqueHex(hex) {
  const normalized = normalizeHex(hex)
  if (!normalized) return null
  return normalized.length === 9 ? normalized.slice(0, 7) : normalized
}

/** @type {import('../types.mjs').Domain<string>} */
export const colorDomain = {
  parse(raw) {
    const hex = normalizeHex(raw)
    if (!hex) throw new Error(`colorDomain.parse: invalid colour ${String(raw)}`)
    return hex
  },

  serialize(value) {
    return value
  },

  transforms: {
    // Mix toward an ALREADY-RESOLVED target colour by ratio t. (Source-graph
    // resolution of `with` is core's job; the maths is the domain's.) Mirrors
    // the `mix` branch of build.mjs applyDerive.
    mix(value, { with: target, t }) {
      const a = normalizeHex(value)
      const b = normalizeHex(target)
      if (!a || !b) throw new Error(`colorDomain.mix: invalid operands ${value} / ${target}`)
      return mixHex(a, b, t)
    },

    // Append an alpha channel: round(clamp(alpha,0,1) * 255). Does NOT composite
    // over a background. Mirrors build.mjs applyAlpha exactly.
    alpha(value, { alpha }) {
      const rgba = hexToRgba(value)
      if (!rgba) throw new Error(`colorDomain.alpha: invalid colour ${String(value)}`)
      return rgbaToHex({ r: rgba.r, g: rgba.g, b: rgba.b, a: Math.round(clamp(alpha, 0, 1) * 255), hasAlpha: true })
    },
  },

  constraints: {
    // `against` is the resolved background colour. Returns satisfied + signed
    // margin so the solver can rank candidates.
    minContrast(value, { against, ratio }) {
      const r = contrastRatio(value, against)
      return { ok: r != null && r >= ratio, margin: (r ?? 0) - ratio }
    },
  },

  // Pass-through to the existing pure solver. NOTE: solveConstrainedColor still
  // takes constraints shaped as { kind, bg, ratio } (resolved background under
  // `bg`), whereas the source/constraint registry above uses `against`. Unifying
  // those two shapes is Phase 3 (T3.1) work; for now this stays a faithful
  // wrapper of the shipped behaviour. Returns the resolved colour string.
  solve(anchor, constraints) {
    return solveConstrainedColor({ anchor, constraints }).color
  },
}
