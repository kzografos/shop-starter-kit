<template>
  <div
    class="relative min-h-screen grid grid-cols-1 lg:grid-cols-2 lg:h-screen lg:overflow-hidden bg-[--color-surface-page]"
  >
    <!-- Language switcher -->
    <div class="absolute top-4 right-6 z-10 flex items-center gap-2">
      <button
        class="transition-opacity duration-150 hover:opacity-100 flex items-center"
        :class="currentLocale === 'el' ? 'opacity-100' : 'opacity-35'"
        aria-label="Ελληνικά"
        @click="setLocale('el')"
      >
        <span class="fi fi-cy fis rounded-sm w-5 h-5" />
      </button>
      <span class="text-[--color-border-warm] text-xs">|</span>
      <button
        class="transition-opacity duration-150 hover:opacity-100 flex items-center"
        :class="currentLocale === 'en' ? 'opacity-100' : 'opacity-35'"
        aria-label="English"
        @click="setLocale('en')"
      >
        <span class="fi fi-gb fis rounded-sm w-5 h-5" />
      </button>
    </div>

    <!-- Left panel: desktop only -->
    <div
      class="hidden lg:flex flex-col justify-center items-center px-12 py-16 relative overflow-hidden h-screen"
      style="
        background: linear-gradient(145deg, var(--color-surface-card), var(--color-cream-pale));
      "
    >
      <div class="mb-10">
        <NuxtLink :to="localePath('/')">
          <img
            src="/logo.svg"
            alt="Mike Animal Show Pet Shop"
            class="h-14 w-auto hover:opacity-80 transition-opacity"
          />
        </NuxtLink>
      </div>

      <div class="text-center mb-10 max-w-sm">
        <h1 class="font-display text-5xl font-normal text-[--color-bark] leading-tight">
          {{ $t('login.welcome_back') }}<br />
          <span class="italic text-terracotta">{{ $t('login.welcome_accent') }}</span>
        </h1>
        <p class="mt-4 text-[--color-bark-light] text-base leading-relaxed">
          {{ $t('login.tagline') }}
        </p>
      </div>

      <ul class="space-y-4 text-[--color-bark] text-sm max-w-xs w-full">
        <li class="flex items-center gap-3">
          <span class="text-xl">🐾</span>
          <span>{{ $t('login.feature_orders') }}</span>
        </li>
        <li class="flex items-center gap-3">
          <span class="text-xl">🛒</span>
          <span>{{ $t('login.feature_points') }}</span>
        </li>
        <li class="flex items-center gap-3">
          <span class="text-xl">⭐</span>
          <span>{{ $t('login.feature_reorder') }}</span>
        </li>
      </ul>

      <!-- Decorative paw -->
      <div
        class="absolute bottom-6 right-6 text-9xl opacity-10 select-none pointer-events-none leading-none"
      >
        🐾
      </div>
    </div>

    <!-- Right panel: form -->
    <div
      class="flex flex-col items-center justify-center px-6 py-12 lg:h-screen lg:overflow-y-auto bg-[--color-surface-page] lg:bg-[--color-surface-card]"
    >
      <!-- Mobile logo -->
      <div class="lg:hidden mb-8">
        <img src="/logo.svg" alt="Mike Animal Show Pet Shop" class="h-12 w-auto mx-auto" />
      </div>

      <div class="w-full max-w-105 min-h-130 flex flex-col">
        <!-- Pill toggle -->
        <div
          class="flex items-center bg-[--color-surface-card] lg:bg-[--color-surface-page] rounded-full p-1 mb-8 w-fit mx-auto gap-4"
        >
          <button
            type="button"
            class="px-6 py-2 rounded-full text-sm font-semibold transition-all"
            :class="
              isLogin
                ? 'bg-terracotta text-white shadow'
                : 'text-[--color-bark] border border-[--color-border-warm] hover:border-terracotta/50'
            "
            @click="!isLogin && toggleMode()"
          >
            {{ $t('login.toggle_signin') }}
          </button>
          <button
            type="button"
            class="px-6 py-2 rounded-full text-sm font-semibold transition-all"
            :class="
              !isLogin
                ? 'bg-terracotta text-white shadow'
                : 'text-[--color-bark] border border-[--color-border-warm] hover:border-terracotta/50'
            "
            @click="isLogin && toggleMode()"
          >
            {{ $t('login.toggle_register') }}
          </button>
        </div>

        <!-- Heading -->
        <div class="mb-6">
          <h2 class="font-display text-4xl font-bold text-[--color-bark]">
            {{ isLogin ? $t('login.title') : $t('login.register_title') }}
          </h2>
          <p class="mt-2 text-sm text-[--color-bark-light]">
            {{ isLogin ? $t('login.subtitle') : $t('login.register_subtitle') }}
          </p>
        </div>

        <!-- Google OAuth -->
        <button
          type="button"
          class="w-full flex items-center justify-center gap-3 px-4 h-14 rounded-xl border border-[--color-border-warm] bg-cream text-[--color-bark] text-base font-medium hover:bg-[--color-surface-card] hover:border-terracotta/50 transition-colors mb-5"
          @click="signInWithGoogle"
        >
          <svg viewBox="0 0 24 24" class="w-4 h-4 shrink-0">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          {{ $t('login.google') }}
        </button>

        <!-- Divider -->
        <div class="relative flex items-center gap-3 mb-5">
          <div class="flex-1 h-px bg-[--color-border-warm]" />
          <span class="text-xs text-[--color-bark-light]">{{ $t('login.or') }}</span>
          <div class="flex-1 h-px bg-[--color-border-warm]" />
        </div>

        <!-- Form -->
        <form class="space-y-5" @submit.prevent="onSubmit">
          <UFormField :label="$t('auth.email')" required>
            <UInput
              v-model="form.email"
              type="email"
              placeholder="you@example.com"
              autocomplete="email"
              required
              :class="inputClass"
            />
          </UFormField>

          <UFormField :label="$t('auth.password')" required>
            <UInput
              v-model="form.password"
              type="password"
              placeholder="••••••••"
              :autocomplete="isLogin ? 'current-password' : 'new-password'"
              required
              :class="inputClass"
            />
          </UFormField>

          <div v-show="isLogin" class="flex justify-end -mt-2">
            <NuxtLink
              :to="localePath('/forgot-password')"
              class="text-xs text-terracotta hover:text-terracotta-dark transition-colors"
            >
              {{ $t('auth.forgot_link') }}
            </NuxtLink>
          </div>

          <div v-show="isLogin" class="flex items-center gap-2">
            <UCheckbox v-model="form.rememberMe" :label="$t('auth.remember_me')" name="remember" />
          </div>

          <UAlert v-if="error" color="error" variant="soft" :description="error" />
          <UAlert v-if="successMsg" color="success" variant="soft" :description="successMsg" />

          <UButton
            type="submit"
            block
            :loading="loading"
            :label="isLogin ? $t('login.arrow_button') : $t('login.register_arrow_button')"
            :ui="{ base: 'h-14 justify-center rounded-xl text-base' }"
          />
        </form>

        <!-- Switch mode -->
        <p class="text-sm text-center text-[--color-bark-light] mt-5">
          {{ isLogin ? $t('login.no_account') : $t('login.have_account') }}
          <button
            type="button"
            class="text-terracotta font-medium ml-1 hover:underline"
            @click="toggleMode"
          >
            {{ isLogin ? $t('login.toggle_register') : $t('login.toggle_signin') }}
          </button>
        </p>

        <!-- Loyalty info box -->
        <div
          class="mt-6 flex items-start gap-3 p-4 rounded-xl bg-[--color-surface-card] border border-[--color-border-warm] text-sm text-[--color-bark-light]"
        >
          <span class="text-base shrink-0">🐾</span>
          <span>{{ $t('login.loyalty_note') }}</span>
        </div>

        <NuxtLink
          :to="localePath('/products')"
          class="flex items-center justify-center gap-1.5 text-sm text-[--color-bark-light] hover:text-[--color-bark] transition-colors mt-5 mb-2"
        >
          <UIcon name="i-heroicons-arrow-left" class="w-4 h-4" />
          {{ $t('login.continue_browsing') }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'guest', layout: false })

