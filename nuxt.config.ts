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
    openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
    usdaApiKey: process.env.USDA_API_KEY || '',
    devUserEmail: process.env.DEV_USER_EMAIL || '',
  },

  experimental: {
    viewTransition: true,
  },

  future: {
    compatibilityVersion: 4,
  },
})
