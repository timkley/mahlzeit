import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-03-22',
  devtools: { enabled: true },

  modules: [
    '@nuxthub/core',
    'shadcn-nuxt',
  ],

  // shadcn-vue component config
  shadcn: {
    prefix: '',
    componentDir: './app/components/ui',
  },

  // Tailwind v4 via Vite plugin (replaces @nuxtjs/tailwindcss)
  css: ['~/assets/css/tailwind.css'],
  vite: {
    plugins: [tailwindcss()],
  },

  hub: {
    db: 'sqlite',
    blob: true,
  },

  // Server-only env vars (not exposed to client)
  runtimeConfig: {
    openrouterApiKey: '',
    usdaApiKey: '',
    devUserEmail: '',
  },

  experimental: {
    viewTransition: true,
  },

  app: {
    head: {
      viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
    },
  },

  future: {
    compatibilityVersion: 4,
  },
})
