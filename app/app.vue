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

// Global SEO defaults — pages that set their own title override the template body.
useHead({
  titleTemplate: (title) => (title ? `${title} · ${BUSINESS.name}` : BUSINESS.legalName),
})
useSeoMeta({
  ogSiteName: BUSINESS.legalName,
  ogType: 'website',
  description: () => BUSINESS.tagline,
})
</script>
