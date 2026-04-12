<script setup lang="ts">
import type { IndexRecordsListResponse, IndexRecord } from '~/types/api'

type RecordWithoutSearchable = Omit<IndexRecord, 'searchable_text'>

definePageMeta({ layout: 'dashboard' })
const config = useRuntimeConfig()
const isDev = config.public.environment === 'development'
const route = useRoute()
const indexName = computed(() => decodeURIComponent(route.params.name as string))

useHead(() => ({ title: `Index: ${indexName.value}` }))

const search = ref('')
const page = ref(1)
const limit = 24

const debouncedSearch = useDebounce(search, 300)

const queryParams = computed(() => ({
  page: page.value,
  limit,
  ...(debouncedSearch.value ? { search: debouncedSearch.value } : {})
}))

const { data, status, refresh } = useFetch<IndexRecordsListResponse>(
  () => `/api/indexes/${encodeURIComponent(indexName.value)}/records`,
  {
    query: queryParams,
    watch: [queryParams]
  }
)

// Optimistic overrides: deletedIds and updatedFields applied on top of server data
const deletedIds = ref<Set<string>>(new Set())
const updatedMap = ref<Map<string, RecordWithoutSearchable>>(new Map())

const records = computed<RecordWithoutSearchable[]>(() => {
  const base = (data.value?.records ?? []) as RecordWithoutSearchable[]
  return base
    .filter(r => !deletedIds.value.has(r.id))
    .map(r => updatedMap.value.get(r.id) ?? r)
})

const total = computed(() => Math.max(0, (data.value?.total ?? 0) - deletedIds.value.size))
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit)))
const isLoading = computed(() => status.value === 'pending')

watch([debouncedSearch], () => {
  page.value = 1
  deletedIds.value.clear()
  updatedMap.value.clear()
})

watch(page, () => {
  deletedIds.value.clear()
  updatedMap.value.clear()
})

// Expanded fields map
const expandedCards = ref<Set<string>>(new Set())
function toggleExpand(objectId: string) {
  if (expandedCards.value.has(objectId)) {
    expandedCards.value.delete(objectId)
  } else {
    expandedCards.value.add(objectId)
  }
}

// Edit panel
const editPanelOpen = ref(false)
const editingRecord = ref<RecordWithoutSearchable | null>(null)

function openEdit(record: RecordWithoutSearchable) {
  editingRecord.value = record
  editPanelOpen.value = true
}

function onRecordUpdated(updated: RecordWithoutSearchable) {
  updatedMap.value.set(updated.id, updated)
}

// Delete confirm modal
const deleteModalOpen = ref(false)
const deletingRecord = ref<RecordWithoutSearchable | null>(null)
const isDeleting = ref(false)

function promptDelete(record: RecordWithoutSearchable) {
  deletingRecord.value = record
  deleteModalOpen.value = true
}

const { execute: executeDelete } = useFetch(
  () => `/api/indexes/${encodeURIComponent(indexName.value)}/records/${encodeURIComponent(deletingRecord.value?.object_id ?? '')}`,
  { method: 'DELETE', immediate: false, watch: false }
)

async function confirmDelete() {
  if (!deletingRecord.value) return
  isDeleting.value = true
  try {
    await executeDelete()
    deletedIds.value.add(deletingRecord.value.id)
    deleteModalOpen.value = false
  } finally {
    isDeleting.value = false
  }
}

function visibleFields(fields: Record<string, unknown>, objectId: string): [string, unknown][] {
  const entries = Object.entries(fields)
  if (expandedCards.value.has(objectId)) return entries
  return entries.slice(0, 4)
}

function hiddenCount(fields: Record<string, unknown>): number {
  return Math.max(0, Object.keys(fields).length - 4)
}

