import { existsSync, readFileSync, writeFileSync } from 'fs'
import {
  COLOR_SYSTEM_COMPATIBILITY_BOUNDARIES_PATH,
  COLOR_SYSTEM_VSCODE_CHROME_CONTRACT_PATH,
  loadCompatibilityBoundaries,
  loadVscodeChromeContract,
} from '../color-system.mjs'
import { contrastRatio, hexToRgba, normalizeHex, rgbaToHex } from '../color-utils.mjs'
import { getVscodeChromeSeedDocument } from './vscode-chrome-seeds.mjs'

const VSCODE_CHROME_CONTRACT = loadVscodeChromeContract()
const COMPATIBILITY_BOUNDARIES = loadCompatibilityBoundaries()
const VSCODE_CHROME_RESIDUAL_REPORT_PATH = 'reports/vscode-chrome-residual.json'

const RESIDUAL_BUCKETS = [
  {
    id: 'terminal-ansi',
    label: 'Terminal ANSI',
    suggestion: 'keep platform-specific for now, later map through terminal semantic roles',
    rationale: 'ANSI slots are terminal-specific compatibility outputs and should migrate only after a terminal semantics layer exists.',
    match(key) {
      return key.startsWith('terminal.ansi')
    },
  },
  {
    id: 'feedback-status',
    label: 'Feedback and Status',
    suggestion: 'candidate feedback roles like error / warning / info / success',
    rationale: 'Validation, git, and attention colors should move through abstract feedback roles instead of platform-local key ownership.',
    match(key) {
      return key.startsWith('editorError') ||
        key.startsWith('editorWarning') ||
        key.startsWith('editorInfo') ||
        key.startsWith('gitDecoration.')
    },
  },
  {
    id: 'editor-guides',
    label: 'Editor Guides and Brackets',
    suggestion: 'candidate interaction or chrome tone roles for guidance / scaffolding',
    rationale: 'Indent guides, whitespace, and bracket emphasis are reusable structural cues but need their own abstract guidance roles.',
    match(key) {
      return key.startsWith('editorWhitespace') ||
        key.startsWith('editorIndentGuide') ||
        key.startsWith('editorBracket')
    },
  },
  {
    id: 'selection-list-state',
    label: 'Selection and List State',
    suggestion: 'candidate navigation-state roles for active / inactive / focus list treatments',
    rationale: 'List selection states are shared navigational behavior and should be expressed as abstract navigation roles, not raw VS Code keys.',
    match(key) {
      return key.startsWith('list.')
    },
  },
  {
    id: 'scrollbar-shadow',
    label: 'Scrollbar and Shadow',
    suggestion: 'keep platform compatibility for now',
    rationale: 'Scrollbars and drop shadows are renderer-specific polish details and can remain as bounded platform compatibility values.',
    match(key) {
      return key.startsWith('scrollbarSlider.') || key === 'widget.shadow'
    },
  },
  {
    id: 'accent-on-fill',
    label: 'Accent On Fill',
    suggestion: 'candidate chrome roles like accentOnFill / inverseInk',
    rationale: 'Text that sits on accent backgrounds should be normalized through on-fill contrast roles for easier cross-platform reuse.',
    match(key) {
      return /^(activityBarBadge|badge|button)\.foreground$/.test(key)
    },
  },
  {
    id: 'chrome-ink',
    label: 'Chrome Ink',
    suggestion: 'candidate chrome tone roles like shellInk / mutedInk / subtleInk',
    rationale: 'Foreground and supporting text hierarchy in the shell should become reusable tone roles before adding more platforms.',
    match(key) {
      const normalized = key.toLowerCase()
      return normalized.endsWith('foreground') || normalized.endsWith('placeholderforeground')
    },
  },
  {
    id: 'chrome-surface',
    label: 'Chrome Surface',
    suggestion: 'candidate chrome tone roles like shell / shellRaised / shellInset',
    rationale: 'Residual shell backgrounds and borders still express platform-local elevation and should be grouped before further migration.',
    match(key) {
      const normalized = key.toLowerCase()
      return normalized.endsWith('background') || normalized.endsWith('border')
    },
  },
]

