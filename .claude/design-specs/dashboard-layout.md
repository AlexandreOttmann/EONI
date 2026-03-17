# Dashboard Layout — Design Spec

> **Surface**: Dashboard
> **Libraries**: Motion/Vue + CSS only (no GSAP, no Lenis)
> **Design standard**: Clean, data-dense, functional. Nuxt UI v3 (`U`-prefix) everywhere.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-17 | **v2 — Post-marketing cohesion pass.** Aligned with Phase 1a marketing surface. Added: glass utility usage for sidebar/header, `glow-violet` hover on stat cards, number count-up animation, enhanced empty states with violet/cyan accents, improved CrawlProgressCard with glass effect, auth page noise overlay + dual-glow background, skeleton shimmer patterns, gradient-border stat card hover, sparkline trend indicator spec, merchant footer glass treatment. Clarified CSS utility references from `main.css`. |
| 2026-03-10 | v1 — Initial dashboard layout spec. |

---

## 1. Design System Tokens

### Color Palette (defined in `assets/css/main.css` — do not duplicate)

```
Surface layers (dark):
  surface-base   #030305   — page background
  surface-1      #0c0c10   — sidebar, header
  surface-2      #13131a   — cards, panels
  surface-3      #1c1c26   — hover states, input fill

Accents (violet/cyan duotone — shared with marketing):
  accent-violet   #7c3aed
  accent-violet-2 #a78bfa
  accent-cyan     #06b6d4
  accent-cyan-2   #67e8f9

Text:
  text-base    #f0f0f5   — primary
  text-muted   #71717a   — secondary, descriptions
  text-subtle  #3f3f46   — disabled, placeholders

Border:
  border-base  #27272a

Semantic:
  success  #22c55e
  warning  #f59e0b
  error    #ef4444
```

### CSS Utilities from `main.css` (use in dashboard where noted)

```
.glass           — rgba(12,12,16,0.6) + blur(16px) + subtle white border
.glow-violet     — violet box-shadow halo (stat cards on hover, active states)
.glow-cyan       — cyan box-shadow halo (accent variant)
.gradient-text-violet-cyan — gradient text fill (page titles, key metrics)
```

**Usage rules for dashboard**: these utilities are available but must be used with restraint. The dashboard is a tool, not a marketing page. Reserve `.glow-violet` for hover states and active indicators. Reserve `.gradient-text-violet-cyan` for the main page title or a single hero metric, never for every heading. Use `.glass` for the sidebar merchant footer and header backdrop.

### `app.config.ts` (no changes needed — already configured)

```ts
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'violet',
      neutral: 'zinc',
    },
  },
})
```

### Typography Scale

```
Display  : Space Grotesk, font-display
Body     : Inter, font-sans
Mono     : JetBrains Mono, font-mono

Heading sizes (always clamp + text-wrap: balance):
  page-title   : text-[clamp(1.5rem,3vw,2rem)] font-display font-semibold
  section-title: text-[clamp(1.125rem,2vw,1.375rem)] font-display font-medium
  card-title   : text-base font-medium text-text-base
  label        : text-xs font-mono uppercase tracking-[0.12em] text-text-muted
  body         : text-sm text-text-muted leading-relaxed
  mono-data    : text-sm font-mono tabular-nums text-text-base
```

---

## 2. DashboardLayout

**Surface**: dashboard
**File**: `app/layouts/dashboard.vue`
**Libraries**: Motion/Vue, CSS only

### Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  [DashboardSidebar — fixed left, w-60, surface-1]               │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  [DashboardHeader — sticky top-0, h-14, glass]            │ │
│  │────────────────────────────────────────────────────────────│ │
│  │                                                            │ │
│  │  <slot /> — scrollable, bg-surface-base, p-6              │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Outer wrapper**:
```html
<div class="flex min-h-screen bg-surface-base">
  <DashboardSidebar />
  <div class="flex flex-col flex-1 min-w-0 ml-60">
    <DashboardHeader />
    <main id="main-content" class="flex-1 p-6 overflow-y-auto">
      <slot />
    </main>
  </div>
</div>
```

### Page Transition

Wrap the slot with a subtle Motion/Vue crossfade on route change:

```vue
<AnimatePresence mode="wait">
  <motion.main
    :key="route.path"
    id="main-content"
    class="flex-1 p-6 overflow-y-auto"
    :initial="{ opacity: 0 }"
    :animate="{ opacity: 1 }"
    :exit="{ opacity: 0 }"
    :transition="{ duration: 0.15 }"
  >
    <slot />
  </motion.main>
</AnimatePresence>
```

