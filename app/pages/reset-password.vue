<template>
  <div class="min-h-screen flex items-center justify-center px-4 bg-gray-50">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <NuxtLink :to="localePath('/')">
          <img src="/logo.svg" alt="PetShop CY" class="h-14 w-auto mx-auto mb-4" >
        </NuxtLink>
      </div>

      <UCard class="p-2">
        <div class="text-center mb-6">
          <h1 class="text-2xl font-bold text-gray-900">{{ $t('auth.reset_title') }}</h1>
          <p class="text-sm text-gray-500 mt-1">{{ $t('auth.reset_desc') }}</p>
        </div>

        <!-- No valid session from email link -->
        <div v-if="!ready" class="text-center py-4">
          <UIcon name="i-heroicons-exclamation-triangle" class="w-10 h-10 text-yellow-500 mx-auto mb-3" />
          <p class="text-sm text-gray-500">{{ $t('auth.reset_invalid') }}</p>
          <UButton
            :to="localePath('/forgot-password')"
            variant="ghost"
            :label="$t('auth.forgot_btn')"
            class="mt-4"
          />
        </div>

        <!-- Password form -->
        <form v-else class="space-y-4" @submit.prevent="onSubmit">
          <UFormField :label="$t('auth.new_password')" required>
            <UInput
              v-model="password"
              type="password"
              placeholder="••••••••"
              autocomplete="new-password"
              required
              class="w-full"
            />
          </UFormField>

          <UFormField :label="$t('auth.confirm_password')" required>
            <UInput
              v-model="confirm"
              type="password"
              placeholder="••••••••"
              autocomplete="new-password"
              required
              class="w-full"
            />
          </UFormField>

          <UAlert v-if="error" color="error" variant="soft" :description="error" />
          <UAlert v-if="success" color="success" variant="soft" :description="$t('auth.reset_success')" />

          <UButton
            type="submit"
            block
            :loading="loading"
            :disabled="success"
            :label="$t('auth.reset_btn')"
          />
        </form>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'guest', layout: false })

const { t } = useI18n()

const api = useApi()
const localePath = useLocalePath()
const route = useRoute()

const password = ref('')
const confirm = ref('')
const loading = ref(false)
const error = ref('')
const success = ref(false)

const ready = computed(() => !!route.query.token)

async function onSubmit() {
  error.value = ''
  if (password.value.length < 6) {
    error.value = 'Password must be at least 6 characters'
    return
  }
  if (password.value !== confirm.value) {
    error.value = 'Passwords do not match'
    return
  }

  loading.value = true
  try {
    await api('/auth/reset-password', {
      method: 'POST',
      body: { token: route.query.token as string, password: password.value },
    })
    success.value = true
    setTimeout(() => navigateTo(localePath('/')), 2000)
  } catch (err: unknown) {
    error.value = (err as { data?: { message?: string } })?.data?.message ?? 'An error occurred'
  } finally {
    loading.value = false
  }
}

useSeoMeta({ title: () => t('seo.reset_password.title') })
</script>
