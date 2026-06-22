import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { contrastRatio } from '../scripts/color-utils.mjs'
import {
  buildGlobalSeparationConstraint,
  buildInteractionStateConstraints,
  computeGlobalSeparationRatio,
  solveInteractionStateConstraint,
} from '../scripts/generate-theme-variants.mjs'
import { loadColorSystemTuning } from '../scripts/color-system.mjs'
import { collectCriticalPairSeparationIssues } from '../scripts/theme-audit.mjs'

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

test('declares ember-specific operator/comment separation gate', () => {
  const tuning = loadColorSystemTuning()

  assert.equal(
    tuning.pairSeparationGates.operatorCommentDeltaE.byScheme.ember.light,
    10,
  )
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
  // Track A faithfully moves the boost into the solver at calibration time; it
  // does not promote post-downstream emitted themes to a new hard invariant.
  const expected = {
    ember: { pairCount: 291, median: '1.19', p10: '0.79', p25: '0.94', p75: '1.61' },
    moss: { pairCount: 290, median: '1.26', p10: '0.84', p25: '0.98', p75: '1.53' },
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

test('fails ember-light when operator/comment separation falls below the scheme gate', () => {
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

  const emberIssues = collectCriticalPairSeparationIssues(
    { id: 'light', path: 'themes/ember-light.json' },
    theme,
    { schemeId: 'ember', operatorCommentGate: tuning.pairSeparationGates.operatorCommentDeltaE },
  )
  assert.deepEqual(emberIssues, [
    'themes/ember-light.json: critical pair "operator" vs "comment" deltaE 5.3 is below 10.0',
  ])

  const mossIssues = collectCriticalPairSeparationIssues(
    { id: 'light', path: 'themes/moss-light.json' },
    theme,
    { schemeId: 'moss', operatorCommentGate: tuning.pairSeparationGates.operatorCommentDeltaE },
  )
  assert.deepEqual(mossIssues, [])
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