This is intentionally faster than marketing transitions (0.15s vs 0.4s). Dashboard users navigate frequently and should never feel slowed down.

### Responsive

- `sm` (< 768px): sidebar hidden by default, opens as drawer overlay via `useSidebar()` composable
- `md` (768-1023px): sidebar collapses to icon-only mode (`w-16`)
- `lg+` (>= 1024px): full sidebar visible (`w-60`)

### Accessibility

- `<main id="main-content">` — target for skip-to-content link
- Skip link: `<a href="#main-content" class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent-violet focus:text-white focus:rounded-lg">Skip to main content</a>`

---

## 3. DashboardSidebar

**Surface**: dashboard
**File**: `app/components/dashboard/Sidebar.vue`
**Libraries**: Motion/Vue

### Structure

```
┌─────────────────────┐
│  [Logo — top, p-4]  │
│  ─────────────────  │
│  [Nav group]        │
│    * Overview       │
│    * Crawl          │
│    * Chat Preview   │
│    * Widget         │
│    * Analytics      │
│    * Settings       │
│  ─────────────────  │
│  [Merchant footer   │
│   glass treatment]  │
│    avatar + name    │
│    plan badge       │
└─────────────────────┘
```

**Root element**:
```
fixed inset-y-0 left-0 z-30 w-60 flex flex-col
bg-surface-1 border-r border-border-base
```

**Logo area**:
```
h-14 flex items-center px-4 border-b border-border-base
```

Logo mark: `w-7 h-7 rounded-lg bg-gradient-to-br from-accent-violet to-accent-cyan` — matches the marketing nav logo exactly.
Logo text: `ml-2 text-sm font-display font-semibold text-text-base`

**Nav section label**:
```
px-3 mb-1 text-xs font-mono uppercase tracking-[0.12em] text-text-subtle
```

**Nav item** (base + states):
```css
/* base */
group relative flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm
text-text-muted transition-colors duration-150
hover:bg-surface-3 hover:text-text-base touch-action-manipulation

/* active */
bg-accent-violet/8 text-text-base

/* active indicator — left edge pill */
::before content-[''] absolute left-0 top-1/2 -translate-y-1/2
w-0.5 h-4 rounded-r bg-gradient-to-b from-accent-violet to-accent-cyan
```

The active state uses `bg-accent-violet/8` (violet tint at 8% opacity) instead of the generic `bg-surface-3`, creating a subtle but unmistakable connection to the brand accent. The left indicator uses the violet-to-cyan gradient, matching the marketing site's duotone language.

**Nav item icon**: `w-4 h-4 shrink-0` — active icon color: `text-accent-violet`

**Focus state** (all nav items):
```
focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2
focus-visible:ring-offset-surface-1 focus-visible:outline-none
```

**Merchant footer** (glass treatment):
```
mt-auto mx-2 mb-2 p-3 rounded-xl glass
```

Using the `.glass` utility here creates a subtle elevated card at the bottom of the sidebar, visually separating the merchant info from the navigation. This mirrors the glass morphism used in the marketing nav.

Avatar: `UAvatar` size="sm"
Name: `text-sm font-medium text-text-base truncate min-w-0`
Plan badge: `UBadge` color="violet" variant="subtle" size="xs"

### Nav Items

```ts
const navItems = [
  { label: 'Overview',     icon: 'i-heroicons-squares-2x2', to: '/dashboard' },
  { label: 'Crawl',        icon: 'i-heroicons-arrow-path',  to: '/dashboard/crawl' },
  { label: 'Chat Preview', icon: 'i-heroicons-chat-bubble-left-ellipsis', to: '/dashboard/chat' },
  { label: 'Widget',       icon: 'i-heroicons-code-bracket', to: '/dashboard/widget' },
  { label: 'Analytics',    icon: 'i-heroicons-chart-bar',   to: '/dashboard/analytics' },
  { label: 'Settings',     icon: 'i-heroicons-cog-6-tooth', to: '/dashboard/settings' },
]
```

### Entrance Animation

```ts
// sidebar itself: instant — no animation (structural chrome)
// nav items: subtle stagger on mount
:variants="{
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } }
}"
// each item:
:variants="{
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.2, ease: 'easeOut' } }
}"
```

### Interaction

