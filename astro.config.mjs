import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'

const isGitHubPages = process.env.SITE_TARGET === 'github-pages'
const site = isGitHubPages ? 'https://hearth-code.github.io' : 'https://theme.hearthcode.dev'
const base = isGitHubPages ? '/HearthTheme' : '/'

export default defineConfig({
  site,
  base,
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'en',
        locales: {
          en: 'en-US',
          zh: 'zh-CN',
          ja: 'ja-JP',
        },
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh', 'ja'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
})
