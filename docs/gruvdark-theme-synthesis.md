# GruvDark Theme Synthesis

Updated: 2026-04-05

## Goal

This note captures what is worth borrowing from the `gruvdark-theme` family without turning the second product into a copy.

Reference set:

- `gruvdark`
- `gruvdark-gbm`
- `gruvdark-mono`
- `gruvdark-tokyo`
- their matching light variants

The purpose is to extract directional strengths and translate them into something that still fits the HearthCode system discipline.

## What The GruvDark Family Does Well

### 1) The default theme gets the base balance right

`gruvdark` feels refined because the substrate is not over-tinted.

- the background is charcoal first, warm second
- the foreground is bone/parchment, but not yellow
- syntax colors sit on top of the page instead of dissolving into it

This is a big reason it feels more expensive than many retro themes.
It does not start by washing the whole editor in brown.

### 2) GBM has the best earthy pigment richness

`gruvdark-gbm` is the most useful reference for material warmth.

- green, gold, rose, and rust feel hand-mixed rather than digital
- the palette has obvious vintage attitude
- it proves that earthy themes can still feel lively

The risk is density.
If too much of this version is borrowed at once, the page starts to feel packed instead of composed.

### 3) Mono shows the value of restraint

`gruvdark-mono` proves that not every lane needs strong color.

- hierarchy can come from value and placement
- one or two vivid lanes are enough when the substrate is stable
- reducing simultaneous chroma makes the theme feel more intentional

This is especially relevant for us because the current `Signal` draft can still look too internally united.

### 4) Tokyo contributes cleaner night relief

`gruvdark-tokyo` is the useful reminder that a retro theme still benefits from one cooler, cleaner lane.

- night clarity improves when a blue family stays crisp
- the whole page feels more breathable
- the theme gains separation without becoming cold overall

This is the main reason a gray-blue or oxidized cool anchor should stay in the second product.

### 5) The light variants avoid office-white emptiness

The light variants do not chase modern white UI brightness.

- the page still feels like paper
- ink remains dark and decisive
- warmth is visible without turning into beige fog

This is the right lesson for our light climates.

## What We Should Not Borrow Directly

- We should not inherit the exact palette or token mapping.
- We should not paint the entire UI with the syntax accent color.
- We should not let brown become a global wash across every surface.
- We should not make every semantic role equally colorful.
- We should not chase novelty through pinks or blues that break the material world.

## Derived Direction For Our Second Product

The second product should become:

- charcoal-led, not chocolate-led
- parchment-carried, not yellow-inked
- retro, but with cleaner syntax spacing
- warm in materials, not warm in every role

### Substrate

Use a charcoal substrate with a brown bias.

- darker than Hearth
- less brown than the current `Signal` draft
- more like smoked wood and carbon paper than roasted sepia

### Foreground And Neutrals

Use parchment and bone neutrals, but dry them out.

- foreground should feel dusty and readable
- operators and variables should sit one step below body text
- comments should lean warm gray or olive-gray, not green or chocolate

### Syntax Lane Split

This is the most important lesson.

The better GruvDark variants feel richer because they split syntax into clearly different lanes:

- `keyword / control`: muted blue or dusty indigo
- `function / callable`: coral or terracotta
- `type / support`: oxidized teal
- `string`: moss or dry olive-green
- `number / method`: old gold / ochre
- `operator / variable / parameter`: quiet parchment neutrals

This gives the page more separation than the current `Signal` draft, where too many roles still live in one earthy family.

### UI Strategy

UI chrome should stay quieter than syntax.

- do not let buttons and badges reuse the hero syntax color by default
- keep UI emphasis in neutral ink, blue-gray, or subdued accent fills
- let syntax carry the personality

### Climate Direction

- `dark`: charcoal hero, clearest split-lane syntax, strongest product identity
- `light`: old paper with dark ink and visible syntax spacing

## Proposed Synthesis

The best direction for us is not:

- pure Gruvbox
- pure GBM
- pure mono
- pure Tokyo

It is a synthesis:

- base balance from `gruvdark`
- earthy pigment confidence from `gruvdark-gbm`
- restraint from `gruvdark-mono`
- cool relief from `gruvdark-tokyo`
- paper logic from the light variants

## Working Design Rule

If Hearth is a warm, quiet reading theme, the second product should be:

- more editorial
- more split-lane
- more obviously vintage
- more structurally articulated

But it should still feel designed by the same people.

That means:

- the semantic contract stays intentional
- the system stays disciplined
- only the energy model and material language change
