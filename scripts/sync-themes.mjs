import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { COLOR_SYSTEM_SCHEME_ID, getThemeMetaListForSchemeId, getThemeOutputFiles, loadColorProductManifest } from './color-system.mjs'
import { generateThemeVariants } from './generate-theme-variants-node.mjs'
import { generateColorLanguageLineage } from './generate-color-language-lineage.mjs'
import { generateColorLanguageParity } from './generate-color-language-parity.mjs'
import { generateSiteAssets } from './generate-site-assets.mjs'
import { obsidianEmitter } from './theme-engine/emit/obsidian.mjs'
import { generateObsidianAppTheme } from './generate-obsidian-app-theme.mjs'
import { generateColorLanguageReport } from './generate-color-language-report.mjs'
import { generateColorLanguageContractChecklist } from './generate-color-language-contract-checklist.mjs'
import { generateColorLanguageContractReview } from './generate-color-language-contract-review.mjs'
import { generateNoItalicsOverride } from './generate-no-italics-override.mjs'
import { compile } from './theme-engine/compile.mjs'
import { webEmitter } from './theme-engine/emit/web.mjs'
import { vscodeEmitter } from './theme-engine/emit/vscode.mjs'

function writeIfChanged(path, content) {
  if (existsSync(path)) {
    const prev = readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
    const next = content.replace(/\r\n/g, '\n')
    if (prev === next) return false
  }
  writeFileSync(path, content)
  return true
}

// 0. 从新的 top-down color language sources 生成 semantic snapshot 与主题 JSON 产物
//    (active scheme: shared side effects only; the engine owns the theme writes below)
const activeThemes = generateThemeVariants({ writeThemes: false }).themes
const product = loadColorProductManifest()
const brandFlavorIds = product.brandFlavorIds.length > 0 ? product.brandFlavorIds : product.supportedSchemeIds
for (const schemeId of brandFlavorIds) {
  if (schemeId === COLOR_SYSTEM_SCHEME_ID) continue
  generateThemeVariants({
    schemeId,
    writeReferenceFiles: false,
    writeSemanticSnapshot: false,
  })
}

// Let the engine own active-scheme theme JSON writes via compile (plan §11 step 4).
for (const file of compile({ themes: activeThemes, emitters: [vscodeEmitter] })) {
  mkdirSync(dirname(file.path), { recursive: true })
  const changed = writeIfChanged(file.path, file.content)
  console.log(`${changed ? '✓ generated' : '- unchanged'} ${file.path}`)
}

// 1. 同步 JSON 到 public 和 extension
const targets = ['public/themes', 'extension/themes']
const publishedThemePaths = product.supportedSchemeIds.flatMap((schemeId) =>
  getThemeMetaListForSchemeId(schemeId).map((theme) => theme.path)
)
const activeThemePaths = Object.values(getThemeOutputFiles())
const syncThemePaths = Array.from(new Set([...activeThemePaths, ...publishedThemePaths]))
const syncThemeFiles = syncThemePaths.map((path) => path.split(/[\\/]/).pop()).filter(Boolean)
const syncThemeFileSet = new Set(syncThemeFiles)

for (const target of targets) {
  mkdirSync(target, { recursive: true })
  for (const file of readdirSync(target)) {
    if (!file.endsWith('.json')) continue
    if (syncThemeFileSet.has(file)) continue
    rmSync(join(target, file), { force: true })
    console.log(`✓ removed stale ${target}/${file}`)
  }
  for (const srcPath of syncThemePaths) {
    const file = srcPath.split(/[\\/]/).pop()
    copyFileSync(srcPath, join(target, file))
    console.log(`✓ ${srcPath} → ${target}/${file}`)
  }
}

// 2. 由 theme compiler 输出 web token file descriptor，生成 src/data/tokens.ts
const [tokensFile] = compile({ themes: activeThemes, emitters: [webEmitter] })
if (!tokensFile) throw new Error('compile({ emitters: [webEmitter] }) did not produce src/data/tokens.ts')
mkdirSync('src/data', { recursive: true })
const tokensChanged = writeIfChanged(tokensFile.path, tokensFile.content)
console.log(`${tokensChanged ? '✓ generated' : '- unchanged'} ${tokensFile.path}`)

// 3. 生成 lineage 报告，保证任意下游 token 可反查
generateColorLanguageLineage()

// 4. 生成 parity 报告，确保同一颜色语言在各终端保持表现一致
generateColorLanguageParity()

// 5. 生成站点与文档派生产物（CSS vars / docs baseline / extension metadata）
generateSiteAssets()

// 6. 生成 Obsidian 主题产物（经 theme compiler，与 web token 同一引擎路径）
for (const file of compile({ themes: activeThemes, emitters: [obsidianEmitter] })) {
  mkdirSync(dirname(file.path), { recursive: true })
  const changed = writeIfChanged(file.path, file.content)
  console.log(`${changed ? '✓ generated' : '- unchanged'} ${file.path}`)
}

// 7. 生成 Obsidian 社区主题标准产物（manifest/theme.css/versions/screenshot）
await generateObsidianAppTheme()

// 8. 生成色彩语言一致性报告（供文档与 CI 使用）
generateColorLanguageReport()

// 9. 生成长期契约清单（定义 future-proof / compatibility / generated lifecycle）
generateColorLanguageContractChecklist()

// 10. 生成长期契约评审清单（说明哪些层已稳定、哪些仍是迁移层）
generateColorLanguageContractReview()

// 11. 生成 no-italics 用户覆盖文档（镜像已发布主题的全部斜体规则）
generateNoItalicsOverride()
