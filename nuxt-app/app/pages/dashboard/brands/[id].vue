<script setup lang="ts">
import type {
  BrandWithCounts,
  CrawlJob,
  CrawlJobsResponse,
  IndexesListResponse,
  IndexRecord,
  IndexRecordsListResponse,
  IndexSummary,
  BrandDomainMismatchError,
  ReassignCrawlBrandResponse
} from '~/types/api'

type RecordItem = Omit<IndexRecord, 'searchable_text'>

definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const brandId = computed(() => String(route.params.id))

const { brands, isLoading: brandsLoading, updateBrand, deleteBrand, refresh: refreshBrands } = useBrands()

const brand = computed<BrandWithCounts | null>(() => {
  return brands.value.find(b => b.id === brandId.value) ?? null
})

// Wait for brands fetch to complete before throwing 404, so we don't
// bail out during the initial pending state.
watchEffect(() => {
  if (!brandsLoading.value && !brand.value) {
    throw createError({ statusCode: 404, statusMessage: 'Brand not found' })
  }
})

useHead({
  title: () => brand.value ? `${brand.value.name} · Brand` : 'Brand'
})

// ─── Tabs ────────────────────────────────────────────────────
interface TabItem {
  label: string
  value: string
  icon: string
  slot: string
}

const tabItems: TabItem[] = [
  { label: 'Overview', value: 'overview', icon: 'i-heroicons-information-circle', slot: 'overview' },
  { label: 'Indexes', value: 'indexes', icon: 'i-heroicons-circle-stack', slot: 'indexes' },
  { label: 'Crawls', value: 'crawls', icon: 'i-heroicons-arrow-path', slot: 'crawls' },
  { label: 'Products', value: 'products', icon: 'i-heroicons-shopping-bag', slot: 'products' },
  { label: 'FAQ', value: 'faq', icon: 'i-heroicons-question-mark-circle', slot: 'faq' },
  { label: 'Support', value: 'support', icon: 'i-heroicons-lifebuoy', slot: 'support' }
]

// ─── Overview: edit/delete ───────────────────────────────────
const editName = ref('')
const editDomains = ref<string[]>([])
const editDomainInput = ref('')
const editDescription = ref('')
const editLogoUrl = ref('')
const isSaving = ref(false)

// Hydrate edit fields whenever the resolved brand changes.
watch(brand, (b) => {
  if (!b) return
  editName.value = b.name
  editDomains.value = [...(b.domains ?? [])]
  editDescription.value = b.description ?? ''
  editLogoUrl.value = b.logo_url ?? ''
}, { immediate: true })

function normalizeDomainEntry(raw: string): string {
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed) return ''
  let host = trimmed
  if (/^[a-z]+:\/\//.test(host)) {
    try {
      host = new URL(host).hostname
    } catch {
      // fall through
    }
  }
  host = (host.split('/')[0] ?? '').split('?')[0] ?? ''
  host = (host.split('#')[0] ?? '')
  return host.replace(/^www\./, '')
}

function addDomain() {
  const norm = normalizeDomainEntry(editDomainInput.value)
  if (!norm) {
    editDomainInput.value = ''
    return
  }
  if (editDomains.value.includes(norm)) {
    editDomainInput.value = ''
    return
  }
  editDomains.value = [...editDomains.value, norm]
  editDomainInput.value = ''
}

function removeDomain(idx: number) {
  editDomains.value = editDomains.value.filter((_, i) => i !== idx)
}

async function handleSave() {
  if (!brand.value || !editName.value.trim()) return
  isSaving.value = true
  try {
    await updateBrand(brand.value.id, {
      name: editName.value.trim(),
      domains: editDomains.value,
      description: editDescription.value.trim() || undefined,
      logo_url: editLogoUrl.value.trim() || undefined
    })
  } catch {
    // handled by composable toast
  } finally {
    isSaving.value = false
  }
}

