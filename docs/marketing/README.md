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

> Warmth or structure. Meaning stays clear.

Supporting message:

> Different material. Same reading rhythm.

`EMBER` and `MOSS` remain the product lockup. Ember brings warm softness; Moss
brings dry structure. Each direction ships in Dark and Light, with the same
semantic roles expressed through a different material character. `Four themes.
One color language.` is system proof, not the lead campaign headline.

Proof should be shown in this order:

1. Two visibly distinct material directions.
2. Dark and Light designed as pairs.
3. Accurate platform availability.
4. Generated and audited semantic consistency.
5. Platform-specific capabilities such as Theme Forge and Style Settings.

Do not lead with the number of platforms, Theme Forge, or the calibration
implementation. Those are supporting proof, not the product definition.

## Visual direction: Semantic Materials

The system should make two material atmospheres memorable while keeping real
code, Markdown, and terminal content crisp. It should not force every channel
into the same poster shell.

- Use charcoal and paper as the dominant fields.
- Use Ember and Moss as asymmetric material accents, never as a generic rainbow.
- Texture belongs to the substrate. Syntax and reading content remain sharp.
- Keep screenshots and generated UI previews honest. A generated representation
  must not pretend to be a literal screenshot from an application.
- Use one strong statement per asset. Installation, customization, and platform
  coverage belong in separate frames.
- Reserve the torn-paper rift for family-level attraction assets. Platform proof
  images inherit color and spacing, not the tear or field-guide chrome.

The visual system has three jobs:

1. **Attraction** — family hero, OG, and social covers use one memorable material
   boundary and no documentation-density labels.
2. **Product proof** — editor, Obsidian, terminal, and Forge imagery gives the
   working surface at least 70% of the canvas.
3. **System proof** — direction atlases, availability matrices, and calibration
   diagrams may use the denser Color Field Guide language.

### Material treatment

Family-level assets use a deterministic print layer: sparse paper grain, short
fibers, restrained display-type wear, and a structural torn-paper rift between
the wide Ember/Moss fields. The rift uses a jagged field boundary,
a narrow exposed paper core, a flat dark undercut, Ember-side abrasion,
projecting fibers, and detached chips rather than a decorative straight line or
drop shadow. Every layer is generated as SVG primitives; it is not a baked
raster overlay or an AI-authored palette source.

- Texture ink must be injected from the foreground or surface tokens of the
  theme underneath it.
- Most pixels remain the exact shipped surface color so color-fidelity checks
  can continue to prove the source palette.
- Proof/code regions use clean theme surfaces without a decorative texture layer.
- Torn-paper geometry must stay deterministic for the same dimensions and seed;
  its paper, warm edge, cool flecks, and shadow inks must be injected from real
  theme tokens.
- App-like editor and Forge demonstrations remain clean UI evidence rather than
  pretending to be printed screenshots.

## Content matrix

Every asset has one job and one source-owned sample. Do not substitute decorative
pseudocode or generic product copy at export time.

| Asset | Message | Sample proof |
| --- | --- | --- |
| Family overview / social card | `EMBER` and `MOSS`, separated by their material fields, with `WARMTH OR STRUCTURE. MEANING STAYS CLEAR.` | One valid TypeScript object repeated across all four themes; only `direction` and `mode` change. |
| VS Code / Open VSX / Zed | `Same roles. Different material.` | The shared TypeScript theme object. |
| Obsidian | `Color as reading order.` | Markdown heading, callout, and task list. |
| Terminal packs | `Meaning survives the surface.` | The real `pnpm run verify` command and audit result labels. |
| Theme Forge | `Your color. Same safeguards.` | Choose direction, pick seed, preview both modes, apply, and restore. |

The copy and samples live in `products/hearthcode/preview.json`. The preview
generator must consume them directly so the website, repository, and extension
exports cannot silently diverge.

## Asset compiler

Final marketing images are deterministic build artifacts. AI may be used to
explore a direction, but it is not a color, copy, logo, or layout source for a
shipped asset.

The compiler has three explicit layers:

1. `scripts/marketing/brand-system.mjs` owns typography stacks, field-guide
   measurements, registration marks, and safe structural color operations.
2. `scripts/marketing/template-components.mjs` owns reusable SVG composition
   primitives. Templates recompose for each aspect ratio rather than crop a
   single master image.
