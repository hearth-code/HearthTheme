import { getExportedSiteTokenKeys } from './build.mjs'
import { getObsidianThemeOutputFiles } from '../color-system.mjs'

const OBSIDIAN_THEME_PATHS = getObsidianThemeOutputFiles()

function buildRoleIndex(adapters) {
  return new Map(adapters.map((role) => [role.id, role]))
}

function pushIndexed(indexes, entry) {
  indexes.byArtifactId[entry.id] = entry
  if (!indexes.byPath[entry.path]) indexes.byPath[entry.path] = []
  indexes.byPath[entry.path].push(entry.id)
  if (!indexes.byVariant[entry.variant]) indexes.byVariant[entry.variant] = []
  indexes.byVariant[entry.variant].push(entry.id)
  if (entry.roleId) {
    if (!indexes.byRole[entry.roleId]) indexes.byRole[entry.roleId] = []
    indexes.byRole[entry.roleId].push(entry.id)
  }
  if (entry.feedbackId) {
    if (!indexes.byFeedback[entry.feedbackId]) indexes.byFeedback[entry.feedbackId] = []
    indexes.byFeedback[entry.feedbackId].push(entry.id)
  }
  if (entry.interfaceId) {
    if (!indexes.byInterface[entry.interfaceId]) indexes.byInterface[entry.interfaceId] = []
    indexes.byInterface[entry.interfaceId].push(entry.id)
  }
  if (entry.guidanceId) {
    if (!indexes.byGuidance[entry.guidanceId]) indexes.byGuidance[entry.guidanceId] = []
    indexes.byGuidance[entry.guidanceId].push(entry.id)
  }
  if (entry.terminalId) {
    if (!indexes.byTerminal[entry.terminalId]) indexes.byTerminal[entry.terminalId] = []
    indexes.byTerminal[entry.terminalId].push(entry.id)
  }
  if (entry.familyId) {
    if (!indexes.byFamily[entry.familyId]) indexes.byFamily[entry.familyId] = []
    indexes.byFamily[entry.familyId].push(entry.id)
  }
}

function buildArtifactChain(baseChain, resolvedColor, outputColor) {
  if (!outputColor || outputColor === resolvedColor) return baseChain
  return [...baseChain, 'scripts/generate-theme-variants.mjs#postprocess']
}

function buildSurfaceEntries(model, artifactMaps, indexes) {
  const entries = []

  for (const variant of model.variants.variants) {
    for (const contract of model.surfaceAdapters) {
      const resolved = model.surfaceRules.resolved[contract.id][variant.id]
      const resolvedColor = resolved.color
      const sourceId = resolved.family || `surface:${contract.id}`

      if (contract.webToken) {
        const outputColor = artifactMaps.web?.[variant.id]?.[contract.webToken] ?? model.platformTokenMaps.web[variant.id][contract.webToken]
        const entry = {
          id: `web-surface:${contract.id}:${variant.id}`,
          path: 'src/data/tokens.ts',
          field: `tokens.${variant.id}.${contract.webToken}`,
          artifactType: 'webToken',
          adapter: 'web',
          variant: variant.id,
          roleId: null,
          familyId: sourceId,
          resolvedColor: outputColor,
          chainRefs: buildArtifactChain([...resolved.chainRefs, `adapters.surfaces.${contract.id}`], resolvedColor, outputColor),
        }
        entries.push(entry)
        pushIndexed(indexes, entry)
      }

      if (contract.vscodeColor) {
        const outputColor = artifactMaps.vscode?.workbench?.[variant.id]?.[contract.vscodeColor] ?? model.platformTokenMaps.vscode.workbench[variant.id][contract.vscodeColor]
        const entry = {
          id: `vscode-surface:${contract.id}:${variant.id}`,
          path: variant.outputPath,
          field: `colors.${contract.vscodeColor}`,
          artifactType: 'vscodeWorkbench',
          adapter: 'vscode',
          variant: variant.id,
          roleId: null,
          familyId: sourceId,
          resolvedColor: outputColor,
          chainRefs: buildArtifactChain([...resolved.chainRefs, `adapters.surfaces.${contract.id}`], resolvedColor, outputColor),
        }
        entries.push(entry)
        pushIndexed(indexes, entry)
      }

      if (contract.obsidianVar) {
        const outputColor = artifactMaps.obsidian?.[variant.id]?.[contract.obsidianVar] ?? model.platformTokenMaps.obsidian[variant.id][contract.obsidianVar]
        const entry = {
          id: `obsidian-surface:${contract.id}:${variant.id}`,
          path: OBSIDIAN_THEME_PATHS[variant.id],
          field: contract.obsidianVar,
          artifactType: 'obsidianVar',
          adapter: 'obsidian',
          variant: variant.id,
          roleId: null,
          familyId: sourceId,
          resolvedColor: outputColor,
          chainRefs: [...resolved.chainRefs, `adapters.surfaces.${contract.id}`],
        }
        entries.push(entry)
        pushIndexed(indexes, entry)
      }
    }
  }

  return entries
}

