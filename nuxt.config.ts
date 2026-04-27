export default defineNuxtConfig({
  devtools: { enabled: true },

  modules: ["@nuxt/ui", "@nuxtjs/supabase", "@nuxtjs/i18n", "@pinia/nuxt"],

  css: ["~/assets/css/main.css"],

  components: [
    { path: '~/components', pathPrefix: false },
  ],

  supabase: {
    redirect: false,
  },

  i18n: {
    locales: [
      { code: "el", name: "Ελληνικά", file: "el.json" },
      { code: "en", name: "English", file: "en.json" },
    ],
    defaultLocale: "el",
    langDir: ".",
    strategy: "prefix_except_default",
  },

  runtimeConfig: {
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    public: {
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
      whatsappNumber: process.env.NUXT_PUBLIC_WHATSAPP_NUMBER || "35799000000",
    },
  },

  compatibilityDate: "2024-11-01",
});
