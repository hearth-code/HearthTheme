// Forge quality audit: the input space of the Theme Forge customizer is swept
// against the SAME quality contract the shipped themes are built and audited
// against. One calibrated default build, then per grid point the exact recolor-
// and-enforce composition the worker runs (applyForgeTransform) — a hue sweep at
// both edges of the saturation band the UIs allow. Fails loud on the first grid
// point whose result is not verified, so "every generated theme passes the shipped
// gates" stays a build-enforced claim rather than a hope.

import { pathToFileURL } from 'url'
import { buildForgeThemes, applyForgeTransform } from './theme-engine/browser-worker.mjs'
import { buildThemeForgeSource } from './generate-theme-forge-source.mjs'
import { forgeTransform, hueSaturationToHex } from '../src/lib/themeForgePreview.mjs'
import { SATURATIONS, HUE_STEP } from './theme-engine/forge-grid.mjs'

export function auditForgeQuality({ log = console.log } = {}) {
  const source = buildThemeForgeSource()
  const sparkHex = source.inputs.foundation.families.spark.tones.base.dark
  const baseline = buildForgeThemes({ source }).themes

  const failures = []
  let points = 0
  let worst = null
  for (const saturation of SATURATIONS) {
    for (let hue = 0; hue < 360; hue += HUE_STEP) {
      const transform = forgeTransform(hueSaturationToHex(hue, saturation), sparkHex, saturation)
      const themes = structuredClone(baseline)
      const quality = applyForgeTransform({ themes, transform, source })
      points += 1
      for (const [variantId, report] of Object.entries(quality.variants)) {
        const pair = report.worstPair
        if (pair) {
          const margin = pair.deltaE - pair.min
          if (worst == null || margin < worst.margin) {
            worst = { margin, hue, saturation, variantId, pair: `${pair.a}/${pair.b}` }
          }
        }
        if (!report.verified) {
          failures.push(
            `hue ${hue} sat ${saturation} ${variantId}: ` +
              `pairs ${JSON.stringify(report.pairViolations)} chrome ${JSON.stringify(report.chromeIssues)}`
          )
        }
      }
    }
  }

  if (failures.length > 0) {
    log(`[FAIL] Forge quality audit found unverified grid points:`)
    for (const failure of failures) log(`  - ${failure}`)
    return false
  }
  log(
    `[PASS] Forge quality audit passed (${points} grid points; worst pair margin ` +
      `+${worst.margin.toFixed(1)} deltaE at hue ${worst.hue}/sat ${worst.saturation} ${worst.variantId} ${worst.pair}).`
  )
  return true
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!auditForgeQuality()) process.exit(1)
  } catch (error) {
    console.error(`[FAIL] Forge quality audit crashed: ${error.message}`)
    process.exit(1)
  }
}
