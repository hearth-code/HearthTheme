import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { contrastRatio, deltaE, hexHue, hexToRgb, isHueInBand, normalizeHex, rgbToXyz, xyzToLab } from '../scripts/color-utils.mjs'
import {
  blendColorOverBackground,
  computeGlobalSeparationStats,
  constraintMargin,
  constraintSatisfied,
  globalSeparationConstraintMargin,
  globalSeparationConstraintSatisfied,
  solveChromaCeilingColor,
  solveConstrainedColor,
  solveGlobalSeparationConstraint,
  solveHueLaneColor,
  solveNearForegroundColor,
  solveReadabilityColor,
} from '../scripts/color-system/solve.mjs'

const labChroma = (hex) => {
  const [, a, b] = xyzToLab(rgbToXyz(hexToRgb(hex)))
  return Math.sqrt(a ** 2 + b ** 2)
}

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const load = (relPath) => JSON.parse(fs.readFileSync(path.join(ROOT, relPath), 'utf8'))
const lightness = (hex) => xyzToLab(rgbToXyz(hexToRgb(hex)))[0]
const toScopes = (entry) => {
  if (!entry?.scope) return []
  return Array.isArray(entry.scope) ? entry.scope : [entry.scope]
}
const resolveSemanticForeground = (value) => normalizeHex(typeof value === 'string' ? value : value?.foreground)
const getRoleColor = (theme, roleDef) => {
  for (const entry of theme.tokenColors || []) {
    if ((roleDef.scopes || []).some((scope) => toScopes(entry).includes(scope))) {
      const color = normalizeHex(entry.settings?.foreground)
      if (color) return color
    }
  }
  for (const semanticKey of roleDef.semanticKeys || []) {
    const color = resolveSemanticForeground(theme.semanticTokenColors?.[semanticKey])
    if (color) return color
  }
  return null
}

test('keeps the anchor untouched when it already satisfies every constraint', () => {
  const result = solveConstrainedColor({
    anchor: '#8bb49e',
    constraints: [{ kind: 'minContrast', bg: '#1b1d1a', ratio: 3 }],
  })
  assert.equal(result.adjusted, false)
  assert.equal(result.color, '#8bb49e')
})

test('returns the anchor unchanged when there are no constraints', () => {
  const result = solveConstrainedColor({ anchor: '#8bb49e', constraints: [] })
  assert.deepEqual(result, { color: '#8bb49e', adjusted: false })
})

test('raises lightness to clear contrast on a dark background', () => {
  const bg = '#1b1d1a'
  const anchor = '#23291f' // sage, too dark to clear 4.5:1 on the canvas
  const result = solveConstrainedColor({ anchor, constraints: [{ kind: 'minContrast', bg, ratio: 4.5 }] })
  assert.equal(result.adjusted, true)
  assert.ok(lightness(result.color) > lightness(anchor), 'should lighten')
  assert.ok(contrastRatio(result.color, bg) >= 4.5, `got ${contrastRatio(result.color, bg)}`)
})

test('lowers lightness to clear contrast on a light background', () => {
  const bg = '#e7e5d8'
  const anchor = '#dcdac9' // too light to clear 4.5:1 on the paper canvas
  const result = solveConstrainedColor({ anchor, constraints: [{ kind: 'minContrast', bg, ratio: 4.5 }] })
  assert.equal(result.adjusted, true)
  assert.ok(lightness(result.color) < lightness(anchor), 'should darken')
  assert.ok(contrastRatio(result.color, bg) >= 4.5)
})

test('satisfies multiple constraints simultaneously', () => {
  const result = solveConstrainedColor({
    anchor: '#7a7a7a',
    constraints: [
      { kind: 'minContrast', bg: '#000000', ratio: 3 },
      { kind: 'minContrast', bg: '#ffffff', ratio: 1.2 },
    ],
  })
  assert.ok(contrastRatio(result.color, '#000000') >= 3)
  assert.ok(contrastRatio(result.color, '#ffffff') >= 1.2)
})

