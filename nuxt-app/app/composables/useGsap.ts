export function useGsap() {
  const { $gsap, $ScrollTrigger } = useNuxtApp()

  onUnmounted(() => {
    $ScrollTrigger?.getAll().forEach((t: { kill: () => void }) => t.kill())
  })

  return { gsap: $gsap as typeof import('gsap').gsap, ScrollTrigger: $ScrollTrigger }
}
