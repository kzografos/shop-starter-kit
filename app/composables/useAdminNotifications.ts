/**
 * Shared admin low-stock notification state. The header bell and the
 * notifications page both read/refresh the same unread counter.
 */
export function useAdminNotifications() {
  const api = useApi()
  const unread = useState('admin-notif-unread', () => 0)

  async function refreshCount() {
    try {
      const { count } = await api<{ count: number }>(`/admin/notifications/unread-count`)
      unread.value = count
    } catch {
      // Silent — a missing count must never break the admin shell.
    }
  }

  return { unread, refreshCount }
}
