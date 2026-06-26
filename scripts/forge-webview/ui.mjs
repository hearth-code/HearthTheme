// Webview entry for the in-editor Theme Forge. Bundled by
// scripts/generate-forge-webview.mjs into extension/media/forge-ui.js.
// Runs the same browser engine the website island uses: a color picker drives
// the bundled worker (its hue + saturation rotate the whole palette), the
// returned maps paint a live preview, and Apply hands the full theme files to the
// extension host to write as colorCustomizations.
import {
  buildGlobalHueOverride,
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
let requestId = 0
let debounceTimer = 0
let latestFiles = null

function setStatus(text) {
  if (els.status) els.status.textContent = text
}

function setControlsEnabled(enabled) {
  for (const el of [els.color, els.reset, els.apply]) {
    if (el) el.disabled = !enabled
  }
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
  const current = ++requestId
  const { hue, saturation } = pickedHueSaturation()
  const foundation = buildGlobalHueOverride(source.inputs.foundation, { hue, saturation })
  if (els.accent) els.accent.style.backgroundColor = foundation.families.spark.tones.base.dark
  setStatus('Calibrating…')
  worker.postMessage({ requestId: current, source, overrides: { foundation }, chrome: hue })
}

function scheduleRequest() {
  updateReadout()
  window.clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(postRequest, 130)
}

function handleWorkerMessage(event) {
  const message = event.data || {}
  if (message.requestId !== requestId) return
  if (message.error) {
    setStatus(`Error: ${message.error}`)
    return
  }
  latestFiles = message.files || null
  if (els.preview) {
    els.preview.innerHTML = renderThemeForgeSplitSvg({
      maps: message.maps,
      title: 'Theme Forge',
      labels: { dark: 'Dark', light: 'Light' },
    })
  }
  setStatus('Ready — pick a color, then Apply')
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
  if (els.color) els.color.value = hueSaturationToHex(defaultHue, SAT_MAX)
  updateReadout()
  postRequest()
})
els.apply?.addEventListener('click', () => {
  if (!latestFiles) return
  vscode.postMessage({ type: 'apply', files: latestFiles })
})

async function init() {
  setStatus('Loading engine…')
  worker = await createWorker()
  const response = await fetch(config.sourceUri)
  if (!response.ok) throw new Error(`source ${response.status}`)
  source = await response.json()
  defaultHue = getDefaultSparkHue(source.inputs.foundation)
  if (els.color) els.color.value = hueSaturationToHex(defaultHue, SAT_MAX)
  updateReadout()
  setControlsEnabled(true)
  postRequest()
}

init().catch((error) => {
  setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`)
})
