// Webview entry for the in-editor Theme Forge. Bundled by
// scripts/generate-forge-webview.mjs into extension/media/forge-ui.js.
// Runs the same browser engine the website island uses: a color picker drives
// the bundled worker (its hue + saturation tune the primary accent lane), the
// returned maps paint a live preview, and Apply hands the full theme files to the
// extension host to write as colorCustomizations.
import {
  forgeTransform,
  getDefaultSparkHue,
  hexToHueSaturation,
  hueSaturationToHex,
  renderThemeForgeSplitSvg,
} from '../../src/lib/themeForgePreview.mjs'

// Saturation safe band (see tests/theme-forge-quality-clamp.test.mjs). Hue is
// unrestricted; a picked color's saturation is clamped into this range.
const SAT_MIN = 60
const SAT_MAX = 100

const vscode = acquireVsCodeApi()
const config = window.__FORGE__ || {}

const els = {
  color: document.getElementById('forge-color'),
  readout: document.getElementById('forge-readout'),
  reset: document.getElementById('forge-reset'),
  apply: document.getElementById('forge-apply'),
  status: document.getElementById('forge-status'),
  preview: document.getElementById('forge-preview'),
  accent: document.getElementById('forge-accent'),
}

let worker = null
let source = null
let defaultHue = 120
let sparkHex = '#8fc06b'
let requestId = 0
let debounceTimer = 0
let latestFiles = null
let latestQuality = null
let ready = false
let pending = false
// True until the user touches the picker; while default, the theme is left exactly
// as shipped (no transform) so "open and Apply without changing" == stock Moss.
let isDefault = true

function setStatus(text) {
  if (els.status) els.status.textContent = text
}

// Apply is only enabled when the engine has returned a result for the CURRENT
// color — otherwise a quick click after picking a color would apply the previous
// (stale) result, which is why a second Apply was needed to land the new theme.
function refreshApply() {
  // An unverified result (quality gate failed after the solve pass) must never be
  // applied — the preview may render it, but Apply stays off.
  const blocked = latestQuality ? latestQuality.verified !== true : false
  if (els.apply) els.apply.disabled = !ready || pending || !latestFiles || blocked
}

function setControlsEnabled(enabled) {
  ready = enabled
  for (const el of [els.color, els.reset]) {
    if (el) el.disabled = !enabled
  }
  refreshApply()
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

// Derive the rotation inputs from the picked color: its hue (full range) and its
// saturation clamped to the safe band. Lightness is ignored — the calibration
// keeps each role's lightness.
function pickedHueSaturation() {
  const { hue, saturation } = hexToHueSaturation(els.color?.value || '#8fc06b')
  return { hue, saturation: clamp(saturation, SAT_MIN, SAT_MAX) }
}

function updateReadout() {
  const { hue, saturation } = pickedHueSaturation()
  if (els.readout) els.readout.textContent = `hue ${hue}° · saturation ${saturation}%`
}

function postRequest() {
  if (!source) return
  window.clearTimeout(debounceTimer)
  pending = true
  refreshApply()
  const current = ++requestId
  const { saturation } = pickedHueSaturation()
  if (els.accent) els.accent.style.backgroundColor = els.color?.value || ''
  const transform = isDefault ? null : forgeTransform(els.color.value, sparkHex, saturation)
  setStatus(transform ? 'Recoloring…' : 'Ready')
  worker.postMessage({ requestId: current, source, transform })
}

function scheduleRequest() {
  isDefault = false
  updateReadout()
  pending = true
  refreshApply()
  window.clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(postRequest, 130)
}

function handleWorkerMessage(event) {
  const message = event.data || {}
  if (message.requestId !== requestId) return
  pending = false
  if (message.error) {
    setStatus(`Error: ${message.error}`)
    refreshApply()
    return
  }
  latestFiles = message.files || null
  latestQuality = message.quality ?? null
  refreshApply()
  if (els.preview) {
    els.preview.innerHTML = renderThemeForgeSplitSvg({
      maps: message.maps,
      title: 'Theme Forge',
      labels: { dark: 'Dark', light: 'Light' },
    })
  }
  if (!latestQuality) {
    setStatus('Ready — pick a color, then Apply')
  } else if (latestQuality.verified) {
    setStatus(`Ready — quality verified${formatQualityMargin(latestQuality)}, same gates as the shipped themes`)
  } else {
    setStatus('Quality gate failed for this color — Apply disabled, pick another shade')
  }
}

// The tightest pair margin across both variants, e.g. " (worst pair +0.2 ΔE)".
function formatQualityMargin(quality) {
  let worst = null
  for (const report of Object.values(quality.variants || {})) {
    const pair = report?.worstPair
    if (!pair) continue
    const margin = pair.deltaE - pair.min
    if (worst == null || margin < worst) worst = margin
  }
  return worst == null ? '' : ` (worst pair ${worst >= 0 ? '+' : ''}${worst.toFixed(1)} ΔE)`
}

// Webview resources are served cross-origin (https://*.vscode-cdn.net), so
// `new Worker(uri)` is blocked by the same-origin policy. Fetch the bundled
// engine as text and run it from a same-origin blob URL (classic worker).
async function createWorker() {
  const response = await fetch(config.workerUri)
  if (!response.ok) throw new Error(`worker ${response.status}`)
  const code = await response.text()
  const blobUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
  const w = new Worker(blobUrl)
  w.addEventListener('message', handleWorkerMessage)
  w.addEventListener('error', (event) => setStatus(`Worker error: ${event.message || 'failed'}`))
  return w
}

els.color?.addEventListener('input', scheduleRequest)
els.reset?.addEventListener('click', () => {
  isDefault = true
  if (els.color) els.color.value = hueSaturationToHex(defaultHue, SAT_MAX)
  updateReadout()
  postRequest()
})
els.apply?.addEventListener('click', () => {
  if (!latestFiles) return
  if (latestQuality && latestQuality.verified !== true) return
  vscode.postMessage({ type: 'apply', files: latestFiles, quality: latestQuality })
})

async function init() {
  setStatus('Loading engine…')
  worker = await createWorker()
  const response = await fetch(config.sourceUri)
  if (!response.ok) throw new Error(`source ${response.status}`)
  source = await response.json()
  defaultHue = getDefaultSparkHue(source.inputs.foundation)
  sparkHex = source.inputs.foundation.families.spark.tones.base.dark
  if (els.color) els.color.value = hueSaturationToHex(defaultHue, SAT_MAX)
  updateReadout()
  setControlsEnabled(true)
  postRequest()
}

init().catch((error) => {
  setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`)
})
