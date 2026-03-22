// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // Nuxt 4 compatibility date — tells Nuxt which behavior version to use
  // (like Laravel's PHP version constraint in composer.json)
  compatibilityDate: '2026-03-22',

  // Vue devtools — great for debugging components, state, routes in the browser
  devtools: { enabled: true },

  // Modules = like Laravel packages/service providers
  // They hook into the framework and add functionality
  modules: [
    '@nuxthub/core',       // Cloudflare bindings (D1, R2, AI)
    '@nuxtjs/tailwindcss', // Tailwind CSS
  ],

  // NuxtHub config — tells Cloudflare which services to provision
  hub: {
    // D1 database (SQLite on the edge)
    // 'sqlite' dialect → uses libsql locally, D1 in production
    db: 'sqlite',
    // R2 blob storage (for food photos)
    blob: true,
    // Workers AI binding (for food image analysis)
    ai: true,
  },

  // Future flags for Nuxt 4 forward-compatibility
  future: {
    compatibilityVersion: 4,
  },
})
