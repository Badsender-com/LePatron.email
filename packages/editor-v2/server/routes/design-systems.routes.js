const express = require('express')
const router = express.Router()
const designSystemService = require('../services/design-system.service')

/**
 * GET /api/v2/design-systems
 * Liste tous les Design Systems disponibles
 */
router.get('/', (req, res) => {
  try {
    const designSystems = designSystemService.list()

    res.json({
      success: true,
      count: designSystems.length,
      designSystems,
    })
  } catch (error) {
    console.error('Error listing Design Systems:', error)
    res.status(500).json({
      error: 'Failed to list Design Systems',
      message: error.message,
    })
  }
})

/**
 * GET /api/v2/design-systems/:id
 * Charge un Design System par son ID
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params
    const designSystem = designSystemService.load(id)

    res.json({
      success: true,
      designSystem,
    })
  } catch (error) {
    console.error(`Error loading Design System '${req.params.id}':`, error)

    // 404 si Design System non trouvé
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Design System not found',
        message: error.message,
        availableDesignSystems: designSystemService.list(),
      })
    }

    // 500 pour autres erreurs
    res.status(500).json({
      error: 'Failed to load Design System',
      message: error.message,
    })
  }
})

/**
 * DELETE /api/v2/design-systems/cache
 * Vide le cache des Design Systems (développement)
 */
router.delete('/cache', (req, res) => {
  try {
    designSystemService.clearCache()

    res.json({
      success: true,
      message: 'Design System cache cleared',
    })
  } catch (error) {
    console.error('Error clearing cache:', error)
    res.status(500).json({
      error: 'Failed to clear cache',
      message: error.message,
    })
  }
})

module.exports = router
