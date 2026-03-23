import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'

export const RELEASE_METADATA_PATH = 'releases/color-language.json'
export const EXTENSION_PACKAGE_PATH = 'extension/package.json'

const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

function readJson(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing required file: ${path}`)
  }
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

export function isSemver(version) {
  return SEMVER_RE.test(String(version || '').trim())
}

export function readReleaseMetadata() {
  const metadata = readJson(RELEASE_METADATA_PATH)
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error(`${RELEASE_METADATA_PATH} must be a JSON object`)
  }

  const version = String(metadata.version ?? '').trim()
  if (!isSemver(version)) {
    throw new Error(`${RELEASE_METADATA_PATH} has invalid semver version: "${metadata.version}"`)
  }

  return { ...metadata, version }
}

export function getReleaseVersion() {
  return readReleaseMetadata().version
}

function syncExtensionPackageVersion(version) {
  const pkg = readJson(EXTENSION_PACKAGE_PATH)
  const current = String(pkg.version ?? '').trim()
  if (current === version) return false

  pkg.version = version
  writeFileSync(EXTENSION_PACKAGE_PATH, `${JSON.stringify(pkg, null, 4)}\n`)
  return true
}

export function setReleaseVersion(nextVersion, options = {}) {
  const { syncExtensionPackage = true } = options
  const normalized = String(nextVersion ?? '').trim()
  if (!isSemver(normalized)) {
    throw new Error(`Invalid semver version: "${nextVersion}"`)
  }

  const metadata = readJson(RELEASE_METADATA_PATH)
  const previousVersion = String(metadata.version ?? '').trim()
  const releaseChanged = previousVersion !== normalized
  if (releaseChanged) {
    metadata.version = normalized
    writeJson(RELEASE_METADATA_PATH, metadata)
  }

  const extensionChanged = syncExtensionPackage
    ? syncExtensionPackageVersion(normalized)
    : false

  return {
    previousVersion,
    nextVersion: normalized,
    releaseChanged,
    extensionChanged,
  }
}