function buildInteractionEntries(model, artifactMaps, indexes) {
  const entries = []

  for (const variant of model.variants.variants) {
    for (const contract of model.interactionAdapters) {
      const resolved = model.interactionRules.interactions[contract.id].resolved[variant.id]
      const resolvedColor = resolved.color
      const sourceId = resolved.family || `interaction:${contract.id}`

      if (contract.webToken) {
        const outputColor = artifactMaps.web?.[variant.id]?.[contract.webToken] ?? model.platformTokenMaps.web[variant.id][contract.webToken]
        const entry = {
          id: `web-interaction:${contract.id}:${variant.id}`,
          path: 'src/data/tokens.ts',
          field: `tokens.${variant.id}.${contract.webToken}`,
          artifactType: 'webToken',
          adapter: 'web',
          variant: variant.id,
          roleId: null,
          familyId: sourceId,
          resolvedColor: outputColor,
          chainRefs: buildArtifactChain([...resolved.chainRefs, `adapters.interactions.${contract.id}`], resolvedColor, outputColor),
        }
        entries.push(entry)
        pushIndexed(indexes, entry)
      }

      if (contract.vscodeColor) {
        const outputColor = artifactMaps.vscode?.workbench?.[variant.id]?.[contract.vscodeColor] ?? model.platformTokenMaps.vscode.workbench[variant.id][contract.vscodeColor]
        const entry = {
          id: `vscode-interaction:${contract.id}:${variant.id}`,
          path: variant.outputPath,
          field: `colors.${contract.vscodeColor}`,
          artifactType: 'vscodeWorkbench',
          adapter: 'vscode',
          variant: variant.id,
          roleId: null,
          familyId: sourceId,
          resolvedColor: outputColor,
          chainRefs: buildArtifactChain([...resolved.chainRefs, `adapters.interactions.${contract.id}`], resolvedColor, outputColor),
        }
        entries.push(entry)
        pushIndexed(indexes, entry)
      }

      if (contract.obsidianVar) {
        const outputColor = artifactMaps.obsidian?.[variant.id]?.[contract.obsidianVar] ?? model.platformTokenMaps.obsidian[variant.id][contract.obsidianVar]
        const entry = {
          id: `obsidian-interaction:${contract.id}:${variant.id}`,
          path: OBSIDIAN_THEME_PATHS[variant.id],
          field: contract.obsidianVar,
          artifactType: 'obsidianVar',
          adapter: 'obsidian',
          variant: variant.id,
          roleId: null,
          familyId: sourceId,
          resolvedColor: outputColor,
          chainRefs: [...resolved.chainRefs, `adapters.interactions.${contract.id}`],
        }
        entries.push(entry)
        pushIndexed(indexes, entry)
      }
    }
  }

  return entries
}