Active link indicator slide:
```ts
// Use <motion.div> as absolute positioned active pill
// Animate its `top` position as route changes
:animate="{ top: activeIndex * itemHeight }"
:transition="{ type: 'spring', stiffness: 400, damping: 30 }"
```

### Mobile Drawer (sm)

```ts
// Controlled by useSidebar() composable
// Drawer slides in from left
:initial="{ x: '-100%' }"
:animate="{ x: isOpen ? '0%' : '-100%' }"
:transition="{ type: 'spring', stiffness: 300, damping: 30 }"
```
Backdrop: `fixed inset-0 z-20 bg-black/50 backdrop-blur-sm`
Drawer root: add `overscroll-behavior: contain` to prevent scroll bleed.

### Reduced Motion Fallback

No position/transform animations. Active indicator appears instantly. Stagger removed.

### Accessibility

- `<nav aria-label="Dashboard navigation">`
- Active link: `aria-current="page"`
- Mobile toggle button: `aria-expanded`, `aria-controls="sidebar"`
- `id="sidebar"` on the sidebar nav element
- All items keyboard-navigable, tab order: logo -> nav items -> merchant footer

---

## 4. DashboardHeader

**Surface**: dashboard
**File**: `app/components/dashboard/Header.vue`
**Libraries**: CSS only

### Structure

```
┌────────────────────────────────────────────────────────────┐
│ [Mobile menu toggle (sm only)]  [Page title]  [right zone] │
│                                               [UButton     │
│                                                "New Crawl" │
│                                                + UColorMode│
│                                                toggle]     │
└────────────────────────────────────────────────────────────┘
```

**Root** — uses `.glass` utility for consistency with marketing nav:
```
sticky top-0 z-20 h-14 flex items-center justify-between
px-6 border-b border-border-base glass
```

This replaces the previous `bg-surface-1/80 backdrop-blur-xl` with the shared `.glass` utility, ensuring the header's frosted effect matches the marketing navigation bar. The user experiences the same glass language across the entire product.

**Page title**: injected via `useHead()` or slot from each page — `text-sm font-medium text-text-base`

**Right zone**: `flex items-center gap-2`

Color mode toggle: `UButton` icon-only, `variant="ghost"`, `color="neutral"`, `aria-label="Toggle color mode"`, `size="sm"`

New Crawl CTA (shown on Overview + Crawl pages only):
```
UButton label="New Crawl" icon="i-heroicons-plus"
color="violet" variant="solid" size="sm"
```

### Responsive

- `sm`: show hamburger menu icon button (`aria-label="Open navigation"`)
- `md+`: hamburger hidden

### Accessibility

- `<header role="banner">`
- Color mode button: `aria-label="Switch to dark/light mode"`
- New Crawl button: `aria-label="Start a new crawl job"`

---

## 5. DashboardOverview (page)

**Surface**: dashboard
**File**: `app/pages/dashboard/index.vue`
**Libraries**: Motion/Vue

### Structure

```
┌──────────────────────────────────────────────────────┐
│  Page title: "Overview"                              │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐  │
│  │ Pages    │ │ Chunks   │ │Convers.  │ │ Status │  │
│  │ crawled  │ │ indexed  │ │ this wk  │ │ badge  │  │
│  │ [spark]  │ │ [spark]  │ │ [spark]  │ │        │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘  │
│                                                      │
│  ┌──────────────────────────┐ ┌────────────────────┐ │
│  │ Recent Crawl Jobs        │ │ Last Conversations  │ │
│  │ UTable                   │ │ UTable              │ │
│  └──────────────────────────┘ └────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### Stat Cards (4-column grid)

```html
<motion.div
  class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
  :variants="{
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.06 } }
  }"
  initial="hidden"
  animate="visible"
