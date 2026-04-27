<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <div class="text-center">
      <UIcon name="i-heroicons-check-circle" class="w-16 h-16 text-green-500 mx-auto mb-4" />
      <h1 class="text-2xl font-bold text-gray-900 mb-2">{{ $t('auth.login_title') }}</h1>
      <p class="text-gray-600">{{ $t('common.loading') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const localePath = useLocalePath()
const authStore = useAuthStore()

onMounted(async () => {
  await authStore.fetchProfile()
  await navigateTo(localePath('/'))
})
</script>
