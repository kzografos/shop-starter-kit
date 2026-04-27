<template>
  <div class="min-h-screen flex items-center justify-center px-4 bg-gray-50">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <NuxtLink :to="localePath('/')">
          <img src="/logo.svg" alt="PetShop CY" class="h-14 w-auto mx-auto mb-4" />
        </NuxtLink>
      </div>

      <UCard class="p-2">
        <div class="text-center mb-6">
          <h1 class="text-2xl font-bold text-gray-900">{{ $t('auth.forgot_title') }}</h1>
          <p class="text-sm text-gray-500 mt-1">{{ $t('auth.forgot_desc') }}</p>
        </div>

        <form class="space-y-4" @submit.prevent="onSubmit">
          <UFormField :label="$t('auth.email')" required>
            <UInput
              v-model="email"
              type="email"
              placeholder="you@example.com"
              autocomplete="email"
              required
              class="w-full"
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
          />
        </form>

        <p class="text-sm text-center text-gray-500 mt-5">
          <NuxtLink :to="localePath('/login')" class="text-primary-500 font-medium hover:underline">
            ← {{ $t('auth.back_to_login') }}
          </NuxtLink>
        </p>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const supabase = useSupabaseClient()
const localePath = useLocalePath()

const email = ref('')
const loading = ref(false)
const sent = ref(false)
const error = ref('')

async function onSubmit() {
  loading.value = true
  error.value = ''
  try {
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.value, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (err) throw err
    sent.value = true
  } catch (err: any) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

useSeoMeta({ title: 'Reset Password | PetShop CY' })
</script>
