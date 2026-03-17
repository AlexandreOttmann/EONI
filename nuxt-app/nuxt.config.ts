// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxtjs/supabase',
    '@oro.ad/nuxt-claude-devtools',
    'dayjs-nuxt',
    '@vueuse/nuxt',
    'motion-v/nuxt'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

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
  } })
