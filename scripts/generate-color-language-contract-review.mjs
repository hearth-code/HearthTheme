import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  COLOR_SYSTEM_CONTRACT_REVIEW_DOC_PATH,
  loadContractReviewChecklist,
} from './color-system/contract-review.mjs'

function writeIfChanged(path, content) {
  if (existsSync(path)) {
    const previous = readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
    const next = content.replace(/\r\n/g, '\n')
    if (previous === next) return false
  }

  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
  return true
}

function formatList(items) {
  return items.map((item) => `- ${item}`).join('\n')
}

export function generateColorLanguageContractReview() {
  const review = loadContractReviewChecklist()
  const summaryRows = review.assessments
    .map(({ contract, mode, verdict, summary }) => `| ${contract.label} | ${contract.layer} | ${contract.lifecycle} | ${mode.label} | ${verdict} | ${summary} |`)
    .join('\n')

  const modeSections = review.reviewModes
    .map((mode) => {
      const questions = mode.questions
        .map((question) => `- **${question.id}**: ${question.prompt}\n  - ${question.intent}`)
        .join('\n')
      return `## ${mode.label}\n\nApplies to lifecycles: ${mode.appliesToLifecycles.join(', ')}\n\n${questions}`
    })
    .join('\n\n')

  const assessmentSections = review.assessments
    .map(({ contract, mode, verdict, summary, nextAction, passedChecks, evidence }) => `## ${contract.label}\n\n- Layer: ${contract.layer}\n- Lifecycle: ${contract.lifecycle}\n- Review mode: ${mode.label}\n- Verdict: ${verdict}\n\n${summary}\n\n### Passed checks\n${formatList(passedChecks)}\n\n### Evidence\n${formatList(evidence)}\n\n### Next action\n- ${nextAction}`)
    .join('\n\n')

  const markdown = `# Color Language Contract Review\n\nGenerated from \`color-system/framework/contract-review-checklist.json\`.\nThis document explains which layers are already stable future-proof contracts, which remain bounded compatibility or calibration layers, and which files are still migration anchors.\n\n## Current Status\n\n| Contract | Layer | Lifecycle | Review Mode | Verdict | Summary |\n| --- | --- | --- | --- | --- | --- |\n${summaryRows}\n\n${modeSections}\n\n${assessmentSections}\n`

  const changed = writeIfChanged(COLOR_SYSTEM_CONTRACT_REVIEW_DOC_PATH, markdown)
  console.log(`${changed ? '✓ updated' : '- unchanged'} ${COLOR_SYSTEM_CONTRACT_REVIEW_DOC_PATH} from color-system/framework/contract-review-checklist.json`)
}

generateColorLanguageContractReview()
