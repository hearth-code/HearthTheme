# HearthCode Marketing System

HearthCode should be presented as a compact, calibrated theme family rather than
as a growing list of unrelated ports.

## Product truth

- The theme directions are **Ember** and **Moss**.
- Each direction ships in **Dark** and **Light**.
- **Amber** is an Obsidian accent preset. It is not a HearthCode theme direction.
- Theme Forge is a VS Code capability, not a separate theme family or a feature
  promised on every platform.

| Surface or channel | Ember | Moss | Platform-specific capability |
| --- | --- | --- | --- |
| VS Code | Dark + Light | Dark + Light | Theme Forge |
| Open VSX editors | Dark + Light | Dark + Light | — |
| Zed | Dark + Light | Dark + Light | — |
| Terminal packs | Dark + Light | Dark + Light | Five generated formats |
| Obsidian | — | Dark + Light | Style Settings |

`products/hearthcode/product.json` is the source of truth for supported schemes
and channels. Marketing assets must derive availability from that manifest rather
than maintain a second hand-written platform list.

## Positioning

Primary message:

> EMBER / MOSS

Supporting message:

> Four themes. One color language.

Ember brings warm softness. Moss brings dry structure. Each direction ships in
Dark and Light, with the same semantic roles expressed through a different
material character.

Proof should be shown in this order:

1. Two visibly distinct material directions.
2. Dark and Light designed as pairs.
3. Accurate platform availability.
4. Generated and audited semantic consistency.
5. Platform-specific capabilities such as Theme Forge and Style Settings.

Do not lead with the number of platforms, Theme Forge, or the calibration
implementation. Those are supporting proof, not the product definition.

## Visual direction: Color Field Guide

The system should feel like an editorial color specimen or material field guide:
measured, tactile, and useful. It should not look like a generic software launch
graphic.

- Use charcoal and paper as the dominant fields.
- Use Ember and Moss as asymmetric material accents, never as a generic rainbow.
- Prefer registration marks, specimen labels, small measurements, syntax samples,
  and clear ruled divisions over floating glass cards.
- Keep screenshots and generated UI previews honest. A generated representation
  must not pretend to be a literal screenshot from an application.
- Use one strong statement per asset. Installation, customization, and platform
  coverage belong in separate frames.

## Content matrix

Every asset has one job and one source-owned sample. Do not substitute decorative
pseudocode or generic product copy at export time.

| Asset | Message | Sample proof |
| --- | --- | --- |
| Family overview / social card | `EMBER / MOSS` and `FOUR THEMES. ONE COLOR LANGUAGE.` | One valid TypeScript object repeated across all four themes; only `direction` and `mode` change. |
| VS Code / Open VSX / Zed | `Same roles. Different material.` | The shared TypeScript theme object. |
| Obsidian | `Color as reading order.` | Markdown heading, callout, and task list. |
| Terminal packs | `Meaning survives the surface.` | The real `pnpm run verify` command and audit result labels. |
| Theme Forge | `Your color. Same safeguards.` | Choose direction, pick seed, preview both modes, apply, and restore. |

The copy and samples live in `products/hearthcode/preview.json`. The preview
generator must consume them directly so the website, repository, and extension
exports cannot silently diverge.

## Color fidelity contract

Marketing composition may be expressive, but its palette is not a separate
design surface.

- Theme surfaces, foregrounds, syntax samples, and palette swatches must use
  exact values read from `themes/ember-dark.json`, `themes/ember-light.json`,
  `themes/moss-dark.json`, and `themes/moss-light.json`.
- A color shown as a Theme Forge seed must be an existing shipped theme token.
- Alpha and mixes of shipped tokens are allowed only for layout scaffolding such
  as grids, borders, and muted labels. They must never be presented as theme
  swatches or syntax colors.
- `reports/preview-manifest.json` records the source path, SHA-256, and exact
  colors used for every theme. Generation fails when a required token is absent.
- Automated tests inspect generated PNG pixels and require every canonical
  surface and syntax color to be present. Source and manifest values must match
  exactly; PNG checks allow at most one 8-bit RGB unit for SVG rasterizer
  rounding. A plausible-looking substitute is therefore a failing build, not an
  acceptable approximation.

## Canonical assets

All channel-specific exports should derive from a small set of master assets:

- `extension/images/family-overview.png`: Ember/Moss × Dark/Light family overview.
- `extension/images/editor-moss-dark-light.png`: detailed Moss editor proof.
- `extension/images/theme-forge-workflow.png`: VS Code-only Forge capability.
- `docs/marketing/direction-atlas.png`: material and syntax distinction between
  Ember and Moss.
- `docs/marketing/platform-coverage.png`: accurate availability matrix.
- `docs/marketing/moss-surfaces.png`: generated semantic examples for code,
  notes, and terminal. It is a system diagram, not an app screenshot.
- `docs/marketing/obsidian-hero.png`: real Obsidian-specific functional preview.
- `public/og-hearth.png`: current family-level social card.

The preview generator owns these files. Update product, theme, preview, or
generator sources and run `pnpm run preview:generate`; do not edit the PNGs by
hand.

## Motion and sound

Motion assets should be derived only after the still system is approved.

- A family film shows Ember/Moss and Dark/Light. It does not explain Forge.
- Forge, Obsidian, and each direction receive separate short demonstrations.
- Use real theme switching and UI interaction instead of zooming static images.
- The video must work muted. Prefer silence or restrained interaction sounds over
  an ambient music bed until HearthCode has a deliberate audio identity.
