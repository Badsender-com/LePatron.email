<template>
  <div class="h-full flex flex-col bg-white">
    <!-- Header avec actions -->
    <div class="p-4 border-b">
      <div class="flex justify-between items-center mb-3">
        <h2 class="font-bold text-lg text-gray-800">Preview</h2>

        <!-- Device toggle -->
        <div class="flex gap-2">
          <button
            @click="emailStore.setPreviewDevice('desktop')"
            class="px-3 py-1.5 rounded text-sm font-medium transition-colors"
            :class="emailStore.previewDevice === 'desktop'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
            title="Desktop (600px)"
          >
            🖥️ Desktop
          </button>
          <button
            @click="emailStore.setPreviewDevice('mobile')"
            class="px-3 py-1.5 rounded text-sm font-medium transition-colors"
            :class="emailStore.previewDevice === 'mobile'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'"
            title="Mobile (375px)"
          >
            📱 Mobile
          </button>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-2 flex-wrap">
        <button
          @click="forceRender"
          :disabled="isLoading"
          class="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          🔄 Rafraîchir
        </button>

        <button
          @click="exportHtml"
          :disabled="isLoading || emailStore.isEmpty"
          class="px-3 py-1.5 text-sm bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          📤 Exporter HTML
        </button>

        <button
          @click="clearCacheAndRender"
          :disabled="isLoading"
          class="px-3 py-1.5 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Vider le cache et re-render"
        >
          🗑️ Clear Cache
        </button>
      </div>

      <!-- Stats -->
      <div
        v-if="renderTime > 0"
        class="mt-3 text-xs text-gray-600 flex items-center gap-4"
      >
        <span>
          ⚡ Rendu: <strong>{{ renderTime }}ms</strong>
        </span>
        <span v-if="cacheStats?.cached" class="text-green-600">
          ✅ Cache hit
        </span>
        <span v-else class="text-orange-600">
          ⚠️ Cache miss
        </span>
      </div>

      <!-- Error -->
      <div v-if="error" class="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
        <strong>Erreur:</strong> {{ error }}
      </div>
    </div>

    <!-- Preview iframe -->
    <div class="flex-1 overflow-auto p-4 bg-gray-100">
      <!-- Loading -->
      <div v-if="isLoading" class="h-full flex items-center justify-center">
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p class="mt-3 text-sm text-gray-600">Génération du rendu...</p>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="emailStore.isEmpty && !previewHtml" class="h-full flex items-center justify-center">
        <div class="text-center text-gray-400">
          <div class="text-6xl mb-4">👁️</div>
          <p class="text-lg font-medium">Aucun aperçu</p>
          <p class="text-sm mt-2">Ajoutez des blocs pour voir le rendu</p>
        </div>
      </div>

      <!-- Iframe container -->
      <div
        v-else
        class="mx-auto bg-white shadow-lg transition-all duration-300"
        :class="emailStore.previewDevice === 'mobile' ? 'max-w-[375px]' : 'max-w-[600px]'"
      >
        <iframe
          ref="previewIframe"
          class="w-full border-0"
          :style="{ minHeight: '400px', height: iframeHeight + 'px' }"
          title="Email Preview"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick } from 'vue'
import { useEmailStore } from '../stores/email'
import { useRenderPreview } from '../composables/useRenderPreview'

const emailStore = useEmailStore()
const {
  previewHtml,
  renderTime,
  cacheStats,
  error,
  isLoading,
  renderPreview,
  exportEmail,
  clearCache,
  forceRender
} = useRenderPreview({ autoRender: true, debounceMs: 500 })

// Refs
const previewIframe = ref(null)
const iframeHeight = ref(400)

// Méthodes
const updateIframeContent = async () => {
  await nextTick()

  if (!previewIframe.value || !previewHtml.value) {
    return
  }

  const iframe = previewIframe.value
  const doc = iframe.contentDocument || iframe.contentWindow.document

  // Écrire le HTML
  doc.open()
  doc.write(previewHtml.value)
  doc.close()

  // Ajuster la hauteur de l'iframe au contenu
  setTimeout(() => {
    try {
      const body = doc.body
      const html = doc.documentElement
      const height = Math.max(
        body.scrollHeight,
        body.offsetHeight,
        html.clientHeight,
        html.scrollHeight,
        html.offsetHeight
      )
      iframeHeight.value = Math.max(400, height + 20) // Min 400px, +20px de marge
    } catch (err) {
      console.warn('Failed to measure iframe height:', err)
    }
  }, 100)
}

const exportHtml = async () => {
  try {
    await exportEmail()
    console.log('✅ HTML exported successfully')

    // Forcer la mise à jour de l'iframe après l'export
    // car elle a été masquée pendant le chargement (isLoading=true)
    // L'iframe est recréée dans le DOM, donc il faut attendre un peu
    await nextTick()
    setTimeout(() => {
      updateIframeContent()
    }, 50)
  } catch (err) {
    console.error('❌ Export failed:', err)
  }
}

const clearCacheAndRender = async () => {
  try {
    await clearCache()
    console.log('✅ Cache cleared and re-rendered')
  } catch (err) {
    console.error('❌ Clear cache failed:', err)
  }
}

// Watchers
watch(previewHtml, () => {
  updateIframeContent()
})

// Lifecycle
onMounted(async () => {
  // Render initial si des blocs existent
  if (!emailStore.isEmpty) {
    await renderPreview()
  }
})
</script>

<style scoped>
iframe {
  background: white;
}
</style>