function buildInterfaceEntries(model, artifactMaps, indexes) {
  const entries = []
  const siteKeys = new Set(getExportedSiteTokenKeys())

  for (const variant of model.variants.variants) {
    for (const contract of model.interfaceAdapters) {
      const resolved = model.interfaceRules.interfaces[contract.id].resolved[variant.id]
      const resolvedColor = resolved.color
      const sourceId = resolved.family || `interface:${contract.id}`

      if (contract.webToken && siteKeys.has(contract.webToken)) {
        const outputColor = artifactMaps.web?.[variant.id]?.[contract.webToken] ?? model.platformTokenMaps.web[variant.id][contract.webToken]
        const entry = {
          id: `web-interface:${contract.id}:${variant.id}`,
          path: 'src/data/tokens.ts',
          field: `tokens.${variant.id}.${contract.webToken}`,
          artifactType: 'webToken',
          adapter: 'web',
          variant: variant.id,
          roleId: null,
          interfaceId: contract.id,
          familyId: sourceId,
          resolvedColor: outputColor,
          chainRefs: buildArtifactChain([...resolved.chainRefs, `adapters.interfaces.${contract.id}`], resolvedColor, outputColor),
        }
        entries.push(entry)
        pushIndexed(indexes, entry)
      }

      if (contract.vscodeColor) {
        const outputColor = artifactMaps.vscode?.workbench?.[variant.id]?.[contract.vscodeColor] ?? model.platformTokenMaps.vscode.workbench[variant.id][contract.vscodeColor]
        const entry = {
          id: `vscode-interface:${contract.id}:${variant.id}`,
          path: variant.outputPath,
          field: `colors.${contract.vscodeColor}`,
          artifactType: 'vscodeWorkbench',
          adapter: 'vscode',
          variant: variant.id,
          roleId: null,
          interfaceId: contract.id,
          familyId: sourceId,
          resolvedColor: outputColor,
          chainRefs: buildArtifactChain([...resolved.chainRefs, `adapters.interfaces.${contract.id}`], resolvedColor, outputColor),
        }
        entries.push(entry)
        pushIndexed(indexes, entry)
      }

      if (contract.obsidianVar) {
        const outputColor = artifactMaps.obsidian?.[variant.id]?.[contract.obsidianVar] ?? model.platformTokenMaps.obsidian[variant.id][contract.obsidianVar]
        const entry = {
          id: `obsidian-interface:${contract.id}:${variant.id}`,
          path: OBSIDIAN_THEME_PATHS[variant.id],
          field: contract.obsidianVar,
          artifactType: 'obsidianVar',
          adapter: 'obsidian',
          variant: variant.id,
          roleId: null,
          interfaceId: contract.id,
          familyId: sourceId,
          resolvedColor: outputColor,
          chainRefs: [...resolved.chainRefs, `adapters.interfaces.${contract.id}`],
        }
        entries.push(entry)
        pushIndexed(indexes, entry)
      }
    }
  }

  return entries
}

function buildGuidanceEntries(model, artifactMaps, indexes) {
  const entries = []
  const siteKeys = new Set(getExportedSiteTokenKeys())

  for (const variant of model.variants.variants) {
    for (const contract of model.guidanceAdapters) {
      const resolved = model.guidanceRules.guidances[contract.id].resolved[variant.id]
      const resolvedColor = resolved.color
      const sourceId = resolved.family || `guidance:${contract.id}`

      if (contract.webToken && siteKeys.has(contract.webToken)) {
        const outputColor = artifactMaps.web?.[variant.id]?.[contract.webToken] ?? model.platformTokenMaps.web[variant.id][contract.webToken]
        const entry = {
          id: `web-guidance:${contract.id}:${variant.id}`,
          path: 'src/data/tokens.ts',
          field: `tokens.${variant.id}.${contract.webToken}`,
          artifactType: 'webToken',
          adapter: 'web',
          variant: variant.id,
          roleId: null,
          guidanceId: contract.id,
          familyId: sourceId,
          resolvedColor: outputColor,
          chainRefs: buildArtifactChain([...resolved.chainRefs, `adapters.guidances.${contract.id}`], resolvedColor, outputColor),
        }
        entries.push(entry)
        pushIndexed(indexes, entry)
      }

      if (contract.vscodeColor) {
        const outputColor = artifactMaps.vscode?.workbench?.[variant.id]?.[contract.vscodeColor] ?? model.platformTokenMaps.vscode.workbench[variant.id][contract.vscodeColor]
        const entry = {
          id: `vscode-guidance:${contract.id}:${variant.id}`,
          path: variant.outputPath,
          field: `colors.${contract.vscodeColor}`,
          artifactType: 'vscodeWorkbench',
          adapter: 'vscode',
          variant: variant.id,
          roleId: null,
          guidanceId: contract.id,
          familyId: sourceId,
          resolvedColor: outputColor,
          chainRefs: buildArtifactChain([...resolved.chainRefs, `adapters.guidances.${contract.id}`], resolvedColor, outputColor),
        }
        entries.push(entry)
        pushIndexed(indexes, entry)
      }

      if (contract.obsidianVar) {
        const outputColor = artifactMaps.obsidian?.[variant.id]?.[contract.obsidianVar] ?? model.platformTokenMaps.obsidian[variant.id][contract.obsidianVar]
        const entry = {
          id: `obsidian-guidance:${contract.id}:${variant.id}`,
          path: OBSIDIAN_THEME_PATHS[variant.id],
          field: contract.obsidianVar,
          artifactType: 'obsidianVar',
          adapter: 'obsidian',
          variant: variant.id,
          roleId: null,
          guidanceId: contract.id,
          familyId: sourceId,
          resolvedColor: outputColor,
          chainRefs: [...resolved.chainRefs, `adapters.guidances.${contract.id}`],
        }
        entries.push(entry)
        pushIndexed(indexes, entry)
      }
    }
  }

  return entries
}

