// Builds the in-editor Theme Forge webview assets into extension/media/.
// These are build artifacts (gitignored): the bundled engine worker, the bundled
// webview UI, and a copy of the precomputed source payload. Run before packaging
// the extension (wired into scripts/pack.mjs) and on demand for local testing.
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const MEDIA_DIR = 'extension/media'
const ROLLUP_BIN = 'node_modules/.bin/rollup'

const BUNDLES = [
  // Classic worker (iife): loaded from a same-origin blob in the webview, so it
  // must not use ESM import/export at runtime.
  {
    input: 'scripts/theme-engine/browser-worker.mjs',
    output: `${MEDIA_DIR}/forge-worker.js`,
    args: ['--format', 'iife', '--name', 'forgeWorker'],
  },
  // Webview entry, loaded as a module script.
  {
    input: 'scripts/forge-webview/ui.mjs',
    output: `${MEDIA_DIR}/forge-ui.js`,
    args: ['--format', 'esm'],
  },
]

const COPIES = [
  { from: 'public/theme-forge/source.json', to: `${MEDIA_DIR}/source.json` },
]

function rollupBundle({ input, output, args = [] }) {
  execFileSync(ROLLUP_BIN, [input, ...args, '--file', output, '--silent'], {
    cwd: process.cwd(),
    stdio: 'pipe',
  })
}

export function generateForgeWebview() {
  mkdirSync(MEDIA_DIR, { recursive: true })

  for (const bundle of BUNDLES) {
    rollupBundle(bundle)
    console.log(`✓ bundled ${bundle.output}`)
  }

  // The engine worker must stay fs-free to run in the webview sandbox.
  const workerSrc = readFileSync(`${MEDIA_DIR}/forge-worker.js`, 'utf8')
  if (/from ['"](?:node:)?fs['"]/.test(workerSrc) || /readFileSync/.test(workerSrc)) {
    throw new Error('generate-forge-webview: worker bundle still references fs — engine is not bundle-safe')
  }

  for (const copy of COPIES) {
    copyFileSync(copy.from, copy.to)
    console.log(`✓ copied ${copy.to}`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateForgeWebview()
}
