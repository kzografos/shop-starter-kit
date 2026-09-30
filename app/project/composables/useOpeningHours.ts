import { BUSINESS } from '#project/project.config'

// Live "open now / closed" status based on the shop's hours in its configured timezone.
// Client-only (null on server) to avoid SSR vs client timezone hydration mismatch.
export const useOpeningHours = () => {
  const isOpen = ref<boolean | null>(null)

  function compute() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: BUSINESS.timezone,
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date())

    const weekday = parts.find((p) => p.type === 'weekday')?.value
    let hh = parts.find((p) => p.type === 'hour')?.value ?? '00'
    if (hh === '24') hh = '00' // some engines emit 24 at midnight
    const mm = parts.find((p) => p.type === 'minute')?.value ?? '00'
    const current = `${hh}:${mm}`

    const today = BUSINESS.schemaHours.find((h) => weekday && h.days.includes(weekday))
    isOpen.value = !!(today && current >= today.opens && current < today.closes)
  }

  onMounted(() => {
    compute()
    const id = setInterval(compute, 60_000) // refresh every minute
    onUnmounted(() => clearInterval(id))
  })

  return { isOpen }
}
