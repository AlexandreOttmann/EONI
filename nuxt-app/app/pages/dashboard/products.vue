<script setup lang="ts">
import type { IndexRecord, IndexRecordsListResponse } from '~/types/api'

type ProductRecord = Omit<IndexRecord, 'searchable_text'>

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Products' })

const { activeBrandId } = useActiveBrand()
const { brands } = useBrands()

const search = ref('')
const category = ref('__all__')
const page = ref(1)
const limit = 24

const debouncedSearch = useDebounce(search, 300)

const queryParams = computed(() => ({
  ...(activeBrandId.value ? { brand_id: activeBrandId.value } : {}),
  ...(debouncedSearch.value ? { search: debouncedSearch.value } : {}),
  ...(category.value && category.value !== '__all__' ? { category: category.value } : {}),
  page: page.value,
  limit
}))

const { data, status, refresh } = useFetch<IndexRecordsListResponse>('/api/indexes/products/records', {
  query: queryParams,
  watch: [queryParams]
})

const products = computed(() => data.value?.records ?? [])
const total = computed(() => data.value?.total ?? 0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit)))
const isLoading = computed(() => status.value === 'pending')

// Fetch categories for filter
const { data: allRecords } = useFetch<IndexRecordsListResponse>('/api/indexes/products/records', {
  query: { limit: 100 },
  transform: d => d
})

const categories = computed(() => {
  const cats = new Set<string>()
  allRecords.value?.records.forEach((r) => {
    const cat = r.fields.category as string | undefined
    if (cat) cats.add(cat)
  })
  return Array.from(cats).sort()
})

const categoryOptions = computed(() => [
  { label: 'All Categories', value: '__all__' },
  ...categories.value.map(c => ({ label: c, value: c }))
])

// Reset page when filters change
watch([activeBrandId, debouncedSearch, category], () => {
  page.value = 1
})

const availabilityColor = (a: string) => ({
  in_stock: 'success' as const,
  out_of_stock: 'error' as const,
  preorder: 'warning' as const,
  unknown: 'neutral' as const
})[a] ?? 'neutral' as const

const availabilityLabel = (a: string) => ({
  in_stock: 'In Stock',
  out_of_stock: 'Out of Stock',
  preorder: 'Preorder',
  unknown: 'Unknown'
})[a] ?? a

function formatPrice(price: number | null, currency: string): string {
  if (price === null) return '--'
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency
  }).format(price)
}

function truncateUrl(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname.length > 30
      ? u.pathname.slice(0, 30) + '…'
      : u.pathname
    return u.hostname + path
  } catch {
    return url.slice(0, 40)
  }
}

// Record edit panel
const selectedRecord = ref<ProductRecord | null>(null)
const panelOpen = ref(false)
function openRecord(record: ProductRecord) {
  selectedRecord.value = record
  panelOpen.value = true
}

function brandNameFor(brandId: string | null): string | null {
  if (!brandId) return null
  return brands.value.find(b => b.id === brandId)?.name ?? null
}

async function handleRecordUpdated() {
  await refresh()
}
</script>

