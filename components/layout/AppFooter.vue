<template>
  <footer class="bg-gray-900 text-gray-300 mt-auto">
    <div class="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <img src="/logo.svg" alt="PetShop CY" class="h-10 w-auto mb-4 brightness-0 invert" />
          <p class="text-sm leading-relaxed">{{ $t('footer.description') }}</p>
        </div>
        <div>
          <h3 class="text-white font-semibold mb-4">{{ $t('footer.links') }}</h3>
          <ul class="space-y-2 text-sm">
            <li>
              <NuxtLink :to="localePath('/products')" class="hover:text-white transition-colors">
                {{ $t('nav.products') }}
              </NuxtLink>
            </li>
            <li>
              <NuxtLink :to="localePath('/account')" class="hover:text-white transition-colors">
                {{ $t('nav.account') }}
              </NuxtLink>
            </li>
            <li>
              <NuxtLink :to="localePath('/account/orders')" class="hover:text-white transition-colors">
                {{ $t('account.orders') }}
              </NuxtLink>
            </li>
          </ul>
        </div>
        <div>
          <h3 class="text-white font-semibold mb-4">{{ $t('footer.contact') }}</h3>
          <p class="text-sm">{{ $t('footer.shipping_info') }}</p>
        </div>
      </div>
      <div class="mt-8 pt-8 border-t border-gray-700 text-sm text-center text-gray-500">
        © {{ new Date().getFullYear() }} PetShop CY. All rights reserved.
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
const localePath = useLocalePath()
</script>
