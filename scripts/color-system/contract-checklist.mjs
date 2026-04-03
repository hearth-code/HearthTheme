import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

export const COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH = 'color-system/framework/contract-checklist.json'
export const COLOR_SYSTEM_CONTRACT_CHECKLIST_DOC_PATH = 'docs/color-language-contract-checklist.md'

const ALLOWED_LAYERS = new Set(['scheme', 'core', 'variant', 'platform', 'generated'])
const ALLOWED_LIFECYCLES = new Set(['future-proof', 'bounded-compatibility', 'calibration', 'migration', 'generated'])
const ALLOWED_EDIT_POLICIES = new Set(['edit-directly', 'edit-with-rationale', 'calibrate-only', 'sync-managed', 'generated-only'])

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function loadContractChecklist() {
  const data = readJson(COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH)
  assert(data && typeof data === 'object' && !Array.isArray(data), `${COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH} must be an object`)
  assert(Array.isArray(data.contracts) && data.contracts.length > 0, `${COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH}: contracts must be a non-empty array`)

  const seenIds = new Set()
  const contracts = data.contracts.map((contract, index) => {
    assert(contract && typeof contract === 'object' && !Array.isArray(contract), `${COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH}: contracts[${index}] must be an object`)
    const id = String(contract.id || '').trim()
    const label = String(contract.label || '').trim()
    const layer = String(contract.layer || '').trim()
    const lifecycle = String(contract.lifecycle || '').trim()
    const editPolicy = String(contract.editPolicy || '').trim()
    const purpose = String(contract.purpose || '').trim()

    assert(id, `${COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH}: contracts[${index}].id is required`)
    assert(!seenIds.has(id), `${COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH}: duplicate contract id "${id}"`)
    seenIds.add(id)
    assert(label, `${COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH}: contracts[${index}].label is required`)
    assert(ALLOWED_LAYERS.has(layer), `${COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH}: contracts[${index}].layer must be one of ${[...ALLOWED_LAYERS].join(', ')}`)
    assert(ALLOWED_LIFECYCLES.has(lifecycle), `${COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH}: contracts[${index}].lifecycle must be one of ${[...ALLOWED_LIFECYCLES].join(', ')}`)
    assert(ALLOWED_EDIT_POLICIES.has(editPolicy), `${COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH}: contracts[${index}].editPolicy must be one of ${[...ALLOWED_EDIT_POLICIES].join(', ')}`)
    assert(purpose, `${COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH}: contracts[${index}].purpose is required`)
    assert(Array.isArray(contract.paths) && contract.paths.length > 0, `${COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH}: contracts[${index}].paths must be a non-empty array`)
    assert(Array.isArray(contract.guardrails) && contract.guardrails.length > 0, `${COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH}: contracts[${index}].guardrails must be a non-empty array`)

    const paths = [...new Set(contract.paths.map((path, pathIndex) => {
      const value = String(path || '').trim()
      assert(value, `${COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH}: contracts[${index}].paths[${pathIndex}] is invalid`)
      return value.replace(/\\/g, '/')
    }))]
    const guardrails = contract.guardrails.map((guardrail, guardrailIndex) => {
      const value = String(guardrail || '').trim()
      assert(value, `${COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH}: contracts[${index}].guardrails[${guardrailIndex}] is invalid`)
      return value
    })

    const lifecyclePolicyPairs = {
      'future-proof': new Set(['edit-directly']),
      'bounded-compatibility': new Set(['edit-with-rationale']),
      'calibration': new Set(['calibrate-only']),
      'migration': new Set(['sync-managed']),
      'generated': new Set(['generated-only']),
    }
    assert(lifecyclePolicyPairs[lifecycle].has(editPolicy), `${COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH}: contracts[${index}] lifecycle "${lifecycle}" must use editPolicy ${[...lifecyclePolicyPairs[lifecycle]].join(' or ')}`)
    if (lifecycle === 'generated') {
      assert(layer === 'generated', `${COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH}: generated contracts must use layer "generated"`)
    }
    if (layer === 'generated') {
      assert(lifecycle === 'generated', `${COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH}: generated layer entries must use lifecycle "generated"`)
    }

    return {
      id,
      label,
      layer,
      lifecycle,
      editPolicy,
      paths,
      purpose,
      guardrails,
    }
  })

  return {
    schemaVersion: Number(data.schemaVersion || 1),
    description: String(data.description || '').trim(),
    contracts,
  }
}

export function loadTrackedFiles() {
  return execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\\/g, '/'))
    .filter(Boolean)
}

export function globToRegExp(pattern) {
  const normalized = pattern.replace(/\\/g, '/')
  const escaped = normalized.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&')
  const wildcarded = escaped.replace(/\*/g, '[^/]*')
  return new RegExp(`^${wildcarded}$`)
}
