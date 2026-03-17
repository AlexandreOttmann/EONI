export function useLenis() {
  const { $lenis } = useNuxtApp()
  const route = useRoute()

  watch(() => route.path, (path) => {
    if (path.startsWith('/dashboard') || path.startsWith('/auth')) {
      $lenis?.stop()
    } else {
      $lenis?.start()
    }
  }, { immediate: true })

  return $lenis
}
