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
  valid theme through full calibration. Paths are cwd-relative; scheme-targeted
  Node runs now pass an explicit scheme id instead of env overrides. Use this for
  a build-time grid if the client-side port stalls.
- Calibration `apply*` fns (`applySemanticPalette`, `applyRoleChromaCeiling`,
  `applyRoleLaneProfile`, `applyInteractionStateBudget`, `buildVariantTheme`) are
  module-internal but already operate **in-memory**; the only remaining fs is
  sync's seed read (sub-step 2) + writes (sub-step 3) + the module-load model
  (sub-step 4).
- ember is generated by `sync-themes.mjs` in-process with an explicit scheme id —
  byte-identical must hold for it too.
- pnpm hazard: local pnpm 11 vs CI 10 rewrites the lockfile; revert after runs.

## Suggested skills for the next session

None required — follow `docs/theme-engine-extraction-plan.md`. `/code-review` is
a reasonable optional pass over the three commits before continuing.

---

## Review (2026-06-25) — Codex follow-up commits bcf6346 / 7df1202 / d4baed1 / e737515

Verdict: **accepted as clean gated increments.** THE GATE re-run green (sync no
drift, `pnpm test` 129/129 — includes the Rollup-bundling parity test actually
running, `audit:all` exit 0, lockfile clean). Hygiene clean (coherent commits, no
attribution trailers, no temp files, no generated-artifact changes). `rollup` is a
real direct dep (`@rollup/wasm-node`). `artifacts-core.mjs` / `vscode-core.mjs` are
import-free / fs-free; `artifacts.mjs` is a thin fs wrapper that preserves the old
`buildGeneratedPlatformTokenMaps` behavior (default `readTheme=readJson` over
`THEME_FILES`, canonical `getExportedSiteTokenKeys()`). The browser-bundle test is
genuine: bundles with Rollup, asserts no `fs`/`readFileSync` in the bundle, and
`deepEqual`s browser maps/files against the Node build/compile output.

**KEY SCOPE CAVEAT (do not mis-read):** e737515 only bundles the **emit / token-map
layer** for the browser. The **model build (`buildColorLanguageModel` → loaders/fs)
and the calibration (`buildVscodeThemes`) are NOT in the bundle.** `buildBrowserThemeMaps`
/`buildBrowserThemeFiles` REQUIRE a Node-produced `model` + `themes` as inputs. So
this completes sub-step 5 **literally** (bundle + Worker + parity test) but does NOT
yet deliver real-time in-browser recalibration — a primary-color change still needs
Node to produce `model` + `themes`. Sub-steps 2–4 (seed injection / preview mode /
model injection) were prep for closing this; the final wiring is sub-step 6 below.

Minor nits (low severity, not blockers):
- `buildBrowserThemeMaps` only forwards `exportedSiteTokenKeys` when truthy; the core
  then falls back to `inferExportedSiteTokenKeys(model)` (order from `model.platformTokenMaps.web`
  key order), which can diverge from the canonical export order. → Worker entry should
  **require** callers pass `getExportedSiteTokenKeys()`; don't rely on inference.
- `themeFilesFromThemes` default emits bare `${variantId}.json` paths (fine as download
  filenames; don't depend on it where exact repo paths matter).

Recommendation: merge these as gated increments; split brand-art `43ad04e` to its own PR.

## Sub-step 6 (NEXT) — put the model build + calibration in the browser (the real unlock)

This is what actually delivers drag-real-time WYSIWYG. Each piece gated byte-identical.

1. **Make `buildColorLanguageModel` fully bundle-safe / injectable.** The `overrides`
   seam (85037bd) only covers the colour-source subset; `scheme`, `taxonomy`,
   `adapters`, `variants`, and `framework/*` still load from fs. Extend overrides to
   ALL inputs (or add a bundled-source module) so the model can be built in-browser
   from injected data with zero loaders.
2. **Make `scripts/generate-theme-variants.mjs` bundle-safe.** Today it eagerly runs
   `const COLOR_LANGUAGE_MODEL = buildColorLanguageModel()` at module load (line ~40)
   and imports `fs` at the top — so importing it for a browser bundle pulls loaders+fs.
   Make the module-level model lazy/injected and ensure `buildVscodeThemes`
   ({ model, preview/no-write, injected seeds }) runs genuinely fs-free in preview mode.
3. **Bundle model + calibration into the Worker** (alongside the existing emit layer),
   add a `browser == build` parity test for the FULL path (override foundation in-browser
   → calibrated themes deep-equal the Node pipeline for the same override), and require
   `exportedSiteTokenKeys` at the Worker entry.

After 6: the UI island (reuse the prototyped hue/saturation customizer) calls the Worker
on drag → instant + continuous + exact; export = `theme.json`/`theme.css` + shareable URL;
"Buy me a coffee" at the export step (free, no paywall).
