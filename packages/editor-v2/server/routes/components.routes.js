import express from 'express'
import maizzleRenderService from '../services/maizzle-render.service.js'

const router = express.Router()

/**
 * GET /v2/components
 * Liste tous les composants disponibles
 */
router.get('/', async (req, res) => {
  try {
    const components = await maizzleRenderService.listComponents();

    res.json({
      success: true,
      components,
      count: components.length,
    });
  } catch (err) {
    console.error('List components error:', err);
    res.status(500).json({
      error: 'Failed to list components',
      message: err.message,
    });
  }
});

/**
 * GET /v2/components/schema/:name
 * Récupère uniquement le schéma d'un composant/section/colonne
 */
router.get('/schema/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const category = req.query.category || 'content';

    // Special case for columns
    if (name === 'columns') {
      const componentsSchema = await maizzleRenderService.loadComponentsSchema();
      const columnSchema = componentsSchema.columns;

      res.json({
        success: true,
        component: {
          name: 'columns',
          category: 'columns',
          schema: columnSchema,
        },
      });
      return;
    }

    // Load regular component schema
    const schema = await maizzleRenderService.loadComponentSchema(name, category);

    res.json({
      success: true,
      component: {
        name,
        category,
        schema,
      },
    });
  } catch (err) {
    console.error('Get component schema error:', err);
    res.status(404).json({
      error: 'Component schema not found',
      message: err.message,
    });
  }
});

/**
 * GET /v2/components/:name
 * Récupère les détails d'un composant (schéma + template source)
 */
router.get('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const category = req.query.category || 'core';

    // Charger schéma et template
    const schema = await maizzleRenderService.loadComponentSchema(name, category);
    const template = await maizzleRenderService.loadComponentTemplate(name, category);

    res.json({
      success: true,
      component: {
        name,
        category,
        schema,
        template,
      },
    });
  } catch (err) {
    console.error('Get component error:', err);
    res.status(404).json({
      error: 'Component not found',
      message: err.message,
    });
  }
});

export default router
