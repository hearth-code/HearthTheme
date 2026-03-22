## Theme Change Checklist

- [ ] I only hand-edited the core theme source: `themes/hearth-dark.json` (or documented why not).
- [ ] I ran `pnpm run sync` and included all generated updates (`public/themes`, `extension/themes`, `src/data/tokens.ts`, `src/styles/theme-vars.css`, `docs/theme-baseline.md`, `extension/package.json`).
- [ ] I ran `pnpm run audit:all`.
- [ ] I ran `pnpm run build`.
- [ ] I did not manually tweak generated files without updating the generator/script in the same PR.

## Notes

Describe intentional palette/governance changes and any accepted warnings.