function useExtractedDescription() {
  if (brand.value?.extracted_description) {
    editDescription.value = brand.value.extracted_description
  }
}

const showDeleteConfirm = ref(false)
async function confirmDelete() {
  if (!brand.value) return
  await deleteBrand(brand.value.id)
  showDeleteConfirm.value = false
  await navigateTo('/dashboard/brands')
}

// ─── Indexes tab ─────────────────────────────────────────────
const { data: indexesData, status: indexesStatus } = useFetch<IndexesListResponse>('/api/indexes', {
  lazy: true
})
const indexes = computed<IndexSummary[]>(() => indexesData.value?.indexes ?? [])
const indexesLoading = computed(() => indexesStatus.value === 'pending')

function formatIndexDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(iso))
}

// ─── Crawls tab ──────────────────────────────────────────────
const { data: jobsData, status: jobsStatus, refresh: refreshJobs } = useFetch<CrawlJobsResponse>('/api/crawl/jobs', {
  lazy: true
})
const brandJobs = computed<CrawlJob[]>(() => {
  return (jobsData.value?.jobs ?? []).filter(j => j.brand_id === brandId.value)
})
const jobsLoading = computed(() => jobsStatus.value === 'pending')

const historyColumns = [
  { accessorKey: 'url', header: 'URL' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'pages_crawled', header: 'Pages' },
  { accessorKey: 'created_at', header: 'Started' },
  { accessorKey: 'actions', header: '' }
]

const statusColor = (s: string) => ({
  pending: 'neutral' as const,
  running: 'primary' as const,
  completed: 'success' as const,
  failed: 'error' as const
})[s] ?? 'neutral' as const

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(dateStr))
}

// ─── Reassign modal ──────────────────────────────────────────
const reassignOpen = ref(false)
const reassignJob = ref<CrawlJob | null>(null)
const reassignTargetId = ref<string>('')
const reassignError = ref<string | null>(null)
const isReassigning = ref(false)

