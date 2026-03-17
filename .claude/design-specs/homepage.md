# Homepage Design Spec — Marketing Landing Page

> **Surface**: Marketing
> **Standard**: Awwwards / Linear / Vercel grade
> **Libraries**: GSAP + ScrollTrigger, Lenis, Motion for Vue (motion-v), Tailwind v4
> **Status**: Ready for frontend-developer implementation

---

## File Inventory

### Infrastructure (must be built first)

| File | Purpose |
|------|---------|
| `nuxt-app/plugins/gsap.client.ts` | GSAP + ScrollTrigger registration |
| `nuxt-app/plugins/lenis.client.ts` | Lenis smooth scroll + GSAP ticker integration |
| `nuxt-app/app/composables/useGsap.ts` | GSAP + ScrollTrigger accessor with cleanup |
| `nuxt-app/app/composables/useLenis.ts` | Lenis accessor + route-aware start/stop |
| `nuxt-app/app/composables/useTextReveal.ts` | GSAP word-by-word heading reveal |
| `nuxt-app/app/composables/useReveal.ts` | GSAP fade-up for sections |
| `nuxt-app/app/layouts/marketing.vue` | Marketing layout shell: Lenis, CustomCursor, NoiseOverlay, AnimatePresence |
| `nuxt-app/app/components/marketing/NoiseOverlay.vue` | SVG fractal noise texture overlay |
| `nuxt-app/app/components/marketing/CustomCursor.vue` | Spring-following cursor dot |
| `nuxt-app/app/components/marketing/MagneticButton.vue` | Spring-magnetic CTA button |

### Section Components (scroll order)

| File | Section |
|------|---------|
| `nuxt-app/app/components/marketing/MarketingNav.vue` | Fixed glass navigation |
| `nuxt-app/app/components/marketing/HeroSection.vue` | Hero with word reveal + product mockup |
| `nuxt-app/app/components/marketing/LogoCloud.vue` | Infinite-scroll merchant logos |
| `nuxt-app/app/components/marketing/HowItWorks.vue` | 3-step flow with animated connector |
| `nuxt-app/app/components/marketing/FeatureBento.vue` | Asymmetric bento grid |
| `nuxt-app/app/components/marketing/ProductShowcase.vue` | Pinned horizontal scroll product demo |
| `nuxt-app/app/components/marketing/Testimonials.vue` | Glass quote cards |
| `nuxt-app/app/components/marketing/PricingSection.vue` | 3-tier pricing cards |
| `nuxt-app/app/components/marketing/CTASection.vue` | Final conversion block |
| `nuxt-app/app/components/marketing/MarketingFooter.vue` | Minimal dark footer |

### Page

| File | Notes |
|------|-------|
| `nuxt-app/app/pages/index.vue` | Replaces existing starter. Uses `marketing` layout. Composes all sections. |

---

## 0. Package Installation (prerequisite)

```bash
cd nuxt-app && pnpm add gsap lenis
```

GSAP and Lenis are now in `package.json`. `motion-v` is already installed and configured via `motion-v/nuxt` module.

---

## 1. Infrastructure Files

### 1.1 `plugins/gsap.client.ts`

```typescript
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export default defineNuxtPlugin(() => {
  return { provide: { gsap, ScrollTrigger } }
})
```

### 1.2 `plugins/lenis.client.ts`

```typescript
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export default defineNuxtPlugin(() => {
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    orientation: 'vertical',
    smoothWheel: true,
  })

  lenis.on('scroll', ScrollTrigger.update)

  gsap.ticker.add((time: number) => {
    lenis.raf(time * 1000)
  })

  gsap.ticker.lagSmoothing(0)

  return { provide: { lenis } }
})
```

### 1.3 `composables/useGsap.ts`

```typescript
export function useGsap() {
  const { $gsap, $ScrollTrigger } = useNuxtApp()

  onUnmounted(() => {
    $ScrollTrigger?.getAll().forEach((t: any) => t.kill())
  })

  return { gsap: $gsap as typeof import('gsap').gsap, ScrollTrigger: $ScrollTrigger }
}
```