<template>
  <div>
    <h1
      class="text-[clamp(1.5rem,3vw,2rem)] font-display font-semibold text-text-base mb-1"
      style="text-wrap: balance"
    >
      Products
    </h1>
    <p class="text-sm text-text-muted mb-6 leading-relaxed">
      Browse products extracted from your crawled pages.
    </p>

    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-3 mb-6">
      <DashboardBrandSelector />
      <UInput
        v-model="search"
        placeholder="Search products…"
        icon="i-heroicons-magnifying-glass"
        size="sm"
        class="w-56"
        aria-label="Search products"
      />
      <USelect
        v-model="category"
        :items="categoryOptions"
        value-key="value"
        label-key="label"
        placeholder="Category"
        size="sm"
        class="w-44"
        aria-label="Filter by category"
      />
      <span class="ml-auto text-xs text-text-muted tabular-nums">
        {{ total }} products
      </span>
    </div>

    <!-- Loading -->
    <template v-if="isLoading && products.length === 0">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <UCard
          v-for="i in 8"
          :key="i"
        >
          <div class="space-y-3">
            <motion
              as="div"
              class="w-full h-32 rounded-lg bg-surface-3"
              :animate="{ opacity: [0.4, 1, 0.4] }"
              :transition="{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }"
            />
            <motion
              as="div"
              class="h-4 w-3/4 rounded bg-surface-3"
              :animate="{ opacity: [0.4, 1, 0.4] }"
              :transition="{ repeat: Infinity, duration: 1.5, ease: 'easeInOut', delay: 0.1 }"
            />
            <motion
              as="div"
              class="h-3 w-1/2 rounded bg-surface-3"
              :animate="{ opacity: [0.4, 1, 0.4] }"
              :transition="{ repeat: Infinity, duration: 1.5, ease: 'easeInOut', delay: 0.2 }"
            />
          </div>
        </UCard>
      </div>
    </template>

    <!-- Product grid -->
    <template v-else-if="products.length > 0">
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
          v-for="record in products"
          :key="record.object_id"
          as="div"
          :variants="{
            hidden: { opacity: 0, y: 8 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } }
          }"
        >
          <UCard
            class="h-full flex flex-col cursor-pointer transition-shadow duration-300 hover:glow-violet"
            role="button"
            tabindex="0"
            :aria-label="`Edit ${record.fields.name as string}`"
            @click="openRecord(record)"
            @keydown.enter.prevent="openRecord(record)"
            @keydown.space.prevent="openRecord(record)"
          >
            <!-- Image -->
            <div class="w-full h-36 rounded-lg overflow-hidden bg-surface-2 mb-3 flex items-center justify-center">
              <img
                v-if="record.fields.image_url"
                :src="record.fields.image_url as string"
                :alt="record.fields.name as string"
                width="300"
                height="144"
                class="w-full h-full object-cover"
                loading="lazy"
              >
              <UIcon
                v-else
                name="i-heroicons-photo"
                class="w-10 h-10 text-text-subtle"
              />
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <h3 class="text-sm font-medium text-text-base truncate">
                {{ record.fields.name as string }}
              </h3>
              <p class="text-base font-display font-semibold text-text-base tabular-nums mt-1">
                {{ formatPrice(record.fields.price as number | null, record.fields.currency as string) }}
              </p>
            </div>

            <!-- Badges -->
            <div class="flex flex-wrap gap-1.5 mt-3">
              <UBadge
                v-if="brandNameFor(record.brand_id)"
                variant="subtle"
                color="neutral"
                size="xs"
                icon="i-heroicons-building-storefront"
              >
                {{ brandNameFor(record.brand_id) }}
              </UBadge>
              <UBadge
                v-if="record.fields.category"
                variant="subtle"
                color="primary"
                size="xs"
              >
                {{ record.fields.category as string }}
              </UBadge>
              <UBadge
                :color="availabilityColor(record.fields.availability as string)"
                variant="subtle"
                size="xs"
              >
                {{ availabilityLabel(record.fields.availability as string) }}
              </UBadge>
            </div>

            <!-- Source link -->
            <a
              :href="record.fields.source_url as string"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-2 text-xs text-text-muted hover:text-accent-violet truncate block transition-colors"
              @click.stop
            >
              {{ truncateUrl(record.fields.source_url as string) }}
            </a>
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
              name="i-heroicons-shopping-bag"
              class="w-6 h-6 text-accent-violet"
            />
          </div>
        </div>
        <h3 class="text-base font-display font-medium text-text-base mb-1">
          No products found
        </h3>
        <p class="text-sm text-text-muted mb-6 max-w-xs">
          Push products via the API or crawl a website to extract them.
        </p>
        <UButton
          label="Go to Crawl"
          to="/dashboard/crawl"
          color="primary"
          size="md"
        />
      </div>
    </template>

    <!-- Record edit panel -->
    <DashboardRecordEditPanel
      v-model:open="panelOpen"
      :record="selectedRecord"
      index-name="products"
      @updated="handleRecordUpdated"
    />
  </div>
</template>
