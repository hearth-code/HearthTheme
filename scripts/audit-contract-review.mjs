import { loadContractReviewChecklist } from './color-system/contract-review.mjs'

function fail(message) {
  console.error(`[FAIL] ${message}`)
  process.exit(1)
}

function main() {
  try {
    const review = loadContractReviewChecklist()

    for (const assessment of review.assessments) {
      if (assessment.contract.lifecycle === 'future-proof' && assessment.verdict !== 'stable') {
        fail(`Future-proof contract "${assessment.contractId}" must have verdict "stable" (received "${assessment.verdict}")`)
      }
      if (assessment.contract.lifecycle === 'bounded-compatibility' && assessment.verdict !== 'bounded') {
        fail(`Bounded-compatibility contract "${assessment.contractId}" must have verdict "bounded" (received "${assessment.verdict}")`)
      }
      if (assessment.contract.lifecycle === 'calibration' && assessment.verdict !== 'stable') {
        fail(`Calibration contract "${assessment.contractId}" must have verdict "stable" (received "${assessment.verdict}")`)
      }
      if (assessment.contract.lifecycle === 'migration' && assessment.verdict !== 'transitional') {
        fail(`Migration contract "${assessment.contractId}" must have verdict "transitional" (received "${assessment.verdict}")`)
      }
      if (assessment.contract.lifecycle === 'generated' && assessment.verdict !== 'generated') {
        fail(`Generated contract "${assessment.contractId}" must have verdict "generated" (received "${assessment.verdict}")`)
      }
    }

    console.log(`[PASS] Contract review audit passed (${review.assessments.length} assessments).`)
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
  }
}

main()
