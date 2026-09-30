<template>
  <div class="bg-surface-page min-h-screen">
    <div class="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 max-w-6xl mx-auto px-4 py-10">
      <AccountSidebar />

      <!-- Main content -->
      <div class="flex flex-col gap-6">
        <!-- Welcome header -->
        <div class="mb-2">
          <h1 class="font-display text-3xl font-bold text-[--color-bark]">
            {{ $t('account.greeting') }}, {{ displayName }}.
          </h1>
          <p class="text-sm text-[--color-bark-light] mt-1">
            {{ $t('account.dashboard_subtitle') }}
          </p>
        </div>

        <!-- Dashboard blocks — contributed through app.config `accountCards` -->
        <component
          :is="card.component"
          v-for="card in accountCards"
          :key="card.component"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const authStore = useAuthStore()
const appConfig = useAppConfig()
const { profile } = storeToRefs(authStore)

const accountCards = computed(() =>
  [...(appConfig.accountCards ?? [])].sort((a, b) => a.order - b.order),
)

const displayName = computed(() => {
  const name = profile.value?.full_name
  if (name) return name.split(' ')[0]
  const email = profile.value?.email || ''
  return email.split('@')[0]
})

onMounted(async () => {
  await authStore.fetchProfile()
})
</script>
