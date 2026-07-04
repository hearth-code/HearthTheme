import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { contrastRatio } from '../scripts/color-utils.mjs'
import {
  assertGlobalSeparationTarget,
  buildCriticalPairFloors,
  buildGlobalSeparationConstraint,
  buildInteractionStateConstraints,
  computeGlobalSeparationRatio,
  solveInteractionStateConstraint,
} from '../scripts/generate-theme-variants-node.mjs'
import { loadColorSystemTuning } from '../scripts/color-system.mjs'
import { collectCriticalPairSeparationIssues } from '../scripts/theme-audit.mjs'
import { solveCriticalPairFloors } from '../scripts/color-system/solve.mjs'
import { deltaE } from '../scripts/color-utils.mjs'

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const load = (relPath) => JSON.parse(fs.readFileSync(path.join(ROOT, relPath), 'utf8'))

function darkInteractionTheme() {
  return {
    colors: {
      'editor.background': '#1b1d1a',
      'editor.foreground': '#d2bea2',
      'editor.lineHighlightBackground': '#272824',
      'list.hoverBackground': '#282521',
      'tab.hoverBackground': '#282521',
      'editorLineNumber.foreground': '#5d574b',
      'editorLineNumber.activeForeground': '#c5a36e',
    },
  }
}

test('declares interaction-state minContrast constraints from tuning', () => {
  const declarations = buildInteractionStateConstraints(darkInteractionTheme(), 'dark')

  assert.deepEqual(
    declarations.map((declaration) => declaration.token),
    ['editor.lineHighlightBackground', 'list.hoverBackground', 'tab.hoverBackground'],
  )
  assert.deepEqual(declarations[1].constraints, [
    {
      kind: 'minCompositeContrast',
      bg: '#1b1d1a',
      ratio: 1.14,
    },
  ])
})

test('declares a uniform operator/comment separation gate for every scheme', () => {
  // One standard, no per-scheme exceptions: the gate was raised to 10 for ember-light
  // first (user-reported crowding), then unified after moss-light shipped at 5.7 —
  // the same crowding the ember gate existed to prevent.
  const tuning = loadColorSystemTuning()
  const gate = tuning.pairSeparationGates.operatorCommentDeltaE

  assert.equal(gate.default, 10)
  assert.equal(gate.byVariant, undefined)
  assert.equal(gate.byScheme, undefined)
})

test('declares globalSeparation as a group constraint from tuning', () => {
  assert.deepEqual(buildGlobalSeparationConstraint('light'), {
    kind: 'globalSeparation',
    target: {
      median: 1.28,
      p25: 1.03,
      p10: 0.77,
    },
    tolerance: 0,
    baselineDeltaE: 8,
  })
})

test('generated light themes preserve the current final globalSeparation distribution', () => {
  // moss-light and ember-light both run the Track B joint optimizer (strategy 'joint'):
  // the emitted distribution is asserted to meet the declared target (median 1.28 /
  // p25 1.03 / p10 0.77) as a hard invariant on each scheme.
  const expected = {
    ember: { pairCount: 291, median: '1.29', p10: '0.85', p25: '1.04', p75: '1.60' },
    moss: { pairCount: 290, median: '1.29', p10: '0.89', p25: '1.03', p75: '1.53' },
  }

  for (const [schemeId, baseline] of Object.entries(expected)) {
    const darkTheme = load(`themes/${schemeId}-dark.json`)
    const lightTheme = load(`themes/${schemeId}-light.json`)
    const stats = computeGlobalSeparationRatio(lightTheme, darkTheme)

    assert.equal(stats.pairCount, baseline.pairCount)
    assert.equal((stats.medianRatio ?? 0).toFixed(2), baseline.median)
    assert.equal((stats.p10Ratio ?? 0).toFixed(2), baseline.p10)
    assert.equal((stats.p25Ratio ?? 0).toFixed(2), baseline.p25)
    assert.equal((stats.p75Ratio ?? 0).toFixed(2), baseline.p75)
  }
})

test('assertGlobalSeparationTarget fails closed on an empty pair distribution', () => {
  // A single token yields zero measurable pairs. globalSeparationConstraintSatisfied is
  // fail-open on an empty set, so the joint gate must throw rather than treat a broken
  // token/baseline mapping as satisfied.
  const dark = { tokenColors: [{ scope: 'keyword', settings: { foreground: '#888888' } }] }
  const light = { tokenColors: [{ scope: 'keyword', settings: { foreground: '#777777' } }] }
  assert.equal(computeGlobalSeparationRatio(light, dark).pairCount, 0)
  assert.throws(() => assertGlobalSeparationTarget(light, dark, 'light'), /no measurable token pairs/)
})