### 1.4 `composables/useLenis.ts`

```typescript
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
```

### 1.5 `composables/useTextReveal.ts`

```typescript
export function useTextReveal(el: Ref<HTMLElement | null>) {
  const { gsap } = useGsap()

  onMounted(() => {
    if (!el.value || !gsap) return
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return

    // Use TreeWalker to only split TEXT_NODE children, preserving existing <span> wrappers
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
```

### 1.6 `composables/useReveal.ts`

```typescript
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
        scrollTrigger: { trigger: el.value, start: 'top 88%', once: true },
      }
    )
  })
}
```

### 1.7 `layouts/marketing.vue`

```vue
<script setup lang="ts">
const route = useRoute()
useLenis()
</script>

<template>
  <div class="min-h-screen bg-surface-base text-text-base">
    <!-- Skip link -->
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:px-4 focus:py-2 focus:bg-accent-violet focus:text-white focus:rounded-lg"
    >
      Skip to main content
    </a>

    <MarketingCustomCursor />
    <MarketingNoiseOverlay />
    <MarketingNav />

    <AnimatePresence mode="wait">
      <motion.main
        :key="route.path"
        :initial="{ opacity: 0, y: 20 }"
        :animate="{ opacity: 1, y: 0 }"
        :exit="{ opacity: 0, y: -20 }"
        :transition="{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }"
      >
        <slot />
      </motion.main>
    </AnimatePresence>
  </div>
</template>
```

### 1.8 `components/marketing/NoiseOverlay.vue`

```vue
<template>
  <div
    class="pointer-events-none fixed inset-0 z-50 opacity-[0.035]"
    aria-hidden="true"
    :style="{
      backgroundImage: `url(&quot;data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E&quot;)`,
      backgroundRepeat: 'repeat',
      backgroundSize: '256px 256px',
    }"
  />
</template>
```

### 1.9 `components/marketing/CustomCursor.vue`

```vue
<script setup lang="ts">
const cursorX = ref(-100)
const cursorY = ref(-100)
const isHovering = ref(false)
const isVisible = ref(false)

onMounted(() => {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (prefersReduced || window.matchMedia('(pointer: coarse)').matches) return

  isVisible.value = true

  window.addEventListener('mousemove', (e: MouseEvent) => {
    cursorX.value = e.clientX
    cursorY.value = e.clientY
  })

  const observe = () => {
    document.querySelectorAll('a, button, [data-cursor="hover"]').forEach((el) => {
      el.addEventListener('mouseenter', () => { isHovering.value = true })
      el.addEventListener('mouseleave', () => { isHovering.value = false })
    })
  }

  observe()

  const observer = new MutationObserver(() => observe())
  observer.observe(document.body, { childList: true, subtree: true })

  onUnmounted(() => observer.disconnect())
})
</script>

<template>
  <motion.div
    v-if="isVisible"
    aria-hidden="true"
    class="pointer-events-none fixed top-0 left-0 z-[9999] rounded-full border border-accent-violet mix-blend-difference"
    :animate="{
      x: cursorX - (isHovering ? 20 : 6),
      y: cursorY - (isHovering ? 20 : 6),
      width: isHovering ? '40px' : '12px',
      height: isHovering ? '40px' : '12px',
    }"
    :transition="{ type: 'spring', stiffness: 500, damping: 28, mass: 0.5 }"
  />
</template>
```

### 1.10 `components/marketing/MagneticButton.vue`

