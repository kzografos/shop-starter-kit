<template>
  <div style="background: #F5F0E8;">
    <!-- Hero -->
    <section class="bg-cream-pale py-16 px-4">
      <div class="max-w-3xl mx-auto text-center">
        <h1 class="font-display text-4xl sm:text-5xl font-bold text-bark mb-4">{{ $t('contact.title') }}</h1>
        <p class="text-lg text-bark-light max-w-xl mx-auto">{{ $t('contact.subtitle') }}</p>
      </div>
    </section>

    <!-- Content -->
    <section class="max-w-5xl mx-auto px-4 py-14">
      <div class="grid lg:grid-cols-5 gap-8 items-start">

        <!-- Contact cards -->
        <div class="lg:col-span-2 space-y-4">
          <div
            v-for="(item, i) in allContactItems"
            :key="item.icon"
            :ref="(el) => { if (el) cardRefs[i] = el as Element }"
            class="rounded-2xl p-5 flex gap-4 items-start transition-all duration-300 hover:-translate-y-1" style="background: #EFE7D6; border: 1px solid #D8D4C2; box-shadow: 0 2px 12px rgba(0,0,0,0.06);"
            :class="visibleCards[i] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'"
          >
            <div class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-linear-to-br from-terracotta to-terracotta-dark">
              <UIcon :name="item.icon" class="w-5 h-5 text-white" />
            </div>
            <div>
              <div class="font-semibold text-bark text-sm mb-0.5">{{ item.label }}</div>
              <a
                v-if="item.href"
                :href="item.href"
                target="_blank"
                rel="noopener noreferrer"
                class="text-bark-light text-sm whitespace-pre-line leading-relaxed hover:text-terracotta transition-colors"
              >{{ item.value }}</a>
              <div v-else class="text-bark-light text-sm whitespace-pre-line leading-relaxed">{{ item.value }}</div>
            </div>
          </div>

          <!-- Hours card -->
          <div
            :ref="(el) => { if (el) cardRefs[allContactItems.length] = el as Element }"
            class="rounded-2xl p-5 flex gap-4 items-start transition-all duration-300 hover:-translate-y-1" style="background: #EFE7D6; border: 1px solid #D8D4C2; box-shadow: 0 2px 12px rgba(0,0,0,0.06);"
            :class="visibleCards[allContactItems.length] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'"
          >
            <div class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-linear-to-br from-terracotta to-terracotta-dark">
              <UIcon name="i-heroicons-clock" class="w-5 h-5 text-white" />
            </div>
            <div class="flex-1">
              <div class="font-semibold text-bark text-sm mb-2">{{ $t('contact.hours_label') }}</div>
              <div class="space-y-1 text-sm">
                <div v-for="row in hours" :key="row.key" class="flex justify-between">
                  <span class="text-bark-light">{{ $t(`contact.hours_${row.key}`) }}</span>
                  <span v-if="row.value" class="font-medium text-bark">{{ row.value }}</span>
                  <span v-else class="font-medium text-terracotta">{{ $t('contact.closed') }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Map -->
        <div class="lg:col-span-3">
          <div class="rounded-2xl overflow-hidden h-105 lg:h-125" style="border: 1px solid #D8D4C2;">
            <iframe
              :src="mapUrl"
              width="100%"
              height="100%"
              style="border: 0; display: block;"
              loading="lazy"
              allowfullscreen
              referrerpolicy="no-referrer-when-downgrade"
              :title="$t('contact.map_title')"
            />
          </div>
          <p class="text-xs text-bark-light/60 mt-2 text-center">
            © <a href="https://www.openstreetmap.org/copyright" target="_blank" class="hover:text-bark-light transition-colors">OpenStreetMap</a>
          </p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { BUSINESS } from '~/utils/business'

const { t } = useI18n()

const STORE_LAT = BUSINESS.geo.lat
const STORE_LON = BUSINESS.geo.lon

const mapUrl = computed(() => {
  const margin = 0.008
  const bbox = `${STORE_LON - margin},${STORE_LAT - margin},${STORE_LON + margin},${STORE_LAT + margin}`
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${STORE_LAT},${STORE_LON}`
})

const addressValue = `${BUSINESS.address.street}\n${BUSINESS.address.postalCode} ${BUSINESS.address.city}, ${BUSINESS.address.countryName}`
const hours = BUSINESS.displayHours

const allContactItems = computed(() => [
  { icon: 'i-heroicons-map-pin', label: t('contact.address_label'), value: addressValue, href: undefined as string | undefined },
  { icon: 'i-heroicons-phone', label: t('contact.phone_label'), value: BUSINESS.phoneDisplay, href: `tel:${BUSINESS.phone}` },
  { icon: 'i-heroicons-chat-bubble-left-right', label: 'WhatsApp', value: BUSINESS.phoneDisplay, href: `https://wa.me/${BUSINESS.whatsapp}` },
])

// Scroll fade-in — contact items + 1 hours card
const cardRefs: Element[] = []
const visibleCards = ref(Array(allContactItems.value.length + 1).fill(false))

onMounted(() => {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const idx = cardRefs.indexOf(entry.target)
        if (idx !== -1) {
          setTimeout(() => { visibleCards.value[idx] = true }, idx * 100)
        }
        obs.unobserve(entry.target)
      }
    })
  }, { threshold: 0.15 })
  cardRefs.forEach(el => el && obs.observe(el))
})

useSeoMeta({ title: `${t('nav.contact')} | ${BUSINESS.legalName}` })
</script>