function buildTerminalEntries(model, artifactMaps, indexes) {
  const entries = []
  const siteKeys = new Set(getExportedSiteTokenKeys())

  for (const variant of model.variants.variants) {
    for (const contract of model.terminalAdapters) {
      const resolved = model.terminalRules.terminals[contract.id].resolved[variant.id]
      const resolvedColor = resolved.color
      const sourceId = resolved.family || `terminal:${contract.id}`

      if (contract.webToken && siteKeys.has(contract.webToken)) {
        const outputColor = artifactMaps.web?.[variant.id]?.[contract.webToken] ?? model.platformTokenMaps.web[variant.id][contract.webToken]
        const entry = {
          id: `web-terminal:${contract.id}:${variant.id}`,
          path: 'src/data/tokens.ts',
          field: `tokens.${variant.id}.${contract.webToken}`,
          artifactType: 'webToken',
          adapter: 'web',
          variant: variant.id,
          roleId: null,
          terminalId: contract.id,
          familyId: sourceId,
          resolvedColor: outputColor,
          chainRefs: buildArtifactChain([...resolved.chainRefs, `adapters.terminals.${contract.id}`], resolvedColor, outputColor),
        }
        entries.push(entry)
        pushIndexed(indexes, entry)
      }

      if (contract.vscodeColor) {
        const outputColor = artifactMaps.vscode?.workbench?.[variant.id]?.[contract.vscodeColor] ?? model.platformTokenMaps.vscode.workbench[variant.id][contract.vscodeColor]
        const entry = {
          id: `vscode-terminal:${contract.id}:${variant.id}`,
          path: variant.outputPath,
          field: `colors.${contract.vscodeColor}`,
          artifactType: 'vscodeWorkbench',
          adapter: 'vscode',
          variant: variant.id,
          roleId: null,
          terminalId: contract.id,
          familyId: sourceId,
          resolvedColor: outputColor,
          chainRefs: buildArtifactChain([...resolved.chainRefs, `adapters.terminals.${contract.id}`], resolvedColor, outputColor),
        }
        entries.push(entry)
        pushIndexed(indexes, entry)
      }

      if (contract.obsidianVar) {
        const outputColor = artifactMaps.obsidian?.[variant.id]?.[contract.obsidianVar] ?? model.platformTokenMaps.obsidian[variant.id][contract.obsidianVar]
        const entry = {
          id: `obsidian-terminal:${contract.id}:${variant.id}`,
          path: OBSIDIAN_THEME_PATHS[variant.id],
          field: contract.obsidianVar,
          artifactType: 'obsidianVar',
          adapter: 'obsidian',
          variant: variant.id,
          roleId: null,
          terminalId: contract.id,
          familyId: sourceId,
          resolvedColor: outputColor,
          chainRefs: [...resolved.chainRefs, `adapters.terminals.${contract.id}`],
        }
        entries.push(entry)
        pushIndexed(indexes, entry)
      }
    }
  }

  return entries
}

