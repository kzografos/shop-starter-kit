export default defineNuxtConfig({
  devtools: { enabled: false },

  app: {
    head: {
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
          href: 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400;1,9..144,600&family=DM+Sans:wght@400;500;600&display=swap',
        },
      ],
    },
  },

  modules: ["@nuxt/ui", "@nuxtjs/supabase", "@nuxtjs/i18n", "@pinia/nuxt", "pinia-plugin-persistedstate/nuxt", "nuxt-charts", "@nuxt/eslint"],

  css: ["~/assets/css/main.css"],

  components: [
    { path: '~/components', pathPrefix: false },
  ],

  supabase: {
    redirect: false,
    useSsrCookies: true,
  },

  i18n: {
    locales: [
      { code: "el", name: "Ελληνικά", file: "el.json" },
      { code: "en", name: "English", file: "en.json" },
    ],
    defaultLocale: "el",
    langDir: ".",
    strategy: "prefix_except_default",
    detectBrowserLanguage: false,
  },

  runtimeConfig: {
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    resendApiKey: process.env.RESEND_API_KEY,
    emailFrom: process.env.EMAIL_FROM || 'PetShop CY <orders@petshopcyprus.com>',
    public: {
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      whatsappNumber: process.env.NUXT_PUBLIC_WHATSAPP_NUMBER || "35799000000",
    },
  },

  vite: {
    optimizeDeps: {
      include: [
        '@vue/devtools-kit',
        '@vue/devtools-core',
        '@stripe/stripe-js',
      ],
    },
  },

  compatibilityDate: "2024-11-01",
});
