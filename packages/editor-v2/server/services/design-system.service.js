const path = require('path')
const fs = require('fs')

class DesignSystemService {
  constructor() {
    this.cache = new Map()
  }

  /**
   * Charge un Design System par son ID
   * @param {string} designSystemId - ID du Design System (ex: 'demo')
   * @returns {object} Configuration du Design System avec tokens résolus
   */
  load(designSystemId) {
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

      // Charger la config
      // Note: supprimer le cache de require pour permettre le hot reload en dev
      delete require.cache[require.resolve(configPath)]
      const config = require(configPath)

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
   * Résout les références de tokens {{tokens.xxx.yyy}} dans componentDefaults
   * @param {object} config - Configuration brute du Design System
   * @returns {object} Configuration avec tokens résolus
   */
  resolveTokens(config) {
    // Deep clone pour ne pas modifier l'original
    const resolved = JSON.parse(JSON.stringify(config))

    // Résoudre componentDefaults
    if (resolved.componentDefaults) {
      Object.keys(resolved.componentDefaults).forEach((componentName) => {
        Object.keys(resolved.componentDefaults[componentName]).forEach((propName) => {
          const value = resolved.componentDefaults[componentName][propName]

          if (typeof value === 'string' && value.includes('{{tokens')) {
            // Ex: "{{tokens.colors.primary}}" → "#007bff"
            const match = value.match(/{{tokens\.(.*?)}}/)
            if (match) {
              const tokenPath = match[1] // "colors.primary"
              const resolvedValue = this.getNestedValue(config.tokens, tokenPath)

              if (resolvedValue !== undefined) {
                resolved.componentDefaults[componentName][propName] = resolvedValue
              } else {
                console.warn(
                  `⚠️  Token not found: {{tokens.${tokenPath}}} in ${componentName}.${propName}`
                )
              }
            }
          }
        })
      })
    }

    return resolved
  }

  /**
   * Récupère une valeur imbriquée dans un objet via un chemin
   * @param {object} obj - Objet à parcourir
   * @param {string} path - Chemin pointé (ex: "colors.primary")
   * @returns {*} Valeur trouvée ou undefined
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((acc, part) => acc?.[part], obj)
  }

  /**
   * Liste tous les Design Systems disponibles
   * @returns {Array<object>} Liste des Design Systems
   */
  list() {
    const designSystemsDir = path.join(__dirname, '../../design-systems')

    try {
      const dirs = fs.readdirSync(designSystemsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)

      return dirs.map(dirName => {
        try {
          const ds = this.load(dirName)
          return {
            id: ds.id,
            name: ds.name,
            version: ds.version,
          }
        } catch (error) {
          console.warn(`⚠️  Could not load Design System '${dirName}':`, error.message)
          return null
        }
      }).filter(Boolean)
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
module.exports = new DesignSystemService()
