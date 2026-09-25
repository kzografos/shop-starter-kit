<template>
  <span class="inline-flex items-center gap-2 leading-none">
    <img v-if="logo" :src="logo" :alt="BUSINESS.legalName" class="h-[1.4em] w-auto" />
    <template v-else>
      <span
        class="inline-flex items-center justify-center rounded-lg bg-terracotta text-cream font-display font-bold shrink-0"
        style="width: 1.55em; height: 1.55em; font-size: 0.9em;"
        aria-hidden="true"
      >{{ monogram }}</span>
      <ProjectBrandWordmark :inverted="inverted" />
    </template>
  </span>
</template>

<script setup lang="ts">
import { BUSINESS } from '#project/project.config'

defineProps<{ inverted?: boolean }>()

const logo = BUSINESS.brand.logo
const monogram = (BUSINESS.name.trim().charAt(0) || '?').toUpperCase()
</script>
