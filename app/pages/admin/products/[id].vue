<script setup lang="ts">
// Option A: product create/edit lives in the ProductDrawer slide-over on the
// list page. This legacy route just redirects back to the list.
definePageMeta({ layout: 'admin', middleware: 'admin' })
const localePath = useLocalePath()
await navigateTo(localePath('/admin/products'), { replace: true })
</script>

<template>
  <div />
</template>