```vue
<script setup lang="ts">
interface Props {
  to?: string
  variant?: 'primary' | 'ghost'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
})

const el = ref<HTMLElement | null>(null)
const x = ref(0)
const y = ref(0)

function onMouseMove(e: MouseEvent) {
  if (!el.value) return
  const rect = el.value.getBoundingClientRect()
  x.value = (e.clientX - rect.left - rect.width / 2) * 0.35
  y.value = (e.clientY - rect.top - rect.height / 2) * 0.35
}

function onMouseLeave() {
  x.value = 0
  y.value = 0
}

const baseClasses = 'relative inline-flex items-center justify-center gap-2 font-medium transition-colors duration-200 touch-action-manipulation focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base focus-visible:outline-none'

const variantClasses = computed(() =>
  props.variant === 'primary'
    ? 'px-8 py-4 rounded-full bg-accent-violet text-white hover:bg-accent-violet-2'
    : 'px-8 py-4 rounded-full border border-border-base text-text-muted hover:text-text-base hover:border-text-subtle'
)
</script>

<template>
  <motion.div
    ref="el"
    :animate="{ x, y }"
    :transition="{ type: 'spring', stiffness: 150, damping: 15, mass: 0.1 }"
    class="inline-block"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <NuxtLink
      v-if="to"
      :to="to"
      :class="[baseClasses, variantClasses]"
    >
      <slot />
    </NuxtLink>
    <button
      v-else
      :class="[baseClasses, variantClasses]"
    >
      <slot />
    </button>
  </motion.div>
</template>
```

---

## 2. MarketingNav

**File**: `nuxt-app/app/components/marketing/MarketingNav.vue`
**Libraries**: GSAP ScrollTrigger (border trigger), CSS transitions

### Structure and Classes

```
Root: <header> fixed top-0 left-0 right-0 z-40 h-16
Glass bg: bg-surface-base/70 backdrop-blur-xl
Border (scroll-triggered, starts invisible): absolute bottom-0 left-0 right-0 h-px bg-border-base opacity-0
```

**Logo**: `<NuxtLink to="/" class="flex items-center gap-2" aria-label="Synth homepage">`
- Logo mark: `w-7 h-7 rounded-lg bg-gradient-to-br from-accent-violet to-accent-cyan`
- Logo text: `text-sm font-display font-semibold text-text-base` — "Synth"

**Center nav links** (hidden below lg):
```
<ul class="hidden lg:flex items-center gap-8">
  <li><a href="#features" class="text-sm text-text-muted hover:text-text-base transition-colors duration-200 ...">Features</a></li>
  <li><a href="#how-it-works" ...>How it works</a></li>
  <li><a href="#pricing" ...>Pricing</a></li>
</ul>
```

**Right zone**:
- Login: `hidden lg:inline-flex text-sm text-text-muted hover:text-text-base`
- Get started: `hidden lg:inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-accent-violet text-white text-sm font-medium hover:bg-accent-violet-2`
- Mobile hamburger: `lg:hidden w-10 h-10 rounded-lg text-text-muted hover:text-text-base hover:bg-surface-3`

### GSAP Scroll Border

```typescript
gsap.to(borderRef.value, {
  opacity: 1,
  duration: 0.3,
  ease: 'power2.out',
  scrollTrigger: {
    trigger: document.body,
    start: 'top -80',
    end: 'top -80',
    toggleActions: 'play none none reverse',
  },
})
```

### Mobile Menu Overlay

```
<AnimatePresence>
  <motion.div v-if="mobileMenuOpen"
    id="mobile-nav"
    class="fixed inset-0 z-30 bg-surface-base/95 backdrop-blur-xl pt-20 px-6"
    :initial="{ opacity: 0 }"
    :animate="{ opacity: 1 }"
    :exit="{ opacity: 0 }"
    :transition="{ duration: 0.2 }"
    style="overscroll-behavior: contain"
  >
```

Links stagger in: `{ opacity: 0, x: -16 } -> { opacity: 1, x: 0 }`, delay `i * 0.05`

### Accessibility

- `<header role="banner">`, `<nav aria-label="Main navigation">`
- Hamburger: `aria-expanded`, `aria-controls="mobile-nav"`, `aria-label="Toggle navigation menu"`
- All links: focus-visible rings

---

## 3. HeroSection

