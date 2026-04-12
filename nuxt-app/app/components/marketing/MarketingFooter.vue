<script setup lang="ts">
const navColumns = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'Docs', href: '#' },
      { label: 'Changelog', href: '#' }
    ]
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#' },
      { label: 'Blog', href: '#' },
      { label: 'Contact', href: '#' }
    ]
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '#' },
      { label: 'Terms', href: '#' },
      { label: 'Cookies', href: '#' }
    ]
  }
]

const socials = [
  { icon: 'i-simple-icons-x', label: 'X (Twitter)', href: '#' },
  { icon: 'i-simple-icons-github', label: 'GitHub', href: '#' },
  { icon: 'i-simple-icons-discord', label: 'Discord', href: '#' }
]

const currentYear = new Date().getFullYear()
</script>

<template>
  <footer class="border-t border-border-base bg-surface-base">
    <div class="mx-auto max-w-6xl px-6">
      <!-- Top grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-8 py-16">
        <!-- Brand column -->
        <div class="col-span-2 md:col-span-1">
          <div class="flex items-center gap-2 mb-4">
            <div
              class="w-7 h-7 rounded-lg bg-gradient-to-br from-accent-violet to-accent-cyan"
              aria-hidden="true"
            />
            <span class="text-sm font-display font-semibold text-text-base">Eoni</span>
          </div>
          <p class="text-sm text-text-muted leading-relaxed max-w-xs">
            Turn any website into an AI-discoverable, agent-powered storefront.
          </p>
        </div>

        <!-- Nav columns -->
        <div
          v-for="col in navColumns"
          :key="col.title"
        >
          <h3 class="text-xs font-mono uppercase tracking-[0.12em] text-text-subtle mb-4">
            {{ col.title }}
          </h3>
          <ul class="space-y-2.5">
            <li
              v-for="link in col.links"
              :key="link.label"
            >
              <a
                :href="link.href"
                class="text-sm text-text-muted hover:text-text-base transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base focus-visible:outline-none rounded"
              >
                {{ link.label }}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <!-- Bottom bar -->
      <div class="border-t border-border-base py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p class="text-xs text-text-subtle">
          &copy; {{ currentYear }} Eoni. All rights reserved.
        </p>
        <div class="flex items-center gap-4">
          <a
            v-for="social in socials"
            :key="social.label"
            :href="social.href"
            :aria-label="social.label"
            class="text-text-subtle hover:text-text-muted transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base focus-visible:outline-none rounded"
          >
            <UIcon
              :name="social.icon"
              class="w-4 h-4"
            />
          </a>
        </div>
      </div>
    </div>
  </footer>
</template>
