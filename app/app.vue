<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
// Titles, icons and share cards are project data, read from `app.config`;
// the SEO mechanism below stays Core.
const { project } = useAppConfig()

// Absolute base URL for share-card images — scrapers can't fetch relative paths.
const { public: { siteUrl } } = useRuntimeConfig()
const base = (siteUrl as string) || 'http://localhost:3000'
const ogImageUrl = `${base}${project.ogImage}`

// Global SEO defaults — pages that set their own title override the template body.
// To rebrand: swap the icon and share-card files in app/project/public/ and the
// brand.favicon / brand.appleTouchIcon / brand.ogImage paths in app/project/project.config.ts.
useHead({
  titleTemplate: (title) => (title ? `${title} · ${project.name}` : project.legalName),
  link: [
    ...(project.favicon
      ? [{ rel: 'icon', type: 'image/svg+xml', href: project.favicon }]
      : []),
    { rel: 'apple-touch-icon', href: project.appleTouchIcon },
  ],
})
useSeoMeta({
  ogSiteName: project.legalName,
  ogType: 'website',
  description: () => project.tagline,
  ogTitle: project.legalName,
  ogImage: ogImageUrl,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: project.legalName,
  twitterCard: 'summary_large_image',
  twitterTitle: project.legalName,
  twitterImage: ogImageUrl,
})
</script>