**File**: `nuxt-app/app/components/marketing/HeroSection.vue`
**Libraries**: GSAP (text reveal, parallax), Motion/Vue (MagneticButton)

### Structure

```
Root: <section id="main-content" class="relative overflow-hidden">
Background: <div class="absolute inset-0 hero-mesh hero-mesh-animated" aria-hidden="true" />
Content: <div class="relative z-10 mx-auto max-w-5xl px-6 pt-40 pb-24 text-center">
```

**Overline**:
```
<span class="inline-block text-xs font-mono uppercase tracking-[0.2em] text-accent-cyan mb-6">
  AI-powered storefronts
</span>
```
Entrance: `gsap.from({ opacity: 0, y: 20, duration: 0.6, ease: 'power3.out', delay: 0.1 })`

**Heading** (uses `useTextReveal(headingRef)`):
```html
<h1 ref="headingRef"
  class="text-[clamp(2.5rem,7vw,5.5rem)] font-display font-bold leading-[0.95] tracking-tight text-text-base text-balance"
>
  Turn any website into an
  <span class="gradient-text-violet-cyan">AI-powered</span>
  storefront
</h1>
```

**Subheading**:
```
<p ref="subRef" class="mt-6 text-lg text-text-muted leading-relaxed max-w-2xl mx-auto text-pretty">
  Paste your URL. Our AI crawls your catalog, builds a smart chat widget,
  and makes your products discoverable by ChatGPT, Perplexity, and Claude.
  Live in 5&nbsp;minutes.
</p>
```
Entrance: `useReveal(subRef, 0.3)`

**CTAs**:
```
<div ref="ctaRef" class="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
  <MagneticButton variant="primary" to="/auth/signup">
    Get started free
    <UIcon name="i-lucide-arrow-right" class="w-4 h-4" />
  </MagneticButton>
  <MagneticButton variant="ghost" to="#product-showcase">
    See it in action
    <UIcon name="i-lucide-play" class="w-4 h-4" />
  </MagneticButton>
</div>
```
Entrance: `useReveal(ctaRef, 0.5)`

**Product mockup**:
```
<div ref="mockupRef" class="mt-20 relative mx-auto max-w-4xl">
  <!-- Glow behind -->
  <div class="absolute -inset-4 rounded-3xl opacity-60 blur-3xl"
    style="background: radial-gradient(ellipse at center, rgba(124,58,237,0.2) 0%, transparent 70%);"
    aria-hidden="true" />
  <!-- Browser frame -->
  <div class="relative rounded-2xl border border-border-base overflow-hidden glow-violet bg-surface-1">
    <!-- Chrome bar -->
    <div class="flex items-center gap-2 px-4 py-3 border-b border-border-base bg-surface-2">
      <div class="flex gap-1.5">
        <div class="w-3 h-3 rounded-full bg-surface-3" />
        <div class="w-3 h-3 rounded-full bg-surface-3" />
        <div class="w-3 h-3 rounded-full bg-surface-3" />
      </div>
      <div class="flex-1 mx-8">
        <div class="h-6 rounded-full bg-surface-3 max-w-xs mx-auto flex items-center justify-center">
          <span class="text-[10px] font-mono text-text-subtle">yourtravelagency.com</span>
        </div>
      </div>
    </div>
    <!-- Screenshot placeholder -->
    <div class="aspect-[16/10] bg-surface-2 flex items-center justify-center">
      <div class="text-text-subtle text-sm font-mono">Dashboard preview</div>
    </div>
  </div>
</div>
```

Mockup entrance:
```typescript
gsap.fromTo(mockupRef.value,
  { y: 80, opacity: 0, scale: 0.95 },
  { y: 0, opacity: 1, scale: 1, duration: 1.2, ease: 'power3.out', delay: 0.6 }
)
```

Mockup parallax:
```typescript
gsap.to(mockupRef.value, {
  y: -40,
  ease: 'none',
  scrollTrigger: { trigger: mockupRef.value, start: 'top bottom', end: 'bottom top', scrub: 1 },
})
```