function buildFeedbackEntries(model, artifactMaps, indexes) {
  const entries = []
  const siteKeys = new Set(getExportedSiteTokenKeys())

  for (const variant of model.variants.variants) {
    for (const contract of model.feedbackAdapters) {
      const resolved = model.feedbackRules.feedbacks[contract.id].resolved[variant.id]
      const resolvedColor = resolved.color
      const sourceId = resolved.family || `feedback:${contract.id}`

      if (contract.webToken && siteKeys.has(contract.webToken)) {
        const outputColor = artifactMaps.web?.[variant.id]?.[contract.webToken] ?? model.platformTokenMaps.web[variant.id][contract.webToken]
        const entry = {
          id: `web-feedback:${contract.id}:${variant.id}`,
          path: 'src/data/tokens.ts',
          field: `tokens.${variant.id}.${contract.webToken}`,
          artifactType: 'webToken',
          adapter: 'web',
          variant: variant.id,
          roleId: null,
          feedbackId: contract.id,
          familyId: sourceId,
          resolvedColor: outputColor,
          chainRefs: buildArtifactChain([...resolved.chainRefs, `adapters.feedbacks.${contract.id}`], resolvedColor, outputColor),
        }
        entries.push(entry)
        pushIndexed(indexes, entry)
      }

      if (contract.vscodeColor) {
        const outputColor = artifactMaps.vscode?.workbench?.[variant.id]?.[contract.vscodeColor] ?? model.platformTokenMaps.vscode.workbench[variant.id][contract.vscodeColor]
        const entry = {
          id: `vscode-feedback:${contract.id}:${variant.id}`,
          path: variant.outputPath,
          field: `colors.${contract.vscodeColor}`,
          artifactType: 'vscodeWorkbench',
          adapter: 'vscode',
          variant: variant.id,
          roleId: null,
          feedbackId: contract.id,
          familyId: sourceId,
          resolvedColor: outputColor,
          chainRefs: buildArtifactChain([...resolved.chainRefs, `adapters.feedbacks.${contract.id}`], resolvedColor, outputColor),
        }
        entries.push(entry)
        pushIndexed(indexes, entry)
      }

      if (contract.obsidianVar) {
        const outputColor = artifactMaps.obsidian?.[variant.id]?.[contract.obsidianVar] ?? model.platformTokenMaps.obsidian[variant.id][contract.obsidianVar]
        const entry = {
          id: `obsidian-feedback:${contract.id}:${variant.id}`,
          path: OBSIDIAN_THEME_PATHS[variant.id],
          field: contract.obsidianVar,
          artifactType: 'obsidianVar',
          adapter: 'obsidian',
          variant: variant.id,
          roleId: null,
          feedbackId: contract.id,
          familyId: sourceId,
          resolvedColor: outputColor,
          chainRefs: [...resolved.chainRefs, `adapters.feedbacks.${contract.id}`],
        }
        entries.push(entry)
        pushIndexed(indexes, entry)
      }
    }
  }

  return entries
}

