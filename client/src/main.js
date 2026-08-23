import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import App from '@/App.vue'
import routes from '@/router/index.js'
import './assets/styles.css'

const router = createRouter({ history: createWebHistory(), routes })
const pinia = createPinia()

createApp(App).use(pinia).use(router).mount('#app')