### Responsive

- Mobile (< sm): heading clamps to ~2.5rem. CTAs stack (`flex-col`). `pt-32`.
- Desktop (lg+): heading ~5.5rem. Full width mockup. `pt-40`.

### Reduced Motion

No word reveal, no mockup entrance (opacity only), no parallax, mesh not animated.

---

## 4. LogoCloud

**File**: `nuxt-app/app/components/marketing/LogoCloud.vue`
**Libraries**: CSS animation (infinite scroll), GSAP (reveal)

### Structure

```
Root: <section ref="sectionRef" class="py-20 border-y border-border-base">
Label: <p class="text-center text-xs font-mono uppercase tracking-[0.2em] text-text-subtle mb-10">
  Trusted by forward-thinking merchants
</p>

Scroll container with fade edges:
  <div class="relative overflow-hidden">
    <div class="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-surface-base to-transparent z-10 pointer-events-none" aria-hidden="true" />
    <div class="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-surface-base to-transparent z-10 pointer-events-none" aria-hidden="true" />
    <div class="flex gap-16 animate-logo-scroll">
      <!-- logos + duplicated set for seamless loop -->
    </div>
  </div>
```

Logos: `h-8 opacity-40 hover:opacity-70 transition-opacity duration-300 grayscale`
Duplicate set: `aria-hidden="true"`, empty `alt=""`

### CSS

```css
@keyframes logo-scroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.animate-logo-scroll {
  animation: logo-scroll 30s linear infinite;
}
```

Entrance: `useReveal(sectionRef, 0)`

---

## 5. HowItWorks

**File**: `nuxt-app/app/components/marketing/HowItWorks.vue`
**Libraries**: GSAP ScrollTrigger

### Structure

```
Root: <section id="how-it-works" class="py-32">
Container: <div class="mx-auto max-w-6xl px-6">

Header:
  <span class="text-xs font-mono uppercase tracking-[0.2em] text-accent-cyan mb-4 block">How it works</span>
  <h2 class="text-[clamp(2rem,4vw,3.5rem)] font-display font-semibold leading-[1.1] text-text-base text-balance">
    Three steps to AI-ready commerce
  </h2>

Grid: <div class="relative grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
```

**Connector line** (desktop):
```
<div class="hidden md:block absolute top-16 left-[16.66%] right-[16.66%] h-px" aria-hidden="true">
  <div ref="connectorRef" class="h-full bg-gradient-to-r from-accent-violet via-accent-cyan to-accent-violet origin-left scale-x-0" />
</div>
```
GSAP: `scaleX: 0 -> 1`, duration: 1.2, `power2.inOut`, trigger at 75%

**Step card**:
```
Number badge: w-12 h-12 rounded-full bg-surface-2 border border-border-base (text: font-mono text-accent-violet)
Icon: w-10 h-10 rounded-xl bg-surface-2 border border-border-base (icon: text-accent-cyan)
Title: text-lg font-display font-medium text-text-base
Desc: text-sm text-text-muted leading-relaxed max-w-xs
```

Steps data:
```typescript
[
  { number: '01', icon: 'i-lucide-link', title: 'Paste your URL', description: 'Enter your website address. Our crawler indexes every product, service, and page automatically.' },
  { number: '02', icon: 'i-lucide-brain', title: 'AI indexes your catalog', description: 'Content is chunked, embedded, and stored in a vector database. Your entire catalog becomes AI-searchable.' },
  { number: '03', icon: 'i-lucide-rocket', title: 'Go live in minutes', description: 'Add one script tag. Your AI chat widget is live, and your products appear in LLM answers.' },
]
```

Steps entrance: stagger 0.15, `{ opacity: 0, y: 40 }`, duration 0.7, `power3.out`

Mobile: vertical stack with left-side gradient connector line.

---

## 6. FeatureBento

**File**: `nuxt-app/app/components/marketing/FeatureBento.vue`
**Libraries**: Motion/Vue (stagger entrance)

### Structure

