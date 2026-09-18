<template>
  <!-- eslint-disable-next-line vue/no-v-html -- static, shell-owned path data -->
  <svg v-if="paths" viewBox="0 0 24 24" :fill="fill" :stroke="stroke" v-html="paths" />
  <svg v-else viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3" /></svg>
</template>

<script setup lang="ts">
// The admin shell's icon set. Registry entries name an icon; an unknown name
// renders the fallback square instead of failing. Stroke/fill come from
// `.admin-nav-item svg` in admin.css, except the bell which carries its own.
const props = defineProps<{ name: string }>()

const ICONS: Record<string, string> = {
  dashboard: '<rect x="3.25" y="3.25" width="7.5" height="7.5" rx="1.5"/><rect x="13.25" y="3.25" width="7.5" height="4.5" rx="1.5"/><rect x="13.25" y="10.25" width="7.5" height="10.5" rx="1.5"/><rect x="3.25" y="13.25" width="7.5" height="7.5" rx="1.5"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 14l3-4 3 3 4-6"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
  tag: '<path d="M20.59 13.41 11 3.99H4v7l9.59 9.41a2 2 0 0 0 2.82 0l4.18-4.17a2 2 0 0 0 0-2.82Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  cart: '<path d="M3 4h2l2 12h12l2-8H7"/><circle cx="9" cy="20" r="1.25"/><circle cx="18" cy="20" r="1.25"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.75 19c.5-3 3.5-4.75 6.25-4.75S15 16 15.5 19"/><circle cx="17" cy="9" r="2.5"/><path d="M19 14.75c1.5.5 2.5 1.5 2.5 3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  staff: '<circle cx="9" cy="8" r="3.25"/><path d="M3 19c.4-3 3-4.75 6-4.75S14.6 16 15 19"/><path d="M16 3.5a3.25 3.25 0 0 1 0 6.5M18.5 19c-.2-2-1-3.4-2.5-4.3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
}
// The bell was drawn with explicit stroke attributes in the original markup.
const STROKED = new Set(['bell'])

const paths = computed(() => ICONS[props.name] ?? null)
const fill = computed(() => (STROKED.has(props.name) ? 'none' : undefined))
const stroke = computed(() => (STROKED.has(props.name) ? 'currentColor' : undefined))
</script>
