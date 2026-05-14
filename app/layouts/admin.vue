<template>
  <div class="min-h-screen flex bg-gray-50">
    <aside class="w-64 bg-gray-900 text-white flex flex-col flex-shrink-0">
      <div class="p-6 border-b border-gray-700">
        <h1 class="text-lg font-bold">Admin Panel</h1>
        <NuxtLink
          to="/"
          class="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors mt-1"
        >
          <UIcon name="i-heroicons-arrow-left" class="w-3 h-3" />
          PetShop CY
        </NuxtLink>
      </div>
      <nav class="flex-1 p-4 space-y-1">
        <NuxtLink
          to="/admin"
          class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          active-class="bg-gray-800 text-white"
        >
          <UIcon name="i-heroicons-squares-2x2" class="w-5 h-5" />
          {{ $t('admin.dashboard') }}
        </NuxtLink>
        <NuxtLink
          to="/admin/products"
          class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          active-class="bg-gray-800 text-white"
        >
          <UIcon name="i-heroicons-tag" class="w-5 h-5" />
          {{ $t('admin.products') }}
        </NuxtLink>
        <NuxtLink
          to="/admin/orders"
          class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          active-class="bg-gray-800 text-white"
        >
          <UIcon name="i-heroicons-shopping-bag" class="w-5 h-5" />
          {{ $t('admin.orders') }}
        </NuxtLink>
      </nav>
      <div class="p-4 border-t border-gray-700">
        <UButton
          :label="$t('nav.logout')"
          variant="ghost"
          color="neutral"
          block
          @click="authStore.signOut()"
        />
      </div>
    </aside>
    <main class="flex-1 overflow-auto">
      <div :key="$route.fullPath">
        <slot />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const authStore = useAuthStore()
</script>
