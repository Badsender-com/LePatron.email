import express from 'express'
import maizzleRenderService from '../services/maizzle-render.service.js'

const router = express.Router()

/**
 * POST /v2/render/preview
 * Rendu rapide pour preview dans l'éditeur (pas d'optimisation)
 *
 * Body: {
 *   metadata: { title, subject, preheader, designSystemId },
 *   blocks: [{ id, component, props }]
 * }
 */
router.post('/preview', async (req, res) => {
  try {
    const emailData = req.body;

    // Validation basique
    if (!emailData || !emailData.blocks || !Array.isArray(emailData.blocks)) {
      return res.status(400).json({
        error: 'Invalid email data',
        message: 'Body must contain a "blocks" array',
      });
    }

    // Rendre en mode preview avec cache
    const result = await maizzleRenderService.renderEmail(emailData, 'preview', true);

    res.json({
      success: true,
      html: result.html,
      cached: result.cached,
      renderTime: result.renderTime,
      mode: 'preview',
    });
  } catch (err) {
    console.error('Preview render error:', err);
    res.status(500).json({
      error: 'Render failed',
      message: err.message,
    });
  }
});

/**
 * POST /v2/render/export
 * Rendu optimisé pour export HTML final (inline CSS, minification)
 *
 * Body: {
 *   metadata: { title, subject, preheader, designSystemId },
 *   blocks: [{ id, component, props }]
 * }
 */
router.post('/export', async (req, res) => {
  try {
    const emailData = req.body;

    // Validation basique
    if (!emailData || !emailData.blocks || !Array.isArray(emailData.blocks)) {
      return res.status(400).json({
        error: 'Invalid email data',
        message: 'Body must contain a "blocks" array',
      });
    }

    // Rendre en mode export (optimisé, sans cache car c'est un export final)
    const result = await maizzleRenderService.renderEmail(emailData, 'export', false);

    res.json({
      success: true,
      html: result.html,
      renderTime: result.renderTime,
      mode: 'export',
      optimizations: {
        inlineCSS: true,
        removeUnusedCSS: true,
        minify: true,
      },
    });
  } catch (err) {
    console.error('Export render error:', err);
    res.status(500).json({
      error: 'Export failed',
      message: err.message,
    });
  }
});

/**
 * POST /v2/render/component
 * Rend un seul composant (utile pour preview individuel)
 *
 * Body: {
 *   component: string,
 *   props: object,
 *   mode: 'preview' | 'export'
 * }
 */
router.post('/component', async (req, res) => {
  try {
    const { component, props = {}, mode = 'preview' } = req.body;

    if (!component) {
      return res.status(400).json({
        error: 'Missing component',
        message: 'Body must contain a "component" field',
      });
    }

    const html = await maizzleRenderService.renderComponent(component, props, mode);

    res.json({
      success: true,
      html,
      component,
      mode,
    });
  } catch (err) {
    console.error('Component render error:', err);
    res.status(500).json({
      error: 'Component render failed',
      message: err.message,
    });
  }
});

/**
 * GET /v2/render/status
 * Retourne les statistiques du cache
 */
router.get('/status', (req, res) => {
  try {
    const stats = maizzleRenderService.getCacheStats();

    res.json({
      success: true,
      cache: stats,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  } catch (err) {
    console.error('Status error:', err);
    res.status(500).json({
      error: 'Failed to get status',
      message: err.message,
    });
  }
});

/**
 * DELETE /v2/render/cache
 * Vide le cache (utile pour le dev)
 */
router.delete('/cache', (req, res) => {
  try {
    const result = maizzleRenderService.clearCache();

    res.json({
      success: true,
      message: 'Cache cleared',
      ...result,
    });
  } catch (err) {
    console.error('Clear cache error:', err);
    res.status(500).json({
      error: 'Failed to clear cache',
      message: err.message,
    });
  }
});

export default router
