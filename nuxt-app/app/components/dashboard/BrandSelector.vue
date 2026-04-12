<script setup lang="ts">
interface BrandOption {
  label: string
  value: string
}

const props = defineProps<{
  modelValue?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const { brands } = useBrands()
const { activeBrandId, setActiveBrand } = useActiveBrand()

const isControlled = computed(() => props.modelValue !== undefined)

const ALL_BRANDS_KEY = '__all__'

const selectedValue = computed({
  get() {
    const raw = isControlled.value ? props.modelValue : activeBrandId.value
    return raw ?? ALL_BRANDS_KEY
  },
  set(val: string) {
    const brandId = val === ALL_BRANDS_KEY ? null : val
    if (isControlled.value) {
      emit('update:modelValue', brandId)
    } else {
      setActiveBrand(brandId)
    }
  }
})

const options = computed<BrandOption[]>(() => [
  { label: 'All Brands', value: ALL_BRANDS_KEY },
  ...brands.value.map(b => ({ label: b.name, value: b.id }))
])
</script>

<template>
  <USelect
    v-model="selectedValue"
    :items="options"
    value-key="value"
    label-key="label"
    placeholder="Select brand"
    size="sm"
    class="w-48"
    aria-label="Filter by brand"
  />
</template>
