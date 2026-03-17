# Dashboard Layout — Design Spec

> **Surface**: Dashboard
> **Libraries**: Motion/Vue + CSS only (no GSAP, no Lenis)
> **Design standard**: Clean, data-dense, functional. Nuxt UI v3 (`U`-prefix) everywhere.

---

## 1. Design System Tokens

### Color Palette (already in `assets/css/main.css` — do not change)

```
Surface layers (dark):
  surface-base   #030305   — page background
  surface-1      #0c0c10   — sidebar, header
  surface-2      #13131a   — cards, panels
  surface-3      #1c1c26   — hover states, input fill

Accents (violet/cyan duotone):
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

### `app.config.ts` Update Required

```ts
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'violet',   // already set
      neutral: 'zinc',     // already set
    },
  },
})
```

> ⚠️ `app.config.ts` is a critical file — follow `.claude-devtools/settings.json` autoConfirm check before modifying.

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
│  │  [DashboardHeader — sticky top-0, h-14, surface-1/glass]  │ │
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

### Responsive

- `sm` (< 768px): sidebar hidden by default, opens as drawer overlay via `useSidebar()` composable
- `md` (768–1023px): sidebar collapses to icon-only mode (`w-16`)
- `lg+` (≥ 1024px): full sidebar visible (`w-60`)

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
│    • Overview       │
│    • Crawl          │
│    • Chat Preview   │
│    • Widget         │
│    • Analytics      │
│    • Settings       │
│  ─────────────────  │
│  [Merchant info     │
│   bottom, p-4]      │
│    avatar + name    │
│    subscription     │
│    badge            │
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

Logo mark: `w-7 h-7 rounded-lg bg-gradient-to-br from-accent-violet to-accent-cyan`
Logo text: `ml-2 text-sm font-display font-semibold text-text-base`

**Nav section label**:
```
px-3 mb-1 text-xs font-mono uppercase tracking-[0.12em] text-text-subtle
```

**Nav item** (active state):
```
/* base */
group flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm
text-text-muted transition-colors duration-150
hover:bg-surface-3 hover:text-text-base touch-action-manipulation

/* active */
bg-surface-3 text-text-base

/* active indicator */
::before content-[''] absolute left-0 top-1/2 -translate-y-1/2
w-0.5 h-4 rounded-r bg-accent-violet
```

**Nav item icon**: `w-4 h-4 shrink-0` — use Heroicons (auto-imported via Nuxt UI)

**Focus state** (all nav items):
```
focus-visible:ring-2 focus-visible:ring-accent-violet focus-visible:ring-offset-2
focus-visible:ring-offset-surface-1 focus-visible:outline-none
```

**Merchant footer**:
```
mt-auto p-4 border-t border-border-base
```
Avatar: `UAvatar` size="sm"
Name: `text-sm font-medium text-text-base truncate`
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
// sidebar itself: instant — no animation (it's structural chrome)
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

### Reduced Motion Fallback

No position/transform animations. Active indicator appears instantly. Stagger removed.

### Accessibility

- `<nav aria-label="Dashboard navigation">`
- Active link: `aria-current="page"`
- Mobile toggle button: `aria-expanded`, `aria-controls="sidebar"`
- `id="sidebar"` on the sidebar nav element
- All items keyboard-navigable, tab order: logo → nav items → merchant footer

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

**Root**:
```
sticky top-0 z-20 h-14 flex items-center justify-between
px-6 border-b border-border-base
bg-surface-1/80 backdrop-blur-xl
```

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
<div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
  <UCard v-for="stat in stats" ...>
    <div class="flex items-center justify-between">
      <span class="text-xs font-mono uppercase tracking-[0.12em] text-text-muted">
        {{ stat.label }}
      </span>
      <UIcon :name="stat.icon" class="w-4 h-4 text-text-subtle" />
    </div>
    <p class="mt-2 text-2xl font-display font-semibold tabular-nums text-text-base">
      {{ stat.value }}
    </p>
    <p v-if="stat.delta" class="mt-0.5 text-xs text-text-muted">
      {{ stat.delta }}
    </p>
  </UCard>
</div>
```

**UCard theme override** (via `app.config.ts` `ui.card`):
```ts
card: {
  base: 'bg-surface-2 border border-border-base rounded-xl overflow-hidden',
  body: { padding: 'p-4' }
}
```

### Entrance Animation (stat cards)

```ts
// parent
:variants="{
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } }
}"
initial="hidden"
animate="visible"

// each card
:variants="{
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } }
}"
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
  <div class="w-12 h-12 rounded-full bg-surface-3 flex items-center justify-center mb-4">
    <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-text-muted" />
  </div>
  <h3 class="text-sm font-medium text-text-base mb-1">No crawls yet</h3>
  <p class="text-sm text-text-muted mb-4 max-w-xs">
    Add your store URL to start indexing your products for AI search.
  </p>
  <UButton label="Start your first crawl" to="/dashboard/crawl" color="violet" />
</div>
```

