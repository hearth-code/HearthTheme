import { existsSync, readFileSync, rmSync } from 'fs'
import { buildColorLanguageModel } from './color-system/build.mjs'
import { buildGeneratedPlatformTokenMaps } from './color-system/artifacts.mjs'
import { buildColorLanguageLineage } from './color-system/trace.mjs'
import { COLOR_SYSTEM_ACTIVE_SCHEME_PATH, getThemeOutputFiles } from './color-system.mjs'
import { generateThemeVariants } from './generate-theme-variants.mjs'

function fail(message) {
  console.error(`[FAIL] ${message}`)
  process.exit(1)
}

function getConfiguredActiveSchemeId() {
  const data = JSON.parse(readFileSync(COLOR_SYSTEM_ACTIVE_SCHEME_PATH, 'utf8'))
  return String(data?.schemeId || '').trim()
}

function main() {
  const model = buildColorLanguageModel()
  const generatedThemePaths = Object.values(getThemeOutputFiles())
  const configuredActiveSchemeId = getConfiguredActiveSchemeId()

  try {
    generateThemeVariants()
    const artifactMaps = buildGeneratedPlatformTokenMaps(model)
    const lineage = buildColorLanguageLineage(model, artifactMaps)

    if (lineage.scheme?.id !== model.scheme.id) {
      fail(`Lineage scheme id mismatch for "${model.scheme.id}"`)
    }

    if (!Array.isArray(lineage.artifactEntries) || lineage.artifactEntries.length === 0) {
      fail(`No artifact entries generated for scheme "${model.scheme.id}"`)
    }

    if (!lineage.roles || Object.keys(lineage.roles).length === 0) {
      fail(`No role lineage generated for scheme "${model.scheme.id}"`)
    }

    if (!lineage.feedbacks || Object.keys(lineage.feedbacks).length === 0) {
      fail(`No feedback lineage generated for scheme "${model.scheme.id}"`)
    }

    if (!lineage.interfaces || Object.keys(lineage.interfaces).length === 0) {
      fail(`No interface lineage generated for scheme "${model.scheme.id}"`)
    }

    if (!lineage.guidances || Object.keys(lineage.guidances).length === 0) {
      fail(`No guidance lineage generated for scheme "${model.scheme.id}"`)
    }

    if (!lineage.terminals || Object.keys(lineage.terminals).length === 0) {
      fail(`No terminal lineage generated for scheme "${model.scheme.id}"`)
    }

    console.log(`[PASS] Scheme smoke passed for ${model.scheme.id}.`)
  } finally {
    if (model.scheme.id !== configuredActiveSchemeId) {
      for (const path of generatedThemePaths) {
        if (existsSync(path)) {
          rmSync(path, { force: true })
        }
      }
    }
  }
}

main()
