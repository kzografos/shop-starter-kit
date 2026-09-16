<template>
  <button
    class="relative h-8 w-8 flex items-center justify-center rounded-full text-bark-light hover:text-bark hover:bg-cream-pale transition-all"
    @click="open()"
  >
    <UIcon
      name="i-heroicons-shopping-bag"
      class="w-5 h-5"
      :class="cartBouncing ? 'cart-bounce' : ''"
    />
    <span
      v-if="itemCount > 0"
      class="absolute -top-0.5 -right-0.5 min-w-4.5 h-4.5 flex items-center justify-center rounded-full bg-terracotta text-white text-[10px] font-bold px-1"
    >
      {{ itemCount }}
    </span>
  </button>
</template>

<script setup lang="ts">
// Contributed to the header through app.config `headerActions` (registered globally).
const cartStore = useCartStore()
const { itemCount } = storeToRefs(cartStore)
const { open } = useCartDrawer()
const cartBouncing = ref(false)

watch(itemCount, () => {
    cartBouncing.value = true
    setTimeout(() => {
      cartBouncing.value = false
    }, 400)
  }
)
</script>
