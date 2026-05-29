<template>
  <div v-if="!done" class="mt-8 max-w-md mx-auto text-left border border-[--color-border-warm] rounded-2xl p-6 bg-surface-card">
    <h3 class="font-display text-lg font-bold text-[--color-bark] mb-1">
      {{ $t('checkout.create_account_title') }}
    </h3>
    <p class="text-sm text-[--color-bark-light] mb-4">
      {{ $t('checkout.create_account_subtitle') }}
    </p>

    <!-- Google -->
    <button
      type="button"
      class="w-full flex items-center justify-center gap-2 h-11 rounded-full border border-[--color-border-warm] text-sm font-medium text-[--color-bark] hover:border-terracotta transition-colors"
      @click="google"
    >
      <svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
      {{ $t('login.google') }}
    </button>

    <div class="flex items-center gap-3 my-4">
      <span class="flex-1 h-px bg-[--color-border-warm]" />
      <span class="text-xs text-[--color-bark-light]">{{ $t('login.or') }}</span>
      <span class="flex-1 h-px bg-[--color-border-warm]" />
    </div>

    <!-- Password signup — email is fixed to the one used at checkout -->
    <UFormField :label="$t('checkout.email')">
      <UInput :model-value="email" disabled class="w-full" />
    </UFormField>
    <UFormField :label="$t('checkout.set_password')" class="mt-3">
      <UInput v-model="password" type="password" autocomplete="new-password" class="w-full" @keyup.enter="createAccount" />
    </UFormField>

    <UAlert v-if="error" color="error" variant="soft" :description="error" class="mt-3" />

    <UButton
      :label="$t('checkout.create_account_btn')"
      block
      class="mt-4"
      :loading="loading"
      @click="createAccount"
    />

    <button type="button" class="w-full mt-3 text-sm text-[--color-bark-light] hover:text-[--color-bark]" @click="emit('skip')">
      {{ $t('checkout.skip_account') }}
    </button>
  </div>

  <div v-else class="mt-8 max-w-md mx-auto flex items-center justify-center gap-2 text-green-600">
    <UIcon name="i-heroicons-check-circle" class="w-5 h-5" />
    <span class="font-medium">{{ $t('checkout.account_created') }}</span>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ email: string }>()
const emit = defineEmits<{ done: []; skip: [] }>()

const { t } = useI18n()
const api = useApi()
const authStore = useAuthStore()
const { public: { apiBase } } = useRuntimeConfig()

const password = ref('')
const loading = ref(false)
const error = ref('')
const done = ref(false)

async function createAccount() {
  if (password.value.length < 8) {
    error.value = t('checkout.password_too_short')
    return
  }
  loading.value = true
  error.value = ''
  try {
    await api('/auth/register', { method: 'POST', body: { email: props.email, password: password.value } })
    await authStore.fetchProfile() // order(s) now linked + points awarded server-side
    done.value = true
    emit('done')
  } catch (e: unknown) {
    const msg = (e as { data?: { message?: string | string[] } })?.data?.message
    error.value = Array.isArray(msg) ? msg[0] : (msg ?? t('checkout.account_error'))
  } finally {
    loading.value = false
  }
}

function google() {
  if (import.meta.client) localStorage.setItem('post_login_redirect', '/account/orders')
  window.location.href = `${apiBase}/auth/google`
}
</script>
