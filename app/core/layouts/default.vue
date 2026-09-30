<template>
  <div class="min-h-screen flex flex-col bg-white">
    <AppHeader />
    <main class="flex-1">
      <slot />
    </main>
    <AppFooter />
    <component :is="widget.component" v-for="widget in globalWidgets" :key="widget.component" />
  </div>
</template>

<script setup lang="ts">
// Module and project widgets (cart drawer, WhatsApp button) are contributed
// through app.config `globalWidgets`.
const appConfig = useAppConfig()
const globalWidgets = computed(() =>
  [...(appConfig.globalWidgets ?? [])].sort((a, b) => a.order - b.order),
)
</script>
