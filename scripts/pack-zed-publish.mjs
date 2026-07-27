// Mirrors the generated Zed extension into a dedicated public repository.
// The mirror remains a distribution artifact; HearthTheme is the only source.
//
// Usage:
//   node scripts/pack-zed-publish.mjs --repo owner/name [flags]
//   flags: --dry-run     stage + show changes, never commit or push
//          --no-push     commit in the work clone without pushing
//          --no-generate use the already-generated extension files

import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { spawnSync } from 'child_process'
import { buildZedExtensionFiles } from './generate-zed-themes.mjs'

const SOURCE_DIR = 'zed/extension'
const SOURCE_THEMES_DIR = `${SOURCE_DIR}/themes`
const SOURCE_MARKETING_IMAGE = 'zed/images/hearthcode-zed.png'
const WORK_ROOT = 'release/zed-publish'
const DEFAULT_BRANCH = 'main'

function getArg(name, fallback = null) {
  const inline = process.argv.find((arg) => arg.startsWith(`${name}=`))
  if (inline) return inline.slice(name.length + 1)
  const index = process.argv.indexOf(name)
  if (index === -1) return fallback
  const next = process.argv[index + 1]
  return next && !next.startsWith('--') ? next : true
}

function hasFlag(name) {
  return process.argv.includes(name)
}

function git(args, { cwd, allowFail = false, env = process.env } = {}) {
  const result = spawnSync('git', args, { cwd, env, encoding: 'utf8', stdio: 'pipe' })
  if (result.status !== 0 && !allowFail) {
    throw new Error(`git ${args.join(' ')} failed:\n${result.stderr || result.stdout}`)
  }
  return {
    status: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  }
}

function remoteUrlFor(repo, authenticated) {
  return authenticated
    ? `https://github.com/${repo}.git`
    : `git@github.com:${repo}.git`
}

function createGitAuth(token) {
  if (!token) return { env: process.env, cleanup() {} }

  const authDir = mkdtempSync(join(tmpdir(), 'hearthcode-zed-auth-'))
  const askpassPath = join(authDir, 'askpass.sh')
  writeFileSync(askpassPath, [
    '#!/bin/sh',
    'case "$1" in',
    '  *Username*) printf "%s\\n" "x-access-token" ;;',
    '  *) printf "%s\\n" "$ZED_GIT_TOKEN" ;;',
    'esac',
    '',
  ].join('\n'), { mode: 0o700 })
  chmodSync(askpassPath, 0o700)

  return {
    env: {
      ...process.env,
      GIT_ASKPASS: askpassPath,
      GIT_ASKPASS_REQUIRE: 'force',
      GIT_TERMINAL_PROMPT: '0',
      ZED_GIT_TOKEN: token,
    },
    cleanup() {
      rmSync(authDir, { recursive: true, force: true })
    },
  }
}

function generate() {
  const result = spawnSync('node', ['scripts/generate-zed-themes.mjs'], { stdio: 'inherit' })
  if (result.status !== 0) throw new Error('generate-zed-themes failed')
  const marketingResult = spawnSync('node', ['scripts/generate-preview-images.mjs'], { stdio: 'inherit' })
  if (marketingResult.status !== 0) throw new Error('generate-preview-images failed')
}

function copyPublishFiles(cloneDir, expectedFiles) {
  mkdirSync(join(cloneDir, 'themes'), { recursive: true })
  copyFileSync(join(SOURCE_DIR, 'extension.toml'), join(cloneDir, 'extension.toml'))
  for (const file of expectedFiles) {
    copyFileSync(join(SOURCE_THEMES_DIR, file), join(cloneDir, 'themes', file))
  }

  for (const file of readdirSync(join(cloneDir, 'themes'))) {
    const path = join(cloneDir, 'themes', file)
    if (!statSync(path).isFile() || expectedFiles.has(file)) continue
    rmSync(path, { force: true })
  }

  copyFileSync('LICENSE', join(cloneDir, 'LICENSE'))
  copyFileSync('zed/mirror-README.md', join(cloneDir, 'README.md'))
  mkdirSync(join(cloneDir, 'images'), { recursive: true })
  copyFileSync(SOURCE_MARKETING_IMAGE, join(cloneDir, 'images', 'hearthcode-zed.png'))
  for (const file of readdirSync(join(cloneDir, 'images'))) {
    if (file !== 'hearthcode-zed.png') rmSync(join(cloneDir, 'images', file), { recursive: true, force: true })
  }
}