```
Root: <section id="features" class="py-32">
Grid: grid grid-cols-1 md:grid-cols-3 gap-4
```

**Card**:
```
group relative rounded-2xl p-6 overflow-hidden
bg-surface-2 border border-border-base
hover:border-accent-violet/30 transition-colors duration-300
```

Mouse-follow glow (CSS `--mouse-x/y`):
```
<div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
  style="background: radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(124,58,237,0.06), transparent 40%);"
  aria-hidden="true" />
```

Icon: `w-10 h-10 rounded-xl bg-surface-3 border border-border-base` → `UIcon class="w-5 h-5 text-accent-violet"`
Title: `text-base font-display font-medium text-text-base`
Desc: `text-sm text-text-muted leading-relaxed`
Tag: `text-[10px] font-mono uppercase tracking-[0.15em] text-accent-cyan px-2 py-0.5 rounded-full border border-accent-cyan/20 bg-accent-cyan/5`

Features data:
```typescript
[
  { title: 'AI Chat Widget', description: 'A RAG-powered assistant...', icon: 'i-lucide-message-square', tag: 'Core', span: 'md:col-span-2' },
  { title: 'Smart Crawling', description: 'Paste a URL...', icon: 'i-lucide-scan-search', tag: null, span: '' },
  { title: 'LLM-Optimized Pages', description: 'Auto-generated static pages...', icon: 'i-lucide-file-code-2', tag: 'Phase 2', span: '' },
  { title: 'MCP Endpoint', description: 'A per-merchant API...', icon: 'i-lucide-plug', tag: 'Phase 2', span: 'md:col-span-2' },
  { title: 'Analytics Dashboard', description: 'Track conversations...', icon: 'i-lucide-bar-chart-3', tag: null, span: 'md:col-span-2' },
  { title: 'Webhook Automation', description: 'Events like lead_detected...', icon: 'i-lucide-webhook', tag: 'Phase 3', span: '' },
]
```

Motion/Vue stagger: `{ staggerChildren: 0.07 }`, each: `{ opacity: 0, y: 24, scale: 0.97 }` -> visible in 0.5s with ease `[0.22, 1, 0.36, 1]`

---

## 7. ProductShowcase

**File**: `nuxt-app/app/components/marketing/ProductShowcase.vue`
**Libraries**: GSAP ScrollTrigger (pinned horizontal scroll)

### Structure

```
Root: <section id="product-showcase" class="py-32">
Pin container: <div ref="containerRef" class="relative overflow-hidden">
Track: <div ref="trackRef" class="flex gap-8 px-6 will-change-transform">
Panel: <div class="flex-shrink-0 w-[85vw] md:w-[60vw] lg:w-[50vw]">
```

Panel card: `rounded-2xl bg-surface-2 border border-border-base overflow-hidden`
Panel header: icon + title + subtitle, `px-6 py-4 border-b border-border-base`
Panel visual: `aspect-[16/10] bg-surface-1` (placeholder div for now)

Panels:
```typescript
[
  { title: 'Live on your website', subtitle: 'Chat widget embedded in one line of code', icon: 'i-lucide-globe' },
  { title: 'Smart conversations', subtitle: 'RAG-powered answers grounded in your catalog', icon: 'i-lucide-message-square' },
  { title: 'Actionable analytics', subtitle: 'Understand what customers ask', icon: 'i-lucide-bar-chart-3' },
]
```

### GSAP

```typescript
const totalWidth = trackRef.value.scrollWidth - trackRef.value.offsetWidth
gsap.to(trackRef.value, {
  x: -totalWidth,
  ease: 'none',
  scrollTrigger: { trigger: containerRef.value, pin: true, scrub: 1, end: () => `+=${totalWidth}`, invalidateOnRefresh: true },
})
```

Mobile fallback: `overflow-x-auto snap-x snap-mandatory scrollbar-hide` (no GSAP pin on < md)

---

## 8. Testimonials

