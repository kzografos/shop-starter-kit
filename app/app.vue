<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
// Site-wide LocalBusiness structured data for local SEO (project composable).
useBusinessSchema()

// Titles, icons and share cards are project data, read from `app.config`;
// the SEO mechanism below stays Core.
const { project } = useAppConfig()

// Absolute base URL for share-card images — scrapers can't fetch relative paths.
const { public: { siteUrl } } = useRuntimeConfig()
const base = (siteUrl as string) || 'http://localhost:3000'
const ogImageUrl = `${base}${project.ogImage}`

// Global SEO defaults — pages that set their own title override the template body.
// To rebrand: swap public/favicon.svg, public/apple-touch-icon.png, public/og-image.png
// and the brand.favicon / brand.ogImage paths in app/project/utils/business.ts.
useHead({
  titleTemplate: (title) => (title ? `${title} · ${project.name}` : project.legalName),
  link: [
    ...(project.favicon
      ? [{ rel: 'icon', type: 'image/svg+xml', href: project.favicon }]
      : []),
    { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
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
