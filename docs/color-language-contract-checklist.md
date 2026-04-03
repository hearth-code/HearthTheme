# Color Language Contract Checklist

Auto-generated from `color-system/framework/contract-checklist.json`.

Lifecycle registry for long-term color-language contracts, bounded compatibility layers, and generated outputs.

## Summary

| Contract | Layer | Lifecycle | Edit policy | Path patterns |
| --- | --- | --- | --- | --- |
| Scheme Layer | Scheme | Future Proof | edit-directly | 4 |
| Product / Distribution Layer | Product | Future Proof | edit-directly | 4 |
| Color Language Core | Core | Future Proof | edit-directly | 8 |
| Variant System | Variant | Future Proof | edit-directly | 3 |
| Platform Contracts | Platform | Future Proof | edit-directly | 2 |
| Bounded Compatibility | Platform | Bounded Compatibility | edit-with-rationale | 1 |
| Calibration | Platform | Calibration | calibrate-only | 1 |
| Migration Anchors | Platform | Migration | sync-managed | 2 |
| Generated Artifacts | Generated | Generated | generated-only | 15 |

## Lifecycle Meanings

- Future Proof: safe to design against as a long-term contract.
- Bounded Compatibility: explicit host exceptions that require rationale.
- Calibration: bounded compensation only; never palette authorship.
- Migration: sync-managed anchors that still protect current outputs.
- Generated: deliverables and reports; never edit by hand.

## Scheme Layer

- Layer: Scheme
- Lifecycle: Future Proof
- Edit policy: `edit-directly`

Define the public identity, vocabulary, and abstract grouping vocabulary for every scheme.

Tracked paths:

- `color-system/active-scheme.json`
- `color-system/schemes/*/scheme.json`
- `color-system/schemes/*/philosophy.md`
- `color-system/schemes/*/taxonomy.json`

Checklist:

- Keep all platform fields out of the scheme layer.
- Change this layer when the public story or grouping vocabulary changes.

## Product / Distribution Layer

- Layer: Product
- Lifecycle: Future Proof
- Edit policy: `edit-directly`

Bind a public distribution identity to schemes without letting scheme manifests own marketplace, preview, or channel metadata.

Tracked paths:

- `products/active-product.json`
- `products/*/product.json`
- `products/*/preview.json`
- `products/*/release.json`

Checklist:

- Product files may describe channels and product identity, but they must not define palette values.
- Keep preview and release copy here instead of pushing product packaging back into scheme manifests.

## Color Language Core

- Layer: Core
- Lifecycle: Future Proof
- Edit policy: `edit-directly`

Own the abstract color language itself: families, roles, environment, guidance, interface, interaction, feedback, and terminal semantics.

Tracked paths:

- `color-system/schemes/*/foundation.json`
- `color-system/schemes/*/semantic-rules.json`
- `color-system/schemes/*/surface-rules.json`
- `color-system/schemes/*/guidance-rules.json`
- `color-system/schemes/*/terminal-rules.json`
- `color-system/schemes/*/interface-rules.json`
- `color-system/schemes/*/interaction-rules.json`
- `color-system/schemes/*/feedback-rules.json`

Checklist:

- Prefer sparse anchors plus derivation over flat per-variant result tables.
- Keep semantic meaning and environment relationships here, not in platform adapters.

## Variant System

- Layer: Variant
- Lifecycle: Future Proof
- Edit policy: `edit-directly`

Control climate behavior, polarity, inheritance, and scheme-specific intensity knobs without redefining semantic meaning.

Tracked paths:

- `color-system/framework/variant-profiles.json`
- `color-system/framework/variants.json`
- `color-system/schemes/*/variant-knobs.json`

Checklist:

- Keep this layer platform-free.
- Use variant knobs when the grammar stays the same but climate intensity changes.

## Platform Contracts

- Layer: Platform
- Lifecycle: Future Proof
- Edit policy: `edit-directly`

Map abstract roles, surfaces, guidance, interface, interaction, feedback, and terminal semantics into concrete platform fields.

Tracked paths:

- `color-system/framework/adapters.json`
- `color-system/framework/vscode-chrome-contract.json`

Checklist:

- Platform contracts translate intent; they do not define palette values.
- Add new terminals or hosts here only after the abstract layer is already expressive enough.

## Bounded Compatibility

- Layer: Platform
- Lifecycle: Bounded Compatibility
- Edit policy: `edit-with-rationale`

Declare the small set of host-specific exceptions that intentionally remain outside abstract tone roles.

Tracked paths:

- `color-system/framework/compatibility-boundaries.json`

Checklist:

- Every entry must explain why the abstraction cost is not worth it yet.
- This layer must stay free of design hex values and reusable palette decisions.

## Calibration

- Layer: Platform
- Lifecycle: Calibration
- Edit policy: `calibrate-only`

Apply bounded readability, separation, telemetry, and asset-generation calibration without becoming a design authority.

Tracked paths:

- `color-system/framework/tuning.json`

Checklist:

- Use this layer for bounded compensation, not palette authorship.
- Any calibration drift must remain explainable in lineage and parity.

## Migration Anchors

- Layer: Platform
- Lifecycle: Migration
- Edit policy: `sync-managed`

Preserve stable compatibility snapshots while design authority continues moving upward into scheme and framework layers.

Tracked paths:

- `color-system/hearth-dark.source.json`
- `color-system/templates/*.base.json`

Checklist:

- Treat these files as sync-managed anchors, not philosophical sources of truth.
- Only touch them manually when platform compatibility work truly requires it.

## Generated Artifacts

- Layer: Generated
- Lifecycle: Generated
- Edit policy: `generated-only`

Ship and document the current resolved outputs without letting deliverables become hidden design authority.

Tracked paths:

- `color-system/semantic.json`
- `themes/*.json`
- `public/themes/*.json`
- `extension/themes/*.json`
- `obsidian/themes/*.css`
- `obsidian/app-theme/*`
- `src/data/tokens.ts`
- `src/styles/theme-vars.css`
- `docs/theme-baseline.md`
- `docs/color-language-report.md`
- `docs/color-language-contract-checklist.md`
- `reports/color-language-lineage.json`
- `reports/color-language-consistency.json`
- `reports/color-language-parity.json`
- `reports/vscode-chrome-residual.json`

Checklist:

- Generated files should change only when sources or generators change.
- Never hand-tune these outputs instead of fixing the source layer.

