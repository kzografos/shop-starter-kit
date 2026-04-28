<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <div class="flex items-center gap-4 mb-8">
      <UButton icon="i-heroicons-arrow-left" variant="ghost" :to="localePath('/account')" />
      <h1 class="text-2xl font-bold text-gray-900">{{ $t('account.loyalty') }}</h1>
    </div>

    <!-- Points balance -->
    <UCard class="mb-8 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-amber-600 font-medium mb-1">{{ $t('loyalty.your_points') }}</p>
          <p class="text-5xl font-bold text-amber-700">{{ authStore.loyaltyPoints }}</p>
          <p class="text-sm text-amber-600 mt-2">{{ $t('loyalty.redeem_info') }}</p>
        </div>
        <span class="text-6xl">⭐</span>
      </div>
    </UCard>

    <!-- Info cards -->
    <div class="grid sm:grid-cols-2 gap-4 mb-8">
      <UCard>
        <div class="flex items-start gap-3">
          <UIcon name="i-heroicons-arrow-trending-up" class="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 class="font-semibold text-gray-900 mb-1">{{ $t('loyalty.earned') }}</h3>
            <p class="text-sm text-gray-600">{{ $t('loyalty.earn_info') }}</p>
          </div>
        </div>
      </UCard>
      <UCard>
        <div class="flex items-start gap-3">
          <UIcon name="i-heroicons-gift" class="w-6 h-6 text-purple-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 class="font-semibold text-gray-900 mb-1">{{ $t('loyalty.redeemed') }}</h3>
            <p class="text-sm text-gray-600">{{ $t('loyalty.redeem_info') }}</p>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Transaction history -->
    <h2 class="text-lg font-semibold text-gray-900 mb-4">{{ $t('loyalty.history') }}</h2>

    <div v-if="pending">
      <USkeleton v-for="n in 4" :key="n" class="h-14 rounded-lg mb-2" />
    </div>

    <div v-else-if="transactions && transactions.length > 0" class="space-y-2">
      <div
        v-for="tx in transactions"
        :key="tx.id"
        class="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-8 h-8 rounded-full flex items-center justify-center"
            :class="tx.type === 'earn' ? 'bg-green-100' : 'bg-red-100'"
          >
            <UIcon
              :name="tx.type === 'earn' ? 'i-heroicons-plus' : 'i-heroicons-minus'"
              :class="tx.type === 'earn' ? 'text-green-600' : 'text-red-600'"
              class="w-4 h-4"
            />
          </div>
          <div>
            <p class="text-sm font-medium text-gray-900">
              {{ tx.type === 'earn' ? $t('loyalty.earned') : $t('loyalty.redeemed') }}
            </p>
            <p class="text-xs text-gray-500">
              {{ new Date(tx.created_at).toLocaleDateString() }}
            </p>
          </div>
        </div>
        <span
          class="font-bold text-sm"
          :class="tx.type === 'earn' ? 'text-green-600' : 'text-red-600'"
        >
          {{ tx.points_delta > 0 ? '+' : '' }}{{ tx.points_delta }} pts
        </span>
      </div>
    </div>

    <div v-else class="text-center py-12 text-gray-500 text-sm">
      {{ $t('common.loading') }}
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const authStore = useAuthStore()
const localePath = useLocalePath()

const { data: transactions, pending } = await useAsyncData('loyalty-transactions', async () => {
  const { data } = await supabase
    .from('loyalty_transactions')
    .select('*')
    .eq('user_id', user.value!.sub)
    .order('created_at', { ascending: false })
  return data
})

onMounted(() => authStore.fetchProfile())
</script>
