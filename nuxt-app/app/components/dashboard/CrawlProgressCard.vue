<script setup lang="ts">
import type { CrawlJob } from '~/types/api'

const props = defineProps<{
  job: CrawlJob
}>()

const statusColor = (s: string) => ({
  pending: 'neutral' as const,
  running: 'primary' as const,
  completed: 'success' as const,
  failed: 'error' as const
})[s] ?? 'neutral' as const

const progressPct = computed(() => {
  if (!props.job.pages_found || props.job.pages_found === 0) return 0
  return Math.round((props.job.pages_crawled / props.job.pages_found) * 100)
})

const elapsedTime = computed(() => {
  if (!props.job.started_at) return null
  const start = new Date(props.job.started_at)
  const end = props.job.completed_at ? new Date(props.job.completed_at) : new Date()
  const diffMs = end.getTime() - start.getTime()
  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
})
</script>

<template>
  <UCard class="glass relative overflow-hidden">
    <!-- Top-edge glow when running -->
    <div
      v-if="job.status === 'running'"
      class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-violet to-transparent"
      aria-hidden="true"
    />

    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2 min-w-0">
        <!-- Animated spinner only when running -->
        <motion
          v-if="job.status === 'running'"
          as="div"
          :animate="{ rotate: 360 }"
          :transition="{ repeat: Infinity, duration: 1, ease: 'linear' }"
          class="shrink-0"
        >
          <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 text-accent-violet" />
        </motion>
        <UIcon
          v-else-if="job.status === 'completed'"
          name="i-heroicons-check-circle"
          class="w-4 h-4 text-success shrink-0"
        />
        <UIcon
          v-else-if="job.status === 'failed'"
          name="i-heroicons-x-circle"
          class="w-4 h-4 text-error shrink-0"
        />
        <UIcon
          v-else
          name="i-heroicons-clock"
          class="w-4 h-4 text-text-subtle shrink-0"
        />
        <span class="text-sm font-medium text-text-base truncate min-w-0">
          {{ job.url }}
        </span>
      </div>
      <div aria-live="polite">
        <UBadge
          :color="statusColor(job.status)"
          variant="subtle"
          size="xs"
          class="shrink-0 ml-2"
        >
          {{ job.status }}
        </UBadge>
      </div>
    </div>

    <!-- Progress bar -->
    <div
      class="h-1.5 bg-surface-3 rounded-full overflow-hidden"
      role="progressbar"
      :aria-valuenow="progressPct"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <motion
        as="div"
        class="h-full bg-gradient-to-r from-accent-violet to-accent-cyan rounded-full"
        :animate="{ width: `${progressPct}%` }"
        :transition="{ type: 'spring', stiffness: 40, damping: 12 }"
      />
    </div>

    <!-- Stats row -->
    <div class="mt-3 flex gap-4 text-xs font-mono tabular-nums text-text-muted">
      <span>{{ job.pages_crawled }}&nbsp;/&nbsp;{{ job.pages_found }} pages</span>
      <span>{{ job.chunks_created }} chunks</span>
      <span v-if="elapsedTime" class="ml-auto">{{ elapsedTime }}</span>
    </div>
  </UCard>
</template>
