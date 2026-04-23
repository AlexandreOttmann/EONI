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
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
    openaiApiKey: process.env.OPENAI_API_KEY ?? '',
    cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
    cloudflareCrawlApiToken: process.env.CLOUDFLARE_CRAWL_API_TOKEN ?? '',
    supabaseUrl: process.env.SUPABASE_URL ?? '',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    public: {
      environment: 'development',
      widgetCdnUrl: process.env.NUXT_PUBLIC_WIDGET_CDN_URL ?? ''
    }
  },
  routeRules: {
    '/api/chat/**': {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    }
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