test('solves composite interaction-state contrast against its background', () => {
  // A translucent overlay (alpha 0x66) that composites below the target over the
  // canvas. The solver must lift it into range while keeping it translucent.
  const anchor = '#33333366'
  const bg = '#000000'
  const ratio = 1.5
  assert.ok(contrastRatio(blendColorOverBackground(anchor, bg), bg) < ratio)

  const result = solveConstrainedColor({
    anchor,
    constraints: [{ kind: 'minCompositeContrast', bg, ratio }],
  })
  assert.equal(result.adjusted, true)
  assert.notEqual(result.color, anchor)
  // Alpha is preserved (overlay stays translucent, not flattened to a solid fill),
  // and the composite over the background now clears the target.
  assert.match(result.color, /^#[0-9a-f]{6}66$/)
  assert.ok(contrastRatio(blendColorOverBackground(result.color, bg), bg) >= ratio)
})

test('refuses to satisfy a composite target the anchor alpha makes impossible', () => {
  // White at alpha 0x20 over black tops out around 1.5:1 no matter the lightness,
  // so 2:1 is unreachable without dropping alpha. The solver throws instead of
  // silently flattening the overlay into a solid fill.
  assert.throws(
    () =>
      solveConstrainedColor({
        anchor: '#ffffff20',
        constraints: [{ kind: 'minCompositeContrast', bg: '#000000', ratio: 2 }],
      }),
    /no lightness/,
  )
})

test('throws loudly when no lightness can satisfy the constraint', () => {
  // 21:1 is the maximum possible contrast and is unreachable against mid-gray.
  assert.throws(
    () => solveConstrainedColor({ anchor: '#8bb49e', constraints: [{ kind: 'minContrast', bg: '#7f7f7f', ratio: 21 }] }),
    /no lightness/,
  )
})

test('rejects an unknown constraint kind', () => {
  assert.throws(
    () => solveConstrainedColor({ anchor: '#8bb49e', constraints: [{ kind: 'minDeltaE', bg: '#000000', ratio: 3 }] }),
    /unknown constraint kind/,
  )
})

test('evaluates the hueInBand and maxDeltaE constraint allow-list', () => {
  // hueInBand reads the HSL hue of the candidate.
  const amber = '#c9892f' // hue ~29, inside [20, 45]
  const teal = '#2f9fc9' // hue ~196, outside
  assert.equal(constraintSatisfied(amber, { kind: 'hueInBand', hueMin: 20, hueMax: 45 }), true)
  assert.equal(constraintSatisfied(teal, { kind: 'hueInBand', hueMin: 20, hueMax: 45 }), false)
  // Margin is positive inside the lane, negative (by hue distance) outside it.
  assert.ok(constraintMargin(amber, { kind: 'hueInBand', hueMin: 20, hueMax: 45 }) > 0)
  assert.ok(constraintMargin(teal, { kind: 'hueInBand', hueMin: 20, hueMax: 45 }) < 0)

  // maxDeltaE bounds perceptual drift from a reference colour.
  assert.equal(constraintSatisfied(amber, { kind: 'maxDeltaE', from: amber, max: 5 }), true)
  assert.equal(constraintSatisfied(teal, { kind: 'maxDeltaE', from: amber, max: 5 }), false)
  assert.equal(constraintMargin(amber, { kind: 'maxDeltaE', from: amber, max: 5 }), 5)
})

test('keeps an in-lane role colour untouched', () => {
  // Already inside [20, 45] with enough contrast: no candidate search, no drift.
  const anchor = '#c9892f'
  const bg = '#1b1d1a'
  assert.equal(isHueInBand(hexHue(anchor), 20, 45), true)

  const result = solveHueLaneColor({
    anchor,
    constraints: [
      { kind: 'hueInBand', hueMin: 20, hueMax: 45 },
      { kind: 'minContrast', bg, ratio: 2 },
    ],
  })
  assert.equal(result.adjusted, false)
  assert.equal(result.color, anchor)
})

test('throws when the lane cannot be reached within the drift budget', () => {
  // Rotating fully across the wheel into [20, 45] needs more drift than 3 deltaE
  // allows, so the lane + budget are jointly unsatisfiable.
  assert.throws(
    () =>
      solveHueLaneColor({
        anchor: '#1f7fd0',
        constraints: [
          { kind: 'hueInBand', hueMin: 20, hueMax: 45 },
          { kind: 'minContrast', bg: '#1b1d1a', ratio: 2 },
          { kind: 'maxDeltaE', from: '#1f7fd0', max: 3 },
        ],
      }),
    /no candidate/,
  )
})

test('requires a hueInBand constraint to seed the hue search', () => {
  assert.throws(
    () =>
      solveHueLaneColor({
        anchor: '#b04a8a',
        constraints: [{ kind: 'minContrast', bg: '#1b1d1a', ratio: 12 }],
      }),
    /requires a hueInBand constraint/,
  )
})

test('rotates an out-of-lane colour into its hue band (HSL generation)', () => {
  // A magenta well outside [20, 45]. The HSL search lands its realized hue in the
  // lane by construction; the earlier LCH generation could never satisfy this.
  const anchor = '#b04a8a'
  const bg = '#1b1d1a'
  assert.equal(isHueInBand(hexHue(anchor), 20, 45), false)

  const result = solveHueLaneColor({
    anchor,
    constraints: [
      { kind: 'hueInBand', hueMin: 20, hueMax: 45 },
      { kind: 'minContrast', bg, ratio: 2 },
      { kind: 'maxDeltaE', from: anchor, max: 90 },
    ],
  })
  assert.equal(result.adjusted, true)
  assert.equal(isHueInBand(hexHue(result.color), 20, 45), true)
  assert.ok(contrastRatio(result.color, bg) >= 2)
  assert.ok(deltaE(result.color, anchor) <= 90)
})

test('evaluates the minSeparation and maxSeparation constraint allow-list', () => {
  const fg = '#d2bea2'
  const near = '#c9b89a' // deltaE ~3 from fg
  const far = '#3a6fd0' // deltaE ~79 from fg
  assert.equal(constraintSatisfied(far, { kind: 'minSeparation', from: fg, min: 20 }), true)
  assert.equal(constraintSatisfied(near, { kind: 'minSeparation', from: fg, min: 20 }), false)
  assert.equal(constraintSatisfied(near, { kind: 'maxSeparation', from: fg, max: 20 }), true)
  assert.equal(constraintSatisfied(far, { kind: 'maxSeparation', from: fg, max: 20 }), false)
  // Margins are signed distances from the bound.
  assert.ok(constraintMargin(far, { kind: 'minSeparation', from: fg, min: 20 }) > 0)
  assert.ok(constraintMargin(far, { kind: 'maxSeparation', from: fg, max: 20 }) < 0)
})

const NEAR_FG = { fg: '#d2bea2', bg: '#1b1d1a' }

test('pulls an over-separated role colour toward the foreground lane', () => {
  // A blue role far from the warm foreground: mix toward fg until it lands in band.
  const anchor = '#3a6fd0'
  assert.ok(deltaE(anchor, NEAR_FG.fg) > 28)

  const result = solveNearForegroundColor({
    ...NEAR_FG,
    anchor,
    minDeltaE: 12,
    maxDeltaE: 28,
    minBgContrast: 2.8,
    targetDeltaE: 17,
  })
  assert.equal(result.adjusted, true)
  const delta = deltaE(result.color, NEAR_FG.fg)
  assert.ok(delta >= 12 && delta <= 28)
  assert.ok(contrastRatio(result.color, NEAR_FG.bg) >= 2.8)
})

test('pushes an under-separated role colour away from the foreground', () => {
  // A muted colour almost identical to the foreground: lift chroma/lightness to separate.
  const anchor = '#c9b89a'
  assert.ok(deltaE(anchor, NEAR_FG.fg) < 12)

  const result = solveNearForegroundColor({
    ...NEAR_FG,
    anchor,
    minDeltaE: 12,
    maxDeltaE: 30,
    minBgContrast: 2,
  })
  assert.equal(result.adjusted, true)
  const delta = deltaE(result.color, NEAR_FG.fg)
  assert.ok(delta >= 12 && delta <= 30)
})

test('leaves an in-lane role colour untouched', () => {
  const anchor = '#8bb49e'
  const result = solveNearForegroundColor({
    ...NEAR_FG,
    anchor,
    minDeltaE: 3,
    maxDeltaE: 60,
    minBgContrast: 1.5,
  })
  assert.equal(result.adjusted, false)
  assert.equal(result.color, anchor)
})

test('throws when no candidate reaches the separation lane', () => {
  assert.throws(
    () =>
      solveNearForegroundColor({
        ...NEAR_FG,
        anchor: '#c9b89a',
        minDeltaE: 150,
        maxDeltaE: 200,
        minBgContrast: 2,
        targetDeltaE: 175,
      }),
    /no candidate/,
  )
})

// Regression guard: the shipped cursor anchors must already clear their canvas
// constraint, which is what keeps converting cursor to type:"solve" a no-op on
// the generated themes. If a future edit breaks this, the silent self-heal
// becomes a visible test failure instead of an unexplained colour shift.
test('shipped cursor anchors clear their canvas constraint (zero output drift)', () => {
  const { schemeDir } = load('color-system/active-scheme.json')
  const cursor = load(`${schemeDir}/interaction-rules.json`).interactions?.cursor
  if (cursor?.source?.type !== 'solve') return // pilot not applied to the active scheme
  const groundBase = load(`${schemeDir}/foundation.json`).families.ground.tones.base // canvas == ground.base
  const { ratio } = cursor.source.constraints[0]
  for (const variant of ['dark', 'light']) {
    const anchor = cursor.source.anchor[variant]
    const canvas = groundBase[variant]
    assert.ok(
      contrastRatio(anchor, canvas) >= ratio,
      `cursor ${variant} ${anchor} on canvas ${canvas} = ${contrastRatio(anchor, canvas).toFixed(2)} < ${ratio}`,
    )
  }
})

// Regression guard: the shipped status anchors must already clear the fixed
// on-status ink. That keeps converting status to type:"solve" a no-op on the
// generated themes while making future ink/fill drift fail loudly.
test('shipped status anchors clear their on-status ink constraint (zero output drift)', () => {
  const { schemeDir } = load('color-system/active-scheme.json')
  const status = load(`${schemeDir}/interaction-rules.json`).interactions?.status
  if (status?.source?.type !== 'solve') return // pilot not applied to the active scheme
  const onStatusInk = load(`${schemeDir}/interface-rules.json`).interfaces.onStatusInk.source.values
  const { ratio } = status.source.constraints[0]
  for (const variant of ['dark', 'light']) {
    const anchor = status.source.anchor[variant]
    const ink = onStatusInk[variant]
    assert.ok(
      contrastRatio(ink, anchor) >= ratio,
      `status ${variant} ${anchor} under onStatusInk ${ink} = ${contrastRatio(ink, anchor).toFixed(2)} < ${ratio}`,
    )
  }
})

test('evaluates the maxChroma constraint allow-list', () => {
  const vivid = '#e24b4a' // high-chroma red
  const muted = '#6c805a' // low-chroma olive
  assert.equal(constraintSatisfied(muted, { kind: 'maxChroma', max: 40 }), true)
  assert.equal(constraintSatisfied(vivid, { kind: 'maxChroma', max: 40 }), false)
  // Margin is the headroom under the cap: positive when within, negative when over.
  assert.ok(constraintMargin(muted, { kind: 'maxChroma', max: 40 }) > 0)
  assert.ok(constraintMargin(vivid, { kind: 'maxChroma', max: 40 }) < 0)
})

test('clamps an over-cap colour down to the chroma ceiling', () => {
  const anchor = '#e24b4a'
  const max = 40
  assert.ok(labChroma(anchor) > max)

  const result = solveChromaCeilingColor({ anchor, max: undefined, maxChroma: max })
  assert.equal(result.adjusted, true)
  // Chroma lands on the cap (within rounding); never increased.
  assert.ok(labChroma(result.color) <= max + 0.5)
  assert.ok(labChroma(result.color) < labChroma(anchor))
})

test('leaves an under-cap colour untouched (no soft desaturation)', () => {
  const anchor = '#6c805a'
  assert.ok(labChroma(anchor) < 40)
  const result = solveChromaCeilingColor({ anchor, maxChroma: 40 })
  assert.equal(result.adjusted, false)
  assert.equal(result.color, anchor)
})

test('returns the anchor unchanged when no chroma cap is declared', () => {
  const result = solveChromaCeilingColor({ anchor: '#e24b4a', maxChroma: null })
  assert.equal(result.adjusted, false)
  assert.equal(result.color, '#e24b4a')
})

const READABILITY_SEARCH = { scaleStep: 0.04, driftDivisor: 48, lightnessPenaltyDivisor: 52 }
const READABILITY_OPTIONS = {
  bgPow: 0.74, fgPow: 1, wBg: 0.24, wFg: 0.5, wDrift: 0.26,
  minContrast: 3.2, minL: 30, maxL: 80, minScale: 0.88, maxScale: 2,
  targetL: 48, wL: 0.18, minFgContrast: 2.1,
}

test('recalibrates a light-theme colour to clear the bg floor and approach both targets', () => {
  const bg = '#ecdfcd'
  const fg = '#30261b'
  const anchor = '#cfc3ad' // too light: ~1.3:1 on the paper canvas
  assert.ok(contrastRatio(anchor, bg) < READABILITY_OPTIONS.minContrast)

  const result = solveReadabilityColor({
    anchor, bg, fg,
    targetBgContrast: 5.5,
    targetFgContrast: 2.5,
    options: READABILITY_OPTIONS,
    search: READABILITY_SEARCH,
  })
  assert.equal(result.adjusted, true)
  // Hard floor: legible against the canvas.
  assert.ok(contrastRatio(result.color, bg) >= READABILITY_OPTIONS.minContrast)
  // Hard floor: separated from the body text too.
  assert.ok(contrastRatio(result.color, fg) >= READABILITY_OPTIONS.minFgContrast)
})

test('throws when readability constraints cannot be satisfied', () => {
  assert.throws(
    () =>
      solveReadabilityColor({
        anchor: '#777777',
        bg: '#7f7f7f',
        fg: '#808080',
        targetBgContrast: 21,
        targetFgContrast: 21,
        options: {
          ...READABILITY_OPTIONS,
          minContrast: 21,
          minFgContrast: 21,
          minL: 45,
          maxL: 55,
          minScale: 1,
          maxScale: 1,
        },
        search: { ...READABILITY_SEARCH, scaleStep: 1 },
      }),
    /no candidate/,
  )
})

test('throws when a readability anchor cannot be parsed', () => {
  assert.throws(
    () =>
      solveReadabilityColor({
        anchor: 'not-a-color', bg: '#ecdfcd', fg: '#30261b',
        targetBgContrast: 5, targetFgContrast: 2,
        options: READABILITY_OPTIONS, search: READABILITY_SEARCH,
      }),
    /invalid anchor/,
  )
})

test('solves a declared globalSeparation group constraint with the existing boost heuristic', () => {
  const tokenEntries = [
    { color: '#9f8f8f', baselineColor: '#d24d4d', roleId: 'function', index: 0 },
    { color: '#8f8f9f', baselineColor: '#4d4dd2', roleId: 'method', index: 1 },
  ]
  const constraint = {
    kind: 'globalSeparation',
    target: { median: 0.35, p25: 0.35, p10: 0.35 },
    tolerance: 0,
    baselineDeltaE: 8,
  }

  const before = computeGlobalSeparationStats(tokenEntries, { baselineDeltaE: 8 })
  assert.equal(before.pairCount, 1)
  assert.equal(globalSeparationConstraintSatisfied(before, constraint), false)
  assert.ok(globalSeparationConstraintMargin(before, constraint) < 0)

  const result = solveGlobalSeparationConstraint({
    tokenEntries,
    semanticEntries: [{ color: '#9f8f8f', roleId: 'function', semanticKey: 'entity.name.function' }],
    constraint,
    roleProfile: {
      boostFactorByRole: { _default: 1, function: 1, method: 1 },
      lightnessLiftByRole: { _default: 0 },
    },
    boostProfile: {
      maxNeededFactor: 1.55,
      roleBoostScale: 1,
      lightnessLiftScale: 1,
      maxChroma: null,
    },
    defaultMaxBoostRounds: 3,
    deficitProfile: {
      ratioFloorMedian: 0.2,
      ratioFloorP25: 0.15,
      ratioFloorP10: 0.1,
      minNeededFactor: 1.03,
    },
  })

  assert.equal(result.satisfied, true)
  assert.ok(result.margin >= 0)
  assert.equal(result.telemetry.length, 3)
  assert.deepEqual(result.tokenEntries.map((entry) => entry.color), ['#b68787', '#8a8cbf'])
  assert.deepEqual(result.semanticEntries.map((entry) => entry.color), ['#b68787'])
  assert.deepEqual(tokenEntries.map((entry) => entry.color), ['#9f8f8f', '#8f8f9f'])
})

test('generated themes satisfy declared role maxChroma ceilings', () => {
  const tuning = load('color-system/framework/tuning.json')
  const roleDefs = load('color-system/framework/adapters.json').roles
  const themeDir = path.join(ROOT, 'themes')
  for (const file of fs.readdirSync(themeDir).filter((name) => name.endsWith('.json'))) {
    const variantId = file.match(/-(dark|light)\.json$/)?.[1]
    const budgets = tuning.softRoleChromaBudget?.[variantId]
    if (!budgets) continue
    const theme = load(`themes/${file}`)

    for (const [roleId, budget] of Object.entries(budgets)) {
      if (budget.maxChroma == null) continue
      const roleDef = roleDefs.find((role) => role.id === roleId)
      assert.ok(roleDef, `missing role adapter for ${roleId}`)
      const color = getRoleColor(theme, roleDef)
      assert.ok(color, `${file}: missing color for ${roleId}`)
      const chroma = labChroma(color)
      assert.ok(
        chroma <= budget.maxChroma + 0.1,
        `${file}: ${roleId} ${color} chroma ${chroma.toFixed(2)} exceeds maxChroma ${budget.maxChroma}`,
      )
    }
  }
})
