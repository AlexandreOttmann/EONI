import type { MeResponse } from '~/types/api'

export const useAuthStore = defineStore('auth', () => {
  const user = useSupabaseUser()
  const merchant = ref<MeResponse['merchant'] | null>(null)
  const loading = ref(false)

  async function fetchMerchant() {
    if (!user.value) return
    try {
      const data = await $fetch<MeResponse>('/api/auth/me')
      merchant.value = data.merchant
    } catch {
      merchant.value = null
    }
  }

  async function logout() {
    const supabase = useSupabaseClient()
    await supabase.auth.signOut()
    merchant.value = null
    await navigateTo('/auth/login')
  }

  const displayName = computed(() => {
    if (merchant.value?.name) return merchant.value.name
    const meta = user.value?.user_metadata as Record<string, string> | undefined
    return meta?.full_name ?? meta?.name ?? user.value?.email?.split('@')[0] ?? null
  })

  const avatarUrl = computed(() => {
    const meta = user.value?.user_metadata as Record<string, string> | undefined
    return meta?.avatar_url || meta?.picture || null
  })

  return { user, merchant, loading, displayName, avatarUrl, fetchMerchant, logout }
})
