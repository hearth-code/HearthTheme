import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import {
  COLOR_SYSTEM_CONTRACT_CHECKLIST_DOC_PATH,
  COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH,
  loadContractChecklist,
} from './color-system/contract-checklist.mjs'

function writeIfChanged(path, content) {
  if (existsSync(path)) {
    const prev = readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
    const next = content.replace(/\r\n/g, '\n')
    if (prev === next) return false
  }
  writeFileSync(path, content)
  return true
}

function titleCase(value) {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function buildSummaryRows(contracts) {
  return contracts
    .map((contract) => `| ${contract.label} | ${titleCase(contract.layer)} | ${titleCase(contract.lifecycle)} | ${contract.editPolicy} | ${contract.paths.length} |`)
    .join('\n')
}

function buildContractSection(contract) {
  const lines = [
    `## ${contract.label}`,
    '',
    `- Layer: ${titleCase(contract.layer)}`,
    `- Lifecycle: ${titleCase(contract.lifecycle)}`,
    `- Edit policy: \`${contract.editPolicy}\``,
    '',
    contract.purpose,
    '',
    'Tracked paths:',
    '',
    ...contract.paths.map((path) => `- \`${path}\``),
    '',
    'Checklist:',
    '',
    ...contract.guardrails.map((guardrail) => `- ${guardrail}`),
    '',
  ]
  return lines.join('\n')
}

function buildMarkdown(registry) {
  const lines = [
    '# Color Language Contract Checklist',
    '',
    'Auto-generated from `color-system/framework/contract-checklist.json`.',
    '',
    registry.description,
    '',
    '## Summary',
    '',
    '| Contract | Layer | Lifecycle | Edit policy | Path patterns |',
    '| --- | --- | --- | --- | --- |',
    buildSummaryRows(registry.contracts),
    '',
    '## Lifecycle Meanings',
    '',
    '- Future Proof: safe to design against as a long-term contract.',
    '- Bounded Compatibility: explicit host exceptions that require rationale.',
    '- Calibration: bounded compensation only; never palette authorship.',
    '- Migration: sync-managed anchors that still protect current outputs.',
    '- Generated: deliverables and reports; never edit by hand.',
    '',
  ]

  for (const contract of registry.contracts) {
    lines.push(buildContractSection(contract))
  }

  return `${lines.join('\n')}\n`
}

export function generateColorLanguageContractChecklist() {
  const registry = loadContractChecklist()
  const markdown = buildMarkdown(registry)
  mkdirSync('docs', { recursive: true })
  const changed = writeIfChanged(COLOR_SYSTEM_CONTRACT_CHECKLIST_DOC_PATH, markdown)
  console.log(`${changed ? '✓ updated' : '- unchanged'} ${COLOR_SYSTEM_CONTRACT_CHECKLIST_DOC_PATH} from ${COLOR_SYSTEM_CONTRACT_CHECKLIST_PATH}`)
}

generateColorLanguageContractChecklist()
