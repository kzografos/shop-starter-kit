<template>
  <div class="max-w-5xl mx-auto px-4 py-12">
    <div class="text-center mb-12">
      <h1 class="text-3xl font-bold text-gray-900 mb-3">{{ $t('contact.title') }}</h1>
      <p class="text-gray-500">{{ $t('contact.subtitle') }}</p>
    </div>

    <div class="grid lg:grid-cols-5 gap-10">
      <!-- Contact details -->
      <div class="lg:col-span-2 space-y-6">
        <div
          v-for="item in contactItems"
          :key="item.icon"
          class="flex gap-4 items-start"
        >
          <div
            class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style="background: linear-gradient(135deg, #fb923c 0%, #ef4444 100%)"
          >
            <UIcon :name="item.icon" class="w-5 h-5 text-white" />
          </div>
          <div>
            <div class="font-semibold text-gray-900 text-sm mb-0.5">{{ item.label }}</div>
            <div class="text-gray-500 text-sm whitespace-pre-line">{{ item.value }}</div>
          </div>
        </div>

        <!-- Hours -->
        <div class="flex gap-4 items-start">
          <div
            class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style="background: linear-gradient(135deg, #fb923c 0%, #ef4444 100%)"
          >
            <UIcon name="i-heroicons-clock" class="w-5 h-5 text-white" />
          </div>
          <div>
            <div class="font-semibold text-gray-900 text-sm mb-1">{{ $t('contact.hours_label') }}</div>
            <div class="space-y-0.5 text-sm text-gray-500">
              <div class="flex justify-between gap-8">
                <span>{{ $t('contact.hours_weekdays') }}</span>
                <span class="font-medium text-gray-700">09:00 – 19:00</span>
              </div>
              <div class="flex justify-between gap-8">
                <span>{{ $t('contact.hours_saturday') }}</span>
                <span class="font-medium text-gray-700">10:00 – 17:00</span>
              </div>
              <div class="flex justify-between gap-8">
                <span>{{ $t('contact.hours_sunday') }}</span>
                <span class="font-medium text-gray-700">{{ $t('contact.closed') }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Map -->
      <div class="lg:col-span-3">
        <div class="rounded-2xl overflow-hidden shadow-md h-96 lg:h-full min-h-80">
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
        <p class="text-xs text-gray-400 mt-2 text-center">
          © <a href="https://www.openstreetmap.org/copyright" target="_blank" class="hover:underline">OpenStreetMap</a>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()

// Store coordinates — update lat/lon to your exact location
const STORE_LAT = 34.6786
const STORE_LON = 33.0413

const mapUrl = computed(() => {
  const margin = 0.008
  const bbox = `${STORE_LON - margin},${STORE_LAT - margin},${STORE_LON + margin},${STORE_LAT + margin}`
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${STORE_LAT},${STORE_LON}`
})

const contactItems = computed(() => [
  {
    icon: 'i-heroicons-map-pin',
    label: t('contact.address_label'),
    value: t('contact.address_value'),
  },
  {
    icon: 'i-heroicons-phone',
    label: t('contact.phone_label'),
    value: '+357 25 000 000',
  },
  {
    icon: 'i-heroicons-envelope',
    label: t('contact.email_label'),
    value: 'info@petshopcyprus.com',
  },
])

useSeoMeta({ title: `${t('nav.contact')} | PetShop CY` })
</script>
