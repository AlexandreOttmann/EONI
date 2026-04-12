<script setup lang="ts">
import type { BrandWithCounts } from '~/types/api'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Brands' })

const { brands, isLoading, createBrand, updateBrand, deleteBrand } = useBrands()

// Create modal
const showCreateModal = ref(false)
const createName = ref('')
const createDomain = ref('')
const isCreating = ref(false)

async function handleCreate() {
  if (!createName.value.trim()) return
  isCreating.value = true
  try {
    await createBrand({
      name: createName.value.trim(),
      domain: createDomain.value.trim() || undefined
    })
    showCreateModal.value = false
    createName.value = ''
    createDomain.value = ''
  } catch {
    // handled by composable
  } finally {
    isCreating.value = false
  }
}

// Edit modal
const showEditModal = ref(false)
const editBrand = ref<BrandWithCounts | null>(null)
const editName = ref('')
const editDomain = ref('')
const editDescription = ref('')
const editLogoUrl = ref('')
const isSaving = ref(false)

function openEdit(brand: BrandWithCounts) {
  editBrand.value = brand
  editName.value = brand.name
  editDomain.value = brand.domain ?? ''
  editDescription.value = brand.description ?? ''
  editLogoUrl.value = brand.logo_url ?? ''
  showEditModal.value = true
}

async function handleSave() {
  if (!editBrand.value || !editName.value.trim()) return
  isSaving.value = true
  try {
    await updateBrand(editBrand.value.id, {
      name: editName.value.trim(),
      domain: editDomain.value.trim() || undefined,
      description: editDescription.value.trim() || undefined,
      logo_url: editLogoUrl.value.trim() || undefined
    })
    showEditModal.value = false
  } catch {
    // handled by composable
  } finally {
    isSaving.value = false
  }
}

function useExtractedDescription() {
  if (editBrand.value?.extracted_description) {
    editDescription.value = editBrand.value.extracted_description
  }
}

