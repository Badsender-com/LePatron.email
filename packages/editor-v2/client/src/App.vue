<template>
  <div class="h-screen flex flex-col">
    <!-- Header -->
    <header class="bg-gray-800 text-white p-4 flex items-center justify-between">
      <div class="flex items-center gap-4">
        <h1 class="text-xl font-bold">LePatron.email - Éditeur v2 POC</h1>
        <div class="text-xs px-2 py-1 bg-blue-600 rounded">Phase 5 - Frontend</div>
      </div>

      <div class="flex items-center gap-4 text-sm">
        <!-- Email metadata -->
        <div class="text-gray-300">
          <input
            v-model="emailStore.metadata.title"
            type="text"
            class="bg-gray-700 text-white px-3 py-1 rounded border border-gray-600 focus:outline-none focus:border-blue-500"
            placeholder="Titre de l'email"
          />
        </div>

        <!-- Design System -->
        <div class="text-gray-300">
          Design System:
          <span class="font-semibold text-white">
            {{ currentDesignSystem?.name || 'Loading...' }}
          </span>
        </div>

        <!-- Status -->
        <div
          class="flex items-center gap-1.5"
          :class="apiStatus === 'connected' ? 'text-green-400' : 'text-red-400'"
        >
          <div
            class="w-2 h-2 rounded-full"
            :class="apiStatus === 'connected' ? 'bg-green-400' : 'bg-red-400'"
          ></div>
          <span class="text-xs">{{ apiStatus === 'connected' ? 'API Connected' : 'API Disconnected' }}</span>
        </div>
      </div>
    </header>

    <!-- Loading state -->
    <div v-if="isInitializing" class="flex-1 flex items-center justify-center bg-gray-50">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500"></div>
        <p class="mt-4 text-lg text-gray-600">Initialisation de l'éditeur...</p>
        <p class="mt-2 text-sm text-gray-500">Chargement des composants et du Design System</p>
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="initError" class="flex-1 flex items-center justify-center bg-gray-50">
      <div class="text-center max-w-md">
        <div class="text-6xl mb-4">❌</div>
        <h2 class="text-2xl font-bold text-red-600 mb-2">Erreur d'initialisation</h2>
        <p class="text-gray-600 mb-4">{{ initError }}</p>
        <button
          @click="initialize"
          class="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
        >
          🔄 Réessayer
        </button>
      </div>
    </div>

    <!-- Main Editor -->
    <main v-else class="flex-1 flex overflow-hidden">
      <!-- Left: Component Library -->
      <aside class="w-64 border-r">
        <ComponentLibrary />
      </aside>

      <!-- Center Left: Canvas -->
      <section class="flex-1 border-r">
        <Canvas />
      </section>

      <!-- Center Right: Preview -->
      <section class="flex-1 border-r">
        <PreviewPanel />
      </section>

      <!-- Right: Config Panel -->
      <aside class="w-80">
        <ConfigPanel />
      </aside>
    </main>

    <!-- Footer / Status Bar -->
    <footer class="bg-gray-100 border-t px-4 py-2 text-xs text-gray-600 flex justify-between items-center">
      <div class="flex items-center gap-4">
        <span>POC Éditeur v2 - Phase 5 Complete</span>
        <span class="text-gray-400">|</span>
        <span>{{ emailStore.blockCount }} bloc(s)</span>
        <span class="text-gray-400">|</span>
        <span v-if="emailStore.lastRenderTime > 0">
          Dernier rendu: <strong>{{ emailStore.lastRenderTime }}ms</strong>
        </span>
      </div>

      <div class="flex items-center gap-3">
        <button
          @click="loadExampleEmail"
          class="text-blue-600 hover:text-blue-800 font-medium"
        >
          📧 Charger exemple
        </button>
        <button
          v-if="!emailStore.isEmpty"
          @click="resetEditor"
          class="text-red-600 hover:text-red-800 font-medium"
        >
          🗑️ Réinitialiser
        </button>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useEmailStore } from './stores/email'