3. `products/hearthcode/marketing-assets.json` owns formats, channels,
   templates, and output paths. `schemas/marketing-assets.schema.json` guards
   that source file.

Run `pnpm run marketing:generate` after a theme, product, preview-copy, template,
or output-spec change. The command synchronizes theme outputs first, then rebuilds
the full marketing matrix.

### Output matrix

| Layer | Outputs |
| --- | --- |
| Family | README wide, GitHub social, site OG, square, portrait, and story/short-video cover. |
| Direction | Ember and Moss square specimens plus the combined direction atlas. |
| Editor | VS Code/Open VSX editor proof and the four-theme family overview. |
| Platform | Zed proof, terminal proof, generated availability matrix, and the separately generated real Obsidian hero. |
| Capability | Theme Forge workflow. |

The GitHub social export is `1280×640`, matching
[GitHub's best-display recommendation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview).
The site OG remains `1200×630`. Social square, feed portrait,
and story layouts are `1200×1200`, `1080×1350`, and `1080×1920` respectively.

### Aspect-ratio compositions

The family exports share typography, theme-derived colors, and specimen
components, but they do not share one stretched layout:

| Composition | Formats | Editorial job |
| --- | --- | --- |
| `semantic-rift-wide` | README, GitHub social, site OG | A left-to-right Ember/Moss rift with all four themes visible. |
| `editorial-square` | 1:1 social | A compact Dark/Light matrix with large, readable syntax proof. |
| `stacked-directions` | 4:5 feed | Ember and Moss become two stacked direction specimens; each pairs Dark and Light. |
| `campaign-story` | 9:16 story / short-video cover | A poster hierarchy with one large dark proof, one light proof, and no full-height rift. |

The selected composition is declared beside each family asset in
`products/hearthcode/marketing-assets.json`. Do not infer layout from width or
height in the renderer.

The wide composition also enforces semantic layout invariants: `EMBER` and its
code proof remain on the Ember field, while `MOSS` aligns with the Moss proof
column instead of hugging the torn edge. The material split is the separator, so
the display lockup does not add a slash glyph. The four code samples are large
enough to function as product evidence at README scale and remain legible in a
240px-wide thumbnail. The supporting sentence is split across the two fields so
the torn boundary never crosses live text.

Platform proofs do not reuse the family poster wrapper. The editor proof is a
large Moss Dark/Light code comparison with minimal chrome and exact role rails.
The Obsidian proof contains only Moss and gives one oversized functional Markdown
frame the full canvas; a diagonal mode cut supplies the Dark/Light contrast with
only small `DARK` and `LIGHT` labels. Zed and terminal continue to show both
directions because both actually ship there, but their later template revisions
should follow the same product-first rule.

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
- `extension/images/editor-moss-dark-light.png`: product-first Moss Dark/Light
  editor proof with enlarged syntax and exact semantic role rails.
- `extension/images/theme-forge-workflow.png`: VS Code-only Forge capability.
- `docs/marketing/direction-atlas.png`: material and syntax distinction between
  Ember and Moss.
- `docs/marketing/platform-coverage.png`: accurate availability matrix.
- `docs/marketing/moss-surfaces.png`: generated semantic examples for code,
  notes, and terminal. It is a system diagram, not an app screenshot.
- `docs/marketing/obsidian-hero.png`: full-canvas Moss Dark/Light functional
  Markdown proof with no family-poster wrapper.
- `public/og-hearth.png`: current family-level social card.
- `docs/marketing/exports/github-social.png`: GitHub repository social preview.
- `docs/marketing/exports/family-{square,portrait,story}.png`: responsive social
  compositions; these are recomposed layouts, not crops.
- `docs/marketing/exports/{ember,moss}-square.png`: single-direction campaign
  cards with real Dark and Light syntax.
- `zed/images/hearthcode-zed.png`: generated Zed mirror README proof.
- `terminal/hearthcode-terminal.png`: generated terminal README proof.

The preview generator owns these files. Update product, theme, preview, or
generator sources and run `pnpm run marketing:generate`; do not edit the PNGs by
hand.

## Motion and sound

Motion assets should be derived only after the still system is approved.

- A family film shows Ember/Moss and Dark/Light. It does not explain Forge.
- Forge, Obsidian, and each direction receive separate short demonstrations.
- Use real theme switching and UI interaction instead of zooming static images.
- The video must work muted. Prefer silence or restrained interaction sounds over
  an ambient music bed until HearthCode has a deliberate audio identity.
