import {
  COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH,
  loadContractChecklist,
  loadTrackedFiles,
  globToRegExp,
} from './color-system/contract-checklist.mjs'

function fail(message) {
  console.error(`[FAIL] ${message}`)
  process.exit(1)
}

function main() {
  const registry = loadContractChecklist()
  const trackedFiles = loadTrackedFiles()
  const seenPatterns = new Set()

  for (const contract of registry.contracts) {
    for (const pattern of contract.paths) {
      if (seenPatterns.has(pattern)) {
        fail(`${COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH}: duplicate path pattern "${pattern}" across contracts`)
      }
      seenPatterns.add(pattern)

      const matcher = globToRegExp(pattern)
      const matches = trackedFiles.filter((file) => matcher.test(file))
      if (matches.length === 0) {
        fail(`${COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH}: path pattern "${pattern}" in contract "${contract.id}" matches no tracked files`)
      }
    }
  }

  const hasRequired = (layer, lifecycle) => registry.contracts.some((contract) => contract.layer === layer && contract.lifecycle === lifecycle)
  if (!hasRequired('scheme', 'future-proof')) fail(`${COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH}: missing future-proof scheme contract`)
  if (!hasRequired('core', 'future-proof')) fail(`${COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH}: missing future-proof core contract`)
  if (!hasRequired('variant', 'future-proof')) fail(`${COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH}: missing future-proof variant contract`)
  if (!hasRequired('platform', 'future-proof')) fail(`${COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH}: missing future-proof platform contract`)
  if (!hasRequired('platform', 'bounded-compatibility')) fail(`${COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH}: missing bounded-compatibility contract`)
  if (!hasRequired('platform', 'calibration')) fail(`${COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH}: missing calibration contract`)
  if (!hasRequired('platform', 'migration')) fail(`${COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH}: missing migration contract`)
  if (!hasRequired('generated', 'generated')) fail(`${COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH}: missing generated contract`)

  console.log(`[PASS] Contract checklist audit passed (${registry.contracts.length} contracts).`)
}

main()
