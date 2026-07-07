// Single source of truth for the Forge input-space audit grid. The saturation
// band mirrors what the pickers clamp to (ui.mjs / ThemeForgeIsland); the hue
// step defines audit density. Imported by scripts/audit-forge-quality.mjs and
// by the website's calibration section so the published grid-point count can
// never drift from what the audit actually sweeps.

export const SATURATIONS = [60, 100]
export const HUE_STEP = 15

export function gridPointCount() {
  return SATURATIONS.length * Math.ceil(360 / HUE_STEP)
}
