// Mirrors the generated Obsidian app-theme artifacts into the dedicated public
// publish repo (Obsidian reads theme files from the repo ROOT of the default
// branch, which the monorepo can't satisfy). Idempotent: only commits/pushes
// when a generated file actually changed.
//
// Usage:
//   node scripts/pack-obsidian-publish.mjs --repo owner/name [flags]
//   flags: --dry-run     stage + show what would change, never push
//          --no-push     commit locally in the work clone, don't push
//          --no-generate skip regeneration (artifacts assumed fresh)
//          --release     also ensure a GitHub release/tag matching the version
//
// Auth: pushes over SSH (git@github.com:owner/name.git), same as a manual push.
// In CI, provide a deploy key or token with push access to the publish repo.

import { existsSync, readFileSync, copyFileSync, writeFileSync, rmSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import { spawnSync } from 'child_process'
import { getReleaseVersion } from './release-metadata.mjs'

const APP_THEME_DIR = 'obsidian/app-theme'
const REQUIRED_FILES = ['manifest.json', 'theme.css', 'versions.json', 'screenshot.png']
const WORK_ROOT = 'release/obsidian-publish'
const DEFAULT_BRANCH = 'main'

function getArg(name, fallback = null) {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`))
  if (inline) return inline.slice(name.length + 1)
  const idx = process.argv.indexOf(name)
  if (idx === -1) return fallback
  const next = process.argv[idx + 1]
  return next && !next.startsWith('--') ? next : true
}

function hasFlag(name) {
  return process.argv.includes(name)
}

function git(args, { cwd, allowFail = false } = {}) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' })
  if (result.status !== 0 && !allowFail) {
    throw new Error(`git ${args.join(' ')} failed:\n${result.stderr || result.stdout}`)
  }
  return { status: result.status, stdout: (result.stdout || '').trim(), stderr: (result.stderr || '').trim() }
}

function runStep(command, args, label) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) {
    throw new Error(`${label} failed`)
  }
}

function commandExists(command) {
  const probe = spawnSync(command, ['--version'], { stdio: 'ignore' })
  return probe.status === 0
}

// Local dev pushes over SSH (git@github.com). CI provides a token with push
// access to the publish repo via OBSIDIAN_PUBLISH_TOKEN; when present we clone /
// push over HTTPS with that token and reuse it for the `gh release` call, so a
// single fine-grained PAT (contents:write on the mirror) covers everything.
function remoteUrlFor(repo, token) {
  return token
    ? `https://x-access-token:${token}@github.com/${repo}.git`
    : `git@github.com:${repo}.git`
}

function prepareAppTheme() {
  runStep('node', ['scripts/generate-theme-variants.mjs'], 'generate-theme-variants')
  runStep('node', ['scripts/generate-obsidian-themes.mjs'], 'generate-obsidian-themes')
  runStep('node', ['scripts/generate-obsidian-app-theme.mjs'], 'generate-obsidian-app-theme')
}

function ensureSupportingFiles(cloneDir) {
  const license = join(cloneDir, 'LICENSE')
  if (!existsSync(license) && existsSync('LICENSE')) {
    copyFileSync('LICENSE', license)
  }
  const readme = join(cloneDir, 'README.md')
  if (!existsSync(readme)) {
    writeFileSync(
      readme,
      [
        '# HearthCode for Obsidian',
        '',
        'Warm, calm dark and light themes for Obsidian, generated from the HearthCode',
        'color system. Source of truth: https://github.com/hearth-code/HearthTheme',
        '',
      ].join('\n'),
    )
  }
}

function ensureRelease(cloneDir, repo, version, token = '') {
  const tag = String(version)
  // Already released?
  const existing = git(['ls-remote', '--tags', remoteUrlFor(repo, token), tag], { allowFail: true })
  if (existing.status === 0 && existing.stdout.includes(`refs/tags/${tag}`)) {
    console.log(`[publish] release tag ${tag} already exists — skipping`)
    return
  }

  if (commandExists('gh')) {
    const assets = REQUIRED_FILES.filter((f) => f !== 'screenshot.png').map((f) => join(cloneDir, f))
    const result = spawnSync(
      'gh',
      ['release', 'create', tag, '--repo', repo, '--title', tag, '--notes', `HearthCode ${tag}`, ...assets],
      { stdio: 'inherit', env: token ? { ...process.env, GH_TOKEN: token } : process.env },
    )
    if (result.status !== 0) throw new Error('gh release create failed')
    console.log(`[publish] created GitHub release ${tag}`)
  } else {
    git(['tag', tag], { cwd: cloneDir })
    git(['push', 'origin', tag], { cwd: cloneDir })
    console.log(`[publish] pushed git tag ${tag} (gh not available; no GitHub release object)`)
  }
}

function main() {
  const repo = process.env.OBSIDIAN_PUBLISH_REPO || getArg('--repo')
  if (!repo || repo === true || !String(repo).includes('/')) {
    throw new Error('Missing publish repo. Pass --repo owner/name or set OBSIDIAN_PUBLISH_REPO.')
  }
  const dryRun = hasFlag('--dry-run')
  const noPush = hasFlag('--no-push') || dryRun
  const skipGenerate = hasFlag('--no-generate')
  const doRelease = hasFlag('--release')

  const token = process.env.OBSIDIAN_PUBLISH_TOKEN || ''
  const version = getReleaseVersion()

  if (!skipGenerate) {
    prepareAppTheme()
  }

  for (const file of REQUIRED_FILES) {
    if (!existsSync(join(APP_THEME_DIR, file))) {
      throw new Error(`Missing generated file: ${join(APP_THEME_DIR, file)} (run sync first)`)
    }
  }

  const remoteUrl = remoteUrlFor(repo, token)
  const cloneDir = resolve(WORK_ROOT, repo.replace(/[/]/g, '__'))

  mkdirSync(WORK_ROOT, { recursive: true })
  rmSync(cloneDir, { recursive: true, force: true })
  git(['clone', '--quiet', '--depth', '1', remoteUrl, cloneDir])

  const branch =
    git(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: cloneDir, allowFail: true }).stdout || DEFAULT_BRANCH

  for (const file of REQUIRED_FILES) {
    copyFileSync(join(APP_THEME_DIR, file), join(cloneDir, file))
  }
  // Source-driven mirror docs: ship the README + hero from the monorepo so the
  // publish repo never needs hand-editing (single source, copied every publish).
  const mirrorReadme = 'obsidian/mirror-README.md'
  if (existsSync(mirrorReadme)) copyFileSync(mirrorReadme, join(cloneDir, 'README.md'))
  const heroImage = 'docs/marketing/obsidian-hero.png'
  if (existsSync(heroImage)) copyFileSync(heroImage, join(cloneDir, 'hero.png'))
  ensureSupportingFiles(cloneDir)

  git(['add', '-A'], { cwd: cloneDir })
  const status = git(['status', '--porcelain'], { cwd: cloneDir }).stdout

  if (!status) {
    console.log(`[publish] ${repo} already up to date for ${version} — nothing to push.`)
    if (doRelease) ensureRelease(cloneDir, repo, version, token)
    return
  }

  console.log('[publish] changes to publish:')
  console.log(git(['diff', '--cached', '--stat'], { cwd: cloneDir }).stdout)

  if (dryRun) {
    console.log('[publish] --dry-run: not committing or pushing.')
    return
  }

  git(
    [
      '-c', 'user.name=github-actions[bot]',
      '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com',
      '-c', 'commit.gpgsign=false',
      'commit', '-m', `Sync HearthCode ${version}`,
    ],
    { cwd: cloneDir },
  )

  if (noPush) {
    console.log(`[publish] committed in work clone (${cloneDir}); --no-push set, not pushing.`)
    return
  }

  git(['push', 'origin', branch], { cwd: cloneDir })
  console.log(`[publish] pushed HearthCode ${version} to ${repo} (${branch}).`)

  if (doRelease) ensureRelease(cloneDir, repo, version, token)
}

try {
  main()
} catch (error) {
  console.error(`[FAIL] ${error.message}`)
  process.exit(1)
}
