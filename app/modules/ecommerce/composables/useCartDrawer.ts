/**
 * Owns the shared `cart-open` state key (shop). Core never reads the key;
 * shop components open/close the drawer through this composable.
 */
export function useCartDrawer() {
  const isOpen = useState('cart-open', () => false)

  function open() {
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
  }

  return { isOpen, open, close }
}
