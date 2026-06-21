import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contrastRatio } from '../scripts/color-utils.mjs'
import {
  buildInteractionStateConstraints,
  solveInteractionStateConstraint,
} from '../scripts/generate-theme-variants.mjs'
import { loadColorSystemTuning } from '../scripts/color-system.mjs'

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