>
  <motion.div
    v-for="stat in stats"
    :key="stat.label"
    :variants="{
      hidden: { opacity: 0, y: 8 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } }
    }"
  >
    <UCard
      class="group relative overflow-hidden transition-shadow duration-300 hover:glow-violet"
    >
      <!-- Hover glow — mouse-follow radial, same pattern as marketing bento cards -->
      <div
        class="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style="background: radial-gradient(400px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(124,58,237,0.06), transparent 40%)"
        aria-hidden="true"
      />

      <div class="relative z-10">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-mono uppercase tracking-[0.12em] text-text-muted">
            {{ stat.label }}
          </span>
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-violet/10">
            <UIcon :name="stat.icon" class="w-3.5 h-3.5 text-accent-violet" />
          </div>
        </div>

        <!-- Animated count-up value -->
        <p
          class="text-2xl font-display font-semibold tabular-nums text-text-base"
          :aria-label="`${stat.label}: ${stat.value}`"
        >
          {{ animatedValue }}
        </p>

        <!-- Delta + sparkline row -->
        <div class="mt-2 flex items-center justify-between">
          <span
            v-if="stat.delta"
            class="inline-flex items-center gap-1 text-xs font-mono tabular-nums"
            :class="stat.deltaPositive ? 'text-success' : 'text-error'"
          >
            <UIcon
              :name="stat.deltaPositive ? 'i-heroicons-arrow-trending-up' : 'i-heroicons-arrow-trending-down'"
              class="w-3 h-3"
            />
            {{ stat.delta }}
          </span>
          <!-- Mini sparkline (inline SVG, 48x16) -->
          <svg
            v-if="stat.sparkline"
            class="w-12 h-4 text-accent-violet/40"
            viewBox="0 0 48 16"
            fill="none"
            aria-hidden="true"
          >
            <polyline
              :points="stat.sparkline"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
      </div>
    </UCard>
  </motion.div>
</motion.div>
```

**Mouse-follow glow handler** (same pattern as marketing `FeatureBento.vue`):
```ts
function onMouseMove(event: MouseEvent, cardEl: EventTarget | null) {
  const el = cardEl as HTMLElement | null
  if (!el) return
  const rect = el.getBoundingClientRect()
  el.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`)
  el.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`)
}
```

Add `@mousemove="onMouseMove($event, $event.currentTarget)"` to each stat card wrapper.

**Number count-up animation** (composable):

```ts
// app/composables/useCountUp.ts
export function useCountUp(target: Ref<number>, duration = 600) {
  const display = ref(0)

  watch(target, (newVal) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      display.value = newVal
      return
    }
    const start = display.value
    const diff = newVal - start
    const startTime = performance.now()

    function tick(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      display.value = Math.round(start + diff * eased)
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, { immediate: true })

  return display
}
```

**UCard theme override** (via `app.config.ts` `ui.card`):
```ts
card: {
  base: 'bg-surface-2 border border-border-base rounded-xl overflow-hidden',
  body: { padding: 'p-4' }
}
```

### Stat Data Shape

```ts
interface StatCard {
  label: string
  value: number
  icon: string
  delta: string | null        // e.g., "+12%" or "-3%"
  deltaPositive: boolean
  sparkline: string | null    // SVG polyline points, e.g., "0,12 8,10 16,14 24,6 32,8 40,4 48,2"
}
```

### Recent Activity Tables

Two-column grid on `lg+`, stacked on `sm/md`:
```html
<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
  <UCard>
    <template #header>
      <h2 class="text-sm font-medium text-text-base">Recent Crawls</h2>
    </template>
    <UTable :rows="recentCrawls" :columns="crawlColumns" />
  </UCard>
  <UCard>
    <template #header>
      <h2 class="text-sm font-medium text-text-base">Recent Conversations</h2>
    </template>
    <UTable :rows="recentConversations" :columns="conversationColumns" />
  </UCard>
</div>
```

### Empty State

```html
<!-- When no crawl jobs exist -->
<div class="flex flex-col items-center justify-center py-16 text-center">
  <!-- Icon container with violet glow ring -->
  <div class="relative mb-6">
    <div
      class="absolute inset-0 rounded-full blur-xl opacity-30"
      style="background: radial-gradient(circle, rgba(124,58,237,0.4) 0%, transparent 70%)"
      aria-hidden="true"
    />
    <div class="relative w-14 h-14 rounded-full bg-accent-violet/10 border border-accent-violet/20 flex items-center justify-center">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-accent-violet" />
    </div>
  </div>

  <h3 class="text-base font-display font-medium text-text-base mb-1">No crawls yet</h3>
  <p class="text-sm text-text-muted mb-6 max-w-xs">
    Add your store URL to start indexing your products for AI search.
  </p>
  <UButton label="Start your first crawl" to="/dashboard/crawl" color="violet" size="md" />
