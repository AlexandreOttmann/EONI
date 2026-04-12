<script setup lang="ts">
import type { IndexRecord } from '~/types/api'

type RecordWithoutSearchable = Omit<IndexRecord, 'searchable_text'>

interface FieldRow {
  key: string
  value: unknown
  isNew: boolean
}

const props = defineProps<{
  open: boolean
  indexName: string
  record: RecordWithoutSearchable | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  updated: [record: RecordWithoutSearchable]
}>()

const fieldRows = ref<FieldRow[]>([])
const isSaving = ref(false)
const saveError = ref('')

watch(
  () => props.record,
  (r) => {
    if (r) {
      fieldRows.value = Object.entries(r.fields).map(([key, value]) => ({
        key,
        value,
        isNew: false
      }))
    } else {
      fieldRows.value = []
    }
    saveError.value = ''
  },
  { immediate: true }
)

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

async function save() {
  if (!props.record) return
  isSaving.value = true
  saveError.value = ''
  try {
    const fields: Record<string, unknown> = {}
    for (const row of fieldRows.value) {
      if (row.key.trim()) {
        fields[row.key.trim()] = row.value
      }
    }
    await $fetch(
      `/api/indexes/${encodeURIComponent(props.indexName)}/records/${encodeURIComponent(props.record.object_id)}`,
      { method: 'PATCH', body: { fields } }
    )
    // API returns {objectId, status} not the full record — construct optimistic update locally
    const updated: RecordWithoutSearchable = {
      ...props.record,
      fields,
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
      <div class="space-y-3 p-4">
        <div
          v-for="(row, i) in fieldRows"
          :key="i"
          class="group flex items-start gap-2"
        >
          <div class="flex-1 min-w-0 space-y-1">
            <!-- New field: editable key -->
            <template v-if="row.isNew">
              <UInput
                v-model="row.key"
                placeholder="field name"
                size="xs"
                class="font-mono"
                aria-label="Field name"
              />
            </template>
            <template v-else>
              <label class="text-xs font-mono text-text-muted">{{ row.key }}</label>
            </template>

            <!-- Value input -->
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
          @click="save"
        />
      </div>
    </template>
  </USlideover>
</template>