**File**: `nuxt-app/app/components/marketing/Testimonials.vue`
**Libraries**: Motion/Vue (stagger)

### Structure

```
Grid: grid grid-cols-1 md:grid-cols-3 gap-6
Card: <blockquote> with class "glass rounded-2xl p-6 flex flex-col"
```

Quote icon: `UIcon i-lucide-quote w-6 h-6 text-accent-violet/40`
Text: `text-sm text-text-base leading-relaxed`
Footer: avatar (10x10 rounded-full) + `<cite>` name + role/company

Placeholder data: 3 fictional merchants (Marie Laurent/Odysway, James Chen/Pacific Trails, Sofia Reyes/Casa Bonita Hotels)

Motion/Vue stagger: `{ staggerChildren: 0.1 }`, each: `{ opacity: 0, y: 24 }`

---

## 9. PricingSection

**File**: `nuxt-app/app/components/marketing/PricingSection.vue`
**Libraries**: Motion/Vue (stagger, toggle animation, AnimatePresence)

### Structure

```
Root: <section id="pricing" class="py-32">
Grid: grid grid-cols-1 md:grid-cols-3 gap-6 items-start
```

**Billing toggle**: `role="switch"` + `aria-checked`
- Knob: `motion.div` with `{ type: 'spring', stiffness: 500, damping: 30 }`
- "Save 20%" badge: mono text in cyan pill

**Cards**:
- Regular: `bg-surface-2 border border-border-base rounded-2xl p-8`
- Pro (highlighted): `border-2 border-accent-violet/50 glow-violet` + "Most popular" badge positioned `-top-3`

**Price animation**: `AnimatePresence` slide `{ y: ±10, opacity }` on toggle

Plans: Starter $29/$23, Pro $79/$63 (highlighted), Enterprise Custom

Feature lists with `UIcon i-lucide-check text-accent-violet`

CTAs: violet solid for Pro, ghost outline for others

---

## 10. CTASection

**File**: `nuxt-app/app/components/marketing/CTASection.vue`
**Libraries**: GSAP (reveal), Motion/Vue (MagneticButton)

### Structure

```
Root: <section class="py-32 relative overflow-hidden">
Background: radial-gradient violet + cyan (decorative)
Heading: text-[clamp(2rem,5vw,4rem)] font-display font-bold
Copy: "Ready to make your products visible to AI?"
Sub: "Set up in 5 minutes. No credit card required."
CTAs: MagneticButton primary + ghost
```

Entrance: `useReveal(ctaSectionRef, 0)`

---

## 11. MarketingFooter

**File**: `nuxt-app/app/components/marketing/MarketingFooter.vue`
**Libraries**: CSS only

### Structure

```
Root: <footer class="border-t border-border-base bg-surface-base">
Top: grid grid-cols-2 md:grid-cols-4 gap-8, py-16
Bottom bar: border-t, py-6, copyright + social icons
```

Brand column: logo + tagline
Nav columns: Product (Features, Pricing, Docs, Changelog) | Company (About, Blog, Contact) | Legal (Privacy, Terms, Cookies)
Socials: X, GitHub, Discord — `UIcon w-4 h-4 text-text-subtle hover:text-text-muted`

Column heading: `text-xs font-mono uppercase tracking-[0.12em] text-text-subtle`
Links: `text-sm text-text-muted hover:text-text-base transition-colors duration-200`

---

## 12. Page: `pages/index.vue`

```vue
<script setup lang="ts">
definePageMeta({ layout: 'marketing' })

useSeoMeta({
  title: 'Synth — Turn any website into an AI-powered storefront',
  description: 'Paste your URL. Our AI crawls your catalog, builds a smart chat widget, and makes your products discoverable by ChatGPT, Perplexity, and Claude.',
  ogTitle: 'Synth — AI-powered storefronts for every merchant',
  ogDescription: 'Turn any website into an AI-discoverable storefront.',
  twitterCard: 'summary_large_image',
})
</script>

<template>
  <div>
    <MarketingHeroSection />
    <MarketingLogoCloud />
    <MarketingHowItWorks />
    <MarketingFeatureBento />
    <MarketingProductShowcase />
    <MarketingTestimonials />
    <MarketingPricingSection />
    <MarketingCTASection />
    <MarketingFooter />
  </div>
</template>
```

