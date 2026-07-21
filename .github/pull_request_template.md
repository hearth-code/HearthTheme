## Theme Change Checklist

- [ ] I edited source-of-truth inputs under `color-system/*` and/or generator logic under `scripts/*` (not hand-editing generated artifacts only).
- [ ] I ran `pnpm run sync` and included all generated updates (`themes`, `public/themes`, `extension/themes`, `obsidian/themes`, `obsidian/app-theme`, `zed/extension`, `src/data/tokens.ts`, `src/styles/theme-vars.css`, `docs/theme-baseline.md`, `docs/color-language-report.md`, `reports/color-language-consistency.json`).
- [ ] I ran `pnpm run audit:generated-origin` and confirmed generated outputs are source-linked (`color-system/` or `scripts/` changed together).
- [ ] I ran `pnpm run audit:all`.
- [ ] I ran `pnpm run build`.
- [ ] If this PR updates extension release payload (`extension/themes/*`, `extension/package.json`, `extension/CHANGELOG.md`, `extension/icon.png`), versioning and changelog are release-ready (no placeholder notes).

## Notes

Describe intentional palette/governance changes and any accepted warnings.
