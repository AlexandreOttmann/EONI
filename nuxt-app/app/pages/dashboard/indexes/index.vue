<script setup lang="ts">
import type { IndexesListResponse } from '~/types/api'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Indexes' })

const router = useRouter()
const { activeBrandId } = useActiveBrand()

const queryParams = computed(() => ({
  ...(activeBrandId.value ? { brand_id: activeBrandId.value } : {})
}))

const { data, status, refresh } = useFetch<IndexesListResponse>('/api/indexes', {
  query: queryParams,
  watch: [queryParams]
})

const indexes = computed(() => data.value?.indexes ?? [])
const isLoading = computed(() => status.value === 'pending')

// New index modal
const isNewIndexOpen = ref(false)
const newIndexName = ref('')
const newIndexNameError = ref('')
const isCreating = ref(false)

function openNewIndex() {
  newIndexName.value = ''
  newIndexNameError.value = ''
  isNewIndexOpen.value = true
}

async function confirmNewIndex() {
  const name = newIndexName.value.trim()
  if (!name) {
    newIndexNameError.value = 'Index name is required.'
    return
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    newIndexNameError.value = 'Only letters, numbers, hyphens, and underscores.'
    return
  }
  isCreating.value = true
  newIndexNameError.value = ''
  try {
    await $fetch('/api/indexes', { method: 'POST', body: { name } })
    isNewIndexOpen.value = false
    router.push(`/dashboard/indexes/${encodeURIComponent(name)}`)
  } catch (e: unknown) {
    newIndexNameError.value = (e as { data?: { message?: string } })?.data?.message ?? 'Failed to create index.'
  } finally {
    isCreating.value = false
  }
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(iso))
}
</script>

<template>
  <div>
    <div class="flex items-start justify-between mb-1">
      <h1
        class="text-[clamp(1.5rem,3vw,2rem)] font-display font-semibold text-text-base"
        style="text-wrap: balance"
      >
        Indexes
      </h1>
      <UButton
        label="New Index"
        icon="i-heroicons-plus"
        color="primary"
        size="sm"
        @click="openNewIndex"
      />
    </div>
    <p class="text-sm text-text-muted mb-6 leading-relaxed">
      Custom record indexes for your AI-powered storefront.
    </p>

    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-3 mb-6">
      <DashboardBrandSelector />
      <span class="ml-auto text-xs text-text-muted tabular-nums">
        {{ indexes.length }} index{{ indexes.length === 1 ? '' : 'es' }}
      </span>
    </div>

    <!-- Loading -->
    <template v-if="isLoading && indexes.length === 0">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <UCard
          v-for="i in 6"
          :key="i"
        >
          <div class="space-y-3">
            <motion
              as="div"
              class="h-5 w-1/2 rounded bg-surface-3"
              :animate="{ opacity: [0.4, 1, 0.4] }"
              :transition="{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }"
            />
            <motion
              as="div"
              class="h-4 w-1/3 rounded bg-surface-3"
              :animate="{ opacity: [0.4, 1, 0.4] }"
              :transition="{ repeat: Infinity, duration: 1.5, ease: 'easeInOut', delay: 0.1 }"
            />
            <motion
              as="div"
              class="h-3 w-2/3 rounded bg-surface-3"
              :animate="{ opacity: [0.4, 1, 0.4] }"
              :transition="{ repeat: Infinity, duration: 1.5, ease: 'easeInOut', delay: 0.2 }"
            />
          </div>
        </UCard>
      </div>
    </template>

    <!-- Index grid -->
    <template v-else-if="indexes.length > 0">
      <motion
        as="div"
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        :variants="{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.04 } }
        }"
        initial="hidden"
        animate="visible"
      >
        <motion
          v-for="index in indexes"
          :key="index.indexName"
          as="div"
          :variants="{
            hidden: { opacity: 0, y: 8 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } }
          }"
        >
          <NuxtLink :to="`/dashboard/indexes/${encodeURIComponent(index.indexName)}`">
            <UCard class="h-full flex flex-col hover:border-accent-violet/40 transition-colors cursor-pointer">
              <div class="flex items-start gap-2 min-w-0">
                <div class="w-9 h-9 rounded-lg bg-accent-violet/10 border border-accent-violet/20 flex items-center justify-center shrink-0">
                  <UIcon
                    name="i-heroicons-circle-stack"
                    class="w-4 h-4 text-accent-violet"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <h3
                    class="text-sm font-mono font-medium text-text-base truncate"
                    :title="index.indexName"
                  >
                    {{ index.indexName }}
                  </h3>
                  <p class="text-xs text-text-muted tabular-nums mt-0.5">
                    {{ index.count.toLocaleString() }} record{{ index.count === 1 ? '' : 's' }}
                  </p>
                </div>
              </div>
              <p class="text-xs text-text-subtle mt-3">
                Updated {{ formatDate(index.updatedAt) }}
              </p>
            </UCard>
          </NuxtLink>
        </motion>
      </motion>
    </template>

    <!-- Empty state -->
    <template v-else>
      <div class="flex flex-col items-center justify-center py-16 text-center">
        <div class="relative mb-6">
          <div
            class="absolute inset-0 rounded-full blur-xl opacity-30"
            style="background: radial-gradient(circle, rgba(124,58,237,0.4) 0%, transparent 70%)"
            aria-hidden="true"
          />
          <div class="relative w-14 h-14 rounded-full bg-accent-violet/10 border border-accent-violet/20 flex items-center justify-center">
            <UIcon
              name="i-heroicons-circle-stack"
              class="w-6 h-6 text-accent-violet"
            />
          </div>
        </div>
        <h3 class="text-base font-display font-medium text-text-base mb-1">
          No indexes yet
        </h3>
        <p class="text-sm text-text-muted mb-2 max-w-sm">
          Push records via the API to create an index automatically, or create one manually to get the endpoint URL.
        </p>
        <p class="text-xs text-text-subtle font-mono bg-surface-2 border border-border-base rounded-lg px-3 py-2 mb-6 max-w-sm break-all">
          POST /api/indexes/:name/records/batch
        </p>
        <UButton
          label="New Index"
          icon="i-heroicons-plus"
          color="primary"
          size="md"
          @click="openNewIndex"
        />
      </div>
    </template>

    <!-- New Index Modal -->
    <UModal
      v-model:open="isNewIndexOpen"
      title="New Index"
      description="Choose a name for your index. Records can be pushed via API."
    >
      <template #body>
        <div class="space-y-1">
          <UFormField
            label="Index name"
            :error="newIndexNameError"
          >
            <UInput
              v-model="newIndexName"
              placeholder="e.g. products, articles, faq"
              autofocus
              class="font-mono"
              @keydown.enter="confirmNewIndex"
            />
          </UFormField>
          <p class="text-xs text-text-muted">
            Letters, numbers, hyphens, and underscores only.
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            @click="isNewIndexOpen = false"
          />
          <UButton
            label="Create"
            color="primary"
            :loading="isCreating"
            @click="confirmNewIndex"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
