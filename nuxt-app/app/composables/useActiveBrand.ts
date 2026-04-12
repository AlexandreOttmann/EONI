export function useActiveBrand() {
  const activeBrandId = useLocalStorage<string | null>('active-brand-id', null)
  const { brands } = useBrands()

  const activeBrand = computed(() => {
    if (!activeBrandId.value) return null
    return brands.value.find(b => b.id === activeBrandId.value) ?? null
  })

  function setActiveBrand(id: string | null) {
    activeBrandId.value = id
  }

  function clearActiveBrand() {
    activeBrandId.value = null
  }

  return { activeBrandId, activeBrand, setActiveBrand, clearActiveBrand }
}
