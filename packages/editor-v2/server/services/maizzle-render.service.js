import { render as maizzleRender } from '@maizzle/framework'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import baseConfig from '../../config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Service de rendu Maizzle avec cache pour performance
 * Singleton pattern pour partager le cache entre requêtes
 */
class MaizzleRenderService {
  constructor() {
    if (MaizzleRenderService.instance) {
      return MaizzleRenderService.instance
    }

    // Cache: Map<cacheKey, {html, timestamp}>
    this.cache = new Map()
    this.cacheTTL = 5 * 60 * 1000 // 5 minutes en ms

    // Templates cache: Map<componentName, templateContent>
    this.templateCache = new Map()

    // Components schema cache (from components.json)
    this.componentsSchema = null

    MaizzleRenderService.instance = this
  }

  /**
   * Génère une clé de cache unique basée sur le contenu
   */
  generateCacheKey(emailData, mode) {
    const content = JSON.stringify({ emailData, mode })
    return crypto.createHash('md5').update(content).digest('hex')
  }

  /**
   * Vérifie si une entrée de cache est valide
   */
  isCacheValid(cacheEntry) {
    if (!cacheEntry) return false
    const age = Date.now() - cacheEntry.timestamp
    return age < this.cacheTTL
  }

  /**
   * Récupère depuis le cache si valide
   */
  getFromCache(cacheKey) {
    const entry = this.cache.get(cacheKey)
    if (this.isCacheValid(entry)) {
      console.log('✓ Cache hit:', cacheKey)
      return entry.html
    }
    if (entry) {
      this.cache.delete(cacheKey) // Nettoyer entrée expirée
    }
    return null
  }

  /**
   * Stocke dans le cache
   */
  storeInCache(cacheKey, html) {
    this.cache.set(cacheKey, {
      html,
      timestamp: Date.now(),
    })
    console.log('✓ Cache stored:', cacheKey)
  }

  /**
   * Charge le fichier components.json (avec cache)
   */
  async loadComponentsSchema() {
    if (this.componentsSchema) {
      return this.componentsSchema
    }

    const schemaPath = path.join(__dirname, '../../components/components.json')

    try {
      const content = await fs.readFile(schemaPath, 'utf8')
      this.componentsSchema = JSON.parse(content)
      console.log('✓ Components schema loaded')
      return this.componentsSchema
    } catch (err) {
      throw new Error(`Failed to load components.json: ${err.message}`)
    }
  }

  /**
   * Charge un template de composant depuis le disque (avec cache)
   * Nouvelle structure: components/sections/section-1col.html, components/content/heading.html
   */
  async loadComponentTemplate(componentName, category = 'content') {
    const cacheKey = `${category}/${componentName}`

    // Vérifier le cache de templates
    if (this.templateCache.has(cacheKey)) {
      return this.templateCache.get(cacheKey)
    }

    // Charger depuis le disque - structure plate maintenant
    const templatePath = path.join(
      __dirname,
      '../../components',
      category,
      `${componentName}.html`
    )

    try {
      const content = await fs.readFile(templatePath, 'utf8')
      this.templateCache.set(cacheKey, content)
      console.log('✓ Template loaded:', cacheKey)
      return content
    } catch (err) {
      throw new Error(`Failed to load component template "${cacheKey}": ${err.message}`)
    }
  }

  /**
   * Charge le schéma JSON d'un composant depuis components.json
   */
  async loadComponentSchema(componentName, category = 'content') {
    const schema = await this.loadComponentsSchema()

    // Chercher dans la bonne catégorie
    const categoryData = schema[category]
    if (!categoryData) {
      throw new Error(`Category "${category}" not found in components.json`)
    }

    const componentSchema = categoryData[componentName]
    if (!componentSchema) {
      throw new Error(`Component "${componentName}" not found in category "${category}"`)
    }

    return componentSchema
  }

  /**
   * Obtient la configuration Maizzle selon le mode
   */
  getMaizzleConfig(mode = 'preview') {
    if (mode === 'preview') {
      // Mode preview : rapide, pas d'optimisation
      return {
        ...baseConfig,
        inlineCSS: false,
        removeUnusedCSS: false,
        minify: false,
        prettify: true,
      }
    } else if (mode === 'export') {
      // Mode export : optimisé pour production
      return {
        ...baseConfig,
        inlineCSS: true,
        removeUnusedCSS: true,
        minify: true,
        prettify: false,
      }
    }

    throw new Error(`Unknown render mode: ${mode}`)
  }

