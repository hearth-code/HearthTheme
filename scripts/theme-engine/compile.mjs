// The generic theme compiler entry point.
//
//   compile({ source, domain, emitters, variant }) -> File[]
//
// load -> resolve (core + domain) -> verify -> emit (emitters)
//
// Not yet wired. The stages are being extracted one at a time; see
// docs/theme-engine-extraction-plan.md (Phase 6 / T6.1 assembles this). Until
// then the real pipeline remains scripts/sync-themes.mjs.

/**
 * @template V
 * @param {import('./types.mjs').CompileOptions<V>} _options
 * @returns {import('./types.mjs').File[]}
 */
export function compile(_options) {
  throw new Error(
    'compile: not wired (see docs/theme-engine-extraction-plan.md, Phase 6 / T6.1)',
  )
}