</div>
```

The empty state uses the violet glow halo behind the icon — the same radial gradient language used throughout the marketing surface — to make these states feel intentional rather than like error screens.

### Skeleton Loading State

Before data loads, show shimmer placeholders:

```vue
<!-- Stat card skeleton -->
<UCard>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <motion.div
        class="h-3 w-16 rounded bg-surface-3"
        :animate="{ opacity: [0.4, 1, 0.4] }"
        :transition="{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }"
      />
      <motion.div
        class="h-7 w-7 rounded-lg bg-surface-3"
        :animate="{ opacity: [0.4, 1, 0.4] }"
        :transition="{ repeat: Infinity, duration: 1.5, ease: 'easeInOut', delay: 0.1 }"
      />
    </div>
    <motion.div
      class="h-7 w-20 rounded bg-surface-3"
      :animate="{ opacity: [0.4, 1, 0.4] }"
      :transition="{ repeat: Infinity, duration: 1.5, ease: 'easeInOut', delay: 0.2 }"
    />
    <motion.div
      class="h-3 w-12 rounded bg-surface-3"
      :animate="{ opacity: [0.4, 1, 0.4] }"
      :transition="{ repeat: Infinity, duration: 1.5, ease: 'easeInOut', delay: 0.3 }"
    />
  </div>
</UCard>
```

### Reduced Motion Fallback

All `y` animations set to `y: 0`, only `opacity` animates. Count-up jumps to final value instantly. Shimmer uses static `opacity: 0.5` instead of pulsing.

### Accessibility

- Stat values: `aria-label="Pages crawled: 1,204"` (full label, not just number)
- Delta arrows: `aria-hidden="true"` (the text carries the meaning)
- Sparklines: `aria-hidden="true"` (decorative)
- Tables: `<UTable>` renders semantic `<table>` — no extra work needed
- Empty state CTA: standard `<a>` via `to=` prop

---

## 6. CrawlPage

**Surface**: dashboard
**File**: `app/pages/dashboard/crawl.vue`
**Libraries**: Motion/Vue

### Structure

```
┌──────────────────────────────────────────────────────┐
│  "Crawl your store"  [h1]                            │
│  Subtitle description [p, text-muted]                │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │  URL Input row                               │    │
│  │  [UInput placeholder="https://..."]          │    │
│  │  [UButton "Start Crawl"]                     │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │  Active Crawl Job (visible when running)     │    │
│  │  CrawlProgressCard — glass treatment         │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │  Crawl History — UTable                      │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

### CrawlProgressCard Component

**File**: `app/components/dashboard/CrawlProgressCard.vue`

```html
<UCard class="glass relative overflow-hidden">
  <!-- Top-edge glow when running -->
  <div
    v-if="job.status === 'running'"
    class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-violet to-transparent"
    aria-hidden="true"
  />

  <div class="flex items-center justify-between mb-3">
    <div class="flex items-center gap-2 min-w-0">
      <!-- Animated spinner only when running -->
      <motion.div
        v-if="job.status === 'running'"
        :animate="{ rotate: 360 }"
        :transition="{ repeat: Infinity, duration: 1, ease: 'linear' }"
        class="shrink-0"
      >
        <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 text-accent-violet" />
      </motion.div>
      <UIcon v-else-if="job.status === 'completed'" name="i-heroicons-check-circle" class="w-4 h-4 text-success shrink-0" />
      <UIcon v-else-if="job.status === 'failed'" name="i-heroicons-x-circle" class="w-4 h-4 text-error shrink-0" />
      <UIcon v-else name="i-heroicons-clock" class="w-4 h-4 text-text-subtle shrink-0" />
      <span class="text-sm font-medium text-text-base truncate min-w-0">
        {{ job.url }}
      </span>
    </div>
    <UBadge
      :color="statusColor(job.status)"
      variant="subtle"
      size="xs"
      class="shrink-0 ml-2"
    >
      {{ job.status }}
    </UBadge>
  </div>

  <!-- Progress bar -->
  <div
    class="h-1.5 bg-surface-3 rounded-full overflow-hidden"
    role="progressbar"
    :aria-valuenow="progressPct"
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <motion.div
      class="h-full bg-gradient-to-r from-accent-violet to-accent-cyan rounded-full"
      :animate="{ width: `${progressPct}%` }"
      :transition="{ type: 'spring', stiffness: 40, damping: 12 }"
    />
  </div>

  <!-- Stats row -->
  <div class="mt-3 flex gap-4 text-xs font-mono tabular-nums text-text-muted">
    <span>{{ job.pages_crawled }}&nbsp;/&nbsp;{{ job.pages_found }} pages</span>
    <span>{{ job.chunks_created }} chunks</span>
    <span v-if="job.elapsed_time" class="ml-auto">{{ job.elapsed_time }}</span>
  </div>
</UCard>
```