function crawlJobRootDomain(job: CrawlJob | null): string | null {
  if (!job) return null
  try {
    return new URL(job.url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

const reassignCandidates = computed(() => {
  const rootDomain = crawlJobRootDomain(reassignJob.value)
  return brands.value
    .filter((b) => {
      if (b.id === brandId.value) return false
      const domains = b.domains ?? []
      if (domains.length === 0) return true
      if (!rootDomain) return true
      return domains.includes(rootDomain)
    })
    .map(b => ({
      label: b.domains?.length ? `${b.name} (${b.domains.join(', ')})` : b.name,
      value: b.id
    }))
})

function openReassign(job: CrawlJob) {
  reassignJob.value = job
  reassignTargetId.value = ''
  reassignError.value = null
  reassignOpen.value = true
}

function closeReassign() {
  reassignOpen.value = false
  reassignJob.value = null
  reassignTargetId.value = ''
  reassignError.value = null
}

async function confirmReassign() {
  if (!reassignJob.value || !reassignTargetId.value) return
  isReassigning.value = true
  reassignError.value = null
  try {
    const result = await $fetch<ReassignCrawlBrandResponse>(
      `/api/crawl/jobs/${reassignJob.value.id}/reassign-brand`,
      {
        method: 'POST',
        body: { target_brand_id: reassignTargetId.value }
      }
    )
    const target = brands.value.find(b => b.id === result.target_brand_id)
    const targetName = target?.name ?? 'target brand'
    toast.add({
      title: 'Crawl reassigned',
      description: `Moved ${result.counts.pages} pages / ${result.counts.chunks} chunks / ${result.counts.records} records to ${targetName}`,
      color: 'success'
    })
    closeReassign()
    await Promise.all([refreshJobs(), refreshBrands()])
    await router.push(`/dashboard/brands/${result.target_brand_id}`)
  } catch (err: unknown) {
    const data = (err as { data?: BrandDomainMismatchError }).data
    if (data?.code === 'brand_domain_mismatch') {
      reassignError.value = data.message
    } else {
      const message = (err as { data?: { message?: string } }).data?.message ?? 'Failed to reassign crawl.'
      toast.add({ title: 'Error', description: message, color: 'error' })
    }
  } finally {
    isReassigning.value = false
  }
}

// ─── Products tab ────────────────────────────────────────────
const productsSearch = ref('')
const debouncedProductsSearch = useDebounce(productsSearch, 300)
const productsQuery = computed(() => ({
  brand_id: brandId.value,
  limit: 100,
  ...(debouncedProductsSearch.value ? { search: debouncedProductsSearch.value } : {})
}))

const {
  data: productsData,
  status: productsStatus,
  refresh: refreshProducts
} = useFetch<IndexRecordsListResponse>('/api/indexes/products/records', {
  query: productsQuery,
  watch: [productsQuery],
  lazy: true
})

const brandProducts = computed<RecordItem[]>(() => productsData.value?.records ?? [])
const productsLoading = computed(() => productsStatus.value === 'pending')

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
    currency: currency || 'USD'
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

// ─── FAQ tab ─────────────────────────────────────────────────
const faqQuery = computed(() => ({ brand_id: brandId.value, limit: 100 }))
const {
  data: faqData,
  status: faqStatus,
  refresh: refreshFaq
} = useFetch<IndexRecordsListResponse>('/api/indexes/faq/records', {
  query: faqQuery,
  watch: [faqQuery],
  lazy: true
})
const faqRecords = computed<RecordItem[]>(() => faqData.value?.records ?? [])
const faqLoading = computed(() => faqStatus.value === 'pending')

// ─── Support tab ─────────────────────────────────────────────
const supportQuery = computed(() => ({ brand_id: brandId.value, limit: 100 }))
const {
  data: supportData,
  status: supportStatus,
  refresh: refreshSupport
} = useFetch<IndexRecordsListResponse>('/api/indexes/support/records', {
  query: supportQuery,
  watch: [supportQuery],
  lazy: true
})
const supportRecords = computed<RecordItem[]>(() => supportData.value?.records ?? [])
const supportLoading = computed(() => supportStatus.value === 'pending')

type PolicyType = 'shipping' | 'returns' | 'warranty' | 'privacy' | 'terms' | 'contact' | 'other'

const POLICY_COLOR: Record<PolicyType, 'info' | 'primary' | 'warning' | 'error' | 'neutral' | 'success'> = {
  shipping: 'info',
  returns: 'primary',
  warranty: 'warning',
  privacy: 'error',
  terms: 'neutral',
  contact: 'success',
  other: 'neutral'
}

function policyColor(type: unknown) {
  if (typeof type !== 'string') return 'neutral' as const
  return POLICY_COLOR[type as PolicyType] ?? 'neutral'
}

// ─── Record edit panel ──────────────────────────────────────
const selectedRecord = ref<RecordItem | null>(null)
const selectedIndexName = ref<string>('products')
const panelOpen = ref(false)

function openRecord(record: RecordItem, indexName: string) {
  selectedRecord.value = record
  selectedIndexName.value = indexName
  panelOpen.value = true
}

async function handleRecordUpdated() {
  if (selectedIndexName.value === 'products') await refreshProducts()
  else if (selectedIndexName.value === 'faq') await refreshFaq()
  else if (selectedIndexName.value === 'support') await refreshSupport()
}
</script>

<template>
  <div v-if="brand">
    <!-- Header -->
    <div class="flex items-start gap-4 mb-2">
      <NuxtLink
        to="/dashboard/brands"
        class="mt-1 text-text-muted hover:text-text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet rounded-lg"
        aria-label="Back to brands"
      >
        <UIcon
          name="i-heroicons-arrow-left"
          class="w-5 h-5"
        />
      </NuxtLink>
      <div
        v-if="brand.logo_url"
        class="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-surface-2"
      >
        <img
          :src="brand.logo_url"
          :alt="brand.name"
          width="48"
          height="48"
          class="w-full h-full object-cover"
        >
      </div>
      <div
        v-else
        class="w-12 h-12 rounded-xl bg-accent-violet/10 border border-accent-violet/20 flex items-center justify-center shrink-0"
      >
        <UIcon
          name="i-heroicons-building-storefront"
          class="w-6 h-6 text-accent-violet"
        />
      </div>
      <div class="flex-1 min-w-0">
        <h1
          class="text-[clamp(1.5rem,3vw,2rem)] font-display font-semibold text-text-base truncate"
          style="text-wrap: balance"
        >
          {{ brand.name }}
        </h1>
        <p
          v-if="brand.domains && brand.domains.length > 0"
          class="text-sm text-text-muted font-mono truncate"
        >
          {{ brand.domains.join(', ') }}
        </p>
      </div>
      <div class="flex gap-2 shrink-0">
        <UBadge
          variant="subtle"
          color="primary"
          size="sm"
        >
          {{ brand.product_count }} products
        </UBadge>
        <UBadge
          variant="subtle"
          color="neutral"
          size="sm"
        >
          {{ brand.chunk_count }} chunks
        </UBadge>
      </div>
    </div>

    <!-- Tabs -->
    <UTabs
      :items="tabItems"
      variant="pill"
      size="sm"
      class="w-full mt-6"
    >
      <!-- ─── Overview ───────────────────────────────────── -->
      <template #overview>
        <div class="mt-4 max-w-2xl">
          <UCard>
            <form
              class="space-y-4"
              @submit.prevent="handleSave"
            >
              <div>
                <label
                  for="brand-edit-name"
                  class="text-sm font-medium text-text-base mb-1 block"
                >
                  Brand name
                </label>
                <UInput
                  id="brand-edit-name"
                  v-model="editName"
                  size="md"
                />
              </div>

              <!-- Multi-domain input -->
              <div>
                <label
                  for="brand-edit-domain-input"
                  class="text-sm font-medium text-text-base mb-1 block"
                >
                  Domains
                </label>
                <div
                  v-if="editDomains.length > 0"
                  class="flex flex-wrap gap-1.5 mb-2"
                >
                  <UBadge
                    v-for="(dom, i) in editDomains"
                    :key="dom"
                    variant="subtle"
                    :color="i === 0 ? 'primary' : 'neutral'"
                    size="md"
                    class="gap-1 font-mono"
                  >
                    <span>{{ dom }}</span>
                    <button
                      type="button"
                      class="inline-flex items-center justify-center rounded hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-violet"
                      :aria-label="`Remove domain ${dom}`"
                      @click="removeDomain(i)"
                    >
                      <UIcon
                        name="i-heroicons-x-mark"
                        class="w-3.5 h-3.5"
                      />
                    </button>
                  </UBadge>
                </div>
                <div class="flex gap-2">
                  <UInput
                    id="brand-edit-domain-input"
                    v-model="editDomainInput"
                    placeholder="mybrand.com"
                    size="md"
                    class="flex-1"
                    @keydown.enter.prevent="addDomain"
                  />
                  <UButton
                    type="button"
                    label="Add"
                    icon="i-heroicons-plus"
                    variant="outline"
                    color="neutral"
                    size="md"
                    :disabled="!editDomainInput.trim()"
                    @click="addDomain"
                  />
                </div>
                <p class="text-xs text-text-muted mt-1 leading-relaxed">
                  First domain is the primary — used for display. Add more if this brand spans
                  multiple domains (e.g. odysway.com + odysway.fr).
                </p>
              </div>

              <div>
                <div>
                  <label
                    for="brand-edit-description"
                    class="text-sm font-medium text-text-base mb-1 block"
                  >
                    Description
                  </label>
                  <UTextarea
                    id="brand-edit-description"
                    v-model="editDescription"
                    placeholder="Describe this brand for the AI assistant…"
                    :rows="6"
                    class="w-full"
                    size="md"
                  />
                </div>
                <div
                  v-if="brand.extracted_description && brand.extracted_description !== editDescription"
                  class="mt-6 p-2 rounded-lg bg-accent-violet/5 border border-accent-violet/20"
                >
                  <p class="text-xs text-text-muted mb-1">
                    AI suggestion:
                  </p>
                  <p class="text-xs text-text-base line-clamp-3">
                    {{ brand.extracted_description }}
                  </p>
                  <UButton
                    label="Use this"
                    variant="ghost"
                    color="primary"
                    size="xs"
                    class="mt-1"
                    @click="useExtractedDescription"
                  />
                </div>
              </div>
              <div>
                <label
                  for="brand-edit-logo"
                  class="text-sm font-medium text-text-base mb-1 block"
                >
                  Logo URL
                </label>
                <UInput
                  id="brand-edit-logo"
                  v-model="editLogoUrl"
                  placeholder="https://…"
                  size="md"
                />
              </div>
              <div class="flex justify-between pt-2 border-t border-border-subtle">
                <UButton
                  label="Delete brand"
                  variant="ghost"
                  color="error"
                  size="sm"
                  icon="i-heroicons-trash"
                  @click="showDeleteConfirm = true"
                />
                <UButton
                  type="submit"
                  label="Save changes"
                  color="primary"
                  size="sm"
                  :loading="isSaving"
                  :disabled="!editName.trim()"
                />
              </div>
            </form>
          </UCard>
        </div>
      </template>

      <!-- ─── Indexes ────────────────────────────────────── -->
      <template #indexes>
        <div class="mt-4">
          <template v-if="indexesLoading && indexes.length === 0">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <UCard
                v-for="i in 3"
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
                    class="h-3 w-1/3 rounded bg-surface-3"
                    :animate="{ opacity: [0.4, 1, 0.4] }"
                    :transition="{ repeat: Infinity, duration: 1.5, ease: 'easeInOut', delay: 0.1 }"
                  />
                </div>
              </UCard>
            </div>
          </template>
          <template v-else-if="indexes.length > 0">
            <motion
              as="div"
              class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
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
                      Updated {{ formatIndexDate(index.updatedAt) }}
                    </p>
                  </UCard>
                </NuxtLink>
              </motion>
            </motion>
          </template>
          <template v-else>
            <div class="flex flex-col items-center justify-center py-12 text-center">
              <div class="w-12 h-12 rounded-full bg-accent-violet/10 border border-accent-violet/20 flex items-center justify-center mb-3">
                <UIcon
                  name="i-heroicons-circle-stack"
                  class="w-5 h-5 text-accent-violet"
                />
              </div>
              <p class="text-sm text-text-muted">
                No indexes yet.
              </p>
            </div>
          </template>
        </div>
      </template>

      <!-- ─── Crawls ─────────────────────────────────────── -->
      <template #crawls>
        <div class="mt-4">
          <template v-if="jobsLoading && brandJobs.length === 0">
            <UCard>
              <div class="space-y-2">
                <motion
                  v-for="i in 3"
                  :key="i"
                  as="div"
                  class="h-8 rounded bg-surface-3"
                  :animate="{ opacity: [0.4, 1, 0.4] }"
                  :transition="{ repeat: Infinity, duration: 1.5, ease: 'easeInOut', delay: i * 0.1 }"
                />
              </div>
            </UCard>
          </template>
          <UCard v-else-if="brandJobs.length > 0">
            <UTable
              :data="brandJobs"
              :columns="historyColumns"
            >
              <template #url-cell="{ row }">
                <span class="max-w-xs truncate block text-sm font-mono">{{ row.original.url }}</span>
              </template>
              <template #status-cell="{ row }">
                <UBadge
                  :color="statusColor(row.original.status)"
                  variant="subtle"
                  size="xs"
                >
                  {{ row.original.status }}
                </UBadge>
              </template>
              <template #pages_crawled-cell="{ row }">
                <span class="tabular-nums">{{ row.original.pages_crawled }}&nbsp;/&nbsp;{{ row.original.pages_found }}</span>
              </template>
              <template #created_at-cell="{ row }">
                <span class="text-text-muted text-xs">{{ formatDate(row.original.created_at) }}</span>
              </template>
              <template #actions-cell="{ row }">
                <div class="flex justify-end">
                  <UDropdownMenu
                    :items="[[
                      {
                        label: 'Reassign to brand…',
                        icon: 'i-heroicons-arrows-right-left',
                        onSelect: () => openReassign(row.original)
                      }
                    ]]"
                  >
                    <UButton
                      icon="i-heroicons-ellipsis-vertical"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      :aria-label="`Actions for crawl ${row.original.url}`"
                    />
                  </UDropdownMenu>
                </div>
              </template>
            </UTable>
          </UCard>
          <div
            v-else
            class="flex flex-col items-center justify-center py-12 text-center"
          >
            <div class="w-12 h-12 rounded-full bg-accent-violet/10 border border-accent-violet/20 flex items-center justify-center mb-3">
              <UIcon
                name="i-heroicons-arrow-path"
                class="w-5 h-5 text-accent-violet"
              />
            </div>
            <p class="text-sm text-text-muted mb-3">
              No crawls for this brand yet.
            </p>
            <UButton
              label="Start a crawl"
              icon="i-heroicons-arrow-path"
              to="/dashboard/crawl"
              color="primary"
              size="sm"
            />
          </div>
        </div>
      </template>

      <!-- ─── Products ───────────────────────────────────── -->
      <template #products>
        <div class="mt-4">
          <div class="flex flex-wrap items-center gap-3 mb-4">
            <UInput
              v-model="productsSearch"
              placeholder="Search products…"
              icon="i-heroicons-magnifying-glass"
              size="sm"
              class="w-56"
              aria-label="Search products"
            />
            <span class="ml-auto text-xs text-text-muted tabular-nums">
              {{ brandProducts.length }} shown
            </span>
          </div>

          <template v-if="productsLoading && brandProducts.length === 0">
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
                </div>
              </UCard>
            </div>
          </template>
          <template v-else-if="brandProducts.length > 0">
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
                v-for="record in brandProducts"
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
                  @click="openRecord(record, 'products')"
                  @keydown.enter.prevent="openRecord(record, 'products')"
                  @keydown.space.prevent="openRecord(record, 'products')"
                >
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
                  <div class="flex-1 min-w-0">
                    <h3 class="text-sm font-medium text-text-base truncate">
                      {{ record.fields.name as string }}
                    </h3>
                    <p class="text-base font-display font-semibold text-text-base tabular-nums mt-1">
                      {{ formatPrice(record.fields.price as number | null, record.fields.currency as string) }}
                    </p>
                  </div>
                  <div class="flex flex-wrap gap-1.5 mt-3">
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
          </template>
          <template v-else>
            <div class="flex flex-col items-center justify-center py-12 text-center">
              <div class="w-12 h-12 rounded-full bg-accent-violet/10 border border-accent-violet/20 flex items-center justify-center mb-3">
                <UIcon
                  name="i-heroicons-shopping-bag"
                  class="w-5 h-5 text-accent-violet"
                />
              </div>
              <p class="text-sm text-text-muted">
                No products for this brand yet.
              </p>
            </div>
          </template>
        </div>
      </template>

      <!-- ─── FAQ ────────────────────────────────────────── -->
      <template #faq>
        <div class="mt-4">
          <template v-if="faqLoading && faqRecords.length === 0">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <UCard
                v-for="i in 6"
                :key="i"
              >
                <div class="space-y-3">
                  <motion
                    as="div"
                    class="h-4 w-3/4 rounded bg-surface-3"
                    :animate="{ opacity: [0.4, 1, 0.4] }"
                    :transition="{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }"
                  />
                  <motion
                    as="div"
                    class="h-3 w-full rounded bg-surface-3"
                    :animate="{ opacity: [0.4, 1, 0.4] }"
                    :transition="{ repeat: Infinity, duration: 1.5, ease: 'easeInOut', delay: 0.1 }"
                  />
                </div>
              </UCard>
            </div>
          </template>
          <template v-else-if="faqRecords.length > 0">
            <motion
              as="div"
              class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              :variants="{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { staggerChildren: 0.04 } }
              }"
              initial="hidden"
              animate="visible"
            >
              <motion
                v-for="record in faqRecords"
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
                  :aria-label="`Edit FAQ ${(record.fields.question as string) || 'record'}`"
                  @click="openRecord(record, 'faq')"
                  @keydown.enter.prevent="openRecord(record, 'faq')"
                  @keydown.space.prevent="openRecord(record, 'faq')"
                >
                  <h3
                    class="text-sm font-semibold text-text-base line-clamp-2"
                    style="text-wrap: balance"
                  >
                    {{ (record.fields.question as string) || 'Untitled question' }}
                  </h3>
                  <p class="text-xs text-text-muted line-clamp-3 mt-2 leading-relaxed">
                    {{ (record.fields.answer as string) || '' }}
                  </p>
                  <div class="flex flex-wrap gap-1.5 mt-3">
                    <UBadge
                      v-if="record.fields.topic"
                      variant="subtle"
                      color="primary"
                      size="xs"
                    >
                      {{ record.fields.topic as string }}
                    </UBadge>
                  </div>
                </UCard>
              </motion>
            </motion>
          </template>
          <template v-else>
            <div class="flex flex-col items-center justify-center py-12 text-center">
              <div class="w-12 h-12 rounded-full bg-accent-violet/10 border border-accent-violet/20 flex items-center justify-center mb-3">
                <UIcon
                  name="i-heroicons-question-mark-circle"
                  class="w-5 h-5 text-accent-violet"
                />
              </div>
              <p class="text-sm text-text-muted">
                No FAQ records for this brand yet.
              </p>
            </div>
          </template>
        </div>
      </template>

      <!-- ─── Support ────────────────────────────────────── -->
      <template #support>
        <div class="mt-4">
          <template v-if="supportLoading && supportRecords.length === 0">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <UCard
                v-for="i in 6"
                :key="i"
              >
                <div class="space-y-3">
                  <motion
                    as="div"
                    class="h-4 w-3/4 rounded bg-surface-3"
                    :animate="{ opacity: [0.4, 1, 0.4] }"
                    :transition="{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }"
                  />
                  <motion
                    as="div"
                    class="h-3 w-full rounded bg-surface-3"
                    :animate="{ opacity: [0.4, 1, 0.4] }"
                    :transition="{ repeat: Infinity, duration: 1.5, ease: 'easeInOut', delay: 0.1 }"
                  />
                </div>
              </UCard>
            </div>
          </template>
          <template v-else-if="supportRecords.length > 0">
            <motion
              as="div"
              class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              :variants="{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { staggerChildren: 0.04 } }
              }"
              initial="hidden"
              animate="visible"
            >
              <motion
                v-for="record in supportRecords"
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
                  :aria-label="`Edit support ${(record.fields.topic as string) || 'record'}`"
                  @click="openRecord(record, 'support')"
                  @keydown.enter.prevent="openRecord(record, 'support')"
                  @keydown.space.prevent="openRecord(record, 'support')"
                >
                  <div class="flex items-start justify-between gap-2">
                    <h3 class="text-sm font-semibold text-text-base line-clamp-2 flex-1 min-w-0">
                      {{ (record.fields.topic as string) || 'Untitled topic' }}
                    </h3>
                    <UBadge
                      v-if="record.fields.policy_type"
                      :color="policyColor(record.fields.policy_type)"
                      variant="subtle"
                      size="xs"
                      class="shrink-0"
                    >
                      {{ record.fields.policy_type as string }}
                    </UBadge>
                  </div>
                  <p class="text-xs text-text-muted line-clamp-3 mt-2 leading-relaxed">
                    {{ (record.fields.body as string) || '' }}
                  </p>
                </UCard>
              </motion>
            </motion>
          </template>
          <template v-else>
            <div class="flex flex-col items-center justify-center py-12 text-center">
              <div class="w-12 h-12 rounded-full bg-accent-violet/10 border border-accent-violet/20 flex items-center justify-center mb-3">
                <UIcon
                  name="i-heroicons-lifebuoy"
                  class="w-5 h-5 text-accent-violet"
                />
              </div>
              <p class="text-sm text-text-muted">
                No support records for this brand yet.
              </p>
            </div>
          </template>
        </div>
      </template>
    </UTabs>

    <!-- Record edit panel -->
    <DashboardRecordEditPanel
      v-model:open="panelOpen"
      :record="selectedRecord"
      :index-name="selectedIndexName"
      @updated="handleRecordUpdated"
    />

    <!-- Reassign crawl modal -->
    <UModal
      v-model:open="reassignOpen"
      title="Reassign crawl to another brand"
      :dismissible="!isReassigning"
    >
      <template #body>
        <div
          v-if="reassignJob"
          class="space-y-4"
        >
          <div class="rounded-lg border border-border-subtle bg-surface-2 p-3 text-xs font-mono text-text-muted space-y-1">
            <div class="flex justify-between gap-4">
              <span class="text-text-subtle">Source brand</span>
              <span class="text-text-base truncate">{{ brand?.name }}</span>
            </div>
            <div class="flex justify-between gap-4">
              <span class="text-text-subtle">Crawl URL</span>
              <span class="text-text-base truncate">{{ reassignJob.url }}</span>
            </div>
            <div class="flex justify-between gap-4">
              <span class="text-text-subtle">Pages / Chunks</span>
              <span class="text-text-base tabular-nums">
                {{ reassignJob.pages_crawled }} / {{ reassignJob.chunks_created }}
              </span>
            </div>
          </div>

          <div>
            <label
              for="reassign-target"
              class="text-sm font-medium text-text-base mb-1 block"
            >
              Target brand
            </label>
            <USelect
              id="reassign-target"
              v-model="reassignTargetId"
              :items="reassignCandidates"
              value-key="value"
              label-key="label"
              placeholder="Select a brand…"
              size="md"
              class="w-full"
              :disabled="isReassigning"
            />
            <p
              v-if="reassignCandidates.length === 0"
              class="text-xs text-text-muted mt-2"
            >
              No eligible brands. Create a brand that owns the crawl's domain first.
            </p>
          </div>

          <p
            v-if="reassignError"
            class="text-xs text-error-500"
            role="alert"
          >
            {{ reassignError }}
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            :disabled="isReassigning"
            @click="closeReassign"
          />
          <UButton
            label="Reassign"
            icon="i-heroicons-arrows-right-left"
            color="primary"
            :loading="isReassigning"
            :disabled="!reassignTargetId || isReassigning"
            @click="confirmReassign"
          />
        </div>
      </template>
    </UModal>

    <!-- Delete confirmation -->
    <UModal
      v-model:open="showDeleteConfirm"
      title="Delete brand?"
    >
      <template #body>
        <p class="text-sm text-text-base">
          This will permanently delete
          <span class="font-semibold">{{ brand.name }}</span>.
          Crawled pages, chunks, and products for this brand will be detached
          from it. This action cannot be undone.
        </p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            @click="showDeleteConfirm = false"
          />
          <UButton
            label="Delete brand"
            color="error"
            icon="i-heroicons-trash"
            @click="confirmDelete"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