function buildCompatibilityBoundaryIndex(groups) {
  const index = new Map()
  for (const [groupId, group] of Object.entries(groups)) {
    for (const key of group.keys) {
      index.set(key, {
        groupId,
        label: group.label,
        suggestion: group.suggestion,
        rationale: group.rationale,
      })
    }
  }
  return index
}

const COMPATIBILITY_BOUNDARY_INDEX = buildCompatibilityBoundaryIndex(COMPATIBILITY_BOUNDARIES.vscodeChromeResidual.groups)

function resolveBindingBaseColor(binding, model, variantId) {
  if (binding.surface) {
    return normalizeHex(model.surfaceRules?.surfaces?.[binding.surface]?.[variantId])
  }
  if (binding.guidance) {
    return normalizeHex(model.guidanceRules?.guidances?.[binding.guidance]?.values?.[variantId])
  }
  if (binding.terminal) {
    return normalizeHex(model.terminalRules?.terminals?.[binding.terminal]?.values?.[variantId])
  }
  if (binding.interface) {
    return normalizeHex(model.interfaceRules?.interfaces?.[binding.interface]?.values?.[variantId])
  }
  if (binding.interaction) {
    return normalizeHex(model.interactionRules?.interactions?.[binding.interaction]?.values?.[variantId])
  }
  if (binding.feedback) {
    return normalizeHex(model.feedbackRules?.feedbacks?.[binding.feedback]?.values?.[variantId])
  }
  return null
}

function applyAlphaTransform(hex, binding) {
  const rgba = hexToRgba(hex)
  if (!rgba) return hex

  const next = {
    r: rgba.r,
    g: rgba.g,
    b: rgba.b,
    a: rgba.a,
    hasAlpha: rgba.hasAlpha,
  }

  if (binding.alphaScale !== undefined) {
    next.a = Math.max(0, Math.min(255, Math.round(next.a * binding.alphaScale)))
    next.hasAlpha = true
  }
  if (binding.alpha !== undefined) {
    next.a = Math.max(0, Math.min(255, Math.round(binding.alpha * 255)))
    next.hasAlpha = next.a < 255 || rgba.hasAlpha
  }

  return rgbaToHex(next)
}

// Ink that sits on a chrome fill (button/badge text). Instead of trusting a fixed
// ink token to stay legible, pick whichever candidate clears the most contrast
// against the fill this variant actually resolves to. This makes the chrome text
// robust to scheme/polarity differences: moss's warm ochre buttons keep dark ink,
// ember's accent-toned buttons keep cream, with no shared token able to silently
// drop one of them below 4.5:1.
function pickInkForFill(backgroundHex, choices) {
  let best = null
  let bestContrast = -Infinity
  for (const choice of choices || []) {
    const ink = normalizeHex(choice)
    if (!ink) continue
    const ratio = contrastRatio(backgroundHex, ink)
    if (ratio != null && ratio > bestContrast) {
      bestContrast = ratio
      best = ink
    }
  }
  return best
}

export function buildVscodeChromeColors(model, variantId) {
  const out = {}
  for (const binding of VSCODE_CHROME_CONTRACT.bindings) {
    if (binding.inkOn) {
      const fillColor = resolveBindingBaseColor(binding.inkOn, model, variantId)
      if (!fillColor) {
        throw new Error(`Missing chrome ink fill for "${binding.key}" in variant "${variantId}"`)
      }
      const ink = pickInkForFill(fillColor, binding.inkChoices)
      if (!ink) {
        throw new Error(`No legible ink choice for "${binding.key}" in variant "${variantId}"`)
      }
      out[binding.key] = ink
      continue
    }
    const baseColor = resolveBindingBaseColor(binding, model, variantId)
    if (!baseColor) {
      throw new Error(`Missing chrome binding source for "${binding.key}" in variant "${variantId}"`)
    }
    out[binding.key] = applyAlphaTransform(baseColor, binding)
  }
  return out
}

function patchThemeColorsDocument(doc, generatedColors) {
  const currentColors = doc.colors && typeof doc.colors === 'object' && !Array.isArray(doc.colors)
    ? doc.colors
    : {}

  const nextColors = {}
  for (const key of Object.keys(currentColors)) {
    nextColors[key] = generatedColors[key] ?? currentColors[key]
  }
  for (const [key, value] of Object.entries(generatedColors)) {
    if (!(key in nextColors)) nextColors[key] = value
  }

  return {
    ...doc,
    colors: nextColors,
  }
}

