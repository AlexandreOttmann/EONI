<script setup lang="ts">
import type { IndexRecord } from '~/types/api'

type RecordWithoutSearchable = Omit<IndexRecord, 'searchable_text'>

interface FieldRow {
  key: string
  value: unknown
  isNew: boolean
}

type Layout = 'product' | 'faq' | 'support' | 'generic'

type PolicyType = 'shipping' | 'returns' | 'warranty' | 'privacy' | 'terms' | 'contact' | 'other'

const POLICY_ITEMS: Array<{ label: string, value: PolicyType }> = [
  { label: 'Shipping', value: 'shipping' },
  { label: 'Returns', value: 'returns' },
  { label: 'Warranty', value: 'warranty' },
  { label: 'Privacy', value: 'privacy' },
  { label: 'Terms', value: 'terms' },
  { label: 'Contact', value: 'contact' },
  { label: 'Other', value: 'other' }
]

const AVAILABILITY_ITEMS = [
  { label: 'In Stock', value: 'in_stock' },
  { label: 'Out of Stock', value: 'out_of_stock' },
  { label: 'Preorder', value: 'preorder' },
  { label: 'Unknown', value: 'unknown' }
]

const props = defineProps<{
  open: boolean
  indexName: string
  record: RecordWithoutSearchable | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'updated': [record: RecordWithoutSearchable]
}>()

const isSaving = ref(false)
const saveError = ref('')

const layout = computed<Layout>(() => {
  switch (props.indexName) {
    case 'products': return 'product'
    case 'faq': return 'faq'
    case 'support': return 'support'
    default: return 'generic'
  }
})

const { brands } = useBrands()
const recordBrandName = computed(() => {
  const brandId = props.record?.brand_id
  if (!brandId) return null
  return brands.value.find(b => b.id === brandId)?.name ?? null
})

// ─── Product state ──────────────────────────────────────────
const productName = ref('')
const productDescription = ref('')
const productPrice = ref<number | null>(null)
const productCurrency = ref('')
const productSku = ref('')
const productCategory = ref('')
const productImageUrl = ref('')
const productAvailability = ref('')
const productSourceUrl = ref('')

// ─── FAQ state ──────────────────────────────────────────────
const faqQuestion = ref('')
const faqAnswer = ref('')
const faqTopic = ref('')

// ─── Support state ──────────────────────────────────────────
const supportTopic = ref('')
const supportBody = ref('')
const supportPolicyType = ref<PolicyType>('other')

// ─── Generic key-value fallback ─────────────────────────────
const fieldRows = ref<FieldRow[]>([])

function toStr(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

function toNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

watch(
  () => [props.record, props.indexName] as const,
  () => {
    saveError.value = ''
    const r = props.record
    if (!r) {
      fieldRows.value = []
      return
    }
    const f = r.fields

    if (layout.value === 'product') {
      productName.value = toStr(f.name)
      productDescription.value = toStr(f.description)
      productPrice.value = toNumOrNull(f.price)
      productCurrency.value = toStr(f.currency) || 'USD'
      productSku.value = toStr(f.sku)
      productCategory.value = toStr(f.category)
      productImageUrl.value = toStr(f.image_url)
      productAvailability.value = toStr(f.availability) || 'unknown'
      productSourceUrl.value = toStr(f.source_url)
    } else if (layout.value === 'faq') {
      faqQuestion.value = toStr(f.question)
      faqAnswer.value = toStr(f.answer)
      faqTopic.value = toStr(f.topic)
    } else if (layout.value === 'support') {
      supportTopic.value = toStr(f.topic)
      supportBody.value = toStr(f.body)
      const pt = toStr(f.policy_type) as PolicyType
      supportPolicyType.value = POLICY_ITEMS.some(p => p.value === pt) ? pt : 'other'
    } else {
      fieldRows.value = Object.entries(f).map(([key, value]) => ({
        key,
        value,
        isNew: false
      }))
    }
  },
  { immediate: true }
)

// ─── Generic helpers ────────────────────────────────────────
function fieldInputType(value: unknown): 'textarea' | 'number' | 'checkbox' | 'text' {
  if (typeof value === 'boolean') return 'checkbox'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'string' && value.length > 80) return 'textarea'
  return 'text'
}

function removeField(index: number) {
  fieldRows.value.splice(index, 1)
}

function addField() {
  fieldRows.value.push({ key: '', value: '', isNew: true })
}

