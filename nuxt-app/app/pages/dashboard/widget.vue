<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})

useHead({
  title: 'Widget Configuration'
})

// TODO: Replace with real data from useWidget() composable
const config = reactive({
  primaryColor: '#7c3aed',
  welcomeMessage: 'Hi! How can I help you find what you need?',
  position: 'bottom-right' as 'bottom-right' | 'bottom-left',
  suggestedQuestions: [
    'What products do you have?',
    'Do you offer free shipping?',
    'What are your best sellers?'
  ]
})

const isSaving = ref(false)
const newQuestion = ref('')
const { copied, copy } = useClipboard()

const widgetKey = ref('wk_abc123def456')

const snippet = computed(() => {
  return `<script src="https://cdn.shopagent.ai/widget.js"
  data-key="${widgetKey.value}"
  data-color="${config.primaryColor}"
  data-position="${config.position}"
  async><\/script>`
})

const positionOptions = [
  { label: 'Bottom Right', value: 'bottom-right' },
  { label: 'Bottom Left', value: 'bottom-left' }
]

function addQuestion() {
  const q = newQuestion.value.trim()
  if (!q) return
  config.suggestedQuestions.push(q)
  newQuestion.value = ''
}

function removeQuestion(index: number) {
  config.suggestedQuestions.splice(index, 1)
}

// TODO: Replace with real API call via $fetch('/api/merchant/config', { method: 'PATCH' })
async function saveConfig() {
  isSaving.value = true
  await new Promise(resolve => setTimeout(resolve, 800))
  isSaving.value = false
}
</script>

