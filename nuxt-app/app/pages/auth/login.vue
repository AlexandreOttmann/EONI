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
        Welcome back
      </h1>
      <p class="text-sm text-text-muted">
        Sign in to your merchant dashboard
      </p>
    </div>

    <!-- Signup success -->
    <div
      v-if="signupSuccess"
      role="status"
      class="mb-4 p-3 rounded-lg bg-success/10 border border-success/20 text-sm text-success"
    >
      Account created! Check your email to confirm, then sign in.
    </div>

    <!-- OAuth error -->
    <div
      v-if="oauthError"
      role="alert"
      class="mb-4 p-3 rounded-lg bg-error/10 border border-error/20 text-sm text-error"
    >
      Could not sign in with Google. Make sure you have an account first.
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
      aria-label="Sign in"
      class="space-y-4"
      @submit.prevent="handleLogin"
    >
      <div>
        <label
          for="login-email"
          class="block text-xs font-mono uppercase tracking-[0.12em] text-text-muted mb-1.5"
        >
          Email
        </label>
        <UInput
          id="login-email"
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
          for="login-password"
          class="block text-xs font-mono uppercase tracking-[0.12em] text-text-muted mb-1.5"
        >
          Password
        </label>
        <div class="relative">
          <UInput
            id="login-password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Your password"
            autocomplete="current-password"
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

      <UButton
        type="submit"
        label="Sign in"
        color="primary"
        size="md"
        block
        :loading="isSubmitting"
        :disabled="!email || !password || isSubmitting"
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
      @click="loginWithGoogle"
    />

    <!-- Switch link -->
    <p class="text-center text-sm text-text-muted mt-5">
      Don't have an account?
      <NuxtLink
        to="/auth/signup"
        class="text-accent-violet hover:text-accent-violet-2 font-medium transition-colors"
      >
        Sign up
      </NuxtLink>
    </p>
  </UCard>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'auth' })

useHead({ title: 'Sign In' })

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const isSubmitting = ref(false)
const errorMessage = ref<string | null>(null)

// Show "check your email" banner if redirected from signup
const route = useRoute()
const signupSuccess = computed(() => route.query.registered === '1')
const oauthError = computed(() => route.query.error === 'oauth_failed')

async function handleLogin() {
  errorMessage.value = null
  isSubmitting.value = true
  try {
    const supabase = useSupabaseClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value
    })
    if (error) throw error
    await navigateTo('/dashboard')
  } catch (err: unknown) {
    const authErr = err as { message?: string }
    errorMessage.value = authErr?.message ?? 'Invalid email or password. Please try again.'
  } finally {
    isSubmitting.value = false
  }
}

async function loginWithGoogle() {
  const supabase = useSupabaseClient()
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/api/auth/callback` }
  })
}
</script>
