# Theme Iteration Playbook

This guide captures the repeatable path for turning visual feedback into a stable HearthCode theme change.

It is written from the Moss blue-yellow-green clarity pass, but the same path should apply to Ember and future schemes.

## 1. What Went Right In The Moss Pass

The winning move was not "make colors brighter".

The useful move was separating three ideas that had been blended together:

- material texture: charcoal, paper, oxidized metal, worn labels
- signal clarity: readable role lanes with enough distance to scan code quickly
- product identity: Moss as blue-yellow-green, not just a warmer or dirtier Ember

Moss v1 had the right material world, but its signals were buried.
The successful pass kept the substrate and material texture stable, then sharpened only the semantic hero lanes:

- `keyword` moved toward old-warning yellow
- `function` moved toward terminal lichen green
- `type` and `number` moved toward oxidized CRT blue
- `string` moved away from both keyword yellow and method green into lacquered paper
- `operator` in light mode was softened back into rhythm instead of competing with content

The important principle is:

> A theme can feel old and tactile without feeling muddy. Age belongs mostly to surface and material; syntax still needs signal discipline.

## 2. Repeatable Design Path

Use this sequence for any future flavor adjustment.

1. Name the desired signal in non-color language.

   Example: "Fallout-like clarity, but still textured" is better than "make it brighter".

2. Split the request into three layers.

   - substrate: background, shell, carrier, chrome
   - semantic roles: keyword, function, method, type, number, string, variable, operator
   - product identity: what makes this flavor different from the others

3. Decide what must stay stable.

   For Moss, charcoal substrate and parchment carrier stayed stable.
   Only semantic hero colors moved.

4. Move the smallest source layer that expresses the intent.

   Prefer:

   - `color-system/schemes/<scheme>/foundation.json` for hue families and tone anchors
   - `color-system/schemes/<scheme>/semantic-rules.json` for role-to-family mapping
   - `color-system/schemes/<scheme>/philosophy.md` and `scheme.json` for intent language

   Avoid hand-editing generated themes.

5. Sync and read the warnings as design feedback, not just failures.

   `theme-audit` warnings often point to real perception problems:

   - low role deltaE usually means two code roles will blur
   - excessive dominant hue share usually means the theme is becoming one-note
   - contrast outliers often indicate a role is fighting the page rhythm

6. Generate preview assets and install a local package before final judgment.

   Static screenshots catch identity.
   VS Code usage catches fatigue and role confusion.

## 3. Engineering Path

For a normal theme color pass:

```powershell
pnpm run sync
pnpm run audit:theme
pnpm run preview:generate
pnpm run verify
pnpm run pack:moss:local
```

For Ember or a future scheme, replace the local pack command with the matching package script or add one.

To print the review path for a scheme:

```powershell
pnpm run review:theme -- moss
```

This command does not validate or modify files.
It gives the reviewer the source files, generated artifacts, commands, and manual questions for the next pass.

Useful review files:

- `public/previews/preview-contrast-v2.png`
- `obsidian/app-theme/screenshot.png`
- `themes/<scheme>-dark.json`
- `themes/<scheme>-light.json`
- `docs/color-language-report.md`
- `reports/color-language-consistency.json`
- `reports/color-language-lineage.json`
- `reports/color-language-parity.json`

## 4. Manual Visual Review

Review in this order:

1. Static preview image

   Ask whether the flavor identity is visible in under five seconds.

2. Dark editor

   Ask whether the hero roles are readable without looking up the rules.

3. Light editor

   Ask whether the role structure survives without becoming office-paper flat.

4. Real files

   Check at least:

   - TypeScript or TSX
   - JSON
   - Markdown
   - CSS

5. Twenty-minute fatigue pass

   Ask whether any color is beautiful but too loud for daily work.

## 5. What To Preserve

These are product-level assets, not incidental colors:

- Ember should keep hearth warmth, controlled orange pressure, and paper-lit calm.
- Moss should keep charcoal, parchment, oxidized material, and blue-yellow-green identity.
- Variant families should feel like the same flavor under different pressure, not four separate themes.
- Generated outputs should always be explainable by lineage.
- Preview assets should be treated as release-facing evidence, not decorative byproducts.

## 6. Current Moss Gaps

After the clarity pass, Moss is much closer to the target, but these are still worth watching:

- `moss-light` still has a slightly high warm hue-band share.
- The Fallout-like clarity direction can be pushed too far into generic retro-terminal green if future edits overcorrect.
- Blue currently works as structure; it should not become a full neon second foreground.
- String color is a compromise lane and should be tested in JSON-heavy files.
- Obsidian screenshots are useful but still less precise than a real editor usage pass.

## 7. Common Path For Future Flavors

Every flavor should own a short identity contract:

- one sentence of atmosphere
- three primary signal lanes
- one explicit anti-goal
- one material rule
- one daily-use readability rule

Example for Moss:

- atmosphere: textured waste-terminal material with clear instrument signals
- signal lanes: old-warning yellow, terminal lichen green, oxidized CRT blue
- anti-goal: muddy sepia or generic neon terminal
- material rule: keep charcoal, parchment, oxidized metal
- readability rule: aged surfaces are allowed; syntax lanes must stay crisp

Example for Ember:

- atmosphere: hearthlight over paper and warm tooling
- signal lanes: ember orange, controlled blue, lived-in green
- anti-goal: red-hot alarm theme or brown wash
- material rule: warmth should feel lit, not dirty
- readability rule: orange can lead, but cannot consume every role

This identity contract should be reflected in:

- `scheme.json`
- `philosophy.md`
- `foundation.json`
- `semantic-rules.json`
- generated docs and previews

## 8. Commit Discipline

Use small commits as visual checkpoints.

Good pattern:

1. commit the current accepted look
2. make one focused visual pass
3. run `pnpm run verify`
4. generate/install a local package
5. manually review
6. commit only after the visual direction is accepted

This keeps the design process reversible and lets subjective taste move without losing engineering control.
