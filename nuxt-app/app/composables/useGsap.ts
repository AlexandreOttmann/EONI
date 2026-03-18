export function useGsap() {
  const { $gsap, $ScrollTrigger } = useNuxtApp()

  onUnmounted(() => {
    $ScrollTrigger?.getAll().forEach(t => t.kill())
  })

  return { gsap: $gsap, ScrollTrigger: $ScrollTrigger }
}
