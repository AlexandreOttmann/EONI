<script setup lang="ts">
interface Props {
  to?: string
  variant?: 'primary' | 'ghost'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary'
})

const el = ref<HTMLElement | null>(null)
const x = ref(0)
const y = ref(0)

function onMouseMove(e: MouseEvent) {
  if (!el.value) return
  const rect = el.value.getBoundingClientRect()
  x.value = (e.clientX - rect.left - rect.width / 2) * 0.35
  y.value = (e.clientY - rect.top - rect.height / 2) * 0.35
}

function onMouseLeave() {
  x.value = 0
  y.value = 0
}

const baseClasses = 'relative inline-flex items-center justify-center gap-2 font-medium transition-colors duration-200 touch-action-manipulation focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base focus-visible:outline-none'

const variantClasses = computed(() =>
  props.variant === 'primary'
    ? 'px-8 py-4 rounded-full bg-accent-violet text-white hover:bg-accent-violet-2'
    : 'px-8 py-4 rounded-full border border-border-base text-text-muted hover:text-text-base hover:border-text-subtle'
)
</script>

<template>
  <ClientOnly>
    <motion
      ref="el"
      as="div"
      :animate="{ x, y }"
      :transition="{ type: 'spring', stiffness: 150, damping: 15, mass: 0.1 }"
      class="inline-block"
      @mousemove="onMouseMove"
      @mouseleave="onMouseLeave"
    >
      <NuxtLink
        v-if="to"
        :to="to"
        :class="[baseClasses, variantClasses]"
      >
        <slot />
      </NuxtLink>
      <button
        v-else
        :class="[baseClasses, variantClasses]"
      >
        <slot />
      </button>
    </motion>
    <template #fallback>
      <div class="inline-block">
        <NuxtLink
          v-if="to"
          :to="to"
          :class="[baseClasses, variantClasses]"
        >
          <slot />
        </NuxtLink>
        <button
          v-else
          :class="[baseClasses, variantClasses]"
        >
          <slot />
        </button>
      </div>
    </template>
  </ClientOnly>
</template>