  /**
   * Rend un template Maizzle avec des props
   */
  async renderComponent(componentName, props = {}, mode = 'preview') {
    try {
      // Charger le template
      const template = await this.loadComponentTemplate(componentName)

      // Créer un layout wrapper minimal pour Maizzle
      const wrappedTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  ${template}
</body>
</html>
      `

      // Configuration Maizzle
      const config = this.getMaizzleConfig(mode)

      // Rendre avec Maizzle
      const { html } = await maizzleRender(wrappedTemplate, {
        ...config,
        props,
      })

      return html
    } catch (err) {
      console.error('Render error:', err)
      throw new Error(`Failed to render component "${componentName}": ${err.message}`)
    }
  }

  /**
   * Rend un email complet depuis son JSON (méthode principale)
   */
  async renderEmail(emailData, mode = 'preview', useCache = true) {
    const startTime = Date.now()

    // Vérifier le cache
    if (useCache) {
      const cacheKey = this.generateCacheKey(emailData, mode)
      const cached = this.getFromCache(cacheKey)
      if (cached) {
        console.log(`✓ Render from cache (${Date.now() - startTime}ms)`)
        return { html: cached, cached: true, renderTime: Date.now() - startTime }
      }
    }

    try {
      // Transformer JSON → Template Maizzle complet
      const { jsonToMaizzle } = await import('../utils/json-to-maizzle.js')
      const maizzleTemplate = await jsonToMaizzle(emailData, this)

      // Configuration Maizzle
      const config = this.getMaizzleConfig(mode)

      // Rendre avec Maizzle
      const { html } = await maizzleRender(maizzleTemplate, config)

      // Stocker dans le cache
      if (useCache) {
        const cacheKey = this.generateCacheKey(emailData, mode)
        this.storeInCache(cacheKey, html)
      }

      const renderTime = Date.now() - startTime
      console.log(`✓ Email rendered (${renderTime}ms, mode: ${mode})`)

      return { html, cached: false, renderTime }
    } catch (err) {
      console.error('Email render error:', err)
      throw new Error(`Failed to render email: ${err.message}`)
    }
  }

  /**
   * Vide le cache (utile pour le dev)
   */
  clearCache() {
    const count = this.cache.size
    this.cache.clear()
    this.templateCache.clear()
    console.log(`✓ Cache cleared (${count} entries)`)
    return { cleared: count }
  }

  /**
   * Obtient les statistiques du cache
   */
  getCacheStats() {
    const entries = Array.from(this.cache.entries())
    const validEntries = entries.filter(([_, entry]) => this.isCacheValid(entry))
    const expiredEntries = entries.length - validEntries.length

    return {
      total: entries.length,
      valid: validEntries.length,
      expired: expiredEntries,
      templates: this.templateCache.size,
      ttl: this.cacheTTL,
    }
  }

  /**
   * Liste tous les composants disponibles depuis components.json
   */
  async listComponents() {
    try {
      const schema = await this.loadComponentsSchema()
      const components = []

      // Parcourir toutes les catégories (sections, content, custom)
      for (const [categoryName, categoryComponents] of Object.entries(schema)) {
        // Ignorer la catégorie "columns" qui n'est pas un composant draggable
        if (categoryName === 'columns') continue

        for (const [componentName, componentData] of Object.entries(categoryComponents)) {
          components.push({
            name: componentData.name,
            label: componentData.label,
            category: componentData.category,
            icon: componentData.icon || '📦',
            description: componentData.description || '',
            columnCount: componentData.columnCount || 0, // Pour les sections
          })
        }
      }

      return components
    } catch (err) {
      throw new Error(`Failed to list components: ${err.message}`)
    }
  }

  /**
   * Liste les composants d'une catégorie spécifique
   */
  async listComponentsByCategory(category) {
    try {
      const schema = await this.loadComponentsSchema()
      const categoryData = schema[category]

      if (!categoryData) {
        throw new Error(`Category "${category}" not found`)
      }

      const components = []
      for (const [componentName, componentData] of Object.entries(categoryData)) {
        components.push({
          name: componentData.name,
          label: componentData.label,
          category: componentData.category,
          icon: componentData.icon || '📦',
          description: componentData.description || '',
          columnCount: componentData.columnCount || 0,
          columnWidths: componentData.columnWidths || [],
        })
      }

      return components
    } catch (err) {
      throw new Error(`Failed to list components for category "${category}": ${err.message}`)
    }
  }
}

// Export singleton instance
const instance = new MaizzleRenderService()
export default instance