import { useDesignSystem } from './composables/useDesignSystem'
import { useComponents } from './composables/useComponents'
import ComponentLibrary from './components/ComponentLibrary.vue'
import Canvas from './components/Canvas.vue'
import PreviewPanel from './components/PreviewPanel.vue'
import ConfigPanel from './components/ConfigPanel.vue'

const emailStore = useEmailStore()
const designSystemComposable = useDesignSystem()
const componentsComposable = useComponents()

// État local
const isInitializing = ref(true)
const initError = ref(null)
const apiStatus = ref('disconnected')

// Computed
const currentDesignSystem = computed(() => designSystemComposable.currentDesignSystem.value)

// Méthodes
const initialize = async () => {
  isInitializing.value = true
  initError.value = null

  try {
    console.log('🚀 Initializing editor...')

    // Test API
    const healthResponse = await fetch('/api/health')
    if (!healthResponse.ok) {
      throw new Error('API not responding')
    }
    apiStatus.value = 'connected'
    console.log('✅ API connected')

    // Charger Design System
    await designSystemComposable.initialize()
    console.log('✅ Design System initialized')

    // Charger composants
    await componentsComposable.initialize()
    console.log('✅ Components initialized')

    console.log('✅ Editor initialized successfully')

  } catch (err) {
    console.error('❌ Initialization error:', err)
    initError.value = err.message
    apiStatus.value = 'disconnected'
  } finally {
    isInitializing.value = false
  }
}

const loadExampleEmail = async () => {
  try {
    console.log('📧 Loading example email...')

    // Charger example-email.json
    const response = await fetch('/api/v2/design-systems/demo')

    if (!response.ok) {
      throw new Error('Failed to load example')
    }

    // Créer un email exemple avec quelques blocs
    const exampleEmail = {
      metadata: {
        title: 'Email Exemple',
        subject: 'Bienvenue chez LePatron.email !',
        preheader: 'Découvrez notre nouvel éditeur',
        designSystemId: 'demo'
      },
      blocks: [
        {
          id: 'block-heading-' + Date.now(),
          component: 'heading',
          props: {
            text: 'Bienvenue !',
            level: 'h1',
            textColor: '#007bff',
            fontSize: '32px',
            fontWeight: 'bold',
            lineHeight: '1.2',
            align: 'center',
            marginTop: '0',
            marginBottom: '16px'
          }
        },
        {
          id: 'block-container-' + Date.now(),
          component: 'container',
          props: {
            content: '<p style="margin: 0; line-height: 1.6;">Nous sommes ravis de vous présenter notre nouvel éditeur d\'emails, basé sur <strong>Maizzle Framework</strong> et <strong>Vue.js 3</strong>. Cette interface vous permet de composer vos emails en glissant-déposant des composants, et de voir le rendu en temps réel.</p>',
            backgroundColor: '#f8f9fa',
            padding: '24px',
            borderWidth: '0',
            borderStyle: 'solid',
            borderColor: '#dee2e6',
            borderRadius: '8px',
            maxWidth: '600px',
            align: 'center'
          }
        },
        {
          id: 'block-button-' + Date.now(),
          component: 'button',
          props: {
            text: 'Découvrir',
            url: 'https://example.com',
            backgroundColor: '#007bff',
            textColor: '#ffffff',
            borderRadius: '4px',
            padding: '12px 24px',
            align: 'center'
          }
        }
      ]
    }

    emailStore.loadEmail(exampleEmail)

    console.log('✅ Example email loaded')

  } catch (err) {
    console.error('❌ Load example error:', err)
    alert('Erreur lors du chargement de l\'exemple: ' + err.message)
  }
}

const resetEditor = () => {
  if (confirm('Supprimer tous les blocs et réinitialiser l\'éditeur ?')) {
    emailStore.resetEmail()
    console.log('✅ Editor reset')
  }
}

// Lifecycle
onMounted(async () => {
  await initialize()
})
</script>

<style>
/* Global styles */
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
</style>
