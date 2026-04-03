# Color Language Contract Review

Generated from `color-system/framework/contract-review-checklist.json`.
This document explains which layers are already stable future-proof contracts, which remain bounded compatibility or calibration layers, and which files are still migration anchors.

## Current Status

| Contract | Layer | Lifecycle | Review Mode | Verdict | Summary |
| --- | --- | --- | --- | --- | --- |
| Scheme Layer | scheme | future-proof | Future-proof contract review | stable | Scheme identity, philosophy, and taxonomy now behave as explicit public-facing contracts instead of sharing authority with platform files. |
| Color Language Core | core | future-proof | Future-proof contract review | stable | Families, semantics, surfaces, guidance, interface, interaction, feedback, and terminal language now live in abstract scheme data instead of host-specific files. |
| Variant System | variant | future-proof | Future-proof contract review | stable | Climate behavior and intensity knobs are now separated from semantic identity, so new schemes can reuse the framework without rewriting generators. |
| Platform Contracts | platform | future-proof | Future-proof contract review | stable | Adapters and VS Code chrome bindings now behave as translation contracts rather than hidden design sources. |
| Bounded Compatibility | platform | bounded-compatibility | Bounded compatibility review | bounded | The remaining residual workbench keys are explicit host-specific exceptions with rationale, instead of silent leftovers. |
| Calibration | platform | calibration | Calibration review | stable | Calibration is fenced into bounded tuning logic and no longer acts as a hidden design-definition layer. |
| Migration Anchors | platform | migration | Migration anchor review | transitional | Source and template snapshots are still required for compatibility, but they are sync-managed migration anchors with a visible exit path. |
| Generated Artifacts | generated | generated | Generated output review | generated | Themes, docs, reports, and derived assets are reproducible deliverables guarded by sync and generated-origin checks. |

## Future-proof contract review

Applies to lifecycles: future-proof

- **clean-authority-boundary**: Is this layer free of hidden design authority drift?
  - The layer should either remain platform-free or act only as a translation boundary, without re-owning palette authorship.
- **scheme-reusable**: Can multiple schemes reuse this layer without rewriting generators?
  - Future-proof contracts should support new schemes as data changes, not as generator forks.
- **lineage-visible**: Can downstream results still explain this layer in lineage and parity?
  - A future-proof layer must remain visible in reports and not disappear into opaque postprocess behavior.
- **audit-guarded**: Do source-layer and registry audits guard this boundary?
  - Stable contracts should be enforceable, not just documented.
- **direct-edit-authority**: Is this the right place for maintainers to edit intent directly?
  - Future-proof contracts should stay editable at the source instead of forcing maintainers into generated or migration files.

## Bounded compatibility review

Applies to lifecycles: bounded-compatibility

- **host-specific**: Is the exception truly host- or renderer-specific?
  - Only residual behavior that is not worth abstracting yet should live here.
- **small-surface-area**: Is the exception surface area intentionally small and measurable?
  - Bounded compatibility should stay narrow so the abstract model keeps growing instead of leaking.
- **rationale-recorded**: Does the entry explain why abstraction is not worth it yet?
  - Every compatibility escape hatch needs an explicit cost-benefit explanation.
- **no-design-values**: Is the boundary free of reusable design values?
  - This layer may explain exceptions, but it must not quietly become a palette-definition layer.
- **revisit-trigger**: Is there a clear trigger for revisiting this exception later?
  - Bounded compatibility should be reviewable, not forgotten.

## Calibration review

Applies to lifecycles: calibration

- **bounded-compensation**: Is this layer limited to bounded compensation rather than design authorship?
  - Calibration exists to tune readability and parity, not to redefine the scheme.
- **non-authority**: Would removing this file still leave the design authority intact upstream?
  - A calibration layer should never become the only place where intent lives.
- **traceable-effect**: Can the effects of calibration still be explained in lineage or parity?
  - Calibration should remain observable and bounded.
- **budget-backed**: Are the adjustments grounded in explicit budgets or thresholds?
  - Calibration should follow measurable constraints instead of taste-based drift.

## Migration anchor review

Applies to lifecycles: migration

- **sync-managed**: Is the file sync-managed rather than hand-authored design input?
  - Migration anchors should preserve compatibility while upstream layers mature.
- **upstream-target-known**: Is it clear which abstract layer should absorb this anchor over time?
  - Migration anchors need an exit path, not indefinite limbo.
- **residual-visible**: Is the remaining anchor surface visible in residual or compatibility reporting?
  - Migration work should stay measurable.
- **exit-condition-defined**: Is there a defined condition for declaring the migration complete?
  - This keeps migration layers from quietly becoming permanent authorities.

## Generated output review

Applies to lifecycles: generated

