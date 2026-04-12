<script setup lang="ts">
const { gsap } = useGsap()

const borderRef = ref<HTMLElement | null>(null)
const mobileMenuOpen = ref(false)

const user = useSupabaseUser()
const authStore = useAuthStore()
const { merchant } = storeToRefs(authStore)

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' }
] as const

function toggleMenu() {
  mobileMenuOpen.value = !mobileMenuOpen.value
}

function closeMenu() {
  mobileMenuOpen.value = false
}

onMounted(() => {
  if (!borderRef.value || !gsap) return

  gsap.to(borderRef.value, {
    opacity: 1,
    duration: 0.3,
    ease: 'power2.out',
    scrollTrigger: {
      trigger: document.body,
      start: 'top -80',
      end: 'top -80',
      toggleActions: 'play none none reverse'
    }
  })
})

watch(mobileMenuOpen, (open) => {
  if (import.meta.client) {
    document.body.style.overflow = open ? 'hidden' : ''
  }
})

onUnmounted(() => {
  if (import.meta.client) {
    document.body.style.overflow = ''
  }
})
</script>

<template>
  <header
    role="banner"
    class="fixed top-0 left-0 right-0 z-40 h-16 bg-surface-base/70 backdrop-blur-xl"
  >
    <div
      ref="borderRef"
      class="absolute bottom-0 left-0 right-0 h-px bg-border-base opacity-0"
      aria-hidden="true"
    />

    <nav
      aria-label="Main navigation"
      class="mx-auto flex h-full max-w-6xl items-center justify-between px-6"
    >
      <!-- Logo -->
      <NuxtLink
        to="/"
        class="flex items-center gap-2"
        aria-label="Eoni homepage"
      >
        <div
          class="h-7 w-7 rounded-lg bg-gradient-to-br from-accent-violet to-accent-cyan"
          aria-hidden="true"
        />
        <span class="text-sm font-display font-semibold text-text-base">Eoni</span>
      </NuxtLink>

      <!-- Center nav links (desktop) -->
      <ul class="hidden lg:flex items-center gap-8">
        <li
          v-for="link in navLinks"
          :key="link.href"
        >
          <a
            :href="link.href"
            class="text-sm text-text-muted transition-colors duration-200 hover:text-text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base rounded-sm"
          >
            {{ link.label }}
          </a>
        </li>
      </ul>

      <!-- Right zone -->
      <div class="flex items-center gap-3">
        <!-- Authenticated: avatar dropdown -->
        <template v-if="user">
          <UDropdownMenu
            :items="[[
              { label: merchant?.name ?? user.email ?? 'Account', disabled: true }
            ], [
              { label: 'Dashboard', icon: 'i-heroicons-squares-2x2', to: '/dashboard' },
              { label: 'Settings', icon: 'i-heroicons-cog-6-tooth', to: '/dashboard/settings' }
            ], [
              { label: 'Log out', icon: 'i-heroicons-arrow-right-on-rectangle', onSelect: () => authStore.logout() }
            ]]"
          >
            <UButton
              variant="ghost"
              color="neutral"
              size="sm"
              :aria-label="`Account menu for ${merchant?.name ?? 'user'}`"
              class="hidden lg:inline-flex"
            >
              <UAvatar
                size="xs"
                :text="merchant?.name?.charAt(0) ?? user.email?.charAt(0) ?? '?'"
                :alt="merchant?.name ?? 'Account'"
              />
            </UButton>
          </UDropdownMenu>
        </template>

        <!-- Unauthenticated: login + get started -->
        <template v-else>
          <NuxtLink
            to="/auth/login"
            class="hidden lg:inline-flex text-sm text-text-muted transition-colors duration-200 hover:text-text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base rounded-sm px-2 py-1"
          >
            Login
          </NuxtLink>
          <NuxtLink
            to="/auth/login"
            class="hidden lg:inline-flex items-center gap-1.5 rounded-full bg-accent-violet px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-accent-violet-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
          >
            Get started
            <UIcon
              name="i-lucide-arrow-right"
              class="h-3.5 w-3.5"
            />
          </NuxtLink>
        </template>

        <!-- Mobile hamburger -->
        <button
          class="lg:hidden flex h-10 w-10 items-center justify-center rounded-lg text-text-muted transition-colors duration-200 hover:bg-surface-3 hover:text-text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base"
          :aria-expanded="mobileMenuOpen"
          aria-controls="mobile-nav"
          aria-label="Toggle navigation menu"
          @click="toggleMenu"
        >
          <UIcon
            :name="mobileMenuOpen ? 'i-lucide-x' : 'i-lucide-menu'"
            class="h-5 w-5"
          />
        </button>
      </div>
    </nav>

    <!-- Mobile menu overlay -->
    <AnimatePresence>
      <motion
        v-if="mobileMenuOpen"
        id="mobile-nav"
        as="div"
        class="fixed inset-0 z-30 bg-surface-base/95 backdrop-blur-xl px-6 pt-20"
        :initial="{ opacity: 0 }"
        :animate="{ opacity: 1 }"
        :exit="{ opacity: 0 }"
        :transition="{ duration: 0.2 }"
        style="overscroll-behavior: contain"
      >
        <ul class="flex flex-col gap-6">
          <li
            v-for="(link, i) in navLinks"
            :key="link.href"
          >
            <motion
              as="a"
              :href="link.href"
              class="block text-2xl font-display font-medium text-text-base transition-colors duration-200 hover:text-accent-violet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet rounded-sm"
              :initial="{ opacity: 0, x: -16 }"
              :animate="{ opacity: 1, x: 0 }"
              :transition="{ duration: 0.3, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }"
              @click="closeMenu"
            >
              {{ link.label }}
            </motion>
          </li>
        </ul>

        <div class="mt-10 flex flex-col gap-3">
          <template v-if="user">
            <NuxtLink
              to="/dashboard"
              class="block text-center text-sm text-text-muted transition-colors duration-200 hover:text-text-base rounded-sm py-2"
              @click="closeMenu"
            >
              Dashboard
            </NuxtLink>
            <button
              class="inline-flex items-center justify-center gap-1.5 rounded-full bg-surface-3 px-6 py-3 text-sm font-medium text-text-base transition-colors duration-200 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet"
              @click="() => { closeMenu(); authStore.logout() }"
            >
              Log out
            </button>
          </template>
          <template v-else>
            <NuxtLink
              to="/auth/login"
              class="block text-center text-sm text-text-muted transition-colors duration-200 hover:text-text-base rounded-sm py-2"
              @click="closeMenu"
            >
              Login
            </NuxtLink>
            <NuxtLink
              to="/auth/login"
              class="inline-flex items-center justify-center gap-1.5 rounded-full bg-accent-violet px-6 py-3 text-sm font-medium text-white transition-colors duration-200 hover:bg-accent-violet-2"
              @click="closeMenu"
            >
              Get started
              <UIcon
                name="i-lucide-arrow-right"
                class="h-3.5 w-3.5"
              />
            </NuxtLink>
          </template>
        </div>
      </motion>
    </AnimatePresence>
  </header>
</template>
