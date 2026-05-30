<template>
  <div class="min-h-screen flex flex-col bg-white">
    <AppHeader />
    <!-- pb on mobile clears the floating WhatsApp button so it never covers content -->
    <main class="flex-1 pb-24 sm:pb-0">
      <slot />
    </main>
    <AppFooter />
    <WhatsAppButton />
    <CartDrawer />
  </div>
</template>