async function handleDelete() {
  if (!editBrand.value) return
  await deleteBrand(editBrand.value.id)
  showEditModal.value = false
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <h1
        class="text-[clamp(1.5rem,3vw,2rem)] font-display font-semibold text-text-base"
        style="text-wrap: balance"
      >
        Brands
      </h1>
      <UButton
        label="Add Brand"
        icon="i-heroicons-plus"
        color="primary"
        size="sm"
        @click="showCreateModal = true"
      />
    </div>

    <!-- Loading -->
    <template v-if="isLoading">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <UCard
          v-for="i in 3"
          :key="i"
        >
          <div class="space-y-3">
            <motion
              as="div"
              class="h-5 w-32 rounded bg-surface-3"
              :animate="{ opacity: [0.4, 1, 0.4] }"
              :transition="{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }"
            />
            <motion
              as="div"
              class="h-3 w-48 rounded bg-surface-3"
              :animate="{ opacity: [0.4, 1, 0.4] }"
              :transition="{ repeat: Infinity, duration: 1.5, ease: 'easeInOut', delay: 0.1 }"
            />
          </div>
        </UCard>
      </div>
    </template>

    <!-- Brand grid -->
    <template v-else-if="brands.length > 0">
      <motion
        as="div"
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        :variants="{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.06 } }
        }"
        initial="hidden"
        animate="visible"
      >
        <motion
          v-for="brand in brands"
          :key="brand.id"
          as="div"
          :variants="{
            hidden: { opacity: 0, y: 8 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } }
          }"
        >
          <UCard
            class="cursor-pointer transition-shadow duration-300 hover:glow-violet"
            @click="openEdit(brand)"
          >
            <div class="flex items-start gap-3">
              <div
                v-if="brand.logo_url"
                class="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-surface-2"
              >
                <img
                  :src="brand.logo_url"
                  :alt="brand.name"
                  width="40"
                  height="40"
                  class="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div
                v-else
                class="w-10 h-10 rounded-lg bg-accent-violet/10 flex items-center justify-center shrink-0"
              >
                <UIcon
                  name="i-heroicons-building-storefront"
                  class="w-5 h-5 text-accent-violet"
                />
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="text-sm font-medium text-text-base truncate">
                  {{ brand.name }}
                </h3>
                <p
                  v-if="brand.domain"
                  class="text-xs text-text-muted font-mono truncate"
                >
                  {{ brand.domain }}
                </p>
                <p
                  v-if="brand.description"
                  class="text-xs text-text-muted mt-1 line-clamp-2"
                >
                  {{ brand.description }}
                </p>
              </div>
            </div>
            <div class="flex gap-2 mt-3">
              <UBadge
                variant="subtle"
                color="primary"
                size="xs"
              >
                {{ brand.product_count }} products
              </UBadge>
              <UBadge
                variant="subtle"
                color="neutral"
                size="xs"
              >
                {{ brand.chunk_count }} chunks
              </UBadge>
            </div>
          </UCard>
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
              name="i-heroicons-building-storefront"
              class="w-6 h-6 text-accent-violet"
            />
          </div>
        </div>
        <h3 class="text-base font-display font-medium text-text-base mb-1">
          No brands yet
        </h3>
        <p class="text-sm text-text-muted mb-6 max-w-xs">
          Create your first brand to organize your crawled content.
        </p>
        <UButton
          label="Create your first brand"
          icon="i-heroicons-plus"
          color="primary"
          size="md"
          @click="showCreateModal = true"
        />
      </div>
    </template>

    <!-- Create modal -->
    <UModal
      v-model:open="showCreateModal"
      title="Add Brand"
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="handleCreate"
        >
          <div>
            <label
              for="brand-name"
              class="text-sm font-medium text-text-base mb-1 block"
            >
              Brand name
            </label>
            <UInput
              id="brand-name"
              v-model="createName"
              placeholder="My Brand"
              size="md"
              autofocus
            />
          </div>
          <div>
            <label
              for="brand-domain"
              class="text-sm font-medium text-text-base mb-1 block"
            >
              Domain (optional)
            </label>
            <UInput
              id="brand-domain"
              v-model="createDomain"
              placeholder="mybrand.com"
              size="md"
            />
          </div>
          <div class="flex justify-end gap-2">
            <UButton
              label="Cancel"
              variant="outline"
              color="neutral"
              size="sm"
              @click="showCreateModal = false"
            />
            <UButton
              type="submit"
              label="Create"
              color="primary"
              size="sm"
              :loading="isCreating"
              :disabled="!createName.trim()"
            />
          </div>
        </form>
      </template>
    </UModal>

    <!-- Edit modal -->
    <UModal
      v-model:open="showEditModal"
      title="Edit Brand"
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="handleSave"
        >
          <div>
            <label
              for="edit-name"
              class="text-sm font-medium text-text-base mb-1 block"
            >
              Brand name
            </label>
            <UInput
              id="edit-name"
              v-model="editName"
              size="md"
            />
          </div>
          <div>
            <label
              for="edit-domain"
              class="text-sm font-medium text-text-base mb-1 block"
            >
              Domain
            </label>
            <UInput
              id="edit-domain"
              v-model="editDomain"
              placeholder="mybrand.com"
              size="md"
            />
          </div>
          <div>
            <label
              for="edit-description"
              class="text-sm font-medium text-text-base mb-1 block"
            >
              Description
            </label>
            <UTextarea
              id="edit-description"
              v-model="editDescription"
              placeholder="Describe this brand for the AI assistant…"
              :rows="3"
              size="md"
            />
            <div
              v-if="editBrand?.extracted_description && editBrand.extracted_description !== editDescription"
              class="mt-2 p-2 rounded-lg bg-accent-violet/5 border border-accent-violet/20"
            >
              <p class="text-xs text-text-muted mb-1">
                AI suggestion:
              </p>
              <p class="text-xs text-text-base line-clamp-3">
                {{ editBrand.extracted_description }}
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
              for="edit-logo"
              class="text-sm font-medium text-text-base mb-1 block"
            >
              Logo URL
            </label>
            <UInput
              id="edit-logo"
              v-model="editLogoUrl"
              placeholder="https://…"
              size="md"
            />
          </div>
          <div class="flex justify-between">
            <UButton
              label="Delete"
              variant="ghost"
              color="error"
              size="sm"
              icon="i-heroicons-trash"
              @click="handleDelete"
            />
            <div class="flex gap-2">
              <UButton
                label="Cancel"
                variant="outline"
                color="neutral"
                size="sm"
                @click="showEditModal = false"
              />
              <UButton
                type="submit"
                label="Save"
                color="primary"
                size="sm"
                :loading="isSaving"
                :disabled="!editName.trim()"
              />
            </div>
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>
