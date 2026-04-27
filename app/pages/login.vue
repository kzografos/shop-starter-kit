<template>
  <div class="min-h-screen flex items-center justify-center px-4 bg-gray-50">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <NuxtLink :to="localePath('/')">
          <img src="/logo.svg" alt="PetShop CY" class="h-14 w-auto mx-auto mb-4" />
        </NuxtLink>
      </div>

      <UCard class="p-2">
        <!-- Title + description -->
        <div class="text-center mb-6">
          <h1 class="text-2xl font-bold text-gray-900">
            {{ isLogin ? $t('auth.login_title') : $t('auth.register_title') }}
          </h1>
          <p class="text-sm text-gray-500 mt-1">
            {{ isLogin ? $t('auth.login_desc') : $t('auth.register_desc') }}
          </p>
        </div>

        <!-- Google OAuth -->
        <UButton
          block
          color="neutral"
          variant="outline"
          class="mb-4"
          @click="signInWithGoogle"
        >
          <template #leading>
            <svg viewBox="0 0 24 24" class="w-4 h-4">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
          </template>
          Google
        </UButton>

        <UDivider :label="$t('common.or')" class="mb-4" />

        <!-- Email + password form -->
        <form class="space-y-4" @submit.prevent="onSubmit">
          <UFormField :label="$t('auth.email')" required>
            <UInput
              v-model="form.email"
              type="email"
              placeholder="you@example.com"
              autocomplete="email"
              required
              class="w-full"
            />
          </UFormField>

          <UFormField :label="$t('auth.password')" required>
            <UInput
              v-model="form.password"
              type="password"
              placeholder="••••••••"
              :autocomplete="isLogin ? 'current-password' : 'new-password'"
              required
              class="w-full"
            />
          </UFormField>

          <!-- Forgot password (login only) -->
          <div v-if="isLogin" class="flex justify-end -mt-2">
            <NuxtLink
              :to="localePath('/forgot-password')"
              class="text-xs text-gray-400 hover:text-primary-500 transition-colors"
            >
              {{ $t('auth.forgot_link') }}
            </NuxtLink>
          </div>

          <!-- Remember me (login only) -->
          <div v-if="isLogin" class="flex items-center gap-2">
            <UCheckbox v-model="form.rememberMe" :label="$t('auth.remember_me')" name="remember" />
          </div>

          <!-- Feedback -->
          <UAlert v-if="error" color="error" variant="soft" :description="error" />
          <UAlert v-if="successMsg" color="success" variant="soft" :description="successMsg" />

          <UButton
            type="submit"
            block
            :loading="loading"
            :label="isLogin ? $t('auth.login_btn') : $t('auth.register_btn')"
          />
        </form>

        <!-- Toggle login/register -->
        <p class="text-sm text-center text-gray-500 mt-5">
          {{ isLogin ? $t('auth.no_account') : $t('auth.have_account') }}
          <button
            type="button"
            class="text-primary-500 font-medium ml-1 hover:underline"
            @click="toggleMode"
          >
            {{ isLogin ? $t('auth.register_btn') : $t('auth.login_btn') }}
          </button>
        </p>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const supabase = useSupabaseClient()
const authStore = useAuthStore()
const localePath = useLocalePath()
const { t } = useI18n()

const isLogin = ref(true)
const loading = ref(false)
const error = ref('')
const successMsg = ref('')

const form = reactive({
  email: '',
  password: '',
  rememberMe: false,
})

function toggleMode() {
  isLogin.value = !isLogin.value
  error.value = ''
  successMsg.value = ''
}

async function onSubmit() {
  loading.value = true
  error.value = ''
  successMsg.value = ''

  try {
    if (isLogin.value) {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      })
      if (err) throw err
      await authStore.fetchProfile()
      await navigateTo(localePath('/'))
    } else {
      const { error: err } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      })
      if (err) throw err
      successMsg.value = t('auth.register_success')
    }
  } catch (err: any) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function signInWithGoogle() {
  const { error: err } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/confirm` },
  })
  if (err) error.value = err.message
}
</script>
