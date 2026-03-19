import { spawnSync } from 'child_process'

const VERSION_RE = /^v?\d+\.\d+\.\d+(?:-[0-9a-z.-]+)?(?:\+[0-9a-z.-]+)?$/i

function getArg(name, fallback = null) {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`))
  if (inline) return inline.slice(name.length + 1)
  const idx = process.argv.indexOf(name)
  if (idx === -1) return fallback
  return process.argv[idx + 1] ?? fallback
}

function hasFlag(name) {
  return process.argv.includes(name)
}

function normalizeVersion(raw) {
  if (!raw || !VERSION_RE.test(raw)) return null
  return raw.startsWith('v') ? raw : `v${raw}`
}

function runStep(stepLabel, command, args, options = {}) {
  console.log(`\n[${stepLabel}] ${command} ${args.join(' ')}`)
  const result = spawnSync(command, args, { stdio: 'inherit', ...options })
  if (result.error) {
    console.error(`[ERROR] Step crashed: ${stepLabel}`)
    console.error(`Reason: ${result.error.message}`)
    process.exit(1)
  }
  if (result.status !== 0) {
    console.error(`[ERROR] Step failed: ${stepLabel}`)
    process.exit(result.status ?? 1)
  }
}

function runNpmScript(stepLabel, scriptName) {
  const npmExecPath = process.env.npm_execpath
  if (npmExecPath) {
    runStep(stepLabel, process.execPath, [npmExecPath, 'run', scriptName])
    return
  }

  const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  runStep(stepLabel, npmBin, ['run', scriptName], { shell: process.platform === 'win32' })
}

function usage() {
  console.log(`Usage:
  npm run release:theme -- vX.Y.Z
  npm run release:theme -- --ver=vX.Y.Z

Flow:
  1) Run all audits (theme + CJK typography)
  2) Build website and sync outputs
  3) Generate extension preview images from fixtures
  4) Append changelog entry`)
}

if (hasFlag('--help')) {
  usage()
  process.exit(0)
}

const positionalVersion = process.argv.slice(2).find((arg) => !arg.startsWith('-'))
const version = normalizeVersion(getArg('--ver', getArg('--version', positionalVersion)))

if (!version) {
  console.error('[ERROR] Missing or invalid version tag.')
  usage()
  process.exit(1)
}

const nodeBin = process.execPath
console.log(`Preparing theme release: ${version}`)
runNpmScript('1/4 Run audits', 'audit:all')
runNpmScript('2/4 Build (sync + astro)', 'build')
runNpmScript('3/4 Generate previews', 'preview:generate')
runStep('4/4 Append changelog', nodeBin, ['scripts/changelog-draft.mjs', '--append', version])

console.log(`\n[OK] Theme release pipeline completed for ${version}`)
console.log('Next: git add -A && git commit && git push')
