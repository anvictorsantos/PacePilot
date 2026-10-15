import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
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