<template>
  <div>
    <h1 class="text-[clamp(1.5rem,3vw,2rem)] font-display font-semibold text-text-base mb-6" style="text-wrap: balance">
      Widget Configuration
    </h1>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <!-- Config panel -->
      <UCard>
        <template #header>
          <h2 class="text-sm font-medium text-text-base">Customize your widget</h2>
        </template>
        <div class="space-y-5">
          <!-- Accent color -->
          <div>
            <label for="widget-color" class="block text-xs font-mono uppercase tracking-[0.12em] text-text-muted mb-1.5">
              Accent color
            </label>
            <div class="flex items-center gap-3">
              <input
                id="widget-color"
                v-model="config.primaryColor"
                type="color"
                class="w-10 h-10 rounded-lg border border-border-base cursor-pointer bg-transparent"
                aria-label="Widget accent color"
              >
              <UInput
                v-model="config.primaryColor"
                class="flex-1 font-mono"
                size="sm"
                placeholder="#7c3aed"
              />
            </div>
          </div>

          <!-- Welcome message -->
          <div>
            <label for="widget-welcome" class="block text-xs font-mono uppercase tracking-[0.12em] text-text-muted mb-1.5">
              Welcome message
            </label>
            <UInput
              id="widget-welcome"
              v-model="config.welcomeMessage"
              size="sm"
              placeholder="Hi! How can I help you?"
            />
          </div>

          <!-- Position -->
          <div>
            <label for="widget-position" class="block text-xs font-mono uppercase tracking-[0.12em] text-text-muted mb-1.5">
              Position
            </label>
            <USelect
              id="widget-position"
              v-model="config.position"
              :items="positionOptions"
              size="sm"
              aria-label="Widget position"
            />
          </div>

          <!-- Suggested questions -->
          <div>
            <span class="block text-xs font-mono uppercase tracking-[0.12em] text-text-muted mb-1.5">
              Suggested questions
            </span>
            <div class="space-y-2 mb-2">
              <div
                v-for="(question, index) in config.suggestedQuestions"
                :key="index"
                class="flex items-center gap-2"
              >
                <span class="flex-1 text-sm text-text-base truncate min-w-0">{{ question }}</span>
                <UButton
                  icon="i-heroicons-x-mark"
                  variant="ghost"
                  color="neutral"
                  size="xs"
                  :aria-label="`Remove question: ${question}`"
                  @click="removeQuestion(index)"
                />
              </div>
            </div>
            <form class="flex gap-2" @submit.prevent="addQuestion">
              <UInput
                v-model="newQuestion"
                class="flex-1"
                size="sm"
                placeholder="Add a suggested question"
                aria-label="New suggested question"
              />
              <UButton
                type="submit"
                icon="i-heroicons-plus"
                variant="outline"
                color="neutral"
                size="sm"
                :disabled="!newQuestion.trim()"
                aria-label="Add question"
              />
            </form>
          </div>

          <!-- Save button -->
          <UButton
            label="Save changes"
            color="primary"
            size="md"
            block
            :loading="isSaving"
            @click="saveConfig"
          />
        </div>
      </UCard>

      <!-- Live preview -->
      <UCard>
        <template #header>
          <h2 class="text-sm font-medium text-text-base">Preview</h2>
        </template>
        <div class="relative bg-surface-base rounded-lg border border-border-base min-h-[400px] overflow-hidden">
          <!-- Mini browser chrome -->
          <div class="flex items-center gap-1.5 px-3 py-2 bg-surface-1 border-b border-border-base">
            <div class="w-2.5 h-2.5 rounded-full bg-error/60" aria-hidden="true" />
            <div class="w-2.5 h-2.5 rounded-full bg-warning/60" aria-hidden="true" />
            <div class="w-2.5 h-2.5 rounded-full bg-success/60" aria-hidden="true" />
            <div class="flex-1 mx-2 h-5 rounded bg-surface-3 text-[10px] text-text-subtle flex items-center px-2 font-mono">
              your-store.com
            </div>
          </div>

          <!-- Simulated page content -->
          <div class="p-4 space-y-3">
            <div class="h-3 w-3/4 rounded bg-surface-3" aria-hidden="true" />
            <div class="h-3 w-1/2 rounded bg-surface-3" aria-hidden="true" />
            <div class="h-3 w-5/6 rounded bg-surface-3" aria-hidden="true" />
            <div class="h-20 w-full rounded bg-surface-3 mt-4" aria-hidden="true" />
          </div>

          <!-- Widget floating button mockup -->
          <div
            class="absolute bottom-4"
            :class="config.position === 'bottom-right' ? 'right-4' : 'left-4'"
          >
            <div class="space-y-2">
              <!-- Chat bubble mockup -->
              <motion
                as="div"
                class="w-56 rounded-xl p-3 shadow-lg"
                :style="{ backgroundColor: config.primaryColor + '10', borderColor: config.primaryColor + '30' }"
                :initial="{ opacity: 0, y: 8, scale: 0.95 }"
                :animate="{ opacity: 1, y: 0, scale: 1 }"
                :transition="{ duration: 0.3, ease: 'easeOut' }"
                style="border-width: 1px"
              >
                <p class="text-xs text-text-base mb-2">{{ config.welcomeMessage }}</p>
                <div
                  v-for="(q, i) in config.suggestedQuestions.slice(0, 2)"
                  :key="i"
                  class="text-[10px] px-2 py-1 rounded-md mb-1 truncate"
                  :style="{ backgroundColor: config.primaryColor + '15', color: config.primaryColor }"
                >
                  {{ q }}
                </div>
              </motion>
              <!-- FAB button -->
              <div
                class="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
                :class="config.position === 'bottom-right' ? 'ml-auto' : 'mr-auto'"
                :style="{ backgroundColor: config.primaryColor }"
              >
                <UIcon name="i-heroicons-chat-bubble-left-ellipsis" class="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Install snippet -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-medium text-text-base">Install on your site</h2>
          <UButton
            :icon="copied ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
            variant="ghost"
            color="neutral"
            size="xs"
            :aria-label="copied ? 'Copied!' : 'Copy install snippet'"
            @click="copy(snippet)"
          />
        </div>
      </template>
      <pre class="text-xs font-mono text-text-muted bg-surface-3 rounded-lg p-4 overflow-x-auto"><code>{{ snippet }}</code></pre>
      <div v-if="copied" aria-live="polite" class="sr-only">Copied to clipboard</div>
    </UCard>
  </div>
</template>
