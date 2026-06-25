# Handoff — theme-forge (client-side real-time theme customizer)

Audience: a fresh agent (Codex). Task: (1) **review** the work on branch
`theme-forge`, (2) **continue** the gated sub-steps. Everything below is
cold-readable; deeper context lives in the referenced files — do not duplicate.

> Read first: `docs/theme-engine-extraction-plan.md` (esp. **§4 THE GATE**, §9,
> §11) and the project memory bullet "Interactive theme playground / forge" +
> "Theme-forge Step 1 DONE" in the maintainer's notes. The engine is already a
> generic `compile({source,domain,emitters,variant})` in `scripts/theme-engine/`
> with **zero fs coupling**, reproducing shipped artifacts byte-for-byte.

## Why this work exists (the vision)

On the website, a user picks a **primary color + a few params** and gets a
**high-quality, real-time WYSIWYG** custom theme (drag = instant + continuous +
exact), exportable as their own config. Monetization: a **"Buy me a coffee"**
entry at the *export* step — free tool, **no paywall**, tip at the value moment;
it also funnels to the curated Moss/Ember marketplace themes.

The hard requirement (real-time + continuous + exact) means the **whole engine,
including the VSCode calibration, must run in the browser**. A precomputed grid
(instant-but-discrete) and an SSR endpoint (continuous-but-laggy) were both
rejected because neither gives all three. The blocker is that the calibration is
disk-coupled; the plan is to make it in-memory in small **byte-identical** steps.

## Branch & commits to review

Branch `theme-forge` (off `main` `9d64236`), **not merged**. Three commits:

1. `43ad04e` — brand-art generator. **TANGENT** to the engine work:
   `scripts/generate-brand-art.mjs` + npm `generate:brand` + `docs/marketing/moss-{split,hero,spec}.{svg,png}`.
   Separable — consider splitting to its own PR. Not on the customizer critical path.
2. `85037bd` — **model overrides seam**. `buildColorLanguageModel({ domain, overrides })`
   in `scripts/color-system/build.mjs`: each colour-source input (`foundation`,
   `variantKnobs`, `variantProfiles`, the six raw rule sets, `semanticRules`)
   falls back to its loader when not overridden → default build byte-identical.
   Pinned by `tests/theme-engine.overrides.test.mjs`.
3. `1c7c8d5` — **in-memory calibration refs (read-side)**.
   `syncVscodeChromeReferenceFiles` (`scripts/color-system/vscode-chrome.mjs`)
   now returns the patched reference docs in-memory; `buildVscodeThemes`
   (`scripts/generate-theme-variants.mjs`) consumes them via a `readRef` helper
   (`structuredClone` to keep readJson's fresh-object semantics) instead of
   reading the files back. Files are still written for committed refs/audits.
   Removes the calibration's disk **readback**.

Each landed green under THE GATE (sync byte-identical for **moss AND ember**,
`pnpm test` 125/125, `audit:all` exit 0, lockfile clean).

## THE GATE — run before every "done" (from extraction-plan §4)

```bash
node scripts/sync-themes.mjs   # MUST NOT change: themes/** public/themes/**
                               # extension/themes/** src/data/tokens.ts
                               # color-system/semantic.json obsidian/** src/styles/theme-vars.css
pnpm run test                  # all green; count only goes UP
pnpm run audit:all             # exit 0
git diff --quiet pnpm-lock.yaml || git checkout pnpm-lock.yaml   # known hazard
```
One commit per task, imperative subject. **No attribution trailers** (no
`Co-Authored-By`, no "Generated with"). Work on the branch, not `main`.

## Remaining sub-steps (continue here, each gated byte-identical)

2. **Drop the base-doc `readFileSync` inside `syncVscodeChromeReferenceFiles`.**
   It still does `JSON.parse(readFileSync(target.path,'utf8'))` to get the seed
   doc it patches. Inject/inline those seed docs so it reads no repo files.
3. **Add a no-write / preview mode** — skip `writeJsonIfChanged` when previewing
   (so a per-keystroke call never touches the repo).
4. **Make the model injectable.** `COLOR_LANGUAGE_MODEL` is a module-load const
   (`scripts/generate-theme-variants.mjs:40` = `buildColorLanguageModel()`).
   Thread an injected model/overrides through so a `foundation` override (the
   Step-1 seam) actually reaches calibration in-process.
5. **Bundle engine+source for the browser + Web Worker; add a `browser == build`
   parity test.** Then the UI island (reuse the prototyped hue/saturation
   customizer), export (download `theme.json`/`theme.css` + shareable URL), and
   the buy-me-a-coffee entry at export.

## Key facts / gotchas

- **"Primary color" maps to the `spark` foundation family** (keyword/tag lane) in
  `color-system/schemes/moss/foundation.json`. Other lanes are independent:
  `jade`=function/method/property/type, `voltage`=number, `amber`=string,
  `citron`=punctuation/operator. Main control = spark hue; per-lane knobs later.
- `validateModel` (build.mjs) is **structural only** (IDs/coverage/refs), not
  aesthetic — an override that keeps the families/tones shape passes it; the
  hue/ΔE/contrast contracts live in the `audit:*` layer.
- **Option A proven as a fallback**: running the audited pipeline with `cwd`=an
  isolated repo copy (code + `node_modules` resolve from the real repo; cwd-relative
  data reads + theme writes land in the copy) reproduces shipped `moss-dark`/`light`
  **byte-for-byte** with no override, and a +130° spark-hue override regenerates a
  valid theme through full calibration. Paths are cwd-relative; there's also a
  `COLOR_SYSTEM_SCHEME_DIR` env hook. Use this for a build-time grid if the
  client-side port stalls.
- Calibration `apply*` fns (`applySemanticPalette`, `applyRoleChromaCeiling`,
  `applyRoleLaneProfile`, `applyInteractionStateBudget`, `buildVariantTheme`) are
  module-internal but already operate **in-memory**; the only remaining fs is
  sync's seed read (sub-step 2) + writes (sub-step 3) + the module-load model
  (sub-step 4).
- ember is generated by `sync-themes.mjs` as an env-var subprocess
  (`COLOR_SYSTEM_SCHEME_ID=ember`) — byte-identical must hold for it too.
- pnpm hazard: local pnpm 11 vs CI 10 rewrites the lockfile; revert after runs.

## Suggested skills for the next session

None required — follow `docs/theme-engine-extraction-plan.md`. `/code-review` is
a reasonable optional pass over the three commits before continuing.
