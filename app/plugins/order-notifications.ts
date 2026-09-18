// Shop (orders) contribution to the Core notification feed: the wording for
// `order_status` rows. Core renders every row through describeNotification();
// this plugin is the only place that knows those rows are about orders.
// Universal so SSR and client phrase a row identically.
import { registerNotificationPresenter } from '~/utils/notification-presenters'
import { orderStatusPresenter } from '~/utils/order-notification-presenter'

export default defineNuxtPlugin(() => {
  registerNotificationPresenter('order_status', orderStatusPresenter)
})