// ─── Save ───────────────────────────────────────────────────
function buildFields(): Record<string, unknown> {
  if (layout.value === 'product') {
    const fields: Record<string, unknown> = {
      name: productName.value.trim(),
      description: productDescription.value.trim() || null,
      price: productPrice.value,
      currency: productCurrency.value.trim() || 'USD',
      sku: productSku.value.trim() || null,
      category: productCategory.value.trim() || null,
      image_url: productImageUrl.value.trim() || null,
      availability: productAvailability.value || 'unknown',
      source_url: productSourceUrl.value.trim()
    }
    return fields
  }
  if (layout.value === 'faq') {
    const fields: Record<string, unknown> = {
      question: faqQuestion.value.trim(),
      answer: faqAnswer.value.trim()
    }
    if (faqTopic.value.trim()) fields.topic = faqTopic.value.trim()
    return fields
  }
  if (layout.value === 'support') {
    return {
      topic: supportTopic.value.trim(),
      body: supportBody.value.trim(),
      policy_type: supportPolicyType.value
    }
  }
  // Generic
  const fields: Record<string, unknown> = {}
  for (const row of fieldRows.value) {
    if (row.key.trim()) {
      fields[row.key.trim()] = row.value
    }
  }
  return fields
}

function canSave(): boolean {
  if (layout.value === 'product') return productName.value.trim().length > 0
  if (layout.value === 'faq') return faqQuestion.value.trim().length > 0 && faqAnswer.value.trim().length > 0
  if (layout.value === 'support') return supportTopic.value.trim().length > 0 && supportBody.value.trim().length > 0
  return true
}