- **reproducible**: Can the output be fully reproduced by sync or build?
  - Generated deliverables should be deterministic artifacts.
- **source-led**: Do source and generator changes fully explain output drift?
  - Generated files should never become hidden sources of truth.
- **non-authoritative**: Is the team protected from editing this output directly?
  - Generated artifacts must stay clearly downstream.
- **audit-covered**: Do audits and sync checks cover this output class?
  - Generated artifacts should be guarded by automation, not memory.

## Scheme Layer

- Layer: scheme
- Lifecycle: future-proof
- Review mode: Future-proof contract review
- Verdict: stable

Scheme identity, philosophy, and taxonomy now behave as explicit public-facing contracts instead of sharing authority with platform files.

### Passed checks
- clean-authority-boundary
- scheme-reusable
- lineage-visible
- audit-guarded
- direct-edit-authority

### Evidence
- audit:source-layer
- audit:contracts
- check:schemes
- audit:lineage

### Next action
- Keep this layer public-facing and platform-free.

## Color Language Core

- Layer: core
- Lifecycle: future-proof
- Review mode: Future-proof contract review
- Verdict: stable

Families, semantics, surfaces, guidance, interface, interaction, feedback, and terminal language now live in abstract scheme data instead of host-specific files.

### Passed checks
- clean-authority-boundary
- scheme-reusable
- lineage-visible
- audit-guarded
- direct-edit-authority

### Evidence
- audit:source-layer
- check:schemes
- audit:lineage
- audit:parity

### Next action
- Keep preferring sparse anchors and derivation over per-variant result tables.

## Variant System

- Layer: variant
- Lifecycle: future-proof
- Review mode: Future-proof contract review
- Verdict: stable

Climate behavior and intensity knobs are now separated from semantic identity, so new schemes can reuse the framework without rewriting generators.

### Passed checks
- clean-authority-boundary
- scheme-reusable
- lineage-visible
- audit-guarded
- direct-edit-authority

### Evidence
- audit:source-layer
- check:schemes
- audit:lineage
- audit:parity

### Next action
- Use this layer whenever the grammar stays the same but climate intensity changes.

## Platform Contracts

- Layer: platform
- Lifecycle: future-proof
- Review mode: Future-proof contract review
- Verdict: stable

Adapters and VS Code chrome bindings now behave as translation contracts rather than hidden design sources.

### Passed checks
- clean-authority-boundary
- scheme-reusable
- lineage-visible
- audit-guarded
- direct-edit-authority

### Evidence
- audit:source-layer
- audit:lineage
- audit:parity
- audit:compatibility

### Next action
- Add new hosts here only after the abstract layer already expresses the needed behavior.

## Bounded Compatibility

- Layer: platform
- Lifecycle: bounded-compatibility
- Review mode: Bounded compatibility review
- Verdict: bounded

The remaining residual workbench keys are explicit host-specific exceptions with rationale, instead of silent leftovers.

### Passed checks
- host-specific
- small-surface-area
- rationale-recorded
- no-design-values
- revisit-trigger

### Evidence
- audit:compatibility
- reports/vscode-chrome-residual.json
- audit:contracts

### Next action
- Revisit when a new abstract tone role can replace one of the residual keys cleanly.

## Calibration

- Layer: platform
- Lifecycle: calibration
- Review mode: Calibration review
- Verdict: stable

Calibration is fenced into bounded tuning logic and no longer acts as a hidden design-definition layer.

### Passed checks
- bounded-compensation
- non-authority
- traceable-effect
- budget-backed

### Evidence
- audit:source-layer
- audit:parity
- audit:lineage
- docs/theme-baseline.md

### Next action
- Keep tuning numeric and budget-driven; move any new color identity work upward instead.

## Migration Anchors

- Layer: platform
- Lifecycle: migration
- Review mode: Migration anchor review
- Verdict: transitional

Source and template snapshots are still required for compatibility, but they are sync-managed migration anchors with a visible exit path.

### Passed checks
- sync-managed
- upstream-target-known
- residual-visible
- exit-condition-defined

### Evidence
- scripts/color-system/vscode-chrome.mjs
- reports/vscode-chrome-residual.json
- audit:compatibility

### Next action
- Shrink this surface only when abstraction cost stays lower than host-specific complexity.

## Generated Artifacts

- Layer: generated
- Lifecycle: generated
- Review mode: Generated output review
- Verdict: generated

Themes, docs, reports, and derived assets are reproducible deliverables guarded by sync and generated-origin checks.

### Passed checks
- reproducible
- source-led
- non-authoritative
- audit-covered

### Evidence
- check:sync
- audit:generated-origin
- audit:contracts
- audit:all

### Next action
- Treat drift as a source-layer or generator problem, never as a hand-editing task.
