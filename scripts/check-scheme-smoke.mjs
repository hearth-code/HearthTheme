import { buildColorLanguageModel } from './color-system/build.mjs'
import { buildGeneratedPlatformTokenMaps } from './color-system/artifacts.mjs'
import { buildColorLanguageLineage } from './color-system/trace.mjs'

function fail(message) {
  console.error(`[FAIL] ${message}`)
  process.exit(1)
}

function main() {
  const model = buildColorLanguageModel()
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

  console.log(`[PASS] Scheme smoke passed for ${model.scheme.id}.`)
}

main()
