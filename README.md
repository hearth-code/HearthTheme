# Astro Starter Kit: Basics

```sh
pnpm create astro@latest -- --template basics
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
│   └── favicon.svg
├── src
│   ├── assets
│   │   └── astro.svg
│   ├── components
│   │   └── Welcome.astro
│   ├── layouts
│   │   └── Layout.astro
│   └── pages
│       └── index.astro
└── package.json
```

To learn more about the folder structure of an Astro project, refer to [our guide on project structure](https://docs.astro.build/en/basics/project-structure/).

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `pnpm install`             | Installs dependencies                            |
| `pnpm dev`             | Starts local dev server at `localhost:4321`      |
| `pnpm build`           | Build your production site to `./dist/`          |
| `pnpm preview`         | Preview your build locally, before deploying     |
| `npm run audit:theme`  | Run theme quality audit (contrast, coverage, drift) |
| `npm run changelog:draft` | Generate a theme changelog draft from theme diffs |
| `npm run changelog:append -- vX.Y.Z` | Generate and append a changelog entry automatically |
| `npm run release:theme -- vX.Y.Z` | One-shot release prep: audit + build + changelog append |
| `pnpm astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `pnpm astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).

## Theme Governance

- Baseline report: `docs/theme-baseline.md`
- Changelog data: `src/data/themeChangelog.ts`
- Audit command: `npm run audit:theme`
- Changelog draft command: `npm run changelog:draft`
- Changelog append command: `npm run changelog:append -- vX.Y.Z`
- One-shot release command: `npm run release:theme -- vX.Y.Z`
- Advanced range draft command: `node scripts/changelog-draft.mjs --from HEAD~1 --to HEAD --ver vX.Y.Z`
- GitHub main pipeline (`.github/workflows/publish.yml`) now runs verify + auto deploy (Pages + VS Marketplace).
- Pages deploy prerequisite: set repository Pages source to `GitHub Actions`, or set `PAGES_ENABLEMENT_TOKEN` secret to auto-enable in workflow.
