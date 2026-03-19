import type { MerchantConfigResponse, UpdateMerchantConfigRequest } from '~/types/api'

export function useMerchantConfig() {
  const toast = useToast()

  const { data, status, error, refresh } = useFetch<MerchantConfigResponse>('/api/merchant/config')

  const merchant = computed(() => data.value?.merchant ?? null)
  const isLoading = computed(() => status.value === 'pending')

  async function updateConfig(payload: UpdateMerchantConfigRequest) {
    try {
      const result = await $fetch<MerchantConfigResponse>('/api/merchant/config', {
        method: 'PATCH',
        body: payload
      })
      data.value = result
      toast.add({ title: 'Settings saved', color: 'success' })
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode
      const message = statusCode === 422
        ? 'Invalid settings. Please check your input.'
        : 'Failed to save settings.'
      toast.add({ title: 'Error', description: message, color: 'error' })
      throw err
    }
  }

  return { merchant, isLoading, error, refresh, updateConfig }
}