function buildRoleEntries(model, artifactMaps, indexes) {
  const entries = []
  const siteKeys = new Set(getExportedSiteTokenKeys())
  const roleIndex = buildRoleIndex(model.adapters)

  for (const roleId of Object.keys(model.semanticPalette)) {
    const roleDef = roleIndex.get(roleId)
    if (!roleDef) continue
    const webTokenKey = roleDef.webToken || roleId
    for (const variant of model.variants.variants) {
      const resolved = model.resolvedSemantic[roleId][variant.id]
      const baseChain = [
        `foundation.families.${resolved.family}.tones.${resolved.tone}.${variant.id}`,
        `semantic-rules.roles.${roleId}`,
        `variant-profiles.variants.${variant.id}`,
      ]

      const semanticSnapshotEntry = {
        id: `semantic-snapshot:${roleId}:${variant.id}`,
        path: model.sources.semanticSnapshot,
        field: `roles.${roleId}.${variant.id}`,
        artifactType: 'semanticSnapshot',
        adapter: null,
        variant: variant.id,
        roleId,
        familyId: resolved.family,
        resolvedColor: resolved.color,
        chainRefs: baseChain,
        usedEscapeHatch: resolved.usedEscapeHatch,
      }
      entries.push(semanticSnapshotEntry)
      pushIndexed(indexes, semanticSnapshotEntry)

      if (siteKeys.has(webTokenKey)) {
        const outputColor = artifactMaps.web?.[variant.id]?.[webTokenKey] ?? model.platformTokenMaps.web[variant.id][webTokenKey]
        const webEntry = {
          id: `web-role:${roleId}:${variant.id}`,
          path: 'src/data/tokens.ts',
          field: `tokens.${variant.id}.${webTokenKey}`,
          artifactType: 'webToken',
          adapter: 'web',
          variant: variant.id,
          roleId,
          familyId: resolved.family,
          resolvedColor: outputColor,
          chainRefs: buildArtifactChain([...baseChain, `adapters.roles.${roleId}`], resolved.color, outputColor),
        }
        entries.push(webEntry)
        pushIndexed(indexes, webEntry)
      }

      if (roleDef.vscodeSemantic) {
        const outputColor =
          artifactMaps.vscode?.semantic?.[variant.id]?.[roleDef.vscodeSemantic]
          ?? model.platformTokenMaps.vscode.semantic[variant.id][roleDef.vscodeSemantic]
        const semanticEntry = {
          id: `vscode-semantic:${roleId}:${variant.id}`,
          path: variant.outputPath,
          field: `semanticTokenColors.${roleDef.vscodeSemantic}`,
          artifactType: 'vscodeSemantic',
          adapter: 'vscode',
          variant: variant.id,
          roleId,
          familyId: resolved.family,
          resolvedColor: outputColor,
          chainRefs: buildArtifactChain([...baseChain, `adapters.roles.${roleId}`], resolved.color, outputColor),
        }
        entries.push(semanticEntry)
        pushIndexed(indexes, semanticEntry)
      }

      if (roleDef.scopes?.length) {
        const outputColor =
          artifactMaps.vscode?.textmate?.[variant.id]?.[roleId]?.color
          ?? model.platformTokenMaps.vscode.textmate[variant.id]?.[roleId]?.color
          ?? resolved.color
        const textmateEntry = {
          id: `vscode-textmate:${roleId}:${variant.id}`,
          path: variant.outputPath,
          field: `tokenColors[${roleId}]`,
          artifactType: 'vscodeTextMate',
          adapter: 'vscode',
          variant: variant.id,
          roleId,
          familyId: resolved.family,
          resolvedColor: outputColor,
          chainRefs: buildArtifactChain([...baseChain, `adapters.roles.${roleId}`], resolved.color, outputColor),
          scopes: roleDef.scopes,
        }
        entries.push(textmateEntry)
        pushIndexed(indexes, textmateEntry)
      }

      if (roleDef.obsidianVar) {
        const outputColor = artifactMaps.obsidian?.[variant.id]?.[roleDef.obsidianVar] ?? model.platformTokenMaps.obsidian[variant.id][roleDef.obsidianVar]
        const obsidianEntry = {
          id: `obsidian-role:${roleId}:${variant.id}`,
          path: OBSIDIAN_THEME_PATHS[variant.id],
          field: roleDef.obsidianVar,
          artifactType: 'obsidianVar',
          adapter: 'obsidian',
          variant: variant.id,
          roleId,
          familyId: resolved.family,
          resolvedColor: outputColor,
          chainRefs: [...baseChain, `adapters.roles.${roleId}`],
        }
        entries.push(obsidianEntry)
        pushIndexed(indexes, obsidianEntry)
      }
    }
  }

  return entries
}