test('joint critical-pair floors include the scheme color-contract pairs', () => {
  // Regression for cross-validation P1: the joint optimizer must enforce the scheme
  // color-contract.json criticalPairs (audited per scheme by audit-color-contract), not
  // only the tuning floors + pair gates. Active scheme here is moss.
  const floors = buildCriticalPairFloors('light')
  const has = (a, b) => floors.some((f) => (f.a === a && f.b === b) || (f.a === b && f.b === a))
  assert.ok(has('keyword', 'string'), 'keyword/string contract floor present')
  assert.ok(has('operator', 'punctuation'), 'operator/punctuation contract floor present')
})

test('fails every scheme when operator/comment separation falls below the gate', () => {
  const tuning = loadColorSystemTuning()
  const theme = {
    tokenColors: [
      {
        scope: ['comment', 'punctuation.definition.comment'],
        settings: { foreground: '#85776b' },
      },
      {
        scope: ['keyword.operator', 'keyword.operator.assignment'],
        settings: { foreground: '#756e64' },
      },
    ],
  }

  // The gate is uniform: the same crowding is rejected for both schemes (moss used to
  // pass at gate 5 while ember failed at 10 — the double standard this unification killed).
  for (const schemeId of ['ember', 'moss']) {
    const issues = collectCriticalPairSeparationIssues(
      { id: 'light', path: `themes/${schemeId}-light.json` },
      theme,
      { schemeId, operatorCommentGate: tuning.pairSeparationGates.operatorCommentDeltaE },
    )
    assert.deepEqual(issues, [
      `themes/${schemeId}-light.json: critical pair "operator" vs "comment" deltaE 5.3 is below 10.0`,
    ])
  }
})

test('solves a declared interaction-state constraint and records telemetry', () => {
  const theme = darkInteractionTheme()
  const warnings = []
  const declaration = buildInteractionStateConstraints(theme, 'dark').find(
    (item) => item.token === 'list.hoverBackground',
  )

  solveInteractionStateConstraint(theme, 'dark', warnings, declaration)

  assert.equal(theme.colors['list.hoverBackground'], '#2a2723')
  assert.ok(contrastRatio(theme.colors['list.hoverBackground'], theme.colors['editor.background']) >= 1.14)
  assert.match(warnings[0], /interaction constraint list\.hoverBackground minCompositeContrast/)
  assert.match(warnings[0], /adjusted/)
})

test('solveCriticalPairFloors closes a pre-existing floor violation within constraints', () => {
  // The shipped moss-light operator/comment pair before the gate was unified: ΔE ~5.7
  // against a floor of 10 — the state the joint solver alone could never close (its
  // pair floors are move vetoes, not objectives).
  const bg = '#e7e5d8'
  const units = [
    { id: 'operator', color: '#66635d', constraints: [{ kind: 'minContrast', bg, ratio: 4.5 }] },
    { id: 'comment', color: '#766f65', constraints: [{ kind: 'minContrast', bg, ratio: 3.4 }] },
  ]
  const floors = [{ a: 'operator', b: 'comment', min: 10 }]

  const solution = solveCriticalPairFloors({ units, floors, driftCap: 8 })

  assert.equal(solution.satisfied, true)
  const byId = new Map(solution.units.map((unit) => [unit.id, unit.color]))
  assert.ok(deltaE(byId.get('operator'), byId.get('comment')) >= 10)
  assert.ok(deltaE(byId.get('operator'), '#66635d') <= 8, 'operator stays within the drift cap')
  assert.ok(deltaE(byId.get('comment'), '#766f65') <= 8, 'comment stays within the drift cap')
})

test('solveCriticalPairFloors never trades a satisfied floor to close another', () => {
  // punctuation sits well apart from operator; closing operator/comment must not pull
  // the satisfied operator/punctuation pair below its own floor.
  const punctuation = '#885871'
  const units = [
    { id: 'operator', color: '#66635d', constraints: [] },
    { id: 'comment', color: '#766f65', constraints: [] },
  ]
  const floors = [
    { a: 'operator', b: 'comment', min: 10 },
    { a: 'operator', b: 'punctuation', min: 8 },
  ]
  const externalRoleColors = new Map([['punctuation', punctuation]])

  const solution = solveCriticalPairFloors({ units, floors, externalRoleColors, driftCap: 8 })

  assert.equal(solution.satisfied, true)
  const byId = new Map(solution.units.map((unit) => [unit.id, unit.color]))
  assert.ok(deltaE(byId.get('operator'), byId.get('comment')) >= 10)
  assert.ok(deltaE(byId.get('operator'), punctuation) >= 8, 'satisfied operator/punctuation floor preserved')
})

test('solveCriticalPairFloors reports an unsatisfiable floor instead of emitting silently', () => {
  // A drift cap too small to separate the pair: the solver must say so (the caller
  // asserts and fails the build), never return an unmet floor as satisfied.
  const units = [
    { id: 'operator', color: '#66635d', constraints: [] },
    { id: 'comment', color: '#766f65', constraints: [] },
  ]
  const floors = [{ a: 'operator', b: 'comment', min: 30 }]

  const solution = solveCriticalPairFloors({ units, floors, driftCap: 2 })

  assert.equal(solution.satisfied, false)
  assert.ok(solution.deficit > 0)
})