The card uses `.glass` for the semi-transparent frosted background, and adds a thin gradient line along the top edge when a crawl is running. This creates a subtle "active" visual without being distracting. The gradient uses the same `from-accent-violet to-accent-cyan` direction as the progress bar, creating a cohesive look.

**statusColor mapping**:
```ts
const statusColor = (s: string) => ({
  pending:   'neutral',
  running:   'violet',
  completed: 'green',
  failed:    'red',
})[s] ?? 'neutral'
```

### Crawl History Table Columns

```ts
const columns = [
  { key: 'url',           label: 'URL',       class: 'max-w-xs truncate' },
  { key: 'status',        label: 'Status' },
  { key: 'pages_crawled', label: 'Pages',     class: 'tabular-nums' },
  { key: 'chunks_created',label: 'Chunks',    class: 'tabular-nums' },
  { key: 'started_at',    label: 'Started' },
  { key: 'actions',       label: '' },
]
```

### Reduced Motion Fallback

Progress bar: instant width change (no spring). Spinner replaced with static icon with `text-accent-violet` color (still visible as "active").

### Accessibility

- URL input: `<label>` associated via `for`/`id`, or `aria-label="Store URL"`
- Crawl status badge: `aria-live="polite"` wrapper so status changes are announced
- Progress bar: `role="progressbar" :aria-valuenow="progressPct" aria-valuemin="0" aria-valuemax="100"`
- Non-breaking spaces in stat values (e.g., `12&nbsp;/&nbsp;50 pages`) for cleaner screen reader output

---

## 7. WidgetConfigPage

**Surface**: dashboard
**File**: `app/pages/dashboard/widget.vue`
**Libraries**: Motion/Vue, CSS only

### Structure

```
┌────────────────────────────────────────────────────┐
│  "Widget Configuration"                            │
│                                                    │
│  ┌──────────────────────┐  ┌─────────────────────┐ │
│  │ Config Panel (left)  │  │ Live Preview (right)│ │
│  │                      │  │                     │ │
│  │ [Accent color pick]  │  │ [Mini browser frame]│ │
│  │ [Welcome message]    │  │ [Widget floating    │ │
│  │ [Position select]    │  │  button + chat UI   │ │
│  │ [Suggested questions]│  │  mockup]            │ │
│  │                      │  │                     │ │
│  │ [UButton Save]       │  │                     │ │
│  └──────────────────────┘  └─────────────────────┘ │
│                                                    │
│  ┌────────────────────────────────────────────────┐ │
│  │ Install snippet                                │ │
│  │ <code> block with copy button                  │ │
│  └────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

**Layout**: `grid grid-cols-1 lg:grid-cols-2 gap-6`

**Install snippet block**:
```html
<UCard>
  <template #header>
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-medium text-text-base">Install on your site</h2>
      <UButton
        icon="i-heroicons-clipboard-document"
        variant="ghost" color="neutral" size="xs"
        aria-label="Copy install snippet"
        @click="copy(snippet)"
      />
    </div>
  </template>
  <pre class="text-xs font-mono text-text-muted bg-surface-3 rounded-lg p-4 overflow-x-auto">
    <code>{{ snippet }}</code>
  </pre>
</UCard>
```

### Accessibility

- Color picker: `<label>` + `aria-label="Widget accent color"`
- All form inputs: associated labels
- Copy button: `aria-label="Copy install snippet"`, success state: `aria-live="polite"` "Copied!"

---

## 8. AnalyticsPage

**Surface**: dashboard
**File**: `app/pages/dashboard/analytics.vue`
**Libraries**: Motion/Vue, CSS only

### Structure

```
┌──────────────────────────────────────────────────────┐
│  "Analytics"    [date range picker — USelect]        │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │ Total    │ │ Avg conf.│ │ No-answer│             │
│  │ convs    │ │ score    │ │ rate     │             │
│  └──────────┘ └──────────┘ └──────────┘             │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │  Top Questions — UTable                      │    │
│  │  (question text + count + avg confidence)    │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │  Unanswered Questions — UTable               │    │
│  │  (question + count — low confidence_score)   │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

Stat cards: same pattern as Overview section 5, including count-up animation and hover glow. Grid: `grid-cols-1 sm:grid-cols-3 gap-4 mb-6`

No-answer rate badge color: `>20% -> error`, `10-20% -> warning`, `<10% -> success`

### Accessibility

