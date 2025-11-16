'use strict';

const { Mailings } = require('../../../server/common/models.common.js');

/**
 * Save GrapesJS template data
 */
exports.saveTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { grapesjs_data, brand } = req.body;

    const mailing = await Mailings.findById(id);

    if (!mailing) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    // Ensure this is a GrapesJS template
    if (mailing.editor_type !== 'grapesjs') {
      return res.status(400).json({
        success: false,
        error: 'This template is not a GrapesJS template',
      });
    }

    // Update GrapesJS data
    mailing.grapesjs_data = grapesjs_data;

    if (brand) {
      mailing.brand = brand;
    }

    mailing.updatedAt = new Date();
    await mailing.save();

    res.json({
      success: true,
      message: 'Template saved successfully',
      updatedAt: mailing.updatedAt,
    });
  } catch (error) {
    console.error('Error saving template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save template',
      message: error.message,
    });
  }
};

/**
 * Load GrapesJS template data
 */
exports.loadTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const mailing = await Mailings.findById(id);

    if (!mailing) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    // Ensure this is a GrapesJS template
    if (mailing.editor_type !== 'grapesjs') {
      return res.status(400).json({
        success: false,
        error: 'This template is not a GrapesJS template',
      });
    }

    res.json({
      success: true,
      grapesjs_data: mailing.grapesjs_data || {
        components: [],
        styles: [],
        assets: [],
        customBlocks: [],
        pages: [],
      },
      brand: mailing.brand || 'badsender',
      name: mailing.name,
      updatedAt: mailing.updatedAt,
    });
  } catch (error) {
    console.error('Error loading template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load template',
      message: error.message,
    });
  }
};

/**
 * Export template to HTML (placeholder for now)
 */
exports.exportTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const mailing = await Mailings.findById(id);

    if (!mailing) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    // TODO: Implement HTML export with inline CSS using juice
    // For now, return a placeholder
    res.json({
      success: true,
      message: 'Export functionality will be implemented in Phase 3',
      html: '<!-- HTML export coming soon -->',
    });
  } catch (error) {
    console.error('Error exporting template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export template',
      message: error.message,
    });
  }
};

/**
 * Preview template (placeholder for now)
 */
exports.previewTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const mailing = await Mailings.findById(id);

    if (!mailing) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    // TODO: Implement preview with variable substitution
    res.json({
      success: true,
      message: 'Preview functionality will be implemented in Phase 3',
      html: '<!-- Preview coming soon -->',
    });
  } catch (error) {
    console.error('Error previewing template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to preview template',
      message: error.message,
    });
  }
};