function displayValue(val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

// ─── Dev seed (dev mode only) ─────────────────────────────────────────────────
const isSeeding = ref(false)

const seedRecords = [
  {
    objectID: 'travel-kyoto-001',
    destination: 'Kyoto, Japan',
    duration_days: 7,
    price_usd: 2400,
    category: 'Cultural',
    tags: ['temples', 'spring', 'tea-ceremony'],
    best_season: 'Spring (March–May)',
    available: true
  },
  {
    objectID: 'travel-patagonia-002',
    destination: 'Patagonia, Argentina & Chile',
    duration_days: 14,
    price_usd: 4800,
    category: 'Adventure',
    tags: ['trekking', 'glaciers', 'wilderness'],
    best_season: 'Summer (Dec–Feb)',
    available: true
  },
  {
    objectID: 'travel-amalfi-003',
    destination: 'Amalfi Coast, Italy',
    duration_days: 10,
    price_usd: 3600,
    category: 'Leisure',
    tags: ['beach', 'food', 'boat-tours'],
    best_season: 'Summer (Jun–Aug)',
    available: true
  },
  {
    objectID: 'travel-marrakech-004',
    destination: 'Marrakech, Morocco',
    duration_days: 6,
    price_usd: 1800,
    category: 'Cultural',
    tags: ['souks', 'desert', 'architecture'],
    best_season: 'Autumn (Sep–Nov)',
    available: false
  },
  {
    objectID: 'travel-iceland-005',
    destination: 'Iceland Ring Road',
    duration_days: 12,
    price_usd: 5200,
    category: 'Adventure',
    tags: ['northern-lights', 'geysers', 'whale-watching'],
    best_season: 'Winter (Nov–Feb)',
    available: true
  }
]

const { activeBrandId } = useActiveBrand()

const { execute: executeSeed } = useFetch(
  () => `/api/indexes/${encodeURIComponent(indexName.value)}/records/batch`,
  {
    method: 'POST',
    body: seedRecords,
    query: { brand_id: activeBrandId },
    immediate: false,
    watch: false
  }
)

async function seedDevRecords() {
  isSeeding.value = true
  try {
    await executeSeed()
    await refresh()
  } finally {
    isSeeding.value = false
  }
}
</script>

<template>
  <div>
    <!-- Header with breadcrumb -->
    <nav
      aria-label="Breadcrumb"
      class="flex items-center gap-1.5 text-sm text-text-muted mb-1"
    >
      <NuxtLink
        to="/dashboard/indexes"
        class="hover:text-text-base transition-colors"
      >
        Indexes
      </NuxtLink>
      <UIcon
        name="i-heroicons-chevron-right"
        class="w-3.5 h-3.5"
      />
      <span class="font-mono text-text-base">{{ indexName }}</span>
    </nav>

    <h1
      class="text-[clamp(1.5rem,3vw,2rem)] font-display font-semibold text-text-base mb-1"
      style="text-wrap: balance"
    >
      {{ indexName }}
    </h1>
    <p class="text-sm text-text-muted mb-6 leading-relaxed">
      Browse and edit records in this index.
    </p>

    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-3 mb-6">
      <UInput
        v-model="search"
        placeholder="Search records…"
        icon="i-heroicons-magnifying-glass"
        size="sm"
        class="w-64"
        aria-label="Search records"
      />
      <span class="ml-auto text-xs text-text-muted tabular-nums">
        {{ total }} record{{ total === 1 ? '' : 's' }}
      </span>
      <UButton
        v-if="isDev"
        label="Seed 5 travel records"
        icon="i-heroicons-beaker"
        color="neutral"
        variant="ghost"
        size="sm"
        :loading="isSeeding"
        @click="seedDevRecords"
      />
    </div>

    <!-- Loading -->
    <template v-if="isLoading && records.length === 0">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <UCard
          v-for="i in 8"
          :key="i"
        >
          <div class="space-y-3">
            <motion
              as="div"
              class="h-4 w-2/3 rounded bg-surface-3"
              :animate="{ opacity: [0.4, 1, 0.4] }"
              :transition="{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }"
            />
            <motion
              as="div"
              class="h-3 w-full rounded bg-surface-3"
              :animate="{ opacity: [0.4, 1, 0.4] }"
              :transition="{ repeat: Infinity, duration: 1.5, ease: 'easeInOut', delay: 0.1 }"
            />
            <motion
              as="div"
              class="h-3 w-4/5 rounded bg-surface-3"
              :animate="{ opacity: [0.4, 1, 0.4] }"
              :transition="{ repeat: Infinity, duration: 1.5, ease: 'easeInOut', delay: 0.2 }"
            />
            <motion
              as="div"
              class="h-3 w-3/5 rounded bg-surface-3"
              :animate="{ opacity: [0.4, 1, 0.4] }"
              :transition="{ repeat: Infinity, duration: 1.5, ease: 'easeInOut', delay: 0.3 }"
            />
          </div>
        </UCard>
      </div>
    </template>

    <!-- Records grid -->
    <template v-else-if="records.length > 0">
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
          v-for="record in records"
          :key="record.id"
          as="div"
          :variants="{
            hidden: { opacity: 0, y: 8 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } }
          }"
        >
          <UCard class="h-full flex flex-col relative group">
            <!-- Action buttons top-right -->
            <div class="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity z-10">
              <UButton
                icon="i-heroicons-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="Edit record"
                @click.stop="openEdit(record)"
              />
              <UButton
                icon="i-heroicons-trash"
                color="error"
                variant="ghost"
                size="xs"
                aria-label="Delete record"
                @click.stop="promptDelete(record)"
              />
            </div>

            <!-- Clickable body -->
            <button
              class="flex-1 text-left min-w-0 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet rounded-lg"
              :aria-label="`Edit record ${record.object_id}`"
              @click="openEdit(record)"
            >
              <!-- objectID heading -->
              <h3
                class="text-sm font-mono font-medium text-text-base truncate pr-14 mb-2"
                :title="record.object_id"
              >
                {{ record.object_id }}
              </h3>

              <!-- Fields -->
              <dl class="space-y-1">
                <div
                  v-for="[key, val] in visibleFields(record.fields, record.object_id)"
                  :key="key"
                  class="flex gap-1.5 min-w-0"
                >
                  <dt class="text-xs text-text-muted shrink-0 font-mono truncate max-w-[40%]">
                    {{ key }}
                  </dt>
                  <dd class="text-xs text-text-base truncate min-w-0">
                    {{ displayValue(val) }}
                  </dd>
                </div>
              </dl>

              <!-- Expand toggle -->
              <button
                v-if="hiddenCount(record.fields) > 0 && !expandedCards.has(record.object_id)"
                class="text-xs text-accent-violet hover:underline mt-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-violet rounded"
                @click.stop="toggleExpand(record.object_id)"
              >
                {{ hiddenCount(record.fields) }} more field{{ hiddenCount(record.fields) === 1 ? '' : 's' }}
              </button>
              <button
                v-else-if="expandedCards.has(record.object_id)"
                class="text-xs text-accent-violet hover:underline mt-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-violet rounded"
                @click.stop="toggleExpand(record.object_id)"
              >
                Show less
              </button>
            </button>
          </UCard>
        </motion>
      </motion>

      <!-- Pagination -->
      <div
        v-if="totalPages > 1"
        class="flex justify-center mt-8"
      >
        <UPagination
          v-model="page"
          :total="total"
          :items-per-page="limit"
          size="sm"
        />
      </div>
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
          No records found
        </h3>
        <p
          v-if="search"
          class="text-sm text-text-muted mb-6 max-w-xs"
        >
          No records match <strong>{{ search }}</strong>. Try a different search term.
        </p>
        <p
          v-else
          class="text-sm text-text-muted mb-2 max-w-sm"
        >
          Push records to this index via the API to get started.
        </p>
        <p
          v-if="!search"
          class="text-xs text-text-subtle font-mono bg-surface-2 border border-border-base rounded-lg px-3 py-2 max-w-sm break-all"
        >
          POST /api/indexes/{{ indexName }}/records/batch
        </p>
      </div>
    </template>

    <!-- Record Edit Slide-over -->
    <DashboardRecordEditPanel
      v-model:open="editPanelOpen"
      :index-name="indexName"
      :record="editingRecord"
      @updated="onRecordUpdated"
    />

    <!-- Delete Confirm Modal -->
    <UModal
      v-model:open="deleteModalOpen"
      title="Delete record"
      :description="`Delete record &quot;${deletingRecord?.object_id}&quot;? This cannot be undone.`"
    >
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            @click="deleteModalOpen = false"
          />
          <UButton
            label="Delete"
            color="error"
            :loading="isDeleting"
            @click="confirmDelete"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
