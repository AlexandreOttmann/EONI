import type { gsap } from 'gsap'
import type { ScrollTrigger } from 'gsap/ScrollTrigger'
import type Lenis from 'lenis'

declare module '#app' {
  interface NuxtApp {
    $gsap: typeof gsap
    $ScrollTrigger: typeof ScrollTrigger
    $lenis: Lenis
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $gsap: typeof gsap
    $ScrollTrigger: typeof ScrollTrigger
    $lenis: Lenis
  }
}

export {}