function main() {
  const repo = process.env.ZED_PUBLISH_REPO || getArg('--repo')
  if (!repo || repo === true || !String(repo).includes('/')) {
    throw new Error('Missing publish repo. Pass --repo owner/name or set ZED_PUBLISH_REPO.')
  }
  const dryRun = hasFlag('--dry-run')
  const noPush = hasFlag('--no-push') || dryRun
  const token = process.env.ZED_PUBLISH_TOKEN || ''
  const auth = createGitAuth(token)

  try {
    if (!hasFlag('--no-generate')) generate()
    if (!existsSync(SOURCE_MARKETING_IMAGE)) {
      throw new Error(`Missing generated Zed marketing image: ${SOURCE_MARKETING_IMAGE}`)
    }

    const generatedFiles = buildZedExtensionFiles()
    const expectedThemeFiles = new Set(
      generatedFiles
        .filter((file) => file.path.startsWith(`${SOURCE_THEMES_DIR}/`))
        .map((file) => file.path.slice(`${SOURCE_THEMES_DIR}/`.length))
    )
    for (const file of generatedFiles) {
      if (!existsSync(file.path) || readFileSync(file.path, 'utf8') !== file.content) {
        throw new Error(`Generated Zed artifact is missing or stale: ${file.path}`)
      }
    }

    const cloneDir = resolve(WORK_ROOT, String(repo).replace(/[/]/g, '__'))
    mkdirSync(WORK_ROOT, { recursive: true })
    rmSync(cloneDir, { recursive: true, force: true })
    git(['clone', '--quiet', remoteUrlFor(repo, Boolean(token)), cloneDir], { env: auth.env })

    let branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: cloneDir,
      allowFail: true,
      env: auth.env,
    }).stdout
    if (!branch || branch === 'HEAD') {
      branch = DEFAULT_BRANCH
      git(['checkout', '-B', branch], { cwd: cloneDir, env: auth.env })
    }

    copyPublishFiles(cloneDir, expectedThemeFiles)
    git(['add', '-A'], { cwd: cloneDir, env: auth.env })
    const status = git(['status', '--porcelain'], { cwd: cloneDir, env: auth.env }).stdout
    if (!status) {
      console.log(`[publish] ${repo} already matches the generated Zed extension.`)
      return
    }

    console.log('[publish] Zed mirror changes:')
    console.log(git(['diff', '--cached', '--stat'], { cwd: cloneDir, env: auth.env }).stdout)
    if (dryRun) {
      console.log('[publish] --dry-run: not committing or pushing.')
      return
    }

    const version = readFileSync(join(SOURCE_DIR, 'extension.toml'), 'utf8').match(/^version\s*=\s*"([^"]+)"/m)?.[1]
    if (!version) throw new Error('Unable to read Zed extension version')
    git([
      '-c', 'user.name=github-actions[bot]',
      '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com',
      '-c', 'commit.gpgsign=false',
      'commit', '-m', `Sync HearthCode ${version}`,
    ], { cwd: cloneDir, env: auth.env })

    if (noPush) {
      console.log(`[publish] committed in ${cloneDir}; --no-push set.`)
      return
    }
    git(['push', '-u', 'origin', branch], { cwd: cloneDir, env: auth.env })
    console.log(`[publish] pushed HearthCode ${version} to ${repo} (${branch}).`)
  } finally {
    auth.cleanup()
  }
}

try {
  main()
} catch (error) {
  console.error(`[FAIL] ${error.message}`)
  process.exit(1)
}
