import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { contrastRatio, hexToRgb, rgbToXyz, xyzToLab } from '../scripts/color-utils.mjs'
import { solveConstrainedColor } from '../scripts/color-system/solve.mjs'

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const load = (relPath) => JSON.parse(fs.readFileSync(path.join(ROOT, relPath), 'utf8'))
const lightness = (hex) => xyzToLab(rgbToXyz(hexToRgb(hex)))[0]

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
