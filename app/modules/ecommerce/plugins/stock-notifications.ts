// Shop (catalog) contribution to the Core staff inbox: the wording, icon tone
// and product action of `low_stock` / `out_of_stock` rows. Core renders every
// row through describeNotification(); this plugin is the only place that knows
// those rows are about stock. Universal so SSR and client phrase a row identically.
import { registerNotificationPresenter } from '#core/utils/notification-presenters'
import { lowStockPresenter, outOfStockPresenter } from '#shop/utils/stock-notification-presenter'

export default defineNuxtPlugin(() => {
  registerNotificationPresenter('low_stock', lowStockPresenter)
  registerNotificationPresenter('out_of_stock', outOfStockPresenter)
})
