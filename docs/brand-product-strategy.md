# Brand And Product Strategy

Updated: 2026-04-06

## 1. Goal

Keep `HearthCode` as one recognizable brand while allowing multiple theme lines to grow without blurring into one another.

The brand should feel unified.
The products should stay legible.

That means:

- one shared design discipline
- one shared website and repository
- separate theme personalities
- the option to ship together now and split later without redoing the system

## 2. Core Principle

Treat `HearthCode` as the brand, not as the only theme name.

Under that brand, each theme line should be a product with its own:

- mood
- screenshots
- release notes
- public voice
- future extension packaging if needed

This keeps the system coherent without forcing every flavor to behave like one product.

## 3. Recommended Model

Use four layers:

1. `Brand`
   `HearthCode`

2. `Product Line`
   `Ember`
   `Moss`

3. `Theme`
   `HearthCode Moss Dark`
   `HearthCode Moss Light`
   `HearthCode Ember Dark`
   `HearthCode Ember Light`

4. `Channel`
   website
   VS Code
   Open VSX
   Obsidian

This is the cleanest way to make the brand unified while keeping the products distinct.

## 4. Brand What, Product What

What should stay shared across the whole brand:

- the name `HearthCode`
- logo and basic visual identity
- the website and domain
- the design method
- the generation pipeline
- the governance and audit system
- the promise of low-glare, authored, role-aware themes

What should stay separate at the product-line level:

- theme names
- screenshots and preview emphasis
- theme philosophy
- release framing
- product-specific README emphasis
- future extension packaging if the lines diverge enough

The right rule is:

- unify the method
- separate the personalities

## 5. Current Recommended Shipping Strategy

For now, ship both `Ember` and `Moss` in one extension package.

This is still the most practical choice today because:

- it avoids breaking existing users
- it keeps one marketplace page and one install path
- it keeps ratings, installs, and search authority together
- it keeps engineering overhead lower while `Moss` is still maturing

But the internal system should already behave as if a split could happen later.

In other words:

- shared package at the release layer
- separate products at the design and architecture layer

## 6. Website Strategy

The website should present `HearthCode` as one brand with multiple authored directions.

It should not overload users with internal system terms.

Recommended public story:

- `HearthCode` is the brand
- `Ember` and `Moss` are two color directions
- the homepage only highlights a few recommended entry points
- users can still reach the full theme family through the picker

The homepage should stay focused on:

- choose a style
- choose a variant
- preview it
- install it

Everything else is supporting material, not the main path.

## 7. Packaging Strategy

### Phase A: Shared Package

Keep:

- one extension package
- eight themes in the package
- one website
- one repository

Use this while:

- `Moss` is still being tuned
- the visual language is still evolving
- the product narrative is still stabilizing

### Phase B: Brand Family Split

Split into two extensions only if `Moss` becomes independent enough that the shared package starts hurting clarity.

That would mean:

- `HearthCode Theme`
- `HearthCode Moss`

Both would still live under the same brand and shared site.

The split should be a product decision, not a code-structure emergency.

## 8. When To Split Into A Separate Extension

Do not split just because the themes look different.

Split only if several of these become true at the same time:

- `Moss` needs a clearly different marketplace story
- `Moss` needs different screenshots and install framing
- `Moss` wants a different release cadence
- users are confused by seeing both lines in one picker
- the shared package starts to feel like two products glued together

If those are not true yet, keep one package.

## 9. Architecture Rule

The repository should always remain future-split friendly.

That means:

- each product line keeps its own scheme definition
- each product line can grow its own preview and release assets
- product metadata should be able to describe one shared package now
- the same metadata model should be able to emit two packages later

So the architecture target is not:

- one package forever

It is:

- one brand, flexible release topology

## 10. Naming Guidance

Use these naming rules:

- brand: `HearthCode`
- product line names: short public working names
- public theme names: `HearthCode Ember Dark`, `HearthCode Moss Light`, etc.

Current public line names are `Ember` and `Moss`, but they should be treated as working names, not permanent final names.

Choose line names by color temperament and material feel, not by workflow or task type.

Avoid:

- workflow-coded names
- feature-coded names
- line names that duplicate the role of `Dark`, `Light`, or `Soft`

## 11. Immediate Decision

The best current decision is:

- keep one extension package
- keep one website
- keep `Ember` and `Moss` as two explicit lines under the `HearthCode` brand
- keep the homepage simple and brand-first
- keep the repo and product metadata ready for a future package split

This gets the benefits of a unified brand without forcing the products to collapse into one personality.

## 12. Practical Next Steps

1. Keep the website minimal and focused on style selection and installation.
2. Continue tuning `Ember` and `Moss` as separate product lines.
3. Keep public theme names stable.
4. Make sure release notes can talk about `Ember` and `Moss` separately even when shipped together.
5. Reevaluate packaging only after `Moss` is visually mature and stable.

## 13. Decision Summary

`HearthCode` should be one brand.

`Ember` and `Moss` should be treated as separate product lines inside that brand.

Today they can still ship together.
Tomorrow they should be able to ship separately without changing the system model.

## 14. Current Implementation Status

This split-ready model is already scaffolded in the repository.

Current state:

- `products/hearthcode/*` remains the active shared package
- `products/hearthcode-moss/*` now exists as a dormant future standalone Moss product skeleton
- the website and current release flow still point to the shared package
- no public split has happened yet

This means the system is now prepared for a future `Moss` extension without forcing that decision today.
