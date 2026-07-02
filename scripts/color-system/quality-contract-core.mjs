// Single source for deriving the quality contract from its raw declarations
// (framework tuning + the per-scheme color-contract). The theme generator, the
// theme audit, and the Forge browser worker all import THIS derivation, so a gate
// can never be enforced with one value at build time and another at audit or
// preview time (resolvePairGateFloor in generate-theme-variants and
// resolvePairGateThreshold in theme-audit used to mirror each other by hand).
//
// Pure and import-free on purpose: the Forge worker bundles this module, and the
// browser-bundle tests assert the bundle stays free of fs/loader code.

function finiteOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

// Gate resolution precedence: byScheme[scheme][variant] > byScheme[scheme].default
// > byVariant[variant] > default > fallback.
export function resolvePairGate(profile, { schemeId = null, variantId = null, fallback = null } = {}) {
  if (!profile || typeof profile !== 'object') return fallback

  const schemeProfile = schemeId ? profile.byScheme?.[schemeId] : null
  if (schemeProfile && typeof schemeProfile === 'object') {
    const schemeVariantValue = finiteOrNull(schemeProfile[variantId])
    if (schemeVariantValue != null) return schemeVariantValue
    const schemeDefaultValue = finiteOrNull(schemeProfile.default)
    if (schemeDefaultValue != null) return schemeDefaultValue
  }

  const variantValue = finiteOrNull(profile.byVariant?.[variantId])
  if (variantValue != null) return variantValue

  const defaultValue = finiteOrNull(profile.default)
  if (defaultValue != null) return defaultValue

  return fallback
}

// Every minimum role-pair separation the audits enforce: the criticalPairDeltaE
// table (role->role, default merged under the variant), the operator/comment +
// method/property gates, plus the scheme color-contract criticalPairs.
export function buildCriticalPairFloorsFrom({
  criticalPairDeltaEByVariant = {},
  pairSeparationGates = {},
  contractCriticalPairs = [],
  schemeId = null,
  variantId,
}) {
  const floors = []

  const merged = {
    ...(criticalPairDeltaEByVariant.default || {}),
    ...(criticalPairDeltaEByVariant[variantId] || {}),
  }
  for (const [key, min] of Object.entries(merged)) {
    const [a, b] = key.split('->')
    if (a && b && Number.isFinite(min)) floors.push({ a, b, min })
  }

  floors.push({
    a: 'operator',
    b: 'comment',
    min: resolvePairGate(pairSeparationGates.operatorCommentDeltaE, { schemeId, variantId, fallback: 4.5 }),
  })
  floors.push({
    a: 'method',
    b: 'property',
    min: resolvePairGate(pairSeparationGates.methodPropertyDeltaE, { schemeId, variantId, fallback: 10 }),
  })

  for (const pair of contractCriticalPairs || []) {
    if (pair?.left && pair?.right && Number.isFinite(pair.minDeltaE)) {
      floors.push({ a: pair.left, b: pair.right, min: pair.minDeltaE })
    }
  }

  return floors
}

// The declared globalSeparation group constraint for a variant, or null when the
// variant declares no target (dark is authored, not distribution-solved).
export function buildGlobalSeparationConstraintFrom({ tuning = {}, variantId }) {
  const targetByVariant = tuning.globalSeparationTargetByVariant || {}
  const target = targetByVariant[variantId] ?? targetByVariant.default
  if (!target) return null

  const toleranceByVariant = tuning.globalSeparationToleranceByVariant || {}
  const tolerance =
    finiteOrNull(toleranceByVariant[variantId]) ?? finiteOrNull(toleranceByVariant.default) ?? 0

  return {
    kind: 'globalSeparation',
    target,
    tolerance: Math.max(0, tolerance),
    baselineDeltaE: finiteOrNull(tuning.globalSeparationRoleProfile?.baselineDeltaE) ?? 8,
  }
}

// The full declarative quality contract for one scheme: everything a consumer needs
// to VERIFY an emitted theme, derived from the same raw inputs the build reads.
export function buildQualityContract({ tuning = {}, colorContract = {}, schemeId = null, variantIds = ['dark', 'light'] }) {
  const variants = {}
  for (const variantId of variantIds) {
    variants[variantId] = {
      criticalPairFloors: buildCriticalPairFloorsFrom({
        criticalPairDeltaEByVariant: tuning.roleLaneProfile?.criticalPairDeltaEByVariant || {},
        pairSeparationGates: tuning.pairSeparationGates || {},
        contractCriticalPairs: colorContract.criticalPairs || [],
        schemeId,
        variantId,
      }),
      globalSeparation: buildGlobalSeparationConstraintFrom({ tuning, variantId }),
    }
  }
  return { schemeId, variants }
}
