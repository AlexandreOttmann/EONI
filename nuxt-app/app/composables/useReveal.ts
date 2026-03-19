export function useReveal(el: Ref<HTMLElement | null>, delay = 0) {
  const { gsap } = useGsap()

  onMounted(() => {
    if (!el.value || !gsap) return
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return

    gsap.fromTo(
      el.value,
      { opacity: 0, y: 40 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: 'power3.out',
        delay,
        scrollTrigger: { trigger: el.value, start: 'top 88%', once: true }
      }
    )
  })
}
