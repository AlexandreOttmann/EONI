<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Chat Preview' })

const { messages, sources, isStreaming, error, currentSessionId, savedSessions, loadSession, send, stop, reset } = useChat()

const input = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const showSources = ref(false)

async function handleSend() {
  const text = input.value.trim()
  if (!text || isStreaming.value) return
  input.value = ''
  await send(text)
}

function clearHistory() {
  savedSessions.value = []
  reset()
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(iso))
}

// Auto-scroll on new content
watch(
  () => messages.value[messages.value.length - 1]?.content,
  () => {
    nextTick(() => {
      messagesContainer.value?.scrollTo({ top: messagesContainer.value.scrollHeight, behavior: 'smooth' })
    })
  }
)
</script>

<template>
  <div class="flex flex-col h-[calc(100vh-8rem)]">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <h1
        class="text-[clamp(1.5rem,3vw,2rem)] font-display font-semibold text-text-base"
        style="text-wrap: balance"
      >
        Chat Preview
      </h1>
      <UButton
        label="New conversation"
        icon="i-heroicons-plus"
        variant="outline"
        color="neutral"
        size="sm"
        @click="reset"
      />
    </div>

    <div class="flex gap-4 flex-1 min-h-0">
      <!-- History sidebar -->
      <div
        v-if="savedSessions.length > 0"
        class="w-52 shrink-0 hidden md:flex flex-col min-h-0"
      >
        <UCard class="flex-1 flex flex-col min-h-0 overflow-hidden">
          <template #header>
            <h2 class="text-xs font-mono uppercase tracking-[0.12em] text-text-muted">
              History
            </h2>
          </template>
          <div class="flex-1 overflow-y-auto space-y-1 -mx-1">
            <button
              v-for="session in savedSessions"
              :key="session.sessionId"
              type="button"
              class="w-full text-left px-2 py-2 rounded-lg text-xs transition-colors"
              :class="session.sessionId === currentSessionId
                ? 'bg-accent-violet/10 text-accent-violet'
                : 'text-text-muted hover:bg-surface-2 hover:text-text-base'"
              @click="loadSession(session.sessionId)"
            >
              <p class="truncate font-medium">
                {{ session.preview }}
              </p>
              <p class="text-[10px] mt-0.5 opacity-60 tabular-nums">
                {{ formatDate(session.startedAt) }}
              </p>
            </button>
          </div>
          <template #footer>
            <UButton
              label="Clear history"
              icon="i-heroicons-trash"
              variant="ghost"
              color="neutral"
              size="xs"
              block
              @click="clearHistory"
            />
          </template>
        </UCard>
      </div>

      <!-- Messages column -->
      <div class="flex-1 flex flex-col min-h-0">
        <!-- Message list -->
        <div
          ref="messagesContainer"
          class="flex-1 overflow-y-auto space-y-4 pr-2"
        >
          <!-- Empty state -->
          <div
            v-if="messages.length === 0"
            class="flex flex-col items-center justify-center h-full text-center"
          >
            <div class="w-12 h-12 rounded-full bg-accent-violet/10 flex items-center justify-center mb-3">
              <UIcon
                name="i-heroicons-chat-bubble-left-ellipsis"
                class="w-5 h-5 text-accent-violet"
              />
            </div>
            <p class="text-sm text-text-muted">
              Send a message to test your AI assistant.
            </p>
          </div>

          <!-- Messages -->
          <div
            v-for="(msg, i) in messages"
            :key="i"
            class="flex"
            :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
          >
            <div
              class="max-w-[80%] rounded-xl px-4 py-2.5 text-sm"
              :class="msg.role === 'user'
                ? 'bg-accent-violet text-white'
                : 'bg-surface-2 text-text-base'"
            >
              <p class="whitespace-pre-wrap break-words min-w-0">
                {{ msg.content }}<span
                  v-if="isStreaming && msg.role === 'assistant' && i === messages.length - 1"
                  class="inline-block w-1.5 h-4 bg-accent-violet animate-pulse ml-0.5 align-text-bottom"
                  aria-label="Typing"
                />
              </p>
            </div>
          </div>
        </div>

        <!-- Error banner -->
        <div
          v-if="error"
          class="mt-2 p-2 rounded-lg bg-error/10 text-error text-xs"
        >
          {{ error }}
        </div>

        <!-- Sources toggle -->
        <div
          v-if="sources.length > 0"
          class="mt-2 flex justify-end"
        >
          <UButton
            :label="showSources ? 'Hide sources' : 'Show sources'"
            variant="ghost"
            color="neutral"
            size="xs"
            @click="showSources = !showSources"
          />
        </div>

        <!-- Input bar -->
        <form
          class="mt-3 flex gap-2"
          @submit.prevent="handleSend"
        >
          <UInput
            v-model="input"
            class="flex-1"
            size="md"
            placeholder="Type a message…"
            :disabled="isStreaming"
            autofocus
          />
          <UButton
            v-if="isStreaming"
            icon="i-heroicons-stop"
            color="error"
            variant="outline"
            size="md"
            aria-label="Stop streaming"
            @click="stop"
          />
          <UButton
            v-else
            type="submit"
            icon="i-heroicons-paper-airplane"
            color="primary"
            size="md"
            :disabled="!input.trim()"
            aria-label="Send message"
          />
        </form>
      </div>

      <!-- Sources sidebar -->
      <div
        v-if="showSources && sources.length > 0"
        class="w-72 shrink-0 hidden lg:block"
      >
        <UCard class="h-full overflow-y-auto">
          <template #header>
            <h2 class="text-xs font-mono uppercase tracking-[0.12em] text-text-muted">
              Sources
            </h2>
          </template>
          <div class="space-y-3">
            <div
              v-for="source in sources"
              :key="source.id"
              class="p-2 rounded-lg bg-surface-2 text-xs"
            >
              <p class="text-text-base line-clamp-4">
                {{ source.content }}
              </p>
              <div class="mt-1 flex items-center gap-2 text-text-muted">
                <span class="tabular-nums">{{ Math.round(source.similarity * 100) }}% match</span>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>
