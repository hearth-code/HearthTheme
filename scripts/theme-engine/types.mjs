// Theme engine type contracts.
//
// JSDoc only — zero runtime cost, no TypeScript toolchain (see decision log in
// docs/theme-engine-extraction-plan.md §7). These typedefs describe the generic,
// project-agnostic surface of the compiler: the engine knows about Token / Source
// / Domain / Emitter, never about colour or any specific platform.

/** The closed set of value-resolution kinds. The whole "how a value is produced"
 *  algebra is exactly these four — nothing else is a Source kind. */
export const SOURCE_KINDS = Object.freeze(['literal', 'ref', 'derive', 'solve'])

/**
 * A single themed value, before it is resolved.
 * @typedef {Object} Token
 * @property {string} id            stable identifier, e.g. "status"
 * @property {string} layer         which layer it belongs to, e.g. "interaction"
 * @property {Source} source        how its value is produced
 * @property {object[]} [derive]    optional post-resolution transforms
 */

/**
 * The value algebra. Exactly one of the four shapes below.
 * @typedef {(
 *   | { kind: 'literal', value: unknown }
 *   | { kind: 'ref', token: string }
 *   | { kind: 'derive', from: Source, transform: string, args?: object }
 *   | { kind: 'solve', anchor: unknown, constraints: object[] }
 * )} Source
 */

/**
 * A value domain (colour is one implementation). The engine calls a domain
 * exclusively through this interface and never imports domain math directly —
 * that indirection is what lets the same engine theme spacing, motion, etc.
 * @template V
 * @typedef {Object} Domain
 * @property {(raw: unknown) => V | null} tryParse       nullable raw authored value -> internal value
 * @property {(raw: unknown) => V} parse                 raw authored value -> internal value
 * @property {(value: V) => string} serialize           internal value -> emitted string
 * @property {Record<string, (value: V, args: object, ctx: object) => V>} transforms       mix, alpha, lighten, hue…
 * @property {Record<string, (value: V, constraint: object, ctx: object) => ConstraintResult>} constraints   minContrast…
 * @property {(anchor: V, constraints: object[], ctx: object) => V} solve     constraint solver
 */

/**
 * @typedef {Object} ConstraintResult
 * @property {boolean} ok        whether the value satisfies the constraint
 * @property {number} margin     signed headroom (>= 0 means satisfied)
 */

/**
 * A platform output plugin. One per target (vscode, obsidian, web…).
 * @typedef {Object} Emitter
 * @property {string} name              platform name, e.g. "vscode"
 * @property {string[]} consumes        which layers this platform reads (its contract)
 * @property {(ir: object) => File[]} emit   resolved model -> platform files
 */

/**
 * @typedef {Object} File
 * @property {string} path             output path, relative to the repo root
 * @property {string} content          file contents
 */

/**
 * The generic compiler entry point's options.
 * @template V
 * @typedef {Object} CompileOptions
 * @property {object} source           the declarative theme source (token graph + policy)
 * @property {Domain<V>} domain         the value domain (e.g. colour)
 * @property {Emitter[]} emitters       the target platforms
 * @property {object} variant           variant selector (dark/light/density/brand…)
 */
