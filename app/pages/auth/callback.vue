<template>
  <div class="min-h-screen flex items-center justify-center bg-surface-page">
    <div class="text-center">
      <UIcon name="i-heroicons-arrow-path" class="w-10 h-10 text-terracotta animate-spin mx-auto mb-4" />
      <p class="text-[--color-bark-light]">{{ $t('auth.signing_in') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
// Landing page after Google OAuth. The backend has already set the auth cookies
// and redirected here; we just load the profile and continue to the intended page.
definePageMeta({ layout: false })

const authStore = useAuthStore()
const localePath = useLocalePath()

onMounted(async () => {
  await authStore.fetchProfile()
  const stored = localStorage.getItem('post_login_redirect')
  localStorage.removeItem('post_login_redirect')
  const dest = stored && stored.startsWith('/') ? stored : localePath('/account')
  await navigateTo(dest)
})
</script>