const { t, locale: currentLocale, setLocale } = useI18n()
const api = useApi()
const authStore = useAuthStore()
const localePath = useLocalePath()
const route = useRoute()
const { public: { apiBase } } = useRuntimeConfig()

const inputClass = useAuthInputClass()

useSeoMeta({ title: () => t('seo.login.title') })

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
      await api('/auth/login', { method: 'POST', body: { email: form.email, password: form.password } })
      await authStore.fetchProfile()
      const redirectTo = route.query.redirect as string | undefined
      const destination =
        redirectTo && redirectTo.startsWith('/') ? decodeURIComponent(redirectTo) : '/account'
      await navigateTo(destination)
    } else {
      await api('/auth/register', { method: 'POST', body: { email: form.email, password: form.password } })
      successMsg.value = t('auth.register_success')
    }
  } catch (err: unknown) {
    const msg = (err as { data?: { message?: string | string[] } })?.data?.message
    const resolved = (Array.isArray(msg) ? msg[0] : msg) ?? 'An error occurred'
    error.value = String(resolved)
  } finally {
    loading.value = false
  }
}

function signInWithGoogle() {
  // Remember where to land after the Google round-trip (callback page reads this).
  const redirectTo = route.query.redirect as string | undefined
  if (import.meta.client) {
    localStorage.setItem(
      'post_login_redirect',
      redirectTo && redirectTo.startsWith('/') ? redirectTo : localePath('/account'),
    )
  }
  window.location.href = `${apiBase}/auth/google`
}
</script>
