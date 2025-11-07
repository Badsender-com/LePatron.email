import { ref } from 'vue'
import { useEmailStore } from '../stores/email'

/**
 * Composable pour gérer les composants disponibles
 */
export function useComponents() {
  const emailStore = useEmailStore()

  // État
  const components = ref([])
  const componentSchemas = ref({}) // Map: componentName -> schema
  const isLoading = ref(false)
  const error = ref(null)

  /**
   * Charge la liste des composants disponibles
   */
  const loadComponents = async () => {
    isLoading.value = true
    error.value = null

    try {
      console.log('🧩 Loading components list...')

      const response = await fetch('/v2/components')

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to load components')
      }

      components.value = data.components || []
      emailStore.setAvailableComponents(components.value)

      console.log('✅ Components loaded:', components.value.length)

      return components.value

    } catch (err) {
      console.error('❌ Load components error:', err)
      error.value = err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Charge le schema d'un composant spécifique
   * @param {string} componentName - Nom du composant
   * @param {string} category - Catégorie (sections, content, custom, columns)
   */
  const loadComponentSchema = async (componentName, category = 'content') => {
    const cacheKey = `${category}:${componentName}`

    // Vérifier si déjà en cache
    if (componentSchemas.value[cacheKey]) {
      console.log('📋 Component schema (cached):', cacheKey)
      return componentSchemas.value[cacheKey]
    }

    isLoading.value = true
    error.value = null

    try {
      console.log('📋 Loading component schema:', cacheKey)

      const response = await fetch(`/v2/components/schema/${componentName}?category=${category}`)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to load component schema')
      }

      const schema = data.component.schema

      // Mettre en cache
      componentSchemas.value[cacheKey] = schema

      console.log('✅ Component schema loaded:', cacheKey, {
        properties: Object.keys(schema.configurableProperties || {}).length
      })

      return schema

    } catch (err) {
      console.error('❌ Load component schema error:', err)
      error.value = err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Extrait les valeurs par défaut d'un schema de composant
   * @param {object} schema - Schema du composant
   * @returns {object} - Props par défaut
   */
  const extractDefaultProps = (schema) => {
    const defaults = {}

    if (!schema || !schema.configurableProperties) {
      return defaults
    }

    // Parcourir toutes les sections (content, style, layout, etc.)
    Object.values(schema.configurableProperties).forEach(section => {
      Object.entries(section).forEach(([propName, propConfig]) => {
        if (propConfig.default !== undefined) {
          defaults[propName] = propConfig.default
        }
      })
    })

    return defaults
  }

  /**
   * Obtient les props par défaut d'un composant
   * @param {string} componentName - Nom du composant
   * @param {string} category - Catégorie (sections, content, custom)
   * @returns {object} - Props par défaut
   */
  const getDefaultProps = async (componentName, category = 'content') => {
    try {
      const schema = await loadComponentSchema(componentName, category)
      return extractDefaultProps(schema)
    } catch (err) {
      console.error('❌ Get default props error:', err)
      return {}
    }
  }

  /**
   * Trouve un composant par nom
   * @param {string} componentName - Nom du composant
   * @returns {object|null} - Composant ou null
   */
  const findComponent = (componentName) => {
    return components.value.find(c => c.name === componentName) || null
  }

  /**
   * Filtre les composants par catégorie
   * @param {string} category - Catégorie (ex: 'core')
   * @returns {array} - Composants filtrés
   */
  const getComponentsByCategory = (category) => {
    return components.value.filter(c => c.category === category)
  }

  /**
   * Initialise (charge la liste des composants)
   */
  const initialize = async () => {
    try {
      await loadComponents()
    } catch (err) {
      console.error('❌ Initialize components error:', err)
      throw err
    }
  }

  return {
    // État
    components,
    componentSchemas,
    isLoading,
    error,

    // Méthodes
    loadComponents,
    loadComponentSchema,
    extractDefaultProps,
    getDefaultProps,
    findComponent,
    getComponentsByCategory,
    initialize
  }
}
