<script setup lang="ts">
const route = useRoute()
const { isOpen, close } = useSidebar()

// Close mobile sidebar on route change
watch(() => route.path, () => {
  close()
})
</script>

<template>
  <div class="flex min-h-screen bg-surface-base">
    <DashboardBackground />

    <!-- Skip to main content link -->
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent-violet focus:text-white focus:rounded-lg"
    >
      Skip to main content
    </a>

    <!-- Desktop sidebar -->
    <div class="hidden lg:block">
      <DashboardSidebar />
    </div>

    <!-- Mobile sidebar backdrop -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200"
        leave-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isOpen"
          class="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm lg:hidden"
          aria-hidden="true"
          @click="close"
        />
      </Transition>

      <!-- Mobile sidebar drawer -->
      <Transition
        enter-active-class="transition-transform duration-300 ease-out"
        leave-active-class="transition-transform duration-300 ease-in"
        enter-from-class="-translate-x-full"
        leave-to-class="-translate-x-full"
      >
        <div
          v-if="isOpen"
          class="fixed inset-y-0 left-0 z-30 lg:hidden"
          style="overscroll-behavior: contain"
        >
          <DashboardSidebar />
        </div>
      </Transition>
    </Teleport>

    <!-- Main content area -->
    <div class="flex flex-col flex-1 min-w-0 lg:ml-60">
      <DashboardHeader />
      <AnimatePresence mode="wait">
        <motion
          id="main-content"
          :key="route.path"
          as="main"
          class="flex-1 p-6 overflow-y-auto"
          :initial="{ opacity: 0 }"
          :animate="{ opacity: 1 }"
          :exit="{ opacity: 0 }"
          :transition="{ duration: 0.15 }"
        >
          <slot />
        </motion>
      </AnimatePresence>
    </div>
  </div>
</template>