function writeJsonIfChanged(path, data) {
  const next = `${JSON.stringify(data, null, 4)}\n`
  if (existsSync(path)) {
    const prev = readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
    if (prev === next) return false
  }
  writeFileSync(path, next)
  return true
}

function classifyResidualKey(key) {
  const compatibilityBoundary = COMPATIBILITY_BOUNDARY_INDEX.get(key)
  if (compatibilityBoundary) {
    return {
      bucket: `compatibility.${compatibilityBoundary.groupId}`,
      bucketLabel: compatibilityBoundary.label,
      suggestion: compatibilityBoundary.suggestion,
      rationale: compatibilityBoundary.rationale,
      compatibilityBoundary: true,
      compatibilityGroup: compatibilityBoundary.groupId,
    }
  }

  for (const bucket of RESIDUAL_BUCKETS) {
    if (bucket.match(key)) {
      return {
        bucket: bucket.id,
        bucketLabel: bucket.label,
        suggestion: bucket.suggestion,
        rationale: bucket.rationale,
        compatibilityBoundary: false,
        compatibilityGroup: null,
      }
    }
  }
  return {
    bucket: 'platform-compatibility',
    bucketLabel: 'Platform Compatibility',
    suggestion: 'keep as bounded platform compatibility until a stable abstract role appears',
    rationale: 'This key does not yet fit a shared abstraction cleanly and should stay explicit until a stronger cross-platform pattern emerges.',
    compatibilityBoundary: false,
    compatibilityGroup: null,
  }
}

function buildResidualBucketSummary(residualEntries) {
  const summary = {}
  for (const entry of residualEntries) {
    if (!summary[entry.bucket]) {
      summary[entry.bucket] = {
        label: entry.bucketLabel,
        suggestion: entry.suggestion,
        rationale: entry.rationale,
        compatibilityBoundary: Boolean(entry.compatibilityBoundary),
        compatibilityGroup: entry.compatibilityGroup ?? null,
        keys: [],
        keyCount: 0,
      }
    }
    if (!summary[entry.bucket].keys.includes(entry.key)) {
      summary[entry.bucket].keys.push(entry.key)
      summary[entry.bucket].keyCount += 1
    }
  }
  return Object.fromEntries(
    Object.entries(summary).map(([bucketId, value]) => [
      bucketId,
      {
        ...value,
        keys: value.keys.sort(),
      },
    ])
  )
}

function buildResidualVariantReport(doc, migratedKeys) {
  const residualKeys = Object.keys(doc.colors || {})
    .filter((key) => !migratedKeys.has(key))
    .sort()

  const entries = residualKeys.map((key) => ({
    key,
    value: doc.colors[key],
    ...classifyResidualKey(key),
  }))

  return {
    residualKeyCount: residualKeys.length,
    residualKeys,
    buckets: buildResidualBucketSummary(entries),
    entries,
  }
}

