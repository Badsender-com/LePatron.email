const { Maizzle } = require('@maizzle/framework');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Service de rendu Maizzle avec cache pour performance
 * Singleton pattern pour partager le cache entre requêtes
 */
class MaizzleRenderService {
  constructor() {
    if (MaizzleRenderService.instance) {
      return MaizzleRenderService.instance;
    }

    // Cache: Map<cacheKey, {html, timestamp}>
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes en ms

    // Templates cache: Map<componentName, templateContent>
    this.templateCache = new Map();

    MaizzleRenderService.instance = this;
  }

  /**
   * Génère une clé de cache unique basée sur le contenu
   */
  generateCacheKey(emailData, mode) {
    const content = JSON.stringify({ emailData, mode });
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Vérifie si une entrée de cache est valide
   */
  isCacheValid(cacheEntry) {
    if (!cacheEntry) return false;
    const age = Date.now() - cacheEntry.timestamp;
    return age < this.cacheTTL;
  }

  /**
   * Récupère depuis le cache si valide
   */
  getFromCache(cacheKey) {
    const entry = this.cache.get(cacheKey);
    if (this.isCacheValid(entry)) {
      console.log('✓ Cache hit:', cacheKey);
      return entry.html;
    }
    if (entry) {
      this.cache.delete(cacheKey); // Nettoyer entrée expirée
    }
    return null;
  }

  /**
   * Stocke dans le cache
   */
  storeInCache(cacheKey, html) {
    this.cache.set(cacheKey, {
      html,
      timestamp: Date.now(),
    });
    console.log('✓ Cache stored:', cacheKey);
  }

  /**
   * Charge un template de composant depuis le disque (avec cache)
   */
  async loadComponentTemplate(componentName, category = 'core') {
    const cacheKey = `${category}/${componentName}`;

    // Vérifier le cache de templates
    if (this.templateCache.has(cacheKey)) {
      return this.templateCache.get(cacheKey);
    }

    // Charger depuis le disque
    const templatePath = path.join(
      __dirname,
      '../../components',
      category,
      componentName,
      `${componentName}.maizzle.html`
    );

    try {
      const content = await fs.readFile(templatePath, 'utf8');
      this.templateCache.set(cacheKey, content);
      console.log('✓ Template loaded:', cacheKey);
      return content;
    } catch (err) {
      throw new Error(`Failed to load component template "${cacheKey}": ${err.message}`);
    }
  }

  /**
   * Charge le schéma JSON d'un composant
   */
  async loadComponentSchema(componentName, category = 'core') {
    const schemaPath = path.join(
      __dirname,
      '../../components',
      category,
      componentName,
      `${componentName}.schema.json`
    );

    try {
      const content = await fs.readFile(schemaPath, 'utf8');
      return JSON.parse(content);
    } catch (err) {
      throw new Error(`Failed to load component schema "${componentName}": ${err.message}`);
    }
  }

  /**
   * Obtient la configuration Maizzle selon le mode
   */
  getMaizzleConfig(mode = 'preview') {
    const baseConfig = require('../../config.js');

    if (mode === 'preview') {
      // Mode preview : rapide, pas d'optimisation
      return {
        ...baseConfig,
        inlineCSS: false,
        removeUnusedCSS: false,
        minify: false,
        prettify: true,
      };
    } else if (mode === 'export') {
      // Mode export : optimisé pour production
      return {
        ...baseConfig,
        inlineCSS: true,
        removeUnusedCSS: true,
        minify: true,
        prettify: false,
      };
    }

    throw new Error(`Unknown render mode: ${mode}`);
  }

  /**
   * Rend un template Maizzle avec des props
   */
  async renderComponent(componentName, props = {}, mode = 'preview') {
    try {
      // Charger le template
      const template = await this.loadComponentTemplate(componentName);

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
      `;

      // Configuration Maizzle
      const config = this.getMaizzleConfig(mode);

      // Rendre avec Maizzle
      const { html } = await Maizzle.render(wrappedTemplate, {
        ...config,
        props,
      });

      return html;
    } catch (err) {
      console.error('Render error:', err);
      throw new Error(`Failed to render component "${componentName}": ${err.message}`);
    }
  }

  /**
   * Rend un email complet depuis son JSON (méthode principale)
   */
  async renderEmail(emailData, mode = 'preview', useCache = true) {
    const startTime = Date.now();

    // Vérifier le cache
    if (useCache) {
      const cacheKey = this.generateCacheKey(emailData, mode);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        console.log(`✓ Render from cache (${Date.now() - startTime}ms)`);
        return { html: cached, cached: true, renderTime: Date.now() - startTime };
      }
    }

    try {
      // Transformer JSON → Template Maizzle complet
      const { jsonToMaizzle } = require('../utils/json-to-maizzle');
      const maizzleTemplate = await jsonToMaizzle(emailData, this);

      // Configuration Maizzle
      const config = this.getMaizzleConfig(mode);

      // Rendre avec Maizzle
      const { html } = await Maizzle.render(maizzleTemplate, config);

      // Stocker dans le cache
      if (useCache) {
        const cacheKey = this.generateCacheKey(emailData, mode);
        this.storeInCache(cacheKey, html);
      }

      const renderTime = Date.now() - startTime;
      console.log(`✓ Email rendered (${renderTime}ms, mode: ${mode})`);

      return { html, cached: false, renderTime };
    } catch (err) {
      console.error('Email render error:', err);
      throw new Error(`Failed to render email: ${err.message}`);
    }
  }

  /**
   * Vide le cache (utile pour le dev)
   */
  clearCache() {
    const count = this.cache.size;
    this.cache.clear();
    this.templateCache.clear();
    console.log(`✓ Cache cleared (${count} entries)`);
    return { cleared: count };
  }

  /**
   * Obtient les statistiques du cache
   */
  getCacheStats() {
    const entries = Array.from(this.cache.entries());
    const validEntries = entries.filter(([_, entry]) => this.isCacheValid(entry));
    const expiredEntries = entries.length - validEntries.length;

    return {
      total: entries.length,
      valid: validEntries.length,
      expired: expiredEntries,
      templates: this.templateCache.size,
      ttl: this.cacheTTL,
    };
  }

  /**
   * Liste tous les composants disponibles
   */
  async listComponents() {
    const componentsDir = path.join(__dirname, '../../components/core');
    try {
      const dirs = await fs.readdir(componentsDir, { withFileTypes: true });
      const components = [];

      for (const dir of dirs) {
        if (dir.isDirectory()) {
          try {
            const schema = await this.loadComponentSchema(dir.name, 'core');
            components.push({
              name: schema.name,
              label: schema.label,
              category: schema.category,
              icon: schema.icon,
              description: schema.description || '',
            });
          } catch (err) {
            console.warn(`Could not load schema for ${dir.name}:`, err.message);
          }
        }
      }

      return components;
    } catch (err) {
      throw new Error(`Failed to list components: ${err.message}`);
    }
  }
}

// Export singleton instance
const instance = new MaizzleRenderService();
module.exports = instance;
