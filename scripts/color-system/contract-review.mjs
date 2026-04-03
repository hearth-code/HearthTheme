import { readFileSync } from 'node:fs'
import { loadContractChecklist } from './contract-checklist.mjs'

export const COLOR_SYSTEM_CONTRACT_REVIEW_PATH = 'color-system/framework/contract-review-checklist.json'
export const COLOR_SYSTEM_CONTRACT_REVIEW_DOC_PATH = 'docs/color-language-contract-review.md'

const ALLOWED_VERDICTS = new Set(['stable', 'bounded', 'transitional', 'generated'])

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function loadContractReviewChecklist() {
  const contractChecklist = loadContractChecklist()
  const contractsById = new Map(contractChecklist.contracts.map((contract) => [contract.id, contract]))
  const data = readJson(COLOR_SYSTEM_CONTRACT_REVIEW_PATH)

  assert(data && typeof data === 'object' && !Array.isArray(data), `${COLOR_SYSTEM_CONTRACT_REVIEW_PATH} must be an object`)
  assert(Array.isArray(data.reviewModes) && data.reviewModes.length > 0, `${COLOR_SYSTEM_CONTRACT_REVIEW_PATH}: reviewModes must be a non-empty array`)
  assert(Array.isArray(data.assessments) && data.assessments.length > 0, `${COLOR_SYSTEM_CONTRACT_REVIEW_PATH}: assessments must be a non-empty array`)

  const seenModeIds = new Set()
  const reviewModes = data.reviewModes.map((mode, index) => {
    assert(mode && typeof mode === 'object' && !Array.isArray(mode), `${COLOR_SYSTEM_CONTRACT_REVIEW_PATH}: reviewModes[${index}] must be an object`)
    const id = String(mode.id || '').trim()
    const label = String(mode.label || '').trim()
    assert(id, `${COLOR_SYSTEM_CONTRACT_REVIEW_PATH}: reviewModes[${index}].id is required`)
    assert(!seenModeIds.has(id), `${COLOR_SYSTEM_CONTRACT_REVIEW_PATH}: duplicate review mode id "${id}"`)
    seenModeIds.add(id)
    assert(label, `${COLOR_SYSTEM_CONTRACT_REVIEW_PATH}: reviewModes[${index}].label is required`)
    assert(Array.isArray(mode.appliesToLifecycles) && mode.appliesToLifecycles.length > 0, `${COLOR_SYSTEM_CONTRACT_REVIEW_PATH}: reviewModes[${index}].appliesToLifecycles must be a non-empty array`)
    const appliesToLifecycles = [...new Set(mode.appliesToLifecycles.map((value, lifecycleIndex) => {
      const lifecycle = String(value || '').trim()
      assert(lifecycle, `${COLOR_SYSTEM_CONTRACT_REVIEW_PATH}: reviewModes[${index}].appliesToLifecycles[${lifecycleIndex}] is invalid`)
      return lifecycle
    }))]
    assert(Array.isArray(mode.questions) && mode.questions.length > 0, `${COLOR_SYSTEM_CONTRACT_REVIEW_PATH}: reviewModes[${index}].questions must be a non-empty array`)
    const seenQuestionIds = new Set()
    const questions = mode.questions.map((question, questionIndex) => {
      assert(question && typeof question === 'object' && !Array.isArray(question), `${COLOR_SYSTEM_CONTRACT_REVIEW_PATH}: reviewModes[${index}].questions[${questionIndex}] must be an object`)
      const questionId = String(question.id || '').trim()
      const prompt = String(question.prompt || '').trim()
      const intent = String(question.intent || '').trim()
      assert(questionId, `${COLOR_SYSTEM_CONTRACT_REVIEW_PATH}: reviewModes[${index}].questions[${questionIndex}].id is required`)
      assert(!seenQuestionIds.has(questionId), `${COLOR_SYSTEM_CONTRACT_REVIEW_PATH}: duplicate question id "${questionId}" in mode "${id}"`)
      seenQuestionIds.add(questionId)
      assert(prompt, `${COLOR_SYSTEM_CONTRACT_REVIEW_PATH}: reviewModes[${index}].questions[${questionIndex}].prompt is required`)
      assert(intent, `${COLOR_SYSTEM_CONTRACT_REVIEW_PATH}: reviewModes[${index}].questions[${questionIndex}].intent is required`)
      return { id: questionId, prompt, intent }
    })
    return { id, label, appliesToLifecycles, questions }
  })

  const reviewModesById = new Map(reviewModes.map((mode) => [mode.id, mode]))
  const seenContractIds = new Set()
  const assessments = data.assessments.map((assessment, index) => {
    assert(assessment && typeof assessment === 'object' && !Array.isArray(assessment), `${COLOR_SYSTEM_CONTRACT_REVIEW_PATH}: assessments[${index}] must be an object`)
    const contractId = String(assessment.contractId || '').trim()
    const modeId = String(assessment.modeId || '').trim()
    const verdict = String(assessment.verdict || '').trim()
    const summary = String(assessment.summary || '').trim()
    const nextAction = String(assessment.nextAction || '').trim()

    assert(contractId, `${COLOR_SYSTEM_CONTRACT_REVIEW_PATH}: assessments[${index}].contractId is required`)
    assert(!seenContractIds.has(contractId), `${COLOR_SYSTEM_CONTRACT_REVIEW_PATH}: duplicate assessment for contract "${contractId}"`)
    seenContractIds.add(contractId)
    assert(contractsById.has(contractId), `${COLOR_SYSTEM_CONTRACT_REVIEW_PATH}: unknown contractId "${contractId}"`)
    assert(modeId, `${COLOR_SYSTEM_CONTRACT_REVIEW_PATH}: assessments[${index}].modeId is required`)
    assert(reviewModesById.has(modeId), `${COLOR_SYSTEM_CONTRACT_REVIEW_PATH}: unknown modeId "${modeId}"`)
    assert(ALLOWED_VERDICTS.has(verdict), `${COLOR_SYSTEM_CONTRACT_REVIEW_PATH}: assessments[${index}].verdict must be one of ${[...ALLOWED_VERDICTS].join(', ')}`)
    assert(summary, `${COLOR_SYSTEM_CONTRACT_REVIEW_PATH}: assessments[${index}].summary is required`)
    assert(nextAction, `${COLOR_SYSTEM_CONTRACT_REVIEW_PATH}: assessments[${index}].nextAction is required`)
    assert(Array.isArray(assessment.passedChecks) && assessment.passedChecks.length > 0, `${COLOR_SYSTEM_CONTRACT_REVIEW_PATH}: assessments[${index}].passedChecks must be a non-empty array`)
    assert(Array.isArray(assessment.evidence) && assessment.evidence.length > 0, `${COLOR_SYSTEM_CONTRACT_REVIEW_PATH}: assessments[${index}].evidence must be a non-empty array`)

    const contract = contractsById.get(contractId)
    const mode = reviewModesById.get(modeId)
    assert(mode.appliesToLifecycles.includes(contract.lifecycle), `${COLOR_SYSTEM_CONTRACT_REVIEW_PATH}: assessment for contract "${contractId}" uses mode "${modeId}" which does not apply to lifecycle "${contract.lifecycle}"`)

    const validQuestionIds = new Set(mode.questions.map((question) => question.id))
    const passedChecks = [...new Set(assessment.passedChecks.map((value, checkIndex) => {
      const checkId = String(value || '').trim()
      assert(validQuestionIds.has(checkId), `${COLOR_SYSTEM_CONTRACT_REVIEW_PATH}: assessments[${index}].passedChecks[${checkIndex}] references unknown question "${checkId}" for mode "${modeId}"`)
      return checkId
    }))]
    const evidence = assessment.evidence.map((value, evidenceIndex) => {
      const item = String(value || '').trim()
      assert(item, `${COLOR_SYSTEM_CONTRACT_REVIEW_PATH}: assessments[${index}].evidence[${evidenceIndex}] is invalid`)
      return item
    })

    return { contractId, modeId, verdict, summary, nextAction, passedChecks, evidence, contract, mode }
  })

  for (const contract of contractChecklist.contracts) {
    assert(seenContractIds.has(contract.id), `${COLOR_SYSTEM_CONTRACT_REVIEW_PATH}: missing assessment for contract "${contract.id}"`)
  }

  return {
    schemaVersion: Number(data.schemaVersion || 1),
    description: String(data.description || '').trim(),
    reviewModes,
    assessments,
    contractChecklist,
  }
}
