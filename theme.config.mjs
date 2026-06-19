import { loadColorSystemVariants } from './scripts/color-system.mjs'
import { colorDomain } from './scripts/theme-engine/domain-color/index.mjs'
import { obsidianEmitter } from './scripts/theme-engine/emit/obsidian.mjs'
import { vscodeEmitter } from './scripts/theme-engine/emit/vscode.mjs'
import { webEmitter } from './scripts/theme-engine/emit/web.mjs'

const variantSpec = loadColorSystemVariants()

export const themeConfig = Object.freeze({
  domain: colorDomain,
  emitters: Object.freeze([webEmitter, vscodeEmitter, obsidianEmitter]),
  variants: Object.freeze([...variantSpec.variants]),
})

export default themeConfig
