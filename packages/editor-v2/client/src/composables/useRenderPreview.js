import { ref, watch } from 'vue'
import { useEmailStore } from '../stores/email'

/**
 * Composable pour gérer le rendu preview de l'email
 * @param {object} options - Options
 * @param {number} options.debounceMs - Délai de debounce en ms (défaut: 300ms)
 * @param {boolean} options.autoRender - Activer le rendu automatique sur changement (défaut: true)
 */
export function useRenderPreview(options = {}) {
  const {
    debounceMs = 300,
    autoRender = true
  } = options

  const emailStore = useEmailStore()

  // État du composable
  const previewHtml = ref('')
  const renderTime = ref(0)
  const cacheStats = ref(null)
  const error = ref(null)
  const isLoading = ref(false)

  // Timer pour debounce
  let debounceTimer = null

  /**
   * Render l'email en mode preview
   * @param {boolean} useCache - Utiliser le cache (défaut: true)
   */
  const renderPreview = async (useCache = true) => {
    // Clear erreur précédente
    error.value = null
    isLoading.value = true
    emailStore.setRendering(true)

    const startTime = performance.now()

    try {
      console.log('🎨 Rendering preview...', {
        blocks: emailStore.blocks.length,
        designSystem: emailStore.metadata.designSystemId,
        useCache
      })

      const response = await fetch('/api/v2/render/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailStore.emailJSON)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Render failed')
      }

      // Mise à jour des données
      previewHtml.value = data.html
      renderTime.value = data.renderTime
      cacheStats.value = data.cached ? { cached: true } : { cached: false }

      const totalTime = Math.round(performance.now() - startTime)
      emailStore.setLastRenderTime(totalTime)

      console.log('✅ Preview rendered:', {
        renderTime: data.renderTime + 'ms',
        totalTime: totalTime + 'ms',
        cached: data.cached,
        size: data.html.length + ' chars'
      })

    } catch (err) {
      console.error('❌ Render error:', err)
      error.value = err.message
      previewHtml.value = `
        <div style="padding: 20px; color: #dc3545; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; font-family: monospace;">
          <h3 style="margin-top: 0;">❌ Render Error</h3>
          <p>${err.message}</p>
        </div>
      `
    } finally {
      isLoading.value = false
      emailStore.setRendering(false)
    }
  }

  /**
   * Render avec debounce
   */
  const renderPreviewDebounced = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    debounceTimer = setTimeout(() => {
      renderPreview()
    }, debounceMs)
  }

  /**
   * Export l'email en HTML optimisé
   */
  const exportEmail = async () => {
    error.value = null
    isLoading.value = true
    emailStore.setRendering(true)

    const startTime = performance.now()

    try {
      console.log('📤 Exporting email...', {
        blocks: emailStore.blocks.length,
        designSystem: emailStore.metadata.designSystemId
      })

      const response = await fetch('/api/v2/render/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailStore.emailJSON)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Export failed')
      }

      const totalTime = Math.round(performance.now() - startTime)

      console.log('✅ Email exported:', {
        renderTime: data.renderTime + 'ms',
        totalTime: totalTime + 'ms',
        size: data.html.length + ' chars',
        optimizations: data.optimizations
      })

      // Télécharger le fichier HTML
      downloadHtml(data.html, emailStore.metadata.title || 'email')

      return data.html

    } catch (err) {
      console.error('❌ Export error:', err)
      error.value = err.message
      throw err
    } finally {
      isLoading.value = false
      emailStore.setRendering(false)
    }
  }

  /**
   * Télécharge le HTML en tant que fichier
   * @param {string} html - Contenu HTML
   * @param {string} filename - Nom du fichier (sans extension)
   */
  const downloadHtml = (html, filename) => {
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    console.log('💾 HTML downloaded:', filename + '.html')
  }

  /**
   * Vide le cache de rendu (dev)
   */
  const clearCache = async () => {
    try {
      const response = await fetch('/api/v2/render/cache', {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      console.log('🗑️ Cache cleared')

      // Re-render
      await renderPreview(false)

    } catch (err) {
      console.error('❌ Clear cache error:', err)
      error.value = err.message
    }
  }

  /**
   * Force un re-render immédiat
   */
  const forceRender = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    renderPreview()
  }

  // Auto-render sur changement des blocks (avec debounce)
  if (autoRender) {
    watch(
      () => emailStore.emailJSON,
      () => {
        console.log('📝 Email changed, scheduling render...')
        renderPreviewDebounced()
      },
      { deep: true }
    )
  }

  return {
    // État
    previewHtml,
    renderTime,
    cacheStats,
    error,
    isLoading,

    // Méthodes
    renderPreview,
    renderPreviewDebounced,
    exportEmail,
    clearCache,
    forceRender
  }
}