- Date range `USelect`: `aria-label="Date range"`
- No-answer rate: `aria-label="No-answer rate: 14%"`

---

## 9. SettingsPage

**Surface**: dashboard
**File**: `app/pages/dashboard/settings.vue`
**Libraries**: Motion/Vue, CSS only

### Structure

```
┌──────────────────────────────────────────────────────┐
│  "Settings"                                          │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  Profile                                       │  │
│  │  [Business name UInput]                        │  │
│  │  [Domain UInput]                               │  │
│  │  [UButton "Save changes"]                      │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  Account                                       │  │
│  │  [Email — read-only]                           │  │
│  │  [UButton "Change password"]                   │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  Danger zone                                   │  │
│  │  [UButton "Delete account" color="red"        │  │
│  │   variant="outline"]                           │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

**Section cards**: `UCard` stacked, `gap-4`

Danger zone card:
```html
<UCard class="border-error/30">
  <template #header>
    <h2 class="text-sm font-medium text-error">Danger zone</h2>
  </template>
  <div class="flex items-center justify-between">
    <div>
      <p class="text-sm text-text-base">Delete account</p>
      <p class="text-xs text-text-muted">
        Permanently delete your account and all data. This cannot be undone.
      </p>
    </div>
    <UButton label="Delete account" color="red" variant="outline" size="sm" />
  </div>
</UCard>
```

### Accessibility

- Each section: `<section aria-labelledby="section-heading-id">`
- Delete button triggers a `UModal` confirmation before action
- Confirmation modal: `role="alertdialog"`, `aria-describedby` pointing to warning text

---

## 10. AuthLayout + Pages

**Surface**: auth
**File**: `app/layouts/auth.vue`, `app/pages/auth/login.vue`, `app/pages/auth/signup.vue`
**Libraries**: Motion/Vue

### Structure (centered card on dark bg with noise + dual glow)

```
┌────────────────── full screen bg-surface-base ──────────────────┐
│  [NoiseOverlay — same component as marketing, z-50]              │
│  [Dual radial glow — violet top-left, cyan bottom-right]        │
│                                                                  │
│              ┌──────────────────────────┐                        │
│              │  [Logo mark + wordmark]  │                        │
│              │                          │                        │
│              │  [Heading]               │                        │
│              │  [Subtext]               │                        │
│              │                          │                        │
│              │  [Form fields]           │                        │
│              │  [Primary UButton]       │                        │
│              │                          │                        │
│              │  [Divider "or"]          │                        │
│              │  [Google OAuth UButton]  │                        │
│              │                          │                        │
│              │  [Switch link]           │                        │
│              └──────────────────────────┘                        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Background**: `min-h-screen bg-surface-base flex items-center justify-center p-4 relative overflow-hidden`

**Noise overlay**: Reuse `<NoiseOverlay />` from `app/components/marketing/NoiseOverlay.vue`. This is the same grain texture used on the marketing surface, creating continuity between the landing page and the auth flow.

**Dual glow background** (matches marketing hero mesh language):
```html
<!-- Violet glow — top left -->
<div
  class="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 pointer-events-none"
  aria-hidden="true"
  style="background: radial-gradient(ellipse at center, rgba(124,58,237,0.15) 0%, transparent 70%); filter: blur(80px)"
/>
<!-- Cyan glow — bottom right -->
<div
  class="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 pointer-events-none"
  aria-hidden="true"
  style="background: radial-gradient(ellipse at center, rgba(6,182,212,0.10) 0%, transparent 70%); filter: blur(80px)"
/>
```

This creates the same violet/cyan duotone atmosphere as the marketing hero, but softer and more diffuse. The user feels they are still "inside" the same product.

**Card**: `w-full max-w-sm relative` — use `UCard` with `class="glass border-border-base"`

Using `.glass` on the auth card gives it a frosted, elevated look against the glowing background, matching the visual quality of the marketing surface.

### Entrance Animation

```ts
:initial="{ opacity: 0, y: 16, scale: 0.98 }"
:animate="{ opacity: 1, y: 0, scale: 1 }"
:transition="{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }"
```

### Form Validation UX

- `UFormGroup` wraps each field — shows inline error below input
- Submit button: `loading` state while request in-flight (`UButton :loading="pending"`)
- Error toast: `useToast().add({ title: 'Login failed', description: err.message, color: 'red' })`
- Success redirect happens server-side (already built in auth routes)

### Reduced Motion Fallback

Card appears instantly (`opacity: 0 -> 1` only, no y/scale).

