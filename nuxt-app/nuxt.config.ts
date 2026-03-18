// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxtjs/supabase',
    '@pinia/nuxt',
    '@oro.ad/nuxt-claude-devtools',
    'dayjs-nuxt',
    '@vueuse/nuxt',
    'motion-v/nuxt'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    anthropicApiKey: '',
    openaiApiKey: '',
    cloudflareAccountId: '',
    cloudflareCrawlApiToken: '',
    supabaseUrl: process.env.SUPABASE_URL ?? '',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  },

  compatibilityDate: '2025-01-15',
  vite: {
    optimizeDeps: {
      include: [
        '@vue/devtools-core',
        '@vue/devtools-kit',
        'dayjs', // CJS
        'dayjs/plugin/updateLocale', // CJS
        'dayjs/plugin/relativeTime', // CJS
        'dayjs/plugin/utc' // CJS
      ]
    }
  },
  claudeDevtools: {
    enabled: true,
    claude: {
      command: 'claude', // Path to Claude CLI
      args: [] // Additional CLI arguments
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },
  supabase: {
    redirect: false
  }
})
