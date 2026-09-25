import { enabledModuleLayers } from './modules.registry'
import { LOCALES } from './app/project/project.config'

export default defineNuxtConfig({
  // Nuxt layers (blueprint §3): Core, the enabled application modules and the
  // project are layers under app/. Not under `layers/`, so they are listed
  // explicitly — the module ones come from modules.json (E8a), so enabling or
  // disabling a module is a registry edit rather than a config edit.
  //
  // The order is the composition's, not the registry's: earlier entries take
  // precedence and layer plugins run in reverse order of this list, so Core
  // first keeps its plugins running after the modules' and the project's — the
  // position they have at the app root.
  extends: ['./app/core', ...enabledModuleLayers, './app/project'],

  devtools: { enabled: false },

  app: {
    head: {
      htmlAttrs: { class: 'light' },
      meta: [{ name: 'color-scheme', content: 'light' }],
      script: [
        {
          innerHTML: "(function(){try{localStorage.setItem('nuxt-color-mode','light');document.documentElement.classList.remove('dark');document.documentElement.classList.add('light');}catch(e){}})()",
        },
      ],
      link: [
        {
          rel: 'preconnect',
          href: 'https://fonts.googleapis.com',
        },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: '',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400;1,9..144,600&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap',
        },
        {
          rel: 'stylesheet',
          href: 'https://cdnjs.cloudflare.com/ajax/libs/flag-icon-css/6.6.6/css/flag-icons.min.css',
        },
      ],
    },
  },

  modules: [
    '@nuxt/ui',
    '@nuxtjs/i18n',
    '@pinia/nuxt',
    'pinia-plugin-persistedstate/nuxt',
    'nuxt-charts',
    '@nuxt/eslint',
    '@nuxt/image',
  ],

  image: {
    provider: 'ipx',
    quality: 80,
    format: ['webp', 'avif'],
    screens: {
      xs: 320,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
    },
  },

  css: ['~/assets/css/brand.css', '~/assets/css/main.css', '~/assets/css/admin.css'],

  // Components and stores are declared by the layers that own them
  // (app/core, app/modules/*, app/project); the app root holds neither since
  // E7c/E7d.

  // Which locales, and the default, are the project's (C3d); how they are
  // routed and detected is the composition's.
  i18n: {
    locales: [...LOCALES.locales],
    defaultLocale: LOCALES.defaultLocale,
    langDir: '.',
    strategy: 'prefix_except_default',
    detectBrowserLanguage: false,
  },

  // Public only: every secret lives with the backend (backend/.env), the
  // frontend never talks to a provider directly.
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3001',
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    },
  },

  vite: {
    optimizeDeps: {
      include: ['@vue/devtools-kit', '@vue/devtools-core'],
    },
  },

  colorMode: {
    preference: 'light',
    fallback: 'light',
    classSuffix: '',
  },

  compatibilityDate: '2024-11-01',
})