### Reduced Motion Fallback

All `y` animations set to `y: 0`, only `opacity` animates.

### Accessibility

- Stat values: `aria-label="Pages crawled: 1,204"` (full label, not just number)
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
│  │  CrawlProgressCard                           │    │
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
<UCard>
  <div class="flex items-center justify-between mb-3">
    <div class="flex items-center gap-2">
      <!-- animated spinner only when running -->
      <motion.div
        v-if="job.status === 'running'"
        :animate="{ rotate: 360 }"
        :transition="{ repeat: Infinity, duration: 1, ease: 'linear' }"
      >
        <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 text-accent-violet" />
      </motion.div>
      <UIcon v-else name="i-heroicons-check-circle" class="w-4 h-4 text-success" />
      <span class="text-sm font-medium text-text-base truncate min-w-0">
        {{ job.url }}
      </span>
    </div>
    <UBadge :color="statusColor(job.status)" variant="subtle" size="xs">
      {{ job.status }}
    </UBadge>
  </div>

  <!-- progress bar -->
  <div class="h-1.5 bg-surface-3 rounded-full overflow-hidden">
    <motion.div
      class="h-full bg-gradient-to-r from-accent-violet to-accent-cyan rounded-full"
      :animate="{ width: `${progressPct}%` }"
      :transition="{ type: 'spring', stiffness: 40, damping: 12 }"
    />
  </div>

  <!-- stats row -->
  <div class="mt-3 flex gap-4 text-xs font-mono tabular-nums text-text-muted">
    <span>{{ job.pages_crawled }} / {{ job.pages_found }} pages</span>
    <span>{{ job.chunks_created }} chunks</span>
  </div>
</UCard>
```

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
  { key: 'url',          label: 'URL',       class: 'max-w-xs truncate' },
  { key: 'status',       label: 'Status' },
  { key: 'pages_crawled',label: 'Pages',     class: 'tabular-nums' },
  { key: 'chunks_created',label: 'Chunks',   class: 'tabular-nums' },
  { key: 'started_at',   label: 'Started' },
  { key: 'actions',      label: '' },
]
```

### Reduced Motion Fallback

Progress bar: instant width change (no spring). Spinner replaced with static icon.

### Accessibility

- URL input: `<label>` associated via `for`/`id`, or `aria-label="Store URL"`
- Crawl status badge: `aria-live="polite"` wrapper so status changes are announced
- Progress bar: `role="progressbar" :aria-valuenow="progressPct" aria-valuemin="0" aria-valuemax="100"`

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

Stat cards: same pattern as Overview section 5. Grid: `grid-cols-1 sm:grid-cols-3 gap-4 mb-6`

No-answer rate badge color: `>20% → error`, `10-20% → warning`, `<10% → success`

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

### Structure (centered card on dark bg)

```
┌────────────────── full screen bg-surface-base ──────────────────┐
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

**Background**: `min-h-screen bg-surface-base flex items-center justify-center p-4`

**Card**: `w-full max-w-sm` — use `UCard` with custom class `bg-surface-2 border-border-base`

**Glow accent behind card**:
```html
<div
  class="absolute inset-0 pointer-events-none"
  aria-hidden="true"
  style="background: radial-gradient(ellipse 60% 40% at 50% 0%, rgba(124,58,237,0.12) 0%, transparent 70%);"
/>
```

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

Card appears instantly (`opacity: 0 → 1` only, no y/scale).

### Accessibility

- `<form>` with `aria-label="Sign in"` / `aria-label="Create account"`
- All inputs: `<label>` elements, not placeholder-only
- Error messages: `role="alert"` or `aria-live="assertive"`
- Google button: `aria-label="Continue with Google"`
- Password field: `type="password"`, toggle show/hide with `aria-label="Show/hide password"`

---

## Implementation Notes for `frontend-developer`

1. **Use `UCard`, `UButton`, `UInput`, `UTable`, `UBadge`, `UFormGroup`, `UModal`, `UAvatar`** — all auto-imported
2. **`useSidebar()` composable** — manage mobile sidebar open/close state (create in `app/composables/useSidebar.ts`)
3. **`useColorMode()`** from `@nuxtjs/color-mode` — already bundled with Nuxt UI
4. **Route-based page title**: inject via `useHead({ title: 'Overview' })` in each page — header reads via Nuxt's `useAppConfig` or a shared `useDashboard()` composable
5. **`merchant_id`**: auth store holds the current merchant — never pass from client to API, server reads from session
6. **Crawl real-time**: Supabase Realtime subscription in `useCrawl()` composable updates `crawlJob` reactive ref; `CrawlProgressCard` binds to it
7. **Empty states**: every table/list must handle `rows.length === 0` — see section 5 empty state pattern
8. **No `console.log`** — use `useLogger()` or structured logging per project rules
