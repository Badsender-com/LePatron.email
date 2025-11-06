import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { pathToFileURL } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

class DesignSystemService {
  constructor() {
    this.cache = new Map()
  }

  /**
   * Charge un Design System par son ID
   * @param {string} designSystemId - ID du Design System (ex: 'demo')
   * @returns {object} Configuration du Design System avec tokens résolus
   */
  async load(designSystemId) {
    // Cache check
    if (this.cache.has(designSystemId)) {
      console.log(`✅ Design System '${designSystemId}' loaded from cache`)
      return this.cache.get(designSystemId)
    }

    try {
      const configPath = path.join(
        __dirname,
        '../../design-systems',
        designSystemId,
        'design-system.config.js'
      )

      // Vérifier que le fichier existe
      if (!fs.existsSync(configPath)) {
        throw new Error(`Design System '${designSystemId}' not found at ${configPath}`)
      }

      // Charger la config avec import dynamique
      // Ajouter un timestamp pour éviter le cache en dev
      const configUrl = pathToFileURL(configPath).href + '?t=' + Date.now()
      const module = await import(configUrl)
      const config = module.default

      // Résoudre les templates de tokens ({{tokens.colors.primary}})
      const resolved = this.resolveTokens(config)

      // Mettre en cache
      this.cache.set(designSystemId, resolved)

      console.log(`✅ Design System '${designSystemId}' loaded successfully`)
      return resolved
    } catch (error) {
      console.error(`❌ Error loading Design System '${designSystemId}':`, error.message)
      throw error
    }
  }

  /**
   * Résout les références de tokens dans componentDefaults
   * Exemple : backgroundColor: '{{tokens.colors.primary}}' -> backgroundColor: '#007bff'
   */
  resolveTokens(config) {
    // Clone pour ne pas modifier l'original
    const resolved = JSON.parse(JSON.stringify(config))

    // Résoudre les tokens dans componentDefaults
    if (config.componentDefaults) {
      Object.keys(resolved.componentDefaults).forEach((componentName) => {
        Object.keys(resolved.componentDefaults[componentName]).forEach((propName) => {
          const value = resolved.componentDefaults[componentName][propName]

          if (typeof value === 'string' && value.includes('{{tokens')) {
            // Extraire le chemin du token
            const match = value.match(/{{tokens\.(.*?)}}/)
            if (match) {
              const tokenPath = match[1]
              const resolvedValue = this.getNestedValue(config.tokens, tokenPath)

              if (resolvedValue !== undefined) {
                resolved.componentDefaults[componentName][propName] = resolvedValue
              }
            }
          }
        })
      })
    }

    return resolved
  }

  /**
   * Récupère une valeur imbriquée dans un objet par chemin
   * Exemple: getNestedValue({colors: {primary: '#007bff'}}, 'colors.primary') -> '#007bff'
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined
    }, obj)
  }

  /**
   * Liste tous les Design Systems disponibles
   * @returns {Array<object>} Liste des Design Systems
   */
  async list() {
    const designSystemsDir = path.join(__dirname, '../../design-systems')

    try {
      const dirs = fs.readdirSync(designSystemsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)

      const results = await Promise.all(dirs.map(async (dirName) => {
        try {
          const ds = await this.load(dirName)
          return {
            id: ds.id,
            name: ds.name,
            version: ds.version,
          }
        } catch (error) {
          console.warn(`⚠️  Could not load Design System '${dirName}':`, error.message)
          return null
        }
      }))

      return results.filter(Boolean)
    } catch (error) {
      console.error('❌ Error listing Design Systems:', error.message)
      return []
    }
  }

  /**
   * Vide le cache (utile en développement)
   */
  clearCache() {
    this.cache.clear()
    console.log('🗑️  Design System cache cleared')
  }
}

// Export singleton
export default new DesignSystemService()
