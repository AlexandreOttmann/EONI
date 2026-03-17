<script setup lang="ts">
const route = useRoute()

const navItems = [
  { label: 'Overview', icon: 'i-heroicons-squares-2x2', to: '/dashboard' },
  { label: 'Crawl', icon: 'i-heroicons-arrow-path', to: '/dashboard/crawl' },
  { label: 'Chat Preview', icon: 'i-heroicons-chat-bubble-left-ellipsis', to: '/dashboard/chat' },
  { label: 'Widget', icon: 'i-heroicons-code-bracket', to: '/dashboard/widget' },
  { label: 'Analytics', icon: 'i-heroicons-chart-bar', to: '/dashboard/analytics' },
  { label: 'Settings', icon: 'i-heroicons-cog-6-tooth', to: '/dashboard/settings' }
]

function isActive(to: string): boolean {
  if (to === '/dashboard') {
    return route.path === '/dashboard'
  }
  return route.path.startsWith(to)
}

const activeIndex = computed(() => {
  return navItems.findIndex(item => isActive(item.to))
})

// TODO: Replace with real merchant data from useMerchant() composable
const merchant = ref({
  name: 'My Store',
  plan: 'trial' as const
})
</script>

<template>
  <aside
    id="sidebar"
    class="fixed inset-y-0 left-0 z-30 w-60 flex flex-col bg-surface-1 border-r border-border-base"
  >
    <!-- Logo area -->
    <div class="h-14 flex items-center px-4 border-b border-border-base">
      <NuxtLink
        to="/dashboard"
        class="flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:outline-none rounded-lg"
      >
        <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-accent-violet to-accent-cyan" aria-hidden="true" />
        <span class="text-sm font-display font-semibold text-text-base">ShopAgent</span>
      </NuxtLink>
    </div>

    <!-- Navigation -->
    <nav aria-label="Dashboard navigation" class="flex-1 overflow-y-auto py-3 px-2">
      <p class="px-3 mb-1 text-xs font-mono uppercase tracking-[0.12em] text-text-subtle">
        Menu
      </p>
      <motion
        as="ul"
        class="space-y-0.5 relative"
        :variants="{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.04 } }
        }"
        initial="hidden"
        animate="visible"
      >
        <!-- Animated active indicator pill -->
        <motion
          v-if="activeIndex >= 0"
          as="div"
          class="absolute left-0 w-0.5 h-4 rounded-r bg-gradient-to-b from-accent-violet to-accent-cyan"
          :animate="{ top: `${activeIndex * 40 + 12}px` }"
          :transition="{ type: 'spring', stiffness: 400, damping: 30 }"
          aria-hidden="true"
        />

        <motion
          v-for="item in navItems"
          :key="item.to"
          as="li"
          :variants="{
            hidden: { opacity: 0, x: -8 },
            visible: { opacity: 1, x: 0, transition: { duration: 0.2, ease: 'easeOut' } }
          }"
        >
          <NuxtLink
            :to="item.to"
            class="group relative flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors duration-150 touch-action-manipulation focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1 focus-visible:outline-none"
            :class="[
              isActive(item.to)
                ? 'bg-accent-violet/8 text-text-base'
                : 'text-text-muted hover:bg-surface-3 hover:text-text-base'
            ]"
            :aria-current="isActive(item.to) ? 'page' : undefined"
          >
            <UIcon
              :name="item.icon"
              class="w-4 h-4 shrink-0"
              :class="isActive(item.to) ? 'text-accent-violet' : ''"
            />
            <span>{{ item.label }}</span>
          </NuxtLink>
        </motion>
      </motion>
    </nav>

    <!-- Merchant footer -->
    <div class="mt-auto mx-2 mb-2 p-3 rounded-xl glass">
      <div class="flex items-center gap-2 min-w-0">
        <UAvatar
          size="sm"
          :text="merchant.name.charAt(0)"
          :alt="merchant.name"
        />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-text-base truncate min-w-0">
            {{ merchant.name }}
          </p>
          <UBadge color="primary" variant="subtle" size="xs">
            {{ merchant.plan }}
          </UBadge>
        </div>
      </div>
    </div>
  </aside>
</template>
