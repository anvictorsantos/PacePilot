import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    vue(),
    // Compiles catalogue messages at build time, so the runtime build (no eval)
    // can render them. Removing this brings back the CSP unsafe-eval requirement.
    VueI18nPlugin({
      include: resolve(__dirname, 'src/i18n/*.json'),
      strictMessage: false,
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Keep the heavy vendor libraries in their own long-lived chunks. They
        // change far less often than app code, so a dependency bump no longer
        // invalidates the whole bundle, and no single chunk sits near the 500 kB
        // minified size warning. chart.js is only reachable from the activity
        // detail route, so its chunk stays in that route's async graph.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@sentry')) return 'vendor-sentry'
          if (id.includes('vue-i18n') || id.includes('@intlify')) return 'vendor-i18n'
          if (id.includes('chart.js')) return 'vendor-charts'
          if (id.includes('axios')) return 'vendor-http'
          if (/node_modules\/(vue|@vue|vue-router|pinia)\//.test(id)) return 'vendor-vue'
          return
        },
      },
    },
  },
  test: {
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
