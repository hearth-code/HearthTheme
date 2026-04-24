# Theme Visual Quality Methodology

This project treats a theme as a system, not a pile of color values. Every change should preserve three layers at once: semantic signal, material chrome, and cross-variant continuity.

## 1. Semantic Signal

Semantic signal is the first gate. Syntax colors must stay in their intended lanes so the theme remains readable and recognizable:

- moss keeps blue, yellow, and green as the primary signal family.
- ember keeps orange, blue, and green as the primary signal family.
- warm secondary colors can add age and texture, but they cannot blur keyword, string, function, type, and number roles together.
- Low-weight structural roles, especially punctuation and brackets, can carry a restrained secondary hue in light themes. This adds scan rhythm like strong light themes do, but it must remain subordinate to the primary semantic lanes.

Use `pnpm run audit:color-contract` and `pnpm run review:moss:ci` to catch lane drift, low contrast, and low role separation before judging screenshots by eye.

## 2. Material Chrome

Chrome is the editor shell: sidebar, tabs, panels, list states, buttons, badges, status bar, focus, hover, and selection. It carries the retro material feeling. The shell should feel aged and tactile, but it still needs clear hierarchy.

The reusable checks are:

- Surface depth: chrome surfaces need enough separation from the editor background.
- Surface presence: depth is measured against different floors for light and dark variants because light surfaces need stronger separation to read with the same material weight.
- Tab separation: active and inactive tabs need visible structure without becoming loud.
- Interaction presence: hover, selection, and focus states need to be visible in light and dark modes.
- Accent cohesion: status, button, badge, and active indicators should stay in the same accent family.
- Light surface clarity: light variants need a low-saturation panel substrate, strong ink contrast, and a visible current-line band. Age belongs in material texture; it should not become a dusty wash over every signal role.

## 3. Cross-Variant Continuity

Dark, dark-soft, light, and light-soft are not separate products. They should feel like the same object under different lighting.

For each pair, compare:

- Signal presence: light mode should keep enough saturation and contrast from the dark source.
- Hue drift: roles can adapt to polarity, but they should not change identity.
- Material presence ratio: light chrome may use larger raw deltaE, but its normalized presence should stay close to the dark variant.
- Interaction presence: light mode cannot lose hover, selection, or focus affordance.

## 4. Change Path

Use this order for theme work:

1. Update the source tokens or adapter logic.
2. Run `pnpm run sync`.
3. Run `pnpm run optimize:colors` to get algorithmic candidate moves from the generated theme outputs.
4. Run `pnpm run review:moss:ci` for semantic, chrome, and snapshot guardrails.
5. Inspect `reports/moss-visual-review/report.md` and `reports/color-optimization/moss.md`.
6. Run `pnpm run verify` before committing.

Manual review should answer one question: does the result still feel like a clear retro terminal product, not only a pleasant palette? Automated review should answer whether the system contracts still hold.

## 5. Algorithmic Color Optimization

`pnpm run optimize:colors` is a read-only optimizer. It searches candidate colors around the generated role colors and scores them with a weighted objective:

- Lane hue: the color should stay inside the scheme's declared signal lane.
- Lane saturation: the color should clear the lane's minimum saturation without becoming generic neon.
- Contrast: the color should stay readable against the generated editor background.
- Role separation: important roles should keep enough deltaE distance from each other.
- Structural separation: operators and punctuation should not collapse into one gray-brown mass, because light themes need small colored edges to avoid flatness.
- Material retention: the candidate should not drift too far from the current material color.

The optimizer reports candidate moves, but source edits should still happen at the source-token or generator-rule level. Generated outputs are evidence, not the place to hand-edit.

The optimizer also reports rhythm diagnostics. This is the bridge between "all checks pass" and "the theme still feels flat":

- High-exposure roles are weighted by expected language frequency and visual saliency.
- Weighted role colors are grouped into 45-degree hue bands, with neutral roles separated from chromatic roles.
- Dominant hue-band pressure, adjacent hue-band pressure, and active-band count are reported per variant.

Treat rhythm warnings as source-level design pressure. If Moss feels monotonous, the next move should be to adjust source lanes, semantic role mapping, or generator weighting so high-exposure roles distribute more evenly, then regenerate the downstream themes.
