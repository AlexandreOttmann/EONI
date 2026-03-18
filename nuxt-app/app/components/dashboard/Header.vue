<script setup lang="ts">
const route = useRoute()
const colorMode = useColorMode()
const { toggle: toggleSidebar } = useSidebar()

const authStore = useAuthStore()
const { displayName, avatarUrl } = storeToRefs(authStore)

const pageTitle = computed(() => {
  const titles: Record<string, string> = {
    '/dashboard': 'Overview',
    '/dashboard/crawl': 'Crawl',
    '/dashboard/chat': 'Chat Preview',
    '/dashboard/widget': 'Widget',
    '/dashboard/analytics': 'Analytics',
    '/dashboard/settings': 'Settings'
  }
  return titles[route.path] ?? 'Dashboard'
})

const showNewCrawlCta = computed(() => {
  return route.path === '/dashboard' || route.path === '/dashboard/crawl'
})

function toggleColorMode() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <header
    role="banner"
    class="sticky top-0 z-20 h-14 flex items-center justify-between px-6 border-b border-border-base glass"
  >
    <!-- Left zone -->
    <div class="flex items-center gap-3">
      <!-- Mobile menu toggle -->
      <UButton
        class="lg:hidden"
        icon="i-heroicons-bars-3"
        variant="ghost"
        color="neutral"
        size="sm"
        aria-label="Open navigation"
        aria-controls="sidebar"
        @click="toggleSidebar"
      />
      <span class="text-sm font-medium text-text-base">{{ pageTitle }}</span>
    </div>

    <!-- Right zone -->
    <div class="flex items-center gap-2">
      <UButton
        v-if="showNewCrawlCta"
        label="New Crawl"
        icon="i-heroicons-plus"
        color="primary"
        variant="solid"
        size="sm"
        to="/dashboard/crawl"
        aria-label="Start a new crawl job"
      />
      <ClientOnly>
        <UButton
          :icon="colorMode.value === 'dark' ? 'i-heroicons-sun' : 'i-heroicons-moon'"
          variant="ghost"
          color="neutral"
          size="sm"
          aria-label="Switch to dark/light mode"
          @click="toggleColorMode"
        />
      </ClientOnly>
      <UDropdownMenu
        :items="[[
          { label: displayName ?? 'Account', disabled: true }
        ], [
          { label: 'Settings', icon: 'i-heroicons-cog-6-tooth', to: '/dashboard/settings' }
        ], [
          { label: 'Log out', icon: 'i-heroicons-arrow-right-on-rectangle', onSelect: () => authStore.logout() }
        ]]"
      >
        <UButton
          variant="ghost"
          color="neutral"
          size="sm"
          :aria-label="`Account menu for ${displayName ?? 'user'}`"
        >
          <UAvatar
            size="xs"
            :src="avatarUrl ?? undefined"
            :text="displayName?.charAt(0) ?? '?'"
            :alt="displayName ?? 'Account'"
          />
        </UButton>
      </UDropdownMenu>
    </div>
  </header>
</template>
