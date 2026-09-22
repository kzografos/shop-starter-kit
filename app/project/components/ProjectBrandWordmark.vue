<template>
  <span
    class="font-display font-bold leading-none whitespace-nowrap"
    :class="inverted ? 'text-cream' : 'text-bark'"
  >
    <template v-if="accent">{{ base }}<span class="text-terracotta">{{ accent }}</span></template>
    <template v-else>{{ name }}</template>
  </span>
</template>

<script setup lang="ts">
import { BUSINESS } from '#project/utils/business'

defineProps<{ inverted?: boolean }>()

const name = BUSINESS.name
const a = BUSINESS.brand.wordmarkAccent ?? ''
// Defensive: split only when accent is a non-empty, proper suffix of the name.
const isSuffix = a !== '' && a.length < name.length && name.endsWith(a)
const accent = isSuffix ? a : ''
const base = isSuffix ? name.slice(0, -a.length) : name
</script>
