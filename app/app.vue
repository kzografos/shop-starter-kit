<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
import { BUSINESS } from '~/utils/business'

// Site-wide LocalBusiness structured data for local SEO.
useBusinessSchema()

// Absolute base URL for share-card images — scrapers can't fetch relative paths.
const { public: { siteUrl } } = useRuntimeConfig()
const base = (siteUrl as string) || 'http://localhost:3000'
const ogImageUrl = `${base}${BUSINESS.brand.ogImage}`

// Global SEO defaults — pages that set their own title override the template body.
// To rebrand: swap public/favicon.svg, public/apple-touch-icon.png, public/og-image.png
// and the brand.favicon / brand.ogImage paths in app/utils/business.ts.
useHead({
  titleTemplate: (title) => (title ? `${title} · ${BUSINESS.name}` : BUSINESS.legalName),
  link: [
    ...(BUSINESS.brand.favicon
      ? [{ rel: 'icon', type: 'image/svg+xml', href: BUSINESS.brand.favicon }]
      : []),
    { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
  ],
})
useSeoMeta({
  ogSiteName: BUSINESS.legalName,
  ogType: 'website',
  description: () => BUSINESS.tagline,
  ogTitle: BUSINESS.legalName,
  ogImage: ogImageUrl,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: BUSINESS.legalName,
  twitterCard: 'summary_large_image',
  twitterTitle: BUSINESS.legalName,
  twitterImage: ogImageUrl,
})
</script>
