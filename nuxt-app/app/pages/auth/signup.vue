<script setup lang="ts">
definePageMeta({ layout: 'auth' })

useHead({ title: 'Create Account' })

const name = ref('')
const email = ref('')
const password = ref('')
const domain = ref('')
const showPassword = ref(false)
const isSubmitting = ref(false)
const errorMessage = ref<string | null>(null)

async function handleSignup() {
  errorMessage.value = null
  isSubmitting.value = true
  try {
    await $fetch('/api/auth/signup', {
      method: 'POST',
      body: {
        name: name.value,
        email: email.value,
        password: password.value,
        ...(domain.value ? { domain: domain.value } : {})
      }
    })
    await navigateTo('/auth/login?registered=1')
  } catch (err: unknown) {
    const fetchErr = err as { data?: { message?: string } }
    errorMessage.value = fetchErr?.data?.message ?? 'Could not create account. Please try again.'
  } finally {
    isSubmitting.value = false
  }
}

async function signupWithGoogle() {
  const supabase = useSupabaseClient()
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/api/auth/callback` }
  })
}
</script>

<template>
  <UCard class="glass border-border-base">
    <!-- Logo -->
    <div class="flex justify-center mb-6">
      <NuxtLink
        to="/"
        class="flex items-center gap-2"
      >
        <div
          class="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-violet to-accent-cyan"
          aria-hidden="true"
        />
        <span class="text-base font-display font-semibold text-text-base">Eoni</span>
      </NuxtLink>
    </div>

    <!-- Heading -->
    <div class="text-center mb-6">
      <h1 class="text-xl font-display font-semibold text-text-base mb-1">
        Create your account
      </h1>
      <p class="text-sm text-text-muted">
        Start turning your store into an AI storefront
      </p>
    </div>

    <!-- Error message -->
    <div
      v-if="errorMessage"
      role="alert"
      class="mb-4 p-3 rounded-lg bg-error/10 border border-error/20 text-sm text-error"
    >
      {{ errorMessage }}
    </div>

    <!-- Form -->
    <form
      aria-label="Create account"
      class="space-y-4"
      @submit.prevent="handleSignup"
    >
      <div>
        <label
          for="signup-name"
          class="block text-xs font-mono uppercase tracking-[0.12em] text-text-muted mb-1.5"
        >
          Business name
        </label>
        <UInput
          id="signup-name"
          v-model="name"
          type="text"
          placeholder="Your Store"
          autocomplete="organization"
          required
          size="md"
          :disabled="isSubmitting"
        />
      </div>

      <div>
        <label
          for="signup-email"
          class="block text-xs font-mono uppercase tracking-[0.12em] text-text-muted mb-1.5"
        >
          Email
        </label>
        <UInput
          id="signup-email"
          v-model="email"
          type="email"
          placeholder="you@company.com"
          autocomplete="email"
          required
          size="md"
          :disabled="isSubmitting"
        />
      </div>

      <div>
        <label
          for="signup-password"
          class="block text-xs font-mono uppercase tracking-[0.12em] text-text-muted mb-1.5"
        >
          Password
        </label>
        <div class="relative">
          <UInput
            id="signup-password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Min 8 characters"
            autocomplete="new-password"
            required
            size="md"
            :disabled="isSubmitting"
          />
          <button
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-subtle hover:text-text-muted transition-colors"
            :aria-label="showPassword ? 'Hide password' : 'Show password'"
            @click="showPassword = !showPassword"
          >
            <UIcon
              :name="showPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
              class="w-4 h-4"
            />
          </button>
        </div>
      </div>

      <div>
        <label
          for="signup-domain"
          class="block text-xs font-mono uppercase tracking-[0.12em] text-text-muted mb-1.5"
        >
          Store URL
          <span class="text-text-subtle">(optional)</span>
        </label>
        <UInput
          id="signup-domain"
          v-model="domain"
          type="url"
          placeholder="https://your-store.com"
          autocomplete="url"
          size="md"
          :disabled="isSubmitting"
        />
      </div>

      <UButton
        type="submit"
        label="Create account"
        color="primary"
        size="md"
        block
        :loading="isSubmitting"
        :disabled="!name || !email || !password || isSubmitting"
      />
    </form>

    <!-- Divider -->
    <div class="relative my-5">
      <div class="absolute inset-0 flex items-center">
        <div class="w-full border-t border-border-base" />
      </div>
      <div class="relative flex justify-center text-xs uppercase">
        <span class="bg-surface-2 px-2 text-text-subtle font-mono">or</span>
      </div>
    </div>

    <!-- Google OAuth -->
    <UButton
      label="Continue with Google"
      variant="outline"
      color="neutral"
      size="md"
      block
      icon="i-simple-icons-google"
      aria-label="Continue with Google"
      @click="signupWithGoogle"
    />

    <!-- Switch link -->
    <p class="text-center text-sm text-text-muted mt-5">
      Already have an account?
      <NuxtLink
        to="/auth/login"
        class="text-accent-violet hover:text-accent-violet-2 font-medium transition-colors"
      >
        Sign in
      </NuxtLink>
    </p>
  </UCard>
</template>
