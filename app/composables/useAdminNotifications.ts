/**
 * Shared admin low-stock notification state. The header bell and the
 * notifications page both read/refresh the same unread counter.
 */
export function useAdminNotifications() {
  const { public: { apiBase } } = useRuntimeConfig()
  const unread = useState('admin-notif-unread', () => 0)

  async function refreshCount() {
    try {
      const { count } = await $fetch<{ count: number }>(
        `${apiBase}/admin/notifications/unread-count`,
        { credentials: 'include' },
      )
      unread.value = count
    } catch {
      // Silent — a missing count must never break the admin shell.
    }
  }

  return { unread, refreshCount }
}
