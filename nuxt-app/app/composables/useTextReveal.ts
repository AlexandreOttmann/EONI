export function useTextReveal(el: Ref<HTMLElement | null>) {
  const { gsap } = useGsap()

  onMounted(() => {
    if (!el.value || !gsap) return
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return

    const walker = document.createTreeWalker(el.value, NodeFilter.SHOW_TEXT)
    const textNodes: Text[] = []
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode as Text)
    }

    for (const textNode of textNodes) {
      const words = textNode.textContent?.split(/(\s+)/) ?? []
      const fragment = document.createDocumentFragment()
      for (const word of words) {
        if (/^\s+$/.test(word)) {
          fragment.appendChild(document.createTextNode(word))
        } else if (word) {
          const wrapper = document.createElement('span')
          wrapper.style.overflow = 'hidden'
          wrapper.style.display = 'inline-block'
          const inner = document.createElement('span')
          inner.className = 'word'
          inner.style.display = 'inline-block'
          inner.textContent = word
          wrapper.appendChild(inner)
          fragment.appendChild(wrapper)
        }
      }
      textNode.parentNode?.replaceChild(fragment, textNode)
    }

    gsap.fromTo(
      el.value.querySelectorAll('.word'),
      { y: '110%', opacity: 0 },
      {
        y: '0%',
        opacity: 1,
        duration: 0.9,
        ease: 'power4.out',
        stagger: 0.04,
        scrollTrigger: { trigger: el.value, start: 'top 85%', once: true },
      }
    )
  })
}