export function buildColorLanguageLineage(model, artifactMaps = model.platformTokenMaps) {
  const indexes = {
    byArtifactId: {},
    byPath: {},
    byVariant: {},
    byRole: {},
    byFeedback: {},
    byInterface: {},
    byGuidance: {},
    byTerminal: {},
    byFamily: {},
  }

  const artifactEntries = [
    ...buildSurfaceEntries(model, artifactMaps, indexes),
    ...buildInteractionEntries(model, artifactMaps, indexes),
    ...buildInterfaceEntries(model, artifactMaps, indexes),
    ...buildGuidanceEntries(model, artifactMaps, indexes),
    ...buildTerminalEntries(model, artifactMaps, indexes),
    ...buildFeedbackEntries(model, artifactMaps, indexes),
    ...buildRoleEntries(model, artifactMaps, indexes),
  ]

  const roles = {}
  for (const [roleId, variants] of Object.entries(model.resolvedSemantic)) {
    const first = variants[Object.keys(variants)[0]]
    roles[roleId] = {
      source: {
        family: first.family,
        tone: first.tone,
      },
      flags: model.semanticRules.roles[roleId].flags,
      variants: Object.fromEntries(
        Object.entries(variants).map(([variantId, entry]) => [
          variantId,
          {
            color: entry.color,
            family: entry.family,
            tone: entry.tone,
            usedEscapeHatch: entry.usedEscapeHatch,
            steps: entry.steps,
          },
        ])
      ),
    }
  }

  const feedbacks = {}
  for (const [feedbackId, entry] of Object.entries(model.feedbackRules.feedbacks)) {
    const firstVariantId = Object.keys(entry.resolved)[0]
    const first = entry.resolved[firstVariantId]
    feedbacks[feedbackId] = {
      source: {
        family: first.family,
        tone: first.tone,
      },
      variants: Object.fromEntries(
        Object.entries(entry.resolved).map(([variantId, resolved]) => [
          variantId,
          {
            color: resolved.color,
            family: resolved.family,
            tone: resolved.tone,
            usedEscapeHatch: resolved.usedEscapeHatch,
            steps: resolved.steps,
          },
        ])
      ),
    }
  }

  const interfaces = {}
  for (const [interfaceId, entry] of Object.entries(model.interfaceRules.interfaces)) {
    const firstVariantId = Object.keys(entry.resolved)[0]
    const first = entry.resolved[firstVariantId]
    interfaces[interfaceId] = {
      source: {
        family: first.family,
        tone: first.tone,
      },
      variants: Object.fromEntries(
        Object.entries(entry.resolved).map(([variantId, resolved]) => [
          variantId,
          {
            color: resolved.color,
            family: resolved.family,
            tone: resolved.tone,
            usedEscapeHatch: resolved.usedEscapeHatch,
            steps: resolved.steps,
          },
        ])
      ),
    }
  }

  const guidances = {}
  for (const [guidanceId, entry] of Object.entries(model.guidanceRules.guidances)) {
    const firstVariantId = Object.keys(entry.resolved)[0]
    const first = entry.resolved[firstVariantId]
    guidances[guidanceId] = {
      source: {
        family: first.family,
        tone: first.tone,
      },
      variants: Object.fromEntries(
        Object.entries(entry.resolved).map(([variantId, resolved]) => [
          variantId,
          {
            color: resolved.color,
            family: resolved.family,
            tone: resolved.tone,
            usedEscapeHatch: resolved.usedEscapeHatch,
            steps: resolved.steps,
          },
        ])
      ),
    }
  }

  const terminals = {}
  for (const [terminalId, entry] of Object.entries(model.terminalRules.terminals)) {
    const firstVariantId = Object.keys(entry.resolved)[0]
    const first = entry.resolved[firstVariantId]
    terminals[terminalId] = {
      source: {
        family: first.family,
        tone: first.tone,
      },
      variants: Object.fromEntries(
        Object.entries(entry.resolved).map(([variantId, resolved]) => [
          variantId,
          {
            color: resolved.color,
            family: resolved.family,
            tone: resolved.tone,
            usedEscapeHatch: resolved.usedEscapeHatch,
            steps: resolved.steps,
          },
        ])
      ),
    }
  }

  return {
    schemaVersion: 7,
    sources: model.sources,
    scheme: {
      id: model.scheme.id,
      name: model.scheme.name,
      headline: model.scheme.headline,
      summary: model.scheme.summary,
      defaultVariant: model.scheme.defaultVariant,
    },
    foundation: {
      families: Object.fromEntries(
        Object.entries(model.foundation.families).map(([familyId, family]) => [
          familyId,
          {
            description: family.description,
            tones: family.tones,
          },
        ])
      ),
    },
    guidances,
    terminals,
    interfaces,
    feedbacks,
    surfaceRules: Object.fromEntries(
      Object.entries(model.surfaceRules.surfaces).map(([surfaceId, values]) => [
        surfaceId,
        {
          description: model.surfaceRules.definitions[surfaceId]?.description || '',
          values,
          variants: Object.fromEntries(
            Object.entries(model.surfaceRules.resolved[surfaceId]).map(([variantId, entry]) => [
              variantId,
              {
                color: entry.color,
                sourceType: entry.sourceType,
                sourceRef: entry.sourceRef,
                usedEscapeHatch: entry.usedEscapeHatch,
                chainRefs: entry.chainRefs,
                steps: entry.steps,
              },
            ])
          ),
        },
      ])
    ),
    interactionRules: Object.fromEntries(
      Object.entries(model.interactionRules.interactions).map(([interactionId, entry]) => [
        interactionId,
        {
          description: entry.description,
          values: entry.values,
          variants: Object.fromEntries(
            Object.entries(entry.resolved).map(([variantId, resolved]) => [
              variantId,
              {
                color: resolved.color,
                sourceType: resolved.sourceType,
                sourceRef: resolved.sourceRef,
                usedEscapeHatch: resolved.usedEscapeHatch,
                chainRefs: resolved.chainRefs,
                steps: resolved.steps,
              },
            ])
          ),
        },
      ])
    ),
    variantProfiles: model.variantProfiles.variants,
    roles,
    artifactEntries,
    indexes,
  }
}
