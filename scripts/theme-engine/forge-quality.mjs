// Theme Forge quality enforcement: a recolored theme must satisfy the SAME quality
// contract the shipped themes are built and audited against — derived by the shared
// quality-contract core from the same tuning + scheme color-contract in the source
// payload. For each variant this pass (1) SOLVES: closes any critical-pair floor the
// hue spread eroded, moving only chroma + lightness (hue stays where the spread put
// it) via the same solver the build pipeline runs; (2) VERIFIES fail-closed: re-
// measures every floor and the chrome contrast rule on the final colors; (3) REPORTS
// the metrics so the UI can show them and Apply can refuse an unverified theme.
//
// Bundle-safe by construction: everything imported here is already part of the
// Forge worker bundle (the bundle test asserts it stays free of fs/loaders).

import { solveCriticalPairFloors } from '../color-system/solve.mjs'
import { buildQualityContract } from '../color-system/quality-contract-core.mjs'
import { deltaE } from '../color-utils.mjs'
import {
  applyRoleColorToTokenEntries,
  getRoleColorFromTheme,
  GLOBAL_SEPARATION_READABILITY_MIN_BG_CONTRAST,
  setSemanticColor,
} from '../generate-theme-variants.mjs'
import { collectChromeContrastIssues } from './forge-recolor.mjs'

const FORGE_PAIR_DRIFT_CAP = 8

function measureFloors(theme, floors, roleDefById) {
  const measured = []
  for (const { a, b, min } of floors) {
    const colorA = getRoleColorFromTheme(theme, roleDefById.get(a))
    const colorB = getRoleColorFromTheme(theme, roleDefById.get(b))
    if (!colorA || !colorB) continue
    const d = deltaE(colorA, colorB)
    if (d == null) continue
    measured.push({ a, b, min, deltaE: Number(d.toFixed(2)) })
  }
  return measured
}

// Solve + verify + report one variant in place. Returns the variant report.
function enforceVariant(theme, variantId, floors, roleDefById, { verifyChrome = true } = {}) {
  const bg = theme?.colors?.['editor.background']

  const units = []
  for (const roleDef of roleDefById.values()) {
    const color = getRoleColorFromTheme(theme, roleDef)
    if (!color) continue
    units.push({
      id: roleDef.id,
      color,
      // Same canvas floor the build's joint candidates must satisfy, so a solved
      // Forge color is one the pipeline itself could have emitted.
      constraints: bg ? [{ kind: 'minContrast', bg, ratio: GLOBAL_SEPARATION_READABILITY_MIN_BG_CONTRAST }] : [],
    })
  }

  const solution = solveCriticalPairFloors({ units, floors, driftCap: FORGE_PAIR_DRIFT_CAP })

  const movedRoles = []
  const unitById = new Map(units.map((unit) => [unit.id, unit.color]))
  for (const unit of solution.units) {
    const before = unitById.get(unit.id)
    if (!unit.color || unit.color === before) continue
    const roleDef = roleDefById.get(unit.id)
    if (!roleDef) continue
    applyRoleColorToTokenEntries(theme, roleDef.scopes || [], unit.color)
    for (const semanticKey of roleDef.semanticKeys || []) setSemanticColor(theme, semanticKey, unit.color)
    movedRoles.push({ id: unit.id, drift: Number((deltaE(before, unit.color) ?? 0).toFixed(2)) })
  }

  // Verify on the FINAL theme (covers the write-back too, not just the solver's
  // internal state), and fail closed on the chrome rule the recolor promises.
  const pairs = measureFloors(theme, floors, roleDefById)
  const pairViolations = pairs.filter((pair) => pair.deltaE < pair.min - 1e-9)
  // recolorChrome's contrast promise only covers chrome it recolored; an identity
  // chrome transform leaves the shipped chrome (audited by its own contract) as is.
  const chromeIssues = verifyChrome ? collectChromeContrastIssues(theme) : []
  const worstPair = pairs.reduce(
    (worst, pair) => (worst == null || pair.deltaE - pair.min < worst.deltaE - worst.min ? pair : worst),
    null,
  )

  return {
    variantId,
    verified: pairViolations.length === 0 && chromeIssues.length === 0,
    movedRoles,
    worstPair,
    pairViolations,
    chromeIssues,
  }
}

// Enforce the quality contract on every recolored variant, mutating `themes` in
// place. Returns the quality report the worker sends back with the themes.
export function enforceForgeQualityContract(themes, { tuning, colorContract, schemeId, roleDefs, verifyChrome = true }) {
  const variantIds = Object.keys(themes)
  const contract = buildQualityContract({ tuning, colorContract, schemeId, variantIds })
  const roleDefById = new Map((roleDefs || []).filter((def) => def?.id).map((def) => [def.id, def]))

  const report = { verified: true, variants: {} }
  for (const variantId of variantIds) {
    const variantReport = enforceVariant(
      themes[variantId],
      variantId,
      contract.variants[variantId]?.criticalPairFloors || [],
      roleDefById,
      { verifyChrome },
    )
    report.variants[variantId] = variantReport
    if (!variantReport.verified) report.verified = false
  }
  return report
}
