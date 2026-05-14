export default defineNuxtPlugin(() => {
  try {
    localStorage.setItem('nuxt-color-mode', 'light')
  } catch {}
  const colorMode = useColorMode()
  colorMode.preference = 'light'
  colorMode.value = 'light'
})
