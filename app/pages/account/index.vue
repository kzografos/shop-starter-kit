<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="flex items-center justify-between mb-8">
      <h1 class="text-2xl font-bold text-gray-900">{{ $t('account.title') }}</h1>
      <UButton
        :label="$t('nav.logout')"
        variant="outline"
        color="neutral"
        @click="authStore.signOut()"
      />
    </div>

    <div class="grid sm:grid-cols-2 gap-4 mb-8">
      <LoyaltyBadge />
    </div>

    <div class="grid sm:grid-cols-2 gap-4">
      <NuxtLink :to="localePath('/account/orders')">
        <UCard class="hover:border-primary-300 transition-colors cursor-pointer">
          <div class="flex items-center gap-4">
            <UIcon name="i-heroicons-shopping-bag" class="w-8 h-8 text-primary-500" />
            <div>
              <h3 class="font-semibold text-gray-900">{{ $t('account.orders') }}</h3>
              <p class="text-sm text-gray-500">{{ $t('account.no_orders') }}</p>
            </div>
          </div>
        </UCard>
      </NuxtLink>

      <NuxtLink :to="localePath('/account/loyalty')">
        <UCard class="hover:border-primary-300 transition-colors cursor-pointer">
          <div class="flex items-center gap-4">
            <UIcon name="i-heroicons-star" class="w-8 h-8 text-amber-500" />
            <div>
              <h3 class="font-semibold text-gray-900">{{ $t('account.loyalty') }}</h3>
              <p class="text-sm text-gray-500">{{ authStore.loyaltyPoints }} {{ $t('loyalty.points') }}</p>
            </div>
          </div>
        </UCard>
      </NuxtLink>

      <NuxtLink :to="localePath('/account/favourites')">
        <UCard class="hover:border-primary-300 transition-colors cursor-pointer">
          <div class="flex items-center gap-4">
            <UIcon name="i-heroicons-heart" class="w-8 h-8 text-terracotta" />
            <div>
              <h3 class="font-semibold text-gray-900">{{ $t('account.favourites') }}</h3>
              <p class="text-sm text-gray-500">
                {{ favouritesStore.ids.length > 0
                  ? $t('account.favourites_count', { count: favouritesStore.ids.length }, favouritesStore.ids.length)
                  : $t('account.favourites_empty') }}
              </p>
            </div>
          </div>
        </UCard>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const authStore = useAuthStore()
const favouritesStore = useFavouritesStore()
const localePath = useLocalePath()

onMounted(() => authStore.fetchProfile())
</script>