async function save() {
  if (!props.record || !canSave()) return
  isSaving.value = true
  saveError.value = ''
  try {
    const partialFields = buildFields()
    await $fetch(
      `/api/indexes/${encodeURIComponent(props.indexName)}/records/${encodeURIComponent(props.record.object_id)}`,
      { method: 'PATCH', body: { fields: partialFields } }
    )
    // API returns {objectId, status} — construct an optimistic updated record.
    const mergedFields = { ...props.record.fields, ...partialFields }
    const updated: RecordWithoutSearchable = {
      ...props.record,
      fields: mergedFields,
      updated_at: new Date().toISOString()
    }
    emit('updated', updated)
    emit('update:open', false)
  } catch (e: unknown) {
    saveError.value = (e as { data?: { message?: string } })?.data?.message ?? 'Failed to save.'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <USlideover
    :open="open"
    title="Edit Record"
    @update:open="emit('update:open', $event)"
  >
    <template #header>
      <div class="min-w-0">
        <p class="text-xs text-text-muted font-mono">
          {{ indexName }}
        </p>
        <p
          class="text-sm font-mono font-semibold text-text-base truncate"
          :title="record?.object_id"
        >
          {{ record?.object_id }}
        </p>
      </div>
    </template>

    <template #body>
      <div
        v-if="record && indexName"
        class="space-y-4 p-4"
      >
        <!-- Brand chip (all layouts) -->
        <div v-if="recordBrandName">
          <UBadge
            variant="subtle"
            color="primary"
            size="sm"
            icon="i-heroicons-building-storefront"
          >
            {{ recordBrandName }}
          </UBadge>
        </div>

        <!-- ─── Product layout ────────────────────────── -->
        <template v-if="layout === 'product'">
          <div>
            <label
              for="rec-product-name"
              class="text-xs font-medium text-text-muted mb-1 block"
            >
              Name
            </label>
            <UInput
              id="rec-product-name"
              v-model="productName"
              size="sm"
            />
          </div>
          <div>
            <label
              for="rec-product-description"
              class="text-xs font-medium text-text-muted mb-1 block"
            >
              Description
            </label>
            <UTextarea
              id="rec-product-description"
              v-model="productDescription"
              :rows="4"
              size="sm"
              class="w-full"
            />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label
                for="rec-product-price"
                class="text-xs font-medium text-text-muted mb-1 block"
              >
                Price
              </label>
              <UInput
                id="rec-product-price"
                :model-value="productPrice === null ? '' : String(productPrice)"
                type="number"
                size="sm"
                @update:model-value="productPrice = toNumOrNull($event)"
              />
            </div>
            <div>
              <label
                for="rec-product-currency"
                class="text-xs font-medium text-text-muted mb-1 block"
              >
                Currency
              </label>
              <UInput
                id="rec-product-currency"
                v-model="productCurrency"
                size="sm"
                placeholder="USD"
              />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label
                for="rec-product-sku"
                class="text-xs font-medium text-text-muted mb-1 block"
              >
                SKU
              </label>
              <UInput
                id="rec-product-sku"
                v-model="productSku"
                size="sm"
              />
            </div>
            <div>
              <label
                for="rec-product-category"
                class="text-xs font-medium text-text-muted mb-1 block"
              >
                Category
              </label>
              <UInput
                id="rec-product-category"
                v-model="productCategory"
                size="sm"
              />
            </div>
          </div>
          <div>
            <label
              for="rec-product-availability"
              class="text-xs font-medium text-text-muted mb-1 block"
            >
              Availability
            </label>
            <USelect
              id="rec-product-availability"
              v-model="productAvailability"
              :items="AVAILABILITY_ITEMS"
              value-key="value"
              label-key="label"
              size="sm"
              class="w-full"
            />
          </div>
          <div>
            <label
              for="rec-product-image"
              class="text-xs font-medium text-text-muted mb-1 block"
            >
              Image URL
            </label>
            <UInput
              id="rec-product-image"
              v-model="productImageUrl"
              size="sm"
              placeholder="https://…"
            />
          </div>
          <div>
            <label
              for="rec-product-source"
              class="text-xs font-medium text-text-muted mb-1 block"
            >
              Source URL
            </label>
            <UInput
              id="rec-product-source"
              v-model="productSourceUrl"
              size="sm"
              placeholder="https://…"
            />
          </div>
        </template>

        <!-- ─── FAQ layout ────────────────────────────── -->
        <template v-else-if="layout === 'faq'">
          <div>
            <label
              for="rec-faq-question"
              class="text-xs font-medium text-text-muted mb-1 block"
            >
              Question
            </label>
            <UTextarea
              id="rec-faq-question"
              v-model="faqQuestion"
              :rows="2"
              size="sm"
              class="w-full"
              required
            />
          </div>
          <div>
            <label
              for="rec-faq-answer"
              class="text-xs font-medium text-text-muted mb-1 block"
            >
              Answer
            </label>
            <UTextarea
              id="rec-faq-answer"
              v-model="faqAnswer"
              :rows="8"
              size="sm"
              class="w-full"
              required
            />
          </div>
          <div>
            <label
              for="rec-faq-topic"
              class="text-xs font-medium text-text-muted mb-1 block"
            >
              Topic
            </label>
            <UInput
              id="rec-faq-topic"
              v-model="faqTopic"
              size="sm"
              placeholder="Optional"
            />
          </div>
        </template>

        <!-- ─── Support layout ────────────────────────── -->
        <template v-else-if="layout === 'support'">
          <div>
            <label
              for="rec-support-topic"
              class="text-xs font-medium text-text-muted mb-1 block"
            >
              Topic
            </label>
            <UInput
              id="rec-support-topic"
              v-model="supportTopic"
              size="sm"
              required
            />
          </div>
          <div>
            <label
              for="rec-support-policy-type"
              class="text-xs font-medium text-text-muted mb-1 block"
            >
              Policy type
            </label>
            <USelect
              id="rec-support-policy-type"
              v-model="supportPolicyType"
              :items="POLICY_ITEMS"
              value-key="value"
              label-key="label"
              size="sm"
              class="w-full"
            />
          </div>
          <div>
            <label
              for="rec-support-body"
              class="text-xs font-medium text-text-muted mb-1 block"
            >
              Content
            </label>
            <UTextarea
              id="rec-support-body"
              v-model="supportBody"
              :rows="10"
              size="sm"
              class="w-full"
              required
            />
          </div>
        </template>

        <!-- ─── Generic key-value fallback ────────────── -->
        <template v-else>
          <div
            v-for="(row, i) in fieldRows"
            :key="i"
            class="group flex items-start gap-2"
          >
            <div class="flex-1 flex flex-col min-w-0 space-y-2">
              <template v-if="row.isNew">
                <UInput
                  v-model="row.key"
                  placeholder="field name"
                  size="xs"
                  class="font-mono mb-2"
                  aria-label="Field name"
                />
              </template>
              <template v-else>
                <label class="text-xs font-mono text-text-muted pt-6">{{ row.key }}</label>
              </template>

              <template v-if="fieldInputType(row.value) === 'checkbox'">
                <UCheckbox
                  v-model="(row as FieldRow & { value: boolean }).value"
                  :label="row.key || 'value'"
                />
              </template>
              <template v-else-if="fieldInputType(row.value) === 'textarea'">
                <UTextarea
                  :model-value="String(row.value)"
                  :rows="3"
                  :aria-label="row.key || 'value'"
                  @update:model-value="row.value = $event"
                />
              </template>
              <template v-else-if="fieldInputType(row.value) === 'number'">
                <UInput
                  :model-value="String(row.value)"
                  type="number"
                  size="sm"
                  :aria-label="row.key || 'value'"
                  @update:model-value="row.value = Number($event)"
                />
              </template>
              <template v-else>
                <UInput
                  :model-value="String(row.value ?? '')"
                  size="sm"
                  :aria-label="row.key || 'value'"
                  @update:model-value="row.value = $event"
                />
              </template>
            </div>

            <UButton
              icon="i-heroicons-trash"
              color="neutral"
              variant="ghost"
              size="xs"
              class="mt-5 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
              :aria-label="`Delete field ${row.key}`"
              @click="removeField(i)"
            />
          </div>

          <UButton
            label="Add field"
            icon="i-heroicons-plus"
            color="neutral"
            variant="ghost"
            size="sm"
            class="w-full justify-center"
            @click="addField"
          />
        </template>

        <p
          v-if="saveError"
          class="text-xs text-error-500"
          role="alert"
        >
          {{ saveError }}
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 p-4 border-t border-border-base">
        <UButton
          label="Cancel"
          color="neutral"
          variant="ghost"
          @click="emit('update:open', false)"
        />
        <UButton
          label="Save"
          color="primary"
          :loading="isSaving"
          :disabled="!canSave()"
          @click="save"
        />
      </div>
    </template>
  </USlideover>
</template>
