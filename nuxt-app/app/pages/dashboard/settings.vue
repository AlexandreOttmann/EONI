<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})

useHead({
  title: 'Settings'
})

// TODO: Replace with real data from useMerchant() composable
const profile = reactive({
  businessName: 'My Store',
  domain: 'https://my-store.com'
})

const account = reactive({
  email: 'merchant@example.com'
})

const isSaving = ref(false)
const showDeleteModal = ref(false)

// TODO: Replace with real API call via $fetch('/api/merchant/config', { method: 'PATCH' })
async function saveProfile() {
  isSaving.value = true
  await new Promise(resolve => setTimeout(resolve, 800))
  isSaving.value = false
}

// TODO: Implement password change flow via Supabase
function changePassword() {
  // Will redirect to Supabase password reset flow
}

// TODO: Implement account deletion via $fetch('/api/merchant', { method: 'DELETE' })
async function deleteAccount() {
  showDeleteModal.value = false
  // Will call API to delete account
}
</script>

<template>
  <div>
    <h1 class="text-[clamp(1.5rem,3vw,2rem)] font-display font-semibold text-text-base mb-6" style="text-wrap: balance">
      Settings
    </h1>

    <div class="space-y-4 max-w-2xl">
      <!-- Profile section -->
      <section aria-labelledby="settings-profile">
        <UCard>
          <template #header>
            <h2 id="settings-profile" class="text-sm font-medium text-text-base">Profile</h2>
          </template>
          <form class="space-y-4" @submit.prevent="saveProfile">
            <div>
              <label for="business-name" class="block text-xs font-mono uppercase tracking-[0.12em] text-text-muted mb-1.5">
                Business name
              </label>
              <UInput
                id="business-name"
                v-model="profile.businessName"
                size="sm"
                placeholder="Your business name"
              />
            </div>
            <div>
              <label for="business-domain" class="block text-xs font-mono uppercase tracking-[0.12em] text-text-muted mb-1.5">
                Domain
              </label>
              <UInput
                id="business-domain"
                v-model="profile.domain"
                size="sm"
                type="url"
                placeholder="https://your-store.com"
              />
            </div>
            <UButton
              type="submit"
              label="Save changes"
              color="primary"
              size="sm"
              :loading="isSaving"
            />
          </form>
        </UCard>
      </section>

      <!-- Account section -->
      <section aria-labelledby="settings-account">
        <UCard>
          <template #header>
            <h2 id="settings-account" class="text-sm font-medium text-text-base">Account</h2>
          </template>
          <div class="space-y-4">
            <div>
              <label for="account-email" class="block text-xs font-mono uppercase tracking-[0.12em] text-text-muted mb-1.5">
                Email
              </label>
              <UInput
                id="account-email"
                :model-value="account.email"
                size="sm"
                type="email"
                disabled
                aria-readonly="true"
              />
            </div>
            <UButton
              label="Change password"
              variant="outline"
              color="neutral"
              size="sm"
              @click="changePassword"
            />
          </div>
        </UCard>
      </section>

      <!-- Danger zone -->
      <section aria-labelledby="settings-danger">
        <UCard class="border-error/30">
          <template #header>
            <h2 id="settings-danger" class="text-sm font-medium text-error">Danger zone</h2>
          </template>
          <div class="flex items-center justify-between flex-wrap gap-4">
            <div class="min-w-0">
              <p class="text-sm text-text-base">Delete account</p>
              <p class="text-xs text-text-muted">
                Permanently delete your account and all data. This cannot be undone.
              </p>
            </div>
            <UButton
              label="Delete account"
              color="error"
              variant="outline"
              size="sm"
              @click="showDeleteModal = true"
            />
          </div>
        </UCard>
      </section>
    </div>

    <!-- Delete confirmation modal -->
    <UModal v-model:open="showDeleteModal">
      <template #content>
        <div
          role="alertdialog"
          aria-labelledby="delete-modal-title"
          aria-describedby="delete-modal-desc"
          class="p-6"
        >
          <div class="flex items-start gap-4">
            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-error/10 shrink-0">
              <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-error" />
            </div>
            <div>
              <h3 id="delete-modal-title" class="text-base font-display font-medium text-text-base mb-1">
                Delete account?
              </h3>
              <p id="delete-modal-desc" class="text-sm text-text-muted mb-4">
                This will permanently delete your account, all crawled data, conversations, and widget configuration. This action cannot be undone.
              </p>
              <div class="flex gap-2 justify-end">
                <UButton
                  label="Cancel"
                  variant="outline"
                  color="neutral"
                  size="sm"
                  @click="showDeleteModal = false"
                />
                <UButton
                  label="Delete account"
                  color="error"
                  size="sm"
                  @click="deleteAccount"
                />
              </div>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
