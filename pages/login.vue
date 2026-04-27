<template>
  <div class="min-h-screen flex items-center justify-center px-4 bg-gray-50">
    <div class="w-full max-w-md">
      <div class="text-center mb-8">
        <NuxtLink to="/">
          <img src="/logo.svg" alt="PetShop CY" class="h-16 w-auto mx-auto mb-4" />
        </NuxtLink>
        <h1 class="text-2xl font-bold text-gray-900">{{ $t('auth.login_title') }}</h1>
      </div>

      <UCard>
        <div class="space-y-4">
          <UFormField :label="$t('auth.email')">
            <UInput
              v-model="email"
              type="email"
              :placeholder="$t('auth.email')"
              class="w-full"
              @keyup.enter="sendMagicLink"
            />
          </UFormField>

          <UButton
            :label="$t('auth.magic_link')"
            block
            :loading="loading"
            @click="sendMagicLink"
          />

          <p v-if="sent" class="text-sm text-center text-green-600 font-medium">
            {{ $t('auth.magic_link_sent') }}
          </p>

          <UDivider :label="$t('auth.no_account')" />

          <p class="text-sm text-center text-gray-600">
            {{ $t('auth.no_account') }}
            <span class="text-primary-600 font-medium cursor-pointer" @click="goRegister">
              {{ $t('auth.register_btn') }}
            </span>
          </p>
        </div>
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

async function sendMagicLink() {
  if (!email.value) return
  loading.value = true
  const { error } = await supabase.auth.signInWithOtp({
    email: email.value,
    options: { emailRedirectTo: `${window.location.origin}/confirm` },
  })
  loading.value = false
  if (!error) sent.value = true
}

function goRegister() {
  // Magic link handles both login + register
  sendMagicLink()
}
</script>