---

## 13. Additional CSS for `main.css`

Add inside `@layer utilities`:
```css
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
```

Add at root level:
```css
@keyframes logo-scroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.animate-logo-scroll {
  animation: logo-scroll 30s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .animate-logo-scroll { animation: none; }
  .hero-mesh-animated { animation: none; }
}
```

---

## 14. App restructure: `app.vue`

Current `app.vue` has `UHeader`/`UMain`/`UFooter` baked in. Restructure to:

```vue
<script setup>
useHead({
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [{ rel: 'icon', href: '/favicon.ico' }],
  htmlAttrs: { lang: 'en' },
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
```

Move the existing UHeader/UMain/UFooter content to `layouts/default.vue` for dashboard/auth pages.

---

## 15. Implementation Order

```
1. pnpm add gsap lenis (DONE)
2. plugins: gsap.client.ts, lenis.client.ts (gsap.client.ts DONE, lenis.client.ts DONE — rewrite both)
3. composables: useGsap, useLenis, useTextReveal, useReveal
4. Shared components: NoiseOverlay, CustomCursor, MagneticButton
5. Layout: marketing.vue
6. CSS additions in main.css
7. Sections: MarketingNav -> HeroSection -> LogoCloud -> HowItWorks -> FeatureBento -> ProductShowcase -> Testimonials -> PricingSection -> CTASection -> MarketingFooter
8. Page: pages/index.vue (replace)
9. App: app.vue restructure + layouts/default.vue
```

---

## Key Animation Values Reference

| Element | Library | Values |
|---------|---------|--------|
| Word reveal | GSAP | `y: '110%' -> '0%'`, stagger: 0.04, duration: 0.9, `power4.out` |
| Section fade-up | GSAP | `y: 40 -> 0, opacity: 0 -> 1`, duration: 0.8, `power3.out` |
| Bento stagger | Motion/Vue | staggerChildren: 0.07, each: `{ y: 24, scale: 0.97 }`, 0.5s, `[0.22, 1, 0.36, 1]` |
| Magnetic spring | Motion/Vue | stiffness: 150, damping: 15, mass: 0.1 |
| Custom cursor | Motion/Vue | stiffness: 500, damping: 28, mass: 0.5 |
| Nav border | GSAP | opacity 0->1, scroll > 80px, `power2.out` |
| Mockup entrance | GSAP | `{ y: 80, scale: 0.95, opacity: 0 }`, duration: 1.2, `power3.out`, delay: 0.6 |
| Mockup parallax | GSAP | `y: -40`, scrub: 1 |
| Connector line | GSAP | `scaleX: 0 -> 1`, duration: 1.2, `power2.inOut` |
| Page transition | Motion/Vue | `{ opacity, y: ±20 }`, 0.4s, `[0.22, 1, 0.36, 1]` |
| Price toggle | Motion/Vue | `{ y: ±10, opacity }`, 0.2s |
| Toggle knob | Motion/Vue | stiffness: 500, damping: 30 |
| Horiz scroll | GSAP | `x: -totalWidth`, scrub: 1, pinned |

---

## Accessibility Checklist

- All GSAP/Motion animations bail out on `prefers-reduced-motion: reduce`
- Skip-link to `#main-content` in marketing layout
- Nav: `aria-expanded` on hamburger, `aria-controls="mobile-nav"`
- Decorative elements: `aria-hidden="true"` (noise, cursor, glows, connector)
- All headings: semantic hierarchy h1 -> h2 -> h3
- Pricing toggle: `role="switch"` + `aria-checked`
- Testimonials: `<blockquote>` + `<cite>` + `<footer>`
- Focus rings: `focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2`
- Touch targets: minimum 44x44px
