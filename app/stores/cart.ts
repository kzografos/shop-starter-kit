import { defineStore, skipHydrate } from 'pinia'
import type { CartItem, Product } from '~/types'

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])

  const itemCount = computed(() =>
    items.value.reduce((sum, i) => sum + i.quantity, 0)
  )

  const subtotal = computed(() =>
    items.value.reduce((sum, i) => sum + i.product.price * i.quantity, 0)
  )

  function addItem(product: Product, quantity = 1) {
    const existing = items.value.find(i => i.product.id === product.id)
    if (existing) {
      existing.quantity = Math.min(existing.quantity + quantity, product.stock)
    } else {
      items.value.push({ product: structuredClone(product), quantity })
    }
  }

  function removeItem(productId: string) {
    items.value = items.value.filter(i => i.product.id !== productId)
  }

  function updateQuantity(productId: string, quantity: number) {
    const item = items.value.find(i => i.product.id === productId)
    if (!item) return
    if (quantity <= 0) {
      removeItem(productId)
    } else {
      item.quantity = Math.min(quantity, item.product.stock)
    }
  }

  function clear() {
    items.value = []
  }

  function loadFromOrder(orderItems: Array<{ product: Product; quantity: number }>) {
    items.value = orderItems
      .filter(i => i.product.stock > 0)
      .map(i => ({
        product: structuredClone(i.product),
        quantity: Math.min(i.quantity, i.product.stock),
      }))
  }

  return {
    items: skipHydrate(items),
    itemCount,
    subtotal,
    addItem,
    removeItem,
    updateQuantity,
    clear,
    loadFromOrder,
  }
}, {
  persist: true,
})
