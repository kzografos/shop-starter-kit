<template>
  <div class="min-h-screen flex items-center justify-center px-4 py-12 bg-[--color-surface-page]">
    <div class="w-full max-w-md">
      <div class="text-center mb-8">
        <NuxtLink :to="localePath('/')">
          <component :is="brand.component" v-if="brand" class="text-2xl" />
        </NuxtLink>
      </div>

      <div class="bg-[--color-surface-card] border border-[--color-border-warm] rounded-2xl p-8">
        <div class="mb-6">
          <h1 class="font-display text-2xl font-bold text-[--color-bark]">{{ $t('auth.forgot_title') }}</h1>
          <p class="text-sm text-[--color-bark-light] mt-2">{{ $t('auth.forgot_desc') }}</p>
        </div>

        <form class="space-y-5" @submit.prevent="onSubmit">
          <UFormField :label="$t('auth.email')" required>
            <UInput
              v-model="email"
              type="email"
              placeholder="you@example.com"
              autocomplete="email"
              required
              :class="inputClass"
            />
          </UFormField>

          <UAlert v-if="error" color="error" variant="soft" :description="error" />
          <UAlert v-if="sent" color="success" variant="soft" :description="$t('auth.forgot_sent')" />

          <UButton
            type="submit"
            block
            :loading="loading"
            :disabled="sent"
            :label="$t('auth.forgot_btn')"
            :ui="{ base: 'h-14 justify-center rounded-xl text-base' }"
          />
        </form>

        <p class="text-sm text-center text-[--color-bark-light] mt-6">
          <NuxtLink :to="localePath('/login')" class="text-terracotta font-medium hover:text-terracotta-dark transition-colors">
            ← {{ $t('auth.back_to_login') }}
          </NuxtLink>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'guest', layout: false })

// The brand mark is the project's, contributed through `app.config.brand`.
const brand = computed(() => useAppConfig().brand)

const { t } = useI18n()

const api = useApi()
const localePath = useLocalePath()

const inputClass = useAuthInputClass()

const email = ref('')
const loading = ref(false)
const sent = ref(false)
const error = ref('')

async function onSubmit() {
  loading.value = true
  error.value = ''
  try {
    await api('/auth/forgot-password', { method: 'POST', body: { email: email.value } })
    sent.value = true
  } catch (err: unknown) {
    error.value = (err as { data?: { message?: string } })?.data?.message ?? 'An error occurred'
  } finally {
    loading.value = false
  }
}

useSeoMeta({ title: () => t('seo.forgot_password.title') })
</script>
