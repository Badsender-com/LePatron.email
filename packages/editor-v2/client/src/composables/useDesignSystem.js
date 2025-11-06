import { ref } from 'vue'
import { useEmailStore } from '../stores/email'

/**
 * Composable pour gérer les Design Systems
 */
export function useDesignSystem() {
  const emailStore = useEmailStore()

  // État
  const designSystems = ref([])
  const currentDesignSystem = ref(null)
  const isLoading = ref(false)
  const error = ref(null)

  /**
   * Charge la liste des Design Systems disponibles
   */
  const loadDesignSystems = async () => {
    isLoading.value = true
    error.value = null

    try {
      console.log('📚 Loading Design Systems list...')

      const response = await fetch('/api/v2/design-systems')

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to load Design Systems')
      }

      designSystems.value = data.designSystems || []

      console.log('✅ Design Systems loaded:', designSystems.value.length)

      return designSystems.value

    } catch (err) {
      console.error('❌ Load Design Systems error:', err)
      error.value = err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Charge un Design System spécifique
   * @param {string} designSystemId - ID du Design System
   */
  const loadDesignSystem = async (designSystemId) => {
    isLoading.value = true
    error.value = null

    try {
      console.log('📦 Loading Design System:', designSystemId)

      const response = await fetch(`/api/v2/design-systems/${designSystemId}`)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const designSystem = await response.json()

      currentDesignSystem.value = designSystem
      emailStore.setDesignSystem(designSystem)

      console.log('✅ Design System loaded:', {
        id: designSystem.id,
        name: designSystem.name,
        version: designSystem.version,
        components: designSystem.components
      })

      return designSystem

    } catch (err) {
      console.error('❌ Load Design System error:', err)
      error.value = err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Change le Design System actif
   * @param {string} designSystemId - ID du nouveau Design System
   */
  const changeDesignSystem = async (designSystemId) => {
    try {
      await loadDesignSystem(designSystemId)
      emailStore.changeDesignSystem(designSystemId)

      console.log('✅ Design System changed to:', designSystemId)

    } catch (err) {
      console.error('❌ Change Design System error:', err)
      throw err
    }
  }

  /**
   * Obtient les defaults d'un composant depuis le Design System
   * @param {string} componentName - Nom du composant
   * @returns {object} - Props par défaut
   */
  const getComponentDefaults = (componentName) => {
    if (!currentDesignSystem.value) {
      console.warn('⚠️ No Design System loaded')
      return {}
    }

    const defaults = currentDesignSystem.value.componentDefaults?.[componentName] || {}

    console.log('🎨 Component defaults:', componentName, defaults)

    return defaults
  }

  /**
   * Obtient une valeur de token depuis le Design System
   * @param {string} path - Chemin du token (ex: 'colors.primary')
   * @returns {any} - Valeur du token
   */
  const getToken = (path) => {
    if (!currentDesignSystem.value) {
      console.warn('⚠️ No Design System loaded')
      return undefined
    }

    const parts = path.split('.')
    let value = currentDesignSystem.value.tokens

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part]
      } else {
        return undefined
      }
    }

    return value
  }

  /**
   * Vide le cache des Design Systems (dev)
   */
  const clearCache = async () => {
    try {
      const response = await fetch('/api/v2/design-systems/cache', {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      console.log('🗑️ Design Systems cache cleared')

      // Recharger le Design System actuel
      if (emailStore.metadata.designSystemId) {
        await loadDesignSystem(emailStore.metadata.designSystemId)
      }

    } catch (err) {
      console.error('❌ Clear cache error:', err)
      error.value = err.message
    }
  }

  /**
   * Initialise le Design System (charge le DS actif de l'email)
   */
  const initialize = async () => {
    try {
      // Charger la liste
      await loadDesignSystems()

      // Charger le Design System actif
      if (emailStore.metadata.designSystemId) {
        await loadDesignSystem(emailStore.metadata.designSystemId)
      }

    } catch (err) {
      console.error('❌ Initialize Design System error:', err)
      throw err
    }
  }

  return {
    // État
    designSystems,
    currentDesignSystem,
    isLoading,
    error,

    // Méthodes
    loadDesignSystems,
    loadDesignSystem,
    changeDesignSystem,
    getComponentDefaults,
    getToken,
    clearCache,
    initialize
  }
}
