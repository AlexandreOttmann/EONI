import type { BrandListResponse, BrandResponse, Brand, CreateBrandRequest, UpdateBrandRequest } from '~/types/api'

export function useBrands() {
  const toast = useToast()

  const { data, status, error, refresh } = useFetch<BrandListResponse>('/api/brands')

  const brands = computed(() => data.value?.brands ?? [])
  const isLoading = computed(() => status.value === 'pending')

  async function createBrand(payload: CreateBrandRequest): Promise<Brand | null> {
    try {
      const result = await $fetch<BrandResponse>('/api/brands', {
        method: 'POST',
        body: payload
      })
      toast.add({ title: 'Brand created', color: 'success' })
      await refresh()
      return result.brand
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode
      const message = statusCode === 422
        ? 'Invalid brand data. Please check your input.'
        : 'Failed to create brand.'
      toast.add({ title: 'Error', description: message, color: 'error' })
      throw err
    }
  }

  async function updateBrand(id: string, payload: UpdateBrandRequest): Promise<Brand | null> {
    try {
      const result = await $fetch<BrandResponse>(`/api/brands/${id}`, {
        method: 'PATCH',
        body: payload
      })
      toast.add({ title: 'Brand updated', color: 'success' })
      await refresh()
      return result.brand
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode
      const message = statusCode === 422
        ? 'Invalid brand data. Please check your input.'
        : 'Failed to update brand.'
      toast.add({ title: 'Error', description: message, color: 'error' })
      throw err
    }
  }

  async function deleteBrand(id: string): Promise<void> {
    try {
      await $fetch(`/api/brands/${id}`, { method: 'DELETE' })
      toast.add({ title: 'Brand deleted', color: 'success' })
      await refresh()
    } catch {
      toast.add({ title: 'Error', description: 'Failed to delete brand.', color: 'error' })
    }
  }

  return { brands, isLoading, error, refresh, createBrand, updateBrand, deleteBrand }
}