function buildVscodeChromeResidualReport(model, variantSpec, referenceDocs = null) {
  const targets = [
    { variantId: 'dark', path: variantSpec.baseSourcePath, sourceKind: 'source-snapshot' },
    { variantId: 'dark', path: variantSpec.baseTemplatePath, sourceKind: 'template-snapshot' },
    ...variantSpec.variants
      .filter((variant) => variant.mode === 'derived')
      .map((variant) => ({ variantId: variant.id, path: variant.templatePath, sourceKind: 'template-snapshot' })),
  ]

  const migratedKeys = new Set(VSCODE_CHROME_CONTRACT.bindings.map((binding) => binding.key))
  const variants = {}
  const aggregate = new Map()

  for (const target of targets) {
    const doc = referenceDocs?.[target.path] ?? JSON.parse(readFileSync(target.path, 'utf8'))
    const variantReport = buildResidualVariantReport(doc, migratedKeys)
    variants[target.variantId] = {
      sourcePath: target.path,
      sourceKind: target.sourceKind,
      ...variantReport,
    }

    for (const entry of variantReport.entries) {
      if (!aggregate.has(entry.key)) {
        aggregate.set(entry.key, {
          key: entry.key,
          bucket: entry.bucket,
          bucketLabel: entry.bucketLabel,
          suggestion: entry.suggestion,
          rationale: entry.rationale,
          compatibilityBoundary: Boolean(entry.compatibilityBoundary),
          compatibilityGroup: entry.compatibilityGroup ?? null,
          variants: {},
        })
      }
      aggregate.get(entry.key).variants[target.variantId] = entry.value
    }
  }

  const aggregateEntries = [...aggregate.values()].sort((a, b) => a.key.localeCompare(b.key))
  const aggregateBuckets = buildResidualBucketSummary(
    aggregateEntries.map((entry) => ({
      ...entry,
      value: null,
    }))
  )

  return {
    schemaVersion: 1,
    generated: true,
    generatedFrom: {
      activeScheme: model.sources.activeScheme,
      scheme: model.sources.scheme,
      surfaceRules: model.sources.surfaceRules,
      interactionRules: model.sources.interactionRules,
      variants: model.sources.variants,
      vscodeChromeContract: COLOR_SYSTEM_VSCODE_CHROME_CONTRACT_PATH,
      compatibilityBoundaries: COLOR_SYSTEM_COMPATIBILITY_BOUNDARIES_PATH,
      sourceSnapshot: variantSpec.baseSourcePath,
      templateSnapshots: [
        variantSpec.baseTemplatePath,
        ...variantSpec.variants.filter((variant) => variant.mode === 'derived').map((variant) => variant.templatePath),
      ],
    },
    summary: {
      migratedKeyCount: migratedKeys.size,
      residualKeyCount: aggregateEntries.length,
      compatibilityBoundaryKeyCount: aggregateEntries.filter((entry) => entry.compatibilityBoundary).length,
      variantsCovered: Object.keys(variants),
      migrationThesis: 'Migrate high-signal workbench chrome first, then either replace residual buckets with abstract tone roles or declare bounded compatibility exceptions explicitly.',
    },
    variants,
    aggregate: {
      buckets: aggregateBuckets,
      entries: aggregateEntries,
    },
  }
}

export function syncVscodeChromeReferenceFiles(model, variantSpec) {
  const targets = [
    { variantId: 'dark', path: variantSpec.baseSourcePath, label: 'source' },
    { variantId: 'dark', path: variantSpec.baseTemplatePath, label: 'template' },
    ...variantSpec.variants
      .filter((variant) => variant.mode === 'derived')
      .map((variant) => ({ variantId: variant.id, path: variant.templatePath, label: 'template' })),
  ]

  const migratedKeys = new Set(VSCODE_CHROME_CONTRACT.bindings.map((binding) => binding.key))

  // Collect the patched reference docs in memory and return them. They are byte-
  // identical to what is written to disk, so a caller can consume them directly
  // instead of reading the files back — the seam that lets the calibration run
  // without a disk round-trip (and, later, in the browser).
  const refs = {}
  for (const target of targets) {
    const doc = getVscodeChromeSeedDocument(target.path)
    const generatedColors = buildVscodeChromeColors(model, target.variantId)
    const patched = patchThemeColorsDocument(doc, generatedColors)
    refs[target.path] = patched
    const changed = writeJsonIfChanged(target.path, patched)
    const residualCount = Object.keys(patched.colors || {}).filter((key) => !migratedKeys.has(key)).length
    console.log(
      `${changed ? '✓ generated' : '- unchanged'} ${target.path} from ${COLOR_SYSTEM_VSCODE_CHROME_CONTRACT_PATH} (${migratedKeys.size} migrated keys, ${residualCount} residual keys)`
    )
  }

  const residualReport = buildVscodeChromeResidualReport(model, variantSpec, refs)
  const reportChanged = writeJsonIfChanged(VSCODE_CHROME_RESIDUAL_REPORT_PATH, residualReport)
  console.log(
    `${reportChanged ? '✓ generated' : '- unchanged'} ${VSCODE_CHROME_RESIDUAL_REPORT_PATH} from ${COLOR_SYSTEM_VSCODE_CHROME_CONTRACT_PATH}`
  )

  return refs
}