### Accessibility

- `<form>` with `aria-label="Sign in"` / `aria-label="Create account"`
- All inputs: `<label>` elements, not placeholder-only
- Error messages: `role="alert"` or `aria-live="assertive"`
- Google button: `aria-label="Continue with Google"`
- Password field: `type="password"`, toggle show/hide with `aria-label="Show/hide password"`

---

## 11. Dashboard-Specific Motion/Vue Patterns Reference

All patterns in one place for `frontend-developer` to reference.

### Count-Up Numbers
See `useCountUp()` composable in Section 5. Use for stat card values, analytics metrics.

### Skeleton Shimmer
```vue
<motion.div
  class="h-4 w-24 rounded bg-surface-3"
  :animate="{ opacity: [0.4, 1, 0.4] }"
  :transition="{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }"
/>
```

### List Stagger (faster than marketing)
```vue
<motion.ul
  :variants="{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.04 } } }"
  initial="hidden"
  animate="visible"
>
  <motion.li
    v-for="item in items"
    :key="item.id"
    :variants="{ hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } } }"
  />
</motion.ul>
```

### Button Press
```vue
<motion.button :whilePress="{ scale: 0.97 }">...</motion.button>
```

### Progress Bar (spring)
```vue
<motion.div
  class="h-full bg-gradient-to-r from-accent-violet to-accent-cyan rounded-full"
  :animate="{ width: `${percent}%` }"
  :transition="{ type: 'spring', stiffness: 40, damping: 12 }"
/>
```

### Toast / Notification Enter
```vue
<motion.div
  :initial="{ opacity: 0, y: -8, scale: 0.95 }"
  :animate="{ opacity: 1, y: 0, scale: 1 }"
  :exit="{ opacity: 0, y: -8, scale: 0.95 }"
  :transition="{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }"
/>
```

### Modal / Dialog Enter
```vue
<AnimatePresence>
  <motion.div
    v-if="isOpen"
    :initial="{ opacity: 0, scale: 0.95, y: 10 }"
    :animate="{ opacity: 1, scale: 1, y: 0 }"
    :exit="{ opacity: 0, scale: 0.95, y: 10 }"
    :transition="{ type: 'spring', stiffness: 300, damping: 25 }"
    style="overscroll-behavior: contain"
  >
    <slot />
  </motion.div>
</AnimatePresence>
```

### Reduced Motion — Global Rule

Every animation pattern above must check `prefers-reduced-motion`. For Motion/Vue, wrap in a computed:

```ts
const prefersReduced = ref(false)
onMounted(() => {
  prefersReduced.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
})

// Then conditionally pass :animate="prefersReduced ? {} : { ... }"
// Or for simple cases, animate opacity only and skip transform
```

---

## 12. Implementation Notes for `frontend-developer`

1. **Use `UCard`, `UButton`, `UInput`, `UTable`, `UBadge`, `UFormGroup`, `UModal`, `UAvatar`** — all auto-imported
2. **CSS utilities**: `.glass`, `.glow-violet`, `.glow-cyan`, `.gradient-text-violet-cyan` are defined in `assets/css/main.css` — use them per the guidelines in Section 1
3. **`useSidebar()` composable** — manage mobile sidebar open/close state (create in `app/composables/useSidebar.ts`)
4. **`useCountUp()` composable** — animate stat card numbers (create in `app/composables/useCountUp.ts`)
5. **`useColorMode()`** from `@nuxtjs/color-mode` — already bundled with Nuxt UI
6. **Route-based page title**: inject via `useHead({ title: 'Overview' })` in each page — header reads via Nuxt's `useAppConfig` or a shared `useDashboard()` composable
7. **`merchant_id`**: auth store holds the current merchant — never pass from client to API, server reads from session
8. **Crawl real-time**: Supabase Realtime subscription in `useCrawl()` composable updates `crawlJob` reactive ref; `CrawlProgressCard` binds to it
9. **Empty states**: every table/list must handle `rows.length === 0` — use the violet-glow empty state pattern from Section 5
10. **Skeleton loading**: show shimmer skeletons while data loads — never show a blank page
11. **Mouse-follow glow**: reuse the `onMouseMove` pattern from marketing `FeatureBento.vue` for stat cards
12. **`NoiseOverlay`**: reuse from `app/components/marketing/NoiseOverlay.vue` in the auth layout
13. **No `console.log`** — use `useLogger()` or structured logging per project rules
