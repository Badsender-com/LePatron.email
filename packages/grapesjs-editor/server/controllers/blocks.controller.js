'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Get standard blocks from JSON configuration
 */
exports.getStandardBlocks = async (req, res) => {
  try {
    const blocksPath = path.join(__dirname, '../config/standard-blocks.json');
    const blocksData = fs.readFileSync(blocksPath, 'utf8');
    const { blocks } = JSON.parse(blocksData);

    res.json({
      success: true,
      blocks,
    });
  } catch (error) {
    console.error('Error loading standard blocks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load standard blocks',
      message: error.message,
    });
  }
};

/**
 * Get custom blocks for a specific template
 */
exports.getCustomBlocks = async (req, res) => {
  try {
    const { templateId } = req.params;
    const mongoose = require('mongoose');
    const Mailing = mongoose.model('Mailing');

    const mailing = await Mailing.findById(templateId);

    if (!mailing) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    const customBlocks = mailing.grapesjs_data?.customBlocks || [];

    res.json({
      success: true,
      blocks: customBlocks,
    });
  } catch (error) {
    console.error('Error loading custom blocks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load custom blocks',
      message: error.message,
    });
  }
};
