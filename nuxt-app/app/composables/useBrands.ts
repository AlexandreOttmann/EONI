import type {
  BrandListResponse,
  BrandResponse,
  Brand,
  CreateBrandRequest,
  UpdateBrandRequest
} from '~/types/api'

/**
 * Normalize a single domain string: trim, lowercase, strip protocol + path,
 * drop leading `www.`. Returns an empty string if the input is empty/invalid.
 */
export function normalizeDomainInput(input: string): string {
  const raw = input.trim().toLowerCase()
  if (!raw) return ''
  let host = raw
  // Strip protocol if user pasted a full URL
  if (/^[a-z]+:\/\//.test(host)) {
    try {
      host = new URL(host).hostname
    } catch {
      // fall through with raw
    }
  }
  // Strip path/query/hash if present
  host = host.split('/')[0] ?? ''
  host = host.split('?')[0] ?? ''
  host = host.split('#')[0] ?? ''
  // Drop leading www.
  host = host.replace(/^www\./, '')
  return host
}

/** De-duplicate + normalize a domains array, dropping empty entries. */
export function normalizeDomainList(list: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const entry of list) {
    const norm = normalizeDomainInput(entry)
    if (!norm || seen.has(norm)) continue
    seen.add(norm)
    out.push(norm)
  }
  return out
}

export function useBrands() {
  const toast = useToast()

  const { data, status, error, refresh } = useFetch<BrandListResponse>('/api/brands')

  const brands = computed(() => data.value?.brands ?? [])
  const isLoading = computed(() => status.value === 'pending')

  async function createBrand(payload: CreateBrandRequest): Promise<Brand | null> {
    // Normalize single-domain convenience input into the `domains` array shape.
    const domains = payload.domains
      ? normalizeDomainList(payload.domains)
      : payload.domain
        ? normalizeDomainList([payload.domain])
        : []

    const body: CreateBrandRequest = {
      name: payload.name,
      ...(domains.length > 0 ? { domains } : {})
    }

    try {
      const result = await $fetch<BrandResponse>('/api/brands', {
        method: 'POST',
        body
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
    // Prefer `domains` on the wire; normalize if caller passed an array.
    const body: UpdateBrandRequest = { ...payload }
    if (body.domains !== undefined) {
      body.domains = normalizeDomainList(body.domains)
    }

    try {
      const result = await $fetch<BrandResponse>(`/api/brands/${id}`, {
        method: 'PATCH',
        body
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
