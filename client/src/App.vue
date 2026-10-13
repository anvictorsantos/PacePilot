<template>
  <div class="min-h-screen bg-background text-white flex">
    <AppSidebar />
    <div class="flex-1 flex flex-col min-w-0">
      <AppHeader />
      <main class="flex-1 p-4 md:p-6 pb-20 md:pb-6 overflow-auto">
        <RouterView />
      </main>
    </div>
    <MobileNav />
    <ToastContainer />
  </div>
</template>

<script setup>
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import MobileNav from '@/components/layout/MobileNav.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'
</script>
