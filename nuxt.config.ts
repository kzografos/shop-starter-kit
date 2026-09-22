export default defineNuxtConfig({
  // Nuxt layers (blueprint §3): the e-commerce module is a layer under app/.
  // Not under `layers/`, so it is listed explicitly.
  extends: ['./app/modules/ecommerce', './app/project'],

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

  components: [{ path: '~/components', pathPrefix: false }],

  // Each layer names its own store directory (the e-commerce layer names its
  // own in app/modules/ecommerce/nuxt.config.ts); @pinia/nuxt's default only
  // covers <srcDir>/stores, and naming one directory replaces that default.
  pinia: { storesDirs: ['./stores/**'] }, // relative to srcDir (app/)

  i18n: {
    locales: [
      { code: 'el', name: 'Ελληνικά', file: 'el.json' },
      { code: 'en', name: 'English', file: 'en.json' },
    ],
    defaultLocale: 'el',
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
