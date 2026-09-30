export default defineNuxtPlugin(() => {
  try {
    localStorage.setItem('nuxt-color-mode', 'light')
  } catch { /* storage unavailable (private mode) */ }
  const colorMode = useColorMode()
  colorMode.preference = 'light'
  colorMode.value = 'light'
})
